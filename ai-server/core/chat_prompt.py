"""Prompt construction for the Give policy assistant."""

import re
from typing import Any, Iterable
from urllib.parse import quote


# Kept for compatibility with older imports. It is intentionally not emitted
# as a generic fallback URL because it is not tied to a specific policy.
GOV24_POLICY_URL = "https://www.gov.kr/portal/rcvfvrSvc/main"
GOV24_SEARCH_URL = "https://www.gov.kr/search"
_URL_PATTERN = re.compile(r"(?:https?://|www\.)[^\s<>\"')]+", re.IGNORECASE)


def _text(value: Any) -> str:
    return " ".join(str(value or "").split())


def extract_urls(*values: Any) -> list[str]:
    """Return unique, display-safe URLs found in policy text fields."""
    urls: list[str] = []
    for value in values:
        for match in _URL_PATTERN.findall(str(value or "")):
            url = match.rstrip(".,;:!?)]}")
            if url and url not in urls:
                urls.append(url)
    return urls


def _normalized_url(value: Any) -> str:
    return str(value or "").strip().rstrip(".,;:!?)]}").lower()


def _policy_urls(policies: Iterable[dict[str, Any]]) -> list[str]:
    """Return a policy-specific official URL, with a title-scoped fallback."""
    urls: list[str] = []
    for policy in policies:
        policy_urls: list[str] = []
        for key in ("official_url", "application_url"):
            for url in extract_urls(policy.get(key)):
                if url and url not in policy_urls:
                    policy_urls.append(url)
        if not policy_urls and _text(policy.get("policy_name")):
            # Some legacy/manual rows have no API detail URL. A Government24
            # search scoped to that exact title is still useful and avoids the
            # misleading generic directory link used by the old chatbot.
            fallback = f"{GOV24_SEARCH_URL}?srchTxt={quote(_text(policy.get('policy_name')))}"
            policy_urls.append(fallback)
        for url in policy_urls:
            if url not in urls:
                urls.append(url)
    return urls


def _normalize_policy_name(value: Any) -> str:
    """Normalize a policy title for exact, punctuation-insensitive matching."""
    return re.sub(r"[^0-9a-z가-힣]+", "", str(value or "").lower())


def _select_policy_for_link(
    policies: list[dict[str, Any]],
    answer: str,
    user_message: str,
) -> dict[str, Any] | None:
    """Choose the policy whose URL may be shown in the final answer.

    The RAG result can contain several related policies. Prefer an exact
    policy-title mention in the answer or question; when the model does not
    repeat a title, the first RAG result is the best-ranked policy and is used
    as the deterministic fallback. URLs are historical policy references too,
    so an expired application does not make the policy URL invalid.
    """
    if not policies:
        return None

    normalized_answer = _normalize_policy_name(answer)
    normalized_message = _normalize_policy_name(user_message)

    answer_matches = []
    message_matches = []
    for index, policy in enumerate(policies):
        title = _normalize_policy_name(policy.get("policy_name"))
        if not title:
            continue
        if title in normalized_answer:
            answer_matches.append((len(title), index, policy))
        if title in normalized_message:
            message_matches.append((len(title), index, policy))

    if answer_matches:
        return max(answer_matches, key=lambda item: (item[0], -item[1]))[2]
    if message_matches:
        return max(message_matches, key=lambda item: (item[0], -item[1]))[2]
    return policies[0]


def _strip_untrusted_urls(answer: str, allowed_urls: Iterable[str]) -> str:
    allowed = {_normalized_url(url) for url in allowed_urls}
    answer_urls = extract_urls(answer)
    if not answer_urls:
        return answer

    cleaned = re.sub(
        r"\[([^\]\n]+)\]\(((?:https?://|www\.)[^\s)]+)\)",
        lambda match: match.group(0) if _normalized_url(match.group(2)) in allowed else match.group(1),
        answer,
        flags=re.IGNORECASE,
    )
    cleaned = _URL_PATTERN.sub(
        lambda match: match.group(0) if _normalized_url(match.group(0)) in allowed else "",
        cleaned,
    )
    return re.sub(r"[ \t]{2,}", " ", cleaned).strip()


def build_policy_context(policies: Iterable[dict[str, Any]]) -> str:
    """Build a small factual RAG block without asking the model to infer links."""
    policy_blocks = []
    for policy in policies:
        name = _text(policy.get("policy_name"))
        if not name:
            continue

        lines = [f"- 정책명: {name}"]
        fields = (
            ("정책 요약", policy.get("summary")),
            ("담당기관", policy.get("agency")),
            ("지원대상", policy.get("target_criteria")),
            ("지원내용", policy.get("support_detail")),
            ("신청기간", policy.get("application_period")),
            ("대상 지역", policy.get("region")),
            ("기준일", policy.get("source_updated_at")),
        )
        for label, value in fields:
            field_text = _text(value)
            if field_text:
                lines.append(f"  {label}: {field_text}")

        urls = _policy_urls([policy])
        for url in urls[:2]:
            lines.append(f"  공식 확인 링크: {url}")

        policy_blocks.append("\n".join(lines))

    return "\n\n".join(policy_blocks) if policy_blocks else "검색된 정책 없음"


