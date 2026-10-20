import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.chat_prompt import GOV24_POLICY_URL, build_policy_context, build_system_prompt, ensure_policy_link


class ChatPromptTest(unittest.TestCase):
    def test_policy_context_includes_only_existing_urls(self):
        context = build_policy_context([
            {
                "policy_name": "청년 주거비 지원",
                "summary": "주거비 일부 지원",
                "agency": "OO시",
                "target_criteria": "무주택 청년",
                "support_detail": "공고 기준 확인",
                "content": "자세한 안내 https://example.org/policy.",
                "ai_search_text": "https://example.org/policy",
            }
        ])

        self.assertIn("공식 확인 링크: https://example.org/policy", context)
        self.assertEqual(context.count("https://example.org/policy"), 1)

    def test_system_prompt_has_link_and_quality_rules(self):
        prompt = build_system_prompt("검색된 정책 없음", has_history=False)

        self.assertIn("첫 문장에서 사용자의 핵심 질문에 바로 답한다", prompt)
        self.assertIn("4~7개의 짧은 문장", prompt)
        self.assertIn(f"정책 통합 확인: {GOV24_POLICY_URL}", prompt)
        self.assertIn("새 링크를 지어내지 않는다", prompt)

    def test_policy_link_is_added_without_touching_locker_flow(self):
        policy = [{"content": "", "ai_search_text": "", "official_url": ""}]
        policy_answer = ensure_policy_link("신청 기준을 확인해 주세요.", policy, "의료비 지원 대상이 궁금해요")
        locker_answer = ensure_policy_link("인증 상태를 확인해 주세요.", policy, "QR 보관함 오류가 나요")

        self.assertIn(GOV24_POLICY_URL, policy_answer)
        self.assertNotIn(GOV24_POLICY_URL, locker_answer)


if __name__ == "__main__":
    unittest.main()
