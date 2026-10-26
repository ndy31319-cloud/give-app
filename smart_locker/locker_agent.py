#!/usr/bin/env python3
import json
import os
import signal
import sys
import threading
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Optional

import requests


STATE_FILE = Path(__file__).with_name(".locker_state.json")
ENV_FILE = Path(__file__).with_name(".env")
# Keep the storage window bounded because the solenoid may heat while powered.
MAX_STORAGE_OPEN_SECONDS = 15.0
# The kiosk close command normally ends pickup earlier. Keep a generous but
# bounded hardware window so a lost network request cannot leave the solenoid
# energized indefinitely.
MAX_PICKUP_OPEN_SECONDS = 60.0


def load_env_file() -> None:
    """Load local settings for manual runs without overriding systemd env vars."""
    try:
        for raw_line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key:
                os.environ.setdefault(key, value)
    except FileNotFoundError:
        pass
    except Exception as error:
        print(f"[locker] failed to read .env: {error}")


load_env_file()


def env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


@dataclass
class LockerState:
    locked: bool = True
    doorOpen: bool = False
    redLedOn: bool = False
    occupied: bool = False
    lastCommandId: Optional[str] = None


class MockOutput:
    def __init__(self, pin: int, active_high: bool = True, initial_value: bool = False):
        self.pin = pin
        self.active_high = active_high
        self.value = initial_value
        print(f"[mock-gpio] pin={pin} active_high={active_high} initial={initial_value}")

    def on(self) -> None:
        self.value = True
        print(f"[mock-gpio] pin={self.pin} on")

    def off(self) -> None:
        self.value = False
        print(f"[mock-gpio] pin={self.pin} off")

    def close(self) -> None:
        print(f"[mock-gpio] pin={self.pin} close")


def make_output(pin: int, *, active_high: bool, initial_value: bool):
    if env_bool("MOCK_GPIO", False):
        return MockOutput(pin, active_high=active_high, initial_value=initial_value)

    try:
        from gpiozero import OutputDevice
    except Exception as error:
        raise RuntimeError(
            "GPIO driver is unavailable. Install gpiozero and lgpio, "
            "or set MOCK_GPIO=true only for a hardware-free test."
        ) from error

    try:
        return OutputDevice(pin, active_high=active_high, initial_value=initial_value)
    except Exception as error:
        raise RuntimeError(
            "GPIO pin factory could not be initialized. Install lgpio and check the GPIO pin wiring."
        ) from error


class LockerHardware:
    def __init__(self) -> None:
        relay_pin = env_int("RELAY_PIN", 18)
        red_led_pin = env_int("RED_LED_PIN", 23)
        relay_active_low = env_bool("RELAY_ACTIVE_LOW", True)
        red_led_active_high = env_bool("RED_LED_ACTIVE_HIGH", True)

        self.relay = make_output(
            relay_pin,
            active_high=not relay_active_low,
            initial_value=False,
        )
        self.red_led = make_output(
            red_led_pin,
            active_high=red_led_active_high,
            initial_value=False,
        )

    def open_for_storage(self) -> None:
        # Keep the relay on only during the bounded storage window. The agent
        # independently closes it when the kiosk or backend cannot respond.
        self.relay.on()

    def open_for_pickup(self) -> None:
        # Pickup remains open until the kiosk sends CLOSE_EMPTY_LED_OFF. The
        # agent applies its own bounded timeout as a hardware safety net.
        self.relay.on()

    def lock(self) -> None:
        self.relay.off()

    def set_red_led(self, enabled: bool) -> None:
        if enabled:
            self.red_led.on()
        else:
            self.red_led.off()

    def close(self) -> None:
        self.lock()
        self.relay.close()
        self.red_led.close()