def ensure_policy_link(answer: str, policies: Iterable[dict[str, Any]], user_message: str) -> str:
    """Keep only the URL belonging to the policy actually being discussed."""
    if not answer.strip():
        return answer

    technical_terms = (
        "qr", "큐알", "보관함", "수령", "나눔", "인증", "토큰", "비밀번호",
        "앱", "로그인", "오류", "네트워크", "카메라", "게시글",
    )
    if any(term in user_message.lower() for term in technical_terms):
        return _strip_untrusted_urls(answer, [])

    policy_list = list(policies)
    primary_policy = _select_policy_for_link(policy_list, answer, user_message)
    primary_urls = _policy_urls([primary_policy])
    cleaned_answer = _strip_untrusted_urls(answer, [])
    if not primary_urls:
        return cleaned_answer
    return f"{cleaned_answer.rstrip()}\n공식 확인 링크: {primary_urls[0]}"


def build_system_prompt(policy_context: str, has_history: bool) -> str:
    conversation_note = (
        "이전 대화가 있으므로, 이전 질문에서 확정된 정책명과 사용자의 상황을 자연스럽게 이어서 답하세요."
        if has_history
        else "첫 질문입니다. 정책명이 없더라도 사용자의 질문을 무시하지 말고, 필요한 정보만 한두 가지 물어보세요."
    )

    return f"""
너는 Give의 정책·나눔 안내 도우미 '나눔이'다. 따뜻하고 존중하는 한국어로 답하되,
확인 가능한 사실과 추측을 분명히 구분한다. 유아체나 과한 인사말은 사용하지 않는다.

[대화 문맥]
{conversation_note}

[검증된 검색 정책 정보 - 이 블록 밖의 정책 사실을 만들지 마세요]
{policy_context}
[끝]

[답변 원칙]
1. 첫 문장에서 사용자의 핵심 질문에 바로 답한다.
2. 정책의 대상, 지원 내용, 서류, 마감일, 금액, 담당 기관은 검증된 검색 정책 정보에 있는 내용만 말한다.
3. 정보가 없으면 모른다고 분명히 말하고, 지역·연령대·가구 상황·정책명 중 꼭 필요한 정보만 최대 두 가지 질문한다. 사실처럼 추측하지 않는다.
4. 최종 선정 여부는 담당 기관이 판단한다. '가능성이 있습니다', '확인이 필요합니다'처럼 신중하게 표현한다.
5. 간단한 질문은 2~3문장으로 답한다. 정책 조건·신청 절차를 설명할 때는 4~7개의 짧은 문장으로 충분히 안내한다.
6. 답변은 실행할 다음 행동을 포함한다. 단순히 '찾아보세요'라고 끝내지 말고, 무엇을 확인하거나 누구에게 어떤 내용을 문의해야 하는지 말한다.
7. 정책에 기준일·신청기간·지역이 제공되면 반드시 함께 안내한다. 제공되지 않은 값은 추측하지 않는다.

[링크 원칙]
1. 답변에서 특정 정책을 설명할 때는 그 정책 블록에 속한 '공식 확인 링크'만 마지막에 정확히 한 개를 포함한다.
공식 확인 링크: https://example.com
2. 신청 URL이 있더라도 다른 정책의 URL과 섞지 말고, 현재 설명하는 정책에 속한 주소만 사용한다.
3. 제공된 링크를 바꾸거나 새 링크를 지어내지 않는다.
4. 여러 정책이 검색됐고 답변에 정책명이 없으면 검색 결과 첫 번째 정책의 공식 URL을 사용한다.
5. 정책 블록에 직접 상세 URL이 없으면 해당 정책명으로 좁힌 정부24 검색 링크를 사용한다. 공통 정책 목록 주소는 사용하지 않는다.
6. QR, 보관함, 수령 승인, 개인정보, 긴급상황 질문에는 정책 URL을 기계적으로 붙이지 않는다.

[신청 절차 출력 제한]
별도의 '신청 방법' 또는 '신청방법' 섹션을 만들지 않는다. 신청 절차의 상세 설명 대신 검증된 신청 링크가 있으면 링크만 안내한다.

[개인정보·안전]
1. 비밀번호, 인증번호, QR 비밀 토큰, 주민등록번호, 계좌번호, 카드번호, 진단서 사진을 요구하거나 노출하지 않는다.
2. Give에서는 수령 요청 후 게시자 수락과 안내된 절차가 완료되어야 물품을 받을 수 있다. 보관함을 열었다고 주장하거나 인증 정보를 알려주지 않는다.
3. 사기·선입금·인증정보 공유 요청에는 송금·공유를 멈추고 공식 기관의 대표번호나 공식 앱을 직접 확인하도록 안내한다.
4. 자해, 폭력, 학대, 즉각적인 위험은 정책 설명보다 112·119와 가까운 사람·긴급 지원기관 연락을 우선 안내한다.

[출력 형식]
마크다운 표와 장식용 기호를 쓰지 않는다. URL은 일반 텍스트 전체 주소로 그대로 쓴다.
""".strip()
