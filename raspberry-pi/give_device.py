#!/usr/bin/env python3
import logging
import os
import signal
import sys
import time
from dataclasses import dataclass

import cv2
import requests
from dotenv import load_dotenv

load_dotenv()


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class Config:
    api_base_url: str = os.getenv("API_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
    device_api_key: str = os.getenv("DEVICE_API_KEY", "")
    device_id: str = os.getenv("DEVICE_ID", "give-box-01")
    mock_hardware: bool = env_bool("MOCK_HARDWARE", False)
    camera_index: int = int(os.getenv("CAMERA_INDEX", "0"))
    relay_pin: int = int(os.getenv("RELAY_PIN", "17"))
    relay_active_high: bool = env_bool("RELAY_ACTIVE_HIGH", False)
    sensor_pin: int = int(os.getenv("SENSOR_PIN", "27"))
    sensor_pull_up: bool = env_bool("SENSOR_PULL_UP", True)
    sensor_stable_seconds: float = float(os.getenv("SENSOR_STABLE_SECONDS", "1.0"))
    item_wait_timeout: int = int(os.getenv("ITEM_WAIT_TIMEOUT", "60"))
    scan_cooldown_seconds: float = float(os.getenv("SCAN_COOLDOWN_SECONDS", "2"))
    request_timeout_seconds: int = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "8"))
    verify_tls: bool = env_bool("VERIFY_TLS", True)
    show_camera_preview: bool = env_bool("SHOW_CAMERA_PREVIEW", False)


class DeviceApi:
    def __init__(self, config: Config):
        self.config = config
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "X-Device-Key": config.device_api_key,
            }
        )

    def post(self, path: str, payload: dict) -> dict:
        response = self.session.post(
            f"{self.config.api_base_url}{path}",
            json=payload,
            timeout=self.config.request_timeout_seconds,
            verify=self.config.verify_tls,
        )
        body = response.json() if response.content else {}
        if not response.ok or body.get("success") is False:
            raise RuntimeError(body.get("message") or f"HTTP {response.status_code}")
        return body.get("data") or {}

    def validate_qr(self, token: str) -> dict:
        return self.post("/api/hardware/qr/validate", {"token": token})

    def consume_qr(self, token: str) -> dict:
        return self.post("/api/hardware/qr/consume", {"token": token})

    def report_status(
        self,
        state: str,
        locker_open: bool = False,
        item_detected: bool = False,
        message: str = "",
    ) -> None:
        try:
            self.post(
                "/api/hardware/status",
                {
                    "deviceId": self.config.device_id,
                    "state": state,
                    "lockerOpen": locker_open,
                    "itemDetected": item_detected,
                    "message": message,
                },
            )
        except Exception as error:
            logging.warning("상태 보고 실패: %s", error)


class LockerHardware:
    def __init__(self, config: Config):
        self.config = config
        self.mock = config.mock_hardware
        self.relay = None
        self.sensor = None

        if self.mock:
            logging.info("MOCK_HARDWARE 모드로 실행합니다.")
            return

        try:
            from gpiozero import DigitalInputDevice, DigitalOutputDevice
        except ImportError as error:
            raise RuntimeError("gpiozero가 설치되지 않았습니다.") from error

        self.relay = DigitalOutputDevice(
            config.relay_pin,
            active_high=config.relay_active_high,
            initial_value=False,
        )
        self.sensor = DigitalInputDevice(
            config.sensor_pin,
            pull_up=config.sensor_pull_up,
        )
        self.lock()

    def unlock(self) -> None:
        logging.info("잠금장치를 엽니다.")
        if self.mock:
            return
        self.relay.on()

    def lock(self) -> None:
        logging.info("잠금장치를 닫습니다.")
        if self.mock:
            return
        self.relay.off()

    def wait_for_item(self, timeout_seconds: int) -> bool:
        if self.mock:
            answer = input("물품을 넣었다면 Enter, 취소하려면 q 입력: ").strip().lower()
            return answer != "q"

        deadline = time.monotonic() + timeout_seconds
        active_since = None

        while time.monotonic() < deadline:
            if self.sensor.is_active:
                active_since = active_since or time.monotonic()
                if time.monotonic() - active_since >= self.config.sensor_stable_seconds:
                    return True
            else:
                active_since = None
            time.sleep(0.1)

        return False

    def close(self) -> None:
        self.lock()
        if self.relay:
            self.relay.close()
        if self.sensor:
            self.sensor.close()


