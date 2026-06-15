#!/usr/bin/env python3
import os
import platform
import sys
from pathlib import Path

import cv2
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")


def pass_line(message: str) -> None:
    print(f"[OK] {message}")


def fail_line(message: str) -> None:
    print(f"[FAIL] {message}")


def is_mock() -> bool:
    return os.getenv("MOCK_HARDWARE", "").lower() in {"1", "true", "yes", "on"}


def check_environment() -> bool:
    required = ["API_BASE_URL", "DEVICE_API_KEY", "DEVICE_ID"]
    missing = [name for name in required if not os.getenv(name)]

    if missing:
        fail_line(f".env 필수값 누락: {', '.join(missing)}")
        return False

    pass_line(".env 필수값 설정 완료")
    return True


def check_server() -> bool:
    base_url = os.getenv("API_BASE_URL", "").rstrip("/")
    device_key = os.getenv("DEVICE_API_KEY", "")
    device_id = os.getenv("DEVICE_ID", "give-box-01")

    try:
        root_response = requests.get(base_url, timeout=5)
        root_response.raise_for_status()
        pass_line(f"백엔드 연결 성공: {base_url}")

        status_response = requests.post(
            f"{base_url}/api/hardware/status",
            headers={"X-Device-Key": device_key},
            json={
                "deviceId": device_id,
                "state": "diagnostic",
                "lockerOpen": False,
                "itemDetected": False,
                "message": "라즈베리파이 연결 진단",
            },
            timeout=5,
        )
        status_response.raise_for_status()
        pass_line("디바이스 API 키 인증 성공")
        return True
    except Exception as error:
        fail_line(f"백엔드 또는 디바이스 API 연결 실패: {error}")
        return False


def check_camera() -> bool:
    if is_mock():
        pass_line("MOCK_HARDWARE=true: 카메라 검사를 건너뜁니다.")
        return True

    camera_index = int(os.getenv("CAMERA_INDEX", "0"))
    camera = cv2.VideoCapture(camera_index)

    try:
        if not camera.isOpened():
            fail_line(f"카메라 {camera_index}를 열 수 없습니다.")
            return False

        ok, frame = camera.read()
        if not ok or frame is None:
            fail_line("카메라는 열렸지만 프레임을 읽지 못했습니다.")
            return False

        pass_line(f"카메라 프레임 확인 완료: {frame.shape[1]}x{frame.shape[0]}")
        return True
    finally:
        camera.release()


def check_gpio_import() -> bool:
    if is_mock():
        pass_line("MOCK_HARDWARE=true: GPIO 검사를 건너뜁니다.")
        return True

    try:
        import gpiozero  # noqa: F401

        pass_line("gpiozero 로드 성공")
        return True
    except Exception as error:
        fail_line(f"gpiozero 로드 실패: {error}")
        return False


def main() -> int:
    print(f"Give 기부함 Pi 진단 - {platform.platform()}")
    checks = [check_environment(), check_server(), check_camera(), check_gpio_import()]

    if all(checks):
        print("\n모든 기본 진단을 통과했습니다.")
        return 0

    print("\n일부 진단에 실패했습니다. 위 메시지를 확인해주세요.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
