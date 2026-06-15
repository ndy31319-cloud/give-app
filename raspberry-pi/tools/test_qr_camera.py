#!/usr/bin/env python3
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from give_device import Config, QrScanner  # noqa: E402


def main() -> int:
    scanner = QrScanner(Config())

    try:
        print("앱의 동적 QR을 카메라에 보여주세요. 종료는 Ctrl+C입니다.")
        token = scanner.scan()
        print(f"QR 인식 성공: {token[:24]}...")
        return 0
    finally:
        scanner.close()


if __name__ == "__main__":
    sys.exit(main())
