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


if __name__ == "__main__":
    unittest.main()