class LockerAgent:
    def __init__(self) -> None:
        self.backend_url = os.getenv("BACKEND_URL", "http://localhost:3001").rstrip("/")
        self.locker_id = os.getenv("LOCKER_DEVICE_ID", "locker-1")
        self.device_key = os.getenv("LOCKER_DEVICE_API_KEY", "")
        self.poll_interval = max(env_float("POLL_INTERVAL_SECONDS", 1.0), 0.2)
        self.request_timeout = max(env_float("REQUEST_TIMEOUT_SECONDS", 5.0), 0.5)
        configured_storage_timeout = env_float("STORAGE_OPEN_TIMEOUT_SECONDS", 15.0)
        self.storage_open_timeout = min(
            max(configured_storage_timeout, 1.0),
            MAX_STORAGE_OPEN_SECONDS,
        )
        configured_pickup_timeout = env_float("PICKUP_OPEN_TIMEOUT_SECONDS", 60.0)
        self.pickup_open_timeout = min(
            max(configured_pickup_timeout, 1.0),
            MAX_PICKUP_OPEN_SECONDS,
        )
        self.state_lock = threading.RLock()
        self.hardware = LockerHardware()
        self.state = self.load_state()
        # A restart cannot prove that the physical door is still open. Start
        # from the electrically safe state while preserving occupancy so the
        # red LED can be restored for an item already in the locker.
        self.state.locked = True
        self.state.doorOpen = False
        self.running = True
        self.storage_open_deadline: Optional[float] = None
        self.storage_timeout_timer: Optional[threading.Timer] = None
        self.pickup_open_deadline: Optional[float] = None
        self.pickup_timeout_timer: Optional[threading.Timer] = None

        self.hardware.lock()
        self.hardware.set_red_led(self.state.redLedOn)
        self.save_state()

    def close_expired_storage(self) -> bool:
        with self.state_lock:
            if self.storage_open_deadline is None or time.monotonic() < self.storage_open_deadline:
                return False

            self.storage_open_deadline = None
            self.storage_timeout_timer = None
            self.hardware.lock()
            self.hardware.set_red_led(False)
            self.state.locked = True
            self.state.doorOpen = False
            self.state.redLedOn = False
            self.state.occupied = False
            self.save_state()
            print("[locker] storage open timeout; locker closed")
            return True

    def cancel_storage_timeout(self) -> None:
        with self.state_lock:
            timer = self.storage_timeout_timer
            self.storage_timeout_timer = None
            if timer is not None:
                timer.cancel()

    def close_expired_pickup(self) -> bool:
        with self.state_lock:
            if self.pickup_open_deadline is None or time.monotonic() < self.pickup_open_deadline:
                return False

            self.pickup_open_deadline = None
            self.pickup_timeout_timer = None
            self.hardware.lock()
            self.state.locked = True
            self.state.doorOpen = False
            # The item is still in the locker if pickup timed out. Keep the
            # red LED and occupied state intact for the next approved retry.
            self.state.occupied = True
            self.state.redLedOn = True
            self.hardware.set_red_led(True)
            self.save_state()
            print("[locker] pickup open timeout; locker closed safely")
            return True

    def cancel_pickup_timeout(self) -> None:
        with self.state_lock:
            timer = self.pickup_timeout_timer
            self.pickup_timeout_timer = None
            if timer is not None:
                timer.cancel()

    def schedule_pickup_timeout(self) -> None:
        with self.state_lock:
            self.cancel_pickup_timeout()
            timer = threading.Timer(self.pickup_open_timeout, self.close_expired_pickup)
            timer.daemon = True
            self.pickup_timeout_timer = timer
            timer.start()

    def schedule_storage_timeout(self) -> None:
        with self.state_lock:
            self.cancel_storage_timeout()
            timer = threading.Timer(self.storage_open_timeout, self.close_expired_storage)
            timer.daemon = True
            self.storage_timeout_timer = timer
            timer.start()

    @property
    def headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.device_key:
            headers["x-locker-device-key"] = self.device_key
        return headers

    def load_state(self) -> LockerState:
        try:
            data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
            return LockerState(
                locked=bool(data.get("locked", True)),
                doorOpen=bool(data.get("doorOpen", False)),
                redLedOn=bool(data.get("redLedOn", False)),
                occupied=bool(data.get("occupied", False)),
                lastCommandId=data.get("lastCommandId"),
            )
        except FileNotFoundError:
            return LockerState()
        except Exception as error:
            print(f"[locker] failed to load state, using defaults: {error}")
            return LockerState()

    def save_state(self) -> None:
        temp_file = STATE_FILE.with_name(f"{STATE_FILE.name}.tmp")
        try:
            with self.state_lock:
                payload = json.dumps(asdict(self.state), ensure_ascii=False, indent=2)
            temp_file.write_text(payload, encoding="utf-8")
            os.replace(temp_file, STATE_FILE)
        except Exception as error:
            print(f"[locker] failed to persist local state, continuing with in-memory state: {error}")
            try:
                temp_file.unlink(missing_ok=True)
            except Exception:
                pass

    def get_next_command(self) -> dict[str, Any] | None:
        response = requests.get(
            f"{self.backend_url}/api/device/locker/commands/next",
            params={"lockerId": self.locker_id},
            headers=self.headers,
            timeout=self.request_timeout,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError("backend returned an invalid locker response")
        command = payload.get("data")
        if command is not None and not isinstance(command, dict):
            raise ValueError("backend returned an invalid locker command payload")
        if command is not None and (not command.get("id") or not command.get("type")):
            raise ValueError("backend returned an incomplete locker command")
        return command

    def post_status(self) -> None:
        with self.state_lock:
            payload = {"lockerId": self.locker_id, **asdict(self.state)}
        response = requests.post(
            f"{self.backend_url}/api/device/locker/status",
            headers=self.headers,
            json=payload,
            timeout=self.request_timeout,
        )
        response.raise_for_status()

    def ack_command(self, command: dict[str, Any], success: bool, error: Optional[str] = None) -> None:
        with self.state_lock:
            state = asdict(self.state)
        payload = {
            "success": success,
            "error": error,
            "state": state,
        }
        response = requests.post(
            f"{self.backend_url}/api/device/locker/commands/{command['id']}/ack",
            headers=self.headers,
            json=payload,
            timeout=self.request_timeout,
        )
        response.raise_for_status()

    def apply_command(self, command: dict[str, Any]) -> None:
        # Timer callbacks and the polling loop can receive commands at the
        # same time. Serialize every hardware transition so a timeout cannot
        # reopen or overwrite a newer close command.
        with self.state_lock:
            self._apply_command(command)

    def _apply_command(self, command: dict[str, Any]) -> None:
        command_id = command.get("id")
        if not command_id:
            raise ValueError("locker command id is missing")

        if command_id == self.state.lastCommandId:
            print(f"[locker] duplicate command acknowledged without reapplying: {command_id}")
            return

        command_type = command.get("type")
        print(f"[locker] command={command.get('id')} type={command_type}")

        if command_type == "OPEN_FOR_STORAGE":
            self.pickup_open_deadline = None
            self.cancel_pickup_timeout()
            self.hardware.open_for_storage()
            self.storage_open_deadline = time.monotonic() + self.storage_open_timeout
            self.schedule_storage_timeout()
            self.state.locked = False
            self.state.doorOpen = True

        elif command_type == "CLOSE_WITH_ITEM_LED_ON":
            self.storage_open_deadline = None
            self.cancel_storage_timeout()
            self.pickup_open_deadline = None
            self.cancel_pickup_timeout()
            self.hardware.lock()
            self.hardware.set_red_led(True)
            self.state.locked = True
            self.state.doorOpen = False
            self.state.redLedOn = True
            self.state.occupied = True

        elif command_type == "OPEN_FOR_PICKUP":
            self.storage_open_deadline = None
            self.cancel_storage_timeout()
            self.hardware.open_for_pickup()
            self.pickup_open_deadline = time.monotonic() + self.pickup_open_timeout
            self.schedule_pickup_timeout()
            self.hardware.set_red_led(True)
            self.state.locked = False
            self.state.doorOpen = True
            self.state.redLedOn = True

        elif command_type == "CLOSE_EMPTY_LED_OFF":
            self.storage_open_deadline = None
            self.cancel_storage_timeout()
            self.pickup_open_deadline = None
            self.cancel_pickup_timeout()
            self.hardware.lock()
            self.hardware.set_red_led(False)
            self.state.locked = True
            self.state.doorOpen = False
            self.state.redLedOn = False
            self.state.occupied = False

        elif command_type == "LOCK":
            self.storage_open_deadline = None
            self.cancel_storage_timeout()
            self.pickup_open_deadline = None
            self.cancel_pickup_timeout()
            self.hardware.lock()
            self.state.locked = True
            self.state.doorOpen = False

        elif command_type == "RESET_EMPTY":
            self.storage_open_deadline = None
            self.cancel_storage_timeout()
            self.pickup_open_deadline = None
            self.cancel_pickup_timeout()
            self.hardware.lock()
            self.hardware.set_red_led(False)
            self.state = LockerState(locked=True)

        else:
            raise ValueError(f"unsupported command type: {command_type}")

        self.state.lastCommandId = command_id
        self.save_state()

    def stop(self, *_args: Any) -> None:
        self.running = False

    def run(self) -> None:
        signal.signal(signal.SIGINT, self.stop)
        signal.signal(signal.SIGTERM, self.stop)
        print(f"[locker] started locker_id={self.locker_id} backend={self.backend_url}")

        while self.running:
            try:
                if self.close_expired_storage():
                    try:
                        self.post_status()
                    except Exception as status_error:
                        print(f"[locker] failed to publish timeout status: {status_error}")
                elif self.close_expired_pickup():
                    try:
                        self.post_status()
                    except Exception as status_error:
                        print(f"[locker] failed to publish pickup timeout status: {status_error}")

                command = self.get_next_command()
                if command:
                    try:
                        self.apply_command(command)
                        self.ack_command(command, True)
                    except Exception as command_error:
                        print(f"[locker] command failed: {command_error}")
                        try:
                            self.ack_command(command, False, str(command_error))
                        except Exception as ack_error:
                            print(f"[locker] failed to acknowledge command failure: {ack_error}")
                else:
                    self.post_status()
            except Exception as error:
                print(f"[locker] backend communication failed: {error}")

            time.sleep(max(self.poll_interval, 0.2))

        with self.state_lock:
            self.hardware.lock()
            self.cancel_storage_timeout()
            self.cancel_pickup_timeout()
            self.storage_open_deadline = None
            self.pickup_open_deadline = None
            self.hardware.set_red_led(self.state.redLedOn)
            self.hardware.close()
        print("[locker] stopped")


if __name__ == "__main__":
    try:
        LockerAgent().run()
    except KeyboardInterrupt:
        sys.exit(0)
