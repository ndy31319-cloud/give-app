#!/usr/bin/env python3
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from give_device import Config, LockerHardware  # noqa: E402


def main() -> int:
    config = Config()
    hardware = LockerHardware(config)

    try:
        print("잠금장치를 2초 동안 엽니다.")
        hardware.unlock()
        time.sleep(2)
        hardware.lock()
        print("잠금장치를 닫았습니다.")
        print(f"센서 테스트를 시작합니다. {config.item_wait_timeout}초 안에 센서를 작동시키세요.")
        detected = hardware.wait_for_item(config.item_wait_timeout)
        print("센서 감지 성공" if detected else "센서 감지 시간 초과")
        return 0 if detected else 1
    finally:
        hardware.close()


if __name__ == "__main__":
    sys.exit(main())
