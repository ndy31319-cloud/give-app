import logging
import os
import re
from typing import Any

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from core.chat_text import remove_application_method_sections
from core.chat_prompt import ensure_policy_link
from routes.post_router import router as post_router


# -------------------------------------------------------------------
# 로깅 설정
# -------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

app = FastAPI(
    title="취약 계층 나눔 플랫폼",
    description="기부 물품 유해성 판별 및 취약계층 맞춤 정책 추천 API",
    version="1.0.0",
)

# -------------------------------------------------------------------
# CORS 설정 (배포 시 allow_origins를 실제 도메인으로 교체)
# -------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------------
# 라우터 등록
#
# [Step 1] POST /api/image/check-safety  → 다중 이미지 유해물 일괄 검사
#          POST /api/image               → 단일 이미지 빠른 판별
# [Step 2] POST /api/post/generate-post  → AI 기부글 자동 생성 (Gemini)
# [Step 3] POST /api/chat                → 챗봇 정책 추천 (RAG + Gemini)
# -------------------------------------------------------------------
app.include_router(post_router,  prefix="/api/post",  tags=["2. AI 기부글 생성 (Gemini)"])

# Keep post generation available while optional local ViT/chatbot packages are absent.
try:
    from routes.image_router import router as image_router
    app.include_router(image_router, prefix="/api/image", tags=["1. 이미지 판별 (ViT)"])
except Exception as error:
    logging.warning("Image safety router is unavailable: %s", error)

try:
    from routes.chat_router import router as chat_router
    app.include_router(chat_router, prefix="/api/chat", tags=["3. 챗봇 (RAG + Gemini)"])
