import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.chat_text import normalize_chatbot_text


class ChatTextTest(unittest.TestCase):
    def test_emphasis_and_url_preservation(self):
        cases = json.loads(Path(__file__).with_name("chat_text_cases.json").read_text(encoding="utf-8"))
        for source, expected in cases:
            with self.subTest(source=source):
                self.assertEqual(normalize_chatbot_text(source), expected)

    def test_removes_generic_template_intro(self):
        answer = "주요 내용은 다음과 같습니다.\n\n대상자는 주민센터에 문의할 수 있습니다."
        self.assertEqual(
            normalize_chatbot_text(answer),
            "대상자는 주민센터에 문의할 수 있습니다.",
        )


if __name__ == "__main__":
    unittest.main()
