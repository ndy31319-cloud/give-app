# Raspberry Pi Smart Locker

이 폴더는 Give 보관함을 라즈베리파이 GPIO로 제어하는 실행 코드입니다.

## 동작 순서

1. 초기 상태: 릴레이 OFF, 문 잠김, 빨간 LED OFF.
2. 앱 사용자가 QR을 발급하고 아이패드 키오스크에서 QR 인증.
3. 백엔드가 `OPEN_FOR_STORAGE` 명령을 만들고 라즈베리파이가 폴링으로 받아 도어락을 엽니다. 입고용 릴레이는 물품 투입 완료 전까지 최대 15초 유지됩니다.
4. 사용자가 물품을 넣고 아이패드에서 `물품 투입 감지`를 누르면 `CLOSE_WITH_ITEM_LED_ON` 명령이 내려가고, 문이 잠기며 빨간 LED가 계속 켜집니다. 15초 안에 버튼을 누르지 않으면 라즈베리파이가 자체적으로 문을 닫습니다.
5. 수령자가 아이패드에서 `물품 찾기` 후 보관함을 선택하면 `OPEN_FOR_PICKUP` 명령으로 문이 열립니다. 수령 완료 버튼을 누르면 닫히며, 버튼이나 네트워크 응답이 없을 때는 라즈베리파이가 최대 15초 후 안전하게 닫습니다.
6. 수령자가 물품을 꺼내고 `보관함 물품 닫기`를 누르면 `CLOSE_EMPTY_LED_OFF` 명령으로 문이 잠기고 빨간 LED가 꺼집니다.
7. 백엔드는 기부자에게 `물품 수령이 완료되었습니다.` 알림을 저장합니다.

## 기본 GPIO

BCM 번호 기준입니다. 기존 배선이 다르면 `.env`만 바꾸면 됩니다.

| 용도 | 기본 GPIO | 설명 |
| --- | --- | --- |
| 릴레이 IN | GPIO18 | 솔레노이드 도어락 전원 제어 |
| 빨간 LED | GPIO23 | 물품 보관 중 점등 |
| 초록 LED | 사용 안 함 | 이번 로직에서는 연결하지 않아도 됩니다 |

릴레이 보드는 대부분 active-low라서 기본값이 `RELAY_ACTIVE_LOW=true`입니다. 릴레이가 반대로 동작하면 `false`로 바꾸세요.

## 설치

```bash
cd /home/pi/give-app/smart_locker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

`.env`에서 아래 값을 실제 백엔드 주소와 키로 바꿉니다.

```bash
BACKEND_URL=https://give-app.onrender.com
LOCKER_DEVICE_ID=locker-1
LOCKER_DEVICE_API_KEY=백엔드_LOCKER_DEVICE_API_KEY와_같은값
RELAY_PIN=18
RED_LED_PIN=23
```

백엔드에도 같은 키를 설정해야 합니다.

```bash
LOCKER_DEVICE_API_KEY=백엔드와_라즈베리파이가_공유하는_긴_문자열
DEFAULT_LOCKER_ID=locker-1
```

## 실행

```bash
source .venv/bin/activate
python locker_agent.py
```

`locker_agent.py`는 같은 폴더의 `.env`를 자동으로 읽습니다. systemd로 실행할 때는
`EnvironmentFile` 설정이 우선합니다.

노트북에서 GPIO 없이 테스트하려면:

```bash
MOCK_GPIO=true BACKEND_URL=http://localhost:3001 python locker_agent.py
```

## systemd 자동 실행 예시

프로젝트의 `give-locker.service`를 복사한 뒤, 라즈베리파이 계정이 `pi`가
아니면 `User`와 `/home/pi` 경로를 실제 계정 경로로 바꿉니다.

```ini
[Unit]
Description=Give Smart Locker Agent
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=/home/pi/give-app/smart_locker
EnvironmentFile=/home/pi/give-app/smart_locker/.env
ExecStart=/home/pi/give-app/smart_locker/.venv/bin/python /home/pi/give-app/smart_locker/locker_agent.py
Restart=always
RestartSec=3
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
sudo cp give-locker.service /etc/systemd/system/give-locker.service
sudo systemctl daemon-reload
sudo systemctl enable give-locker
sudo systemctl start give-locker
sudo journalctl -u give-locker -f
```