except Exception as error:
    logging.warning("Chatbot router is unavailable: %s", error)

    class LightweightChatRequest(BaseModel):
        user_message: str
        member_id: int | None = None
        user: dict[str, Any] | None = None
        policies: list[dict[str, Any]] = Field(default_factory=list)
        conversation_history: list[dict[str, Any]] = Field(default_factory=list)

    def _compact_text(value: Any, max_length: int = 700) -> str:
        text = re.sub(r"\s+", " ", str(value or "")).strip()
        if len(text) <= max_length:
            return text
        return f"{text[:max_length - 1].rstrip()}..."

    def _first_policy_value(policy: dict[str, Any], *keys: str, default: str = "") -> str:
        for key in keys:
            value = policy.get(key)
            if value is not None and str(value).strip():
                return _compact_text(value)
        return default

    def _normalize_for_match(value: Any) -> str:
        return re.sub(r"\s+", "", str(value or "").lower())

    def _extract_query_terms(message: str) -> list[str]:
        raw_terms = re.split(r"[\s,.;:!?()\[\]{}\"'“”‘’/\\|]+", message.lower())
        terms = [term.strip() for term in raw_terms if len(term.strip()) >= 2]
        compact_message = _normalize_for_match(message)
        welfare_terms = (
            "지원",
            "신청",
            "대상",
            "자격",
            "복지",
            "혜택",
            "생활비",
            "생계",
            "의료",
            "주거",
            "교육",
            "일자리",
            "청년",
            "노인",
            "장애",
            "아동",
            "한부모",
            "임산부",
            "긴급",
        )
        terms.extend(term for term in welfare_terms if term in compact_message)
        return list(dict.fromkeys(terms))

    def _policy_text(policy: dict[str, Any]) -> str:
        return " ".join(
            _first_policy_value(policy, key)
            for key in (
                "title",
                "policy_name",
                "category",
                "agency",
                "description",
                "summary",
                "targetCriteria",
                "target_criteria",
                "target",
                "support",
                "support_detail",
                "content",
                "aiSearchText",
                "ai_search_text",
                "officialUrl",
                "official_url",
                "applicationUrl",
                "application_url",
                "applicationPeriod",
                "application_period",
                "region",
            )
        ).lower()

    def _policy_title(policy: dict[str, Any]) -> str:
        return str(policy.get("title") or policy.get("policy_name") or "추천 정책").strip()

    def _pick_policies(message: str, policies: list[dict[str, Any]]) -> list[dict[str, Any]]:
        normalized_message = _normalize_for_match(message)
        terms = _extract_query_terms(message)

        scored = []
        for policy in policies:
            text = _normalize_for_match(_policy_text(policy))
            title = _normalize_for_match(_policy_title(policy))
            category = _normalize_for_match(policy.get("category"))
            score = 0
            if title and title in normalized_message:
                score += 40
            for term in terms:
                normalized_term = _normalize_for_match(term)
                if not normalized_term:
                    continue
                if normalized_term in title:
                    score += 8
                elif category and normalized_term in category:
                    score += 6
                elif normalized_term in text:
                    score += 3
            if score:
                scored.append((score, policy))

        if not scored:
            return policies[:5]

        scored.sort(key=lambda item: item[0], reverse=True)
        return [policy for _, policy in scored[:5]]

    def _fallback_answer(message: str, policies: list[dict[str, Any]]) -> str:
        if not policies:
            return (
                "현재 질문만으로는 바로 연결되는 정책을 좁히기 어렵습니다.\n"
                "생활비, 주거, 의료, 교육, 일자리처럼 필요한 지원 분야와 거주 지역, 가구 상황을 함께 알려주시면 더 정확하게 찾아볼게요.\n"
                "이미 알고 계신 정책명이 있다면 그 이름을 보내주시면 지원 대상과 지원 내용을 중심으로 정리해 드리겠습니다.\n"
                "정책명이 확인되면 해당 정책의 공식 안내 주소를 기준으로 안내해 드리겠습니다."
            )

        lines = ["질문 내용 기준으로는 아래 정책을 먼저 확인해 보시면 좋겠습니다."]
        for index, policy in enumerate(policies[:3], start=1):
            title = _policy_title(policy)
            agency = _first_policy_value(policy, "agency", default="담당 기관 확인 필요")
            target = _first_policy_value(
                policy,
                "targetCriteria",
                "target_criteria",
                "target",
                default="지원 대상은 세부 조건 확인이 필요합니다.",
            )
            support = _first_policy_value(
                policy,
                "support",
                "support_detail",
                "description",
                "summary",
                default="지원 내용은 담당 기관 안내 확인이 필요합니다.",
            )
            lines.append(
                f"{index}. {title}: 담당 기관은 {agency}입니다. 지원 대상은 {target}이고, 주요 지원 내용은 {support}입니다."
            )
            official_url = _first_policy_value(policy, "officialUrl", "official_url")
            application_url = _first_policy_value(policy, "applicationUrl", "application_url")
            if official_url:
                lines.append(f"공식 확인 링크: {official_url}")
            if application_url and application_url != official_url:
                lines.append(f"신청 링크: {application_url}")
        lines.append("정확한 가능 여부는 소득, 거주지, 가구 구성, 현재 위기 상황 같은 세부 조건에 따라 달라질 수 있습니다.")
        answer = ensure_policy_link("\n".join(lines), policies, message)
        return remove_application_method_sections(answer)

    def _format_user_context(user: dict[str, Any] | None) -> str:
        if not user:
            return "제공된 회원 정보 없음"
        entries = []
        for label, key in (
            ("회원번호", "member_id"),
            ("역할ID", "role_id"),
            ("거주동", "dong_name"),
            ("생년월일", "birthdate"),
        ):
            value = user.get(key)
            if value is not None and str(value).strip():
                entries.append(f"{label}: {_compact_text(value, 80)}")
        return ", ".join(entries) if entries else "제공된 회원 정보 없음"

    def _format_history_context(history: list[dict[str, Any]]) -> str:
        lines = []
        for item in history[-6:]:
            role = str(item.get("role") or item.get("sender") or "user").strip()
            content = _compact_text(
                item.get("message") or item.get("content") or item.get("text") or "",
                300,
            )
            if content:
                lines.append(f"- {role}: {content}")
        return "\n".join(lines) if lines else "이전 대화 없음"

    def _is_low_detail_answer(answer: str, policies: list[dict[str, Any]]) -> bool:
        normalized = re.sub(r"\s+", " ", answer or "").strip()
        if not normalized:
            return True
        if not policies:
            return len(normalized) < 80

        has_policy_detail = sum(
            marker in normalized
            for marker in ("지원 대상", "지원대상", "대상", "지원 내용", "지원내용", "신청", "확인", "담당")
        )
        looks_complete = normalized.endswith((".", "!", "?", "요", "다", "니다", "세요", ")"))
        return len(normalized) < 220 or has_policy_detail < 2 or not looks_complete

    async def _generate_lightweight_answer(
        message: str,
        policies: list[dict[str, Any]],
        user: dict[str, Any] | None,
        conversation_history: list[dict[str, Any]],
    ) -> str:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return _fallback_answer(message, policies)

        try:
            from google import genai
            from google.genai import types
        except ModuleNotFoundError:
            return _fallback_answer(message, policies)

        policy_context = "\n\n".join(
            f"- 정책명: {_policy_title(policy)}\n"
            f"  분야: {_first_policy_value(policy, 'category')}\n"
            f"  담당기관: {_first_policy_value(policy, 'agency')}\n"
            f"  요약: {_first_policy_value(policy, 'description', 'summary')}\n"
            f"  지원대상: {_first_policy_value(policy, 'targetCriteria', 'target_criteria', 'target')}\n"
            f"  지원내용: {_first_policy_value(policy, 'support', 'support_detail')}\n"
            f"  신청기간: {_first_policy_value(policy, 'applicationPeriod', 'application_period')}\n"
            f"  대상지역: {_first_policy_value(policy, 'region')}\n"
            f"  기준일: {_first_policy_value(policy, 'sourceUpdatedAt', 'source_updated_at')}\n"
            f"  공식 확인 링크: {_first_policy_value(policy, 'officialUrl', 'official_url')}\n"
            f"  신청 링크: {_first_policy_value(policy, 'applicationUrl', 'application_url')}\n"
            f"  상세/신청 참고: {_first_policy_value(policy, 'content', 'aiSearchText', 'ai_search_text')}"
            for policy in policies
        ) or "검색된 정책 없음"
        prompt = f"""
너는 취약계층 나눔/기부 플랫폼의 사회복지 정책 안내 챗봇 '나눔이'야.
아래 DB 정책 정보와 이전 대화만 근거로 한국어로 답해. 없는 금액, 서류, 마감일, 신청 URL은 지어내지 말고 "확인 필요"라고 말해.

[답변 품질 기준]
1. 너무 짧게 끝내지 말고 6~9문장 정도로 성의 있게 설명해.
2. 먼저 결론을 말하고, 가장 관련 있는 정책명과 추천 이유를 알려줘.
3. 지원대상, 지원내용, 주의할 점을 빠뜨리지 말아줘. 별도의 '신청 방법' 섹션이나 절차 설명은 만들지 말아줘.
4. 여러 정책이 있으면 최대 3개까지 비교해서 어떤 상황에 맞는지 설명해.
5. 질문이 모호하면 무작정 정책을 나열하지 말고, 확인해야 할 정보도 함께 물어봐.
6. 마크다운 표, 굵게 표시, 별표 기호는 쓰지 말고 일반 문장과 줄바꿈만 사용해.
7. 제공된 링크는 현재 설명하는 정책 블록에 속한 주소만 답변 마지막에 포함해.
8. 여러 정책을 나열하더라도 답변의 첫 번째 정책에 해당하는 공식 URL을 마지막에 포함해.

[회원 참고 정보]
{_format_user_context(user)}

[이전 대화]
{_format_history_context(conversation_history)}

[사용자 질문]
{message}

[관련 정책 정보]
{policy_context}
"""

        client = genai.Client(api_key=api_key)
        try:
            response = await run_in_threadpool(
                client.models.generate_content,
                model="gemini-2.5-flash",
                contents=[types.Part.from_text(text=prompt)],
                config=types.GenerateContentConfig(
                    temperature=0.45,
                    top_p=0.85,
                    max_output_tokens=900,
                ),
            )
        except Exception as error:
            logging.warning("Lightweight chatbot Gemini call failed: %s", error)
            return _fallback_answer(message, policies)

        answer = (response.text or "").strip()
        if _is_low_detail_answer(answer, policies):
            return _fallback_answer(message, policies)
        answer = ensure_policy_link(answer, policies, message)
        return remove_application_method_sections(answer)

    fallback_chat_router = APIRouter()

    @fallback_chat_router.post("/")
    async def lightweight_chat(request: LightweightChatRequest):
        message = request.user_message.strip()
        if not message:
            raise HTTPException(status_code=400, detail="메시지를 입력해 주세요.")
        matched_policies = _pick_policies(message, request.policies)
        answer = await _generate_lightweight_answer(
            message,
            matched_policies,
            request.user,
            request.conversation_history,
        )
        return {
            "ai_response": answer,
            "response": answer,
            "recommended_policies": matched_policies,
            "suggestedPolicies": matched_policies,
            "extracted_keyword": message[:40],
            "ai_confidence": "fallback-detailed",
        }

    app.include_router(fallback_chat_router, prefix="/api/chat", tags=["3. 챗봇 fallback"])


# -------------------------------------------------------------------
# 헬스체크
# -------------------------------------------------------------------
@app.get("/health", tags=["서버 상태"])
async def health_check():
    return {"status": "ok", "service": "취약 계층 나눔 플랫폼"}
