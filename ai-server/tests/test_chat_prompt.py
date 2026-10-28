import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.chat_prompt import build_policy_context, build_system_prompt, ensure_policy_link
from core.chat_text import remove_application_method_sections


class ChatPromptTest(unittest.TestCase):
    def test_policy_context_includes_only_existing_urls(self):
        context = build_policy_context([
            {
                "policy_name": "청년 주거비 지원",
                "summary": "주거비 일부 지원",
                "agency": "OO시",
                "target_criteria": "무주택 청년",
                "support_detail": "공고 기준 확인",
                "official_url": "https://example.org/policy",
                "content": "자세한 안내 https://invalid.example/ignore.",
                "ai_search_text": "https://invalid.example/ignore",
            }
        ])

        self.assertIn("공식 확인 링크: https://example.org/policy", context)
        self.assertEqual(context.count("https://example.org/policy"), 1)

    def test_system_prompt_has_link_and_quality_rules(self):
        prompt = build_system_prompt("검색된 정책 없음", has_history=False)

        self.assertIn("첫 문장에서 사용자의 핵심 질문에 바로 답한다", prompt)
        self.assertIn("4~7개의 짧은 문장", prompt)
        self.assertIn("해당 정책명으로 좁힌 정부24 검색 링크를 사용한다", prompt)
        self.assertIn("새 링크를 지어내지 않는다", prompt)
        self.assertIn("별도의 '신청 방법' 또는 '신청방법' 섹션을 만들지 않는다", prompt)

    def test_policy_link_is_added_without_touching_locker_flow(self):
        policy = [{
            "policy_name": "의료비 지원",
            "content": "",
            "ai_search_text": "",
            "official_url": "https://example.org/medical",
        }]
        policy_answer = ensure_policy_link("의료비 지원의 신청 기준을 확인해 주세요.", policy, "의료비 지원 대상이 궁금해요")
        locker_answer = ensure_policy_link("인증 상태를 확인해 주세요.", policy, "QR 보관함 오류가 나요")

        self.assertIn("https://example.org/medical", policy_answer)
        self.assertNotIn("https://", locker_answer)

    def test_link_follows_mentioned_policy_not_first_search_result(self):
        policies = [
            {
                "policy_name": "청년 주거비 지원",
                "official_url": "https://example.org/housing",
            },
            {
                "policy_name": "긴급복지 생계 지원",
                "official_url": "https://example.org/emergency",
            },
        ]
        answer = ensure_policy_link(
            "긴급복지 생계 지원은 위기 상황의 가구를 대상으로 합니다.",
            policies,
            "긴급복지 생계 지원이 궁금해요",
        )

        self.assertIn("https://example.org/emergency", answer)
        self.assertNotIn("https://example.org/housing", answer)

    def test_multiple_policies_use_best_ranked_policy_url_as_fallback(self):
        policies = [
            {"policy_name": "청년 주거비 지원", "official_url": "https://example.org/housing"},
            {"policy_name": "청년 교통비 지원", "official_url": "https://example.org/transit"},
        ]
        answer = ensure_policy_link("지원 대상과 조건을 확인해 주세요.", policies, "청년 지원이 궁금해요")

        self.assertIn("https://example.org/housing", answer)
        self.assertNotIn("https://example.org/transit", answer)

    def test_untrusted_url_is_removed_and_best_policy_url_is_added(self):
        policies = [
            {"policy_name": "청년 주거비 지원", "official_url": "https://example.org/housing"},
            {"policy_name": "청년 교통비 지원", "official_url": "https://example.org/transit"},
        ]
        answer = ensure_policy_link(
            "자세한 내용은 https://unrelated.example/wrong에서 확인하세요.",
            policies,
            "청년 지원이 궁금해요",
        )

        self.assertNotIn("unrelated.example", answer)
        self.assertIn("https://example.org/housing", answer)

    def test_untrusted_answer_url_is_replaced_with_official_url(self):
        policy = [{
            "official_url": "https://www.gov.kr/portal/rcvfvrSvc/dtlEx/123",
            "content": "내부 참고 https://invalid.example/blank",
        }]
        answer = ensure_policy_link("자세한 내용은 https://invalid.example/blank에서 확인하세요.", policy, "지원 정책이 궁금해요")

        self.assertNotIn("invalid.example", answer)
        self.assertIn("https://www.gov.kr/portal/rcvfvrSvc/dtlEx/123", answer)

        mixed = ensure_policy_link(
            "공식 안내 https://www.gov.kr/portal/rcvfvrSvc/dtlEx/123, 참고 https://invalid.example/blank",
            policy,
            "지원 정책이 궁금해요",
        )
        self.assertIn("https://www.gov.kr/portal/rcvfvrSvc/dtlEx/123", mixed)
        self.assertNotIn("invalid.example", mixed)

    def test_missing_policy_url_uses_title_scoped_government24_search(self):
        answer = ensure_policy_link(
            "기초생활보장 생계급여의 세부 조건을 확인해 주세요.",
            [{"policy_name": "기초생활보장 생계급여", "official_url": None, "application_url": None}],
            "기초생활보장 생계급여가 궁금해요",
        )
        self.assertIn(
            "https://www.gov.kr/search?srchTxt=%EA%B8%B0%EC%B4%88%EC%83%9D%ED%99%9C%EB%B3%B4%EC%9E%A5%20%EC%83%9D%EA%B3%84%EA%B8%89%EC%97%AC",
            answer,
        )

    def test_chatbot_application_method_section_is_removed(self):
        answer = "정책 요약입니다.\n신청 방법: 주민센터에서 신청하세요.\n주의할 점입니다."
        cleaned = remove_application_method_sections(answer)

        self.assertNotIn("신청 방법", cleaned)
        self.assertIn("정책 요약입니다.", cleaned)
        self.assertIn("주의할 점입니다.", cleaned)


if __name__ == "__main__":
    unittest.main()