class QrScanner:
    def __init__(self, config: Config):
        self.config = config
        self.mock = config.mock_hardware
        self.capture = None
        self.detector = cv2.QRCodeDetector()

        if not self.mock:
            self.capture = cv2.VideoCapture(config.camera_index)
            if not self.capture.isOpened():
                raise RuntimeError(f"카메라 {config.camera_index}를 열 수 없습니다.")

    def scan(self) -> str:
        if self.mock:
            return input("앱 QR 토큰을 입력하세요: ").strip()

        while True:
            ok, frame = self.capture.read()
            if not ok:
                time.sleep(0.2)
                continue

            token, _, _ = self.detector.detectAndDecode(frame)
            if self.config.show_camera_preview:
                cv2.imshow("Give QR Scanner", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    raise KeyboardInterrupt

            if token:
                return token.strip()

    def close(self) -> None:
        if self.capture:
            self.capture.release()
        cv2.destroyAllWindows()


class GiveDevice:
    def __init__(self, config: Config):
        if not config.device_api_key:
            raise RuntimeError("DEVICE_API_KEY를 설정해주세요.")

        self.config = config
        self.api = DeviceApi(config)
        self.hardware = LockerHardware(config)
        self.scanner = QrScanner(config)
        self.running = True

    def stop(self, *_args) -> None:
        self.running = False

    def run_once(self) -> None:
        self.api.report_status("scanning", message="QR 인식 대기 중")
        logging.info("QR 인식 대기 중입니다.")
        token = self.scanner.scan()
        if not token:
            return

        logging.info("QR을 인식했습니다. 서버 검증을 시작합니다.")
        self.api.report_status("validating", message="QR 서버 검증 중")
        session = self.api.validate_qr(token)
        logging.info("QR 검증 완료: purpose=%s member=%s", session.get("purpose"), session.get("memberId"))

        self.hardware.unlock()
        self.api.report_status("awaiting_item", locker_open=True, message="물품 투입 대기 중")

        item_detected = self.hardware.wait_for_item(self.config.item_wait_timeout)
        if not item_detected:
            self.hardware.lock()
            self.api.report_status("timeout", message="물품 투입 시간 초과")
            logging.warning("물품 투입 시간이 초과되었습니다.")
            return

        self.api.report_status(
            "item_detected",
            locker_open=True,
            item_detected=True,
            message="물품 감지 완료",
        )
        self.api.consume_qr(token)
        self.hardware.lock()
        self.api.report_status(
            "completed",
            locker_open=False,
            item_detected=True,
            message="기부 처리 완료",
        )
        logging.info("기부 처리와 잠금 완료")
        time.sleep(self.config.scan_cooldown_seconds)

    def run(self) -> None:
        self.api.report_status("idle", message="디바이스 시작")

        while self.running:
            try:
                self.run_once()
            except KeyboardInterrupt:
                self.running = False
            except Exception as error:
                logging.exception("디바이스 처리 오류: %s", error)
                self.hardware.lock()
                self.api.report_status("error", message=str(error))
                time.sleep(self.config.scan_cooldown_seconds)

    def close(self) -> None:
        self.hardware.close()
        self.scanner.close()
        self.api.report_status("offline", message="디바이스 종료")


def main() -> int:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(message)s",
    )
    device = GiveDevice(Config())
    signal.signal(signal.SIGINT, device.stop)
    signal.signal(signal.SIGTERM, device.stop)

    try:
        device.run()
    finally:
        device.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
