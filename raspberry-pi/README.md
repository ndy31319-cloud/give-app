# Give 기부함 라즈베리파이 설정

이 폴더만 라즈베리파이에 복사하면 Give 기부함 하드웨어를 설치하고 실행할 수 있습니다.

## 폴더 구성

| 파일 | 역할 |
| --- | --- |
| `give_device.py` | QR 인식, 서버 검증, 잠금장치, 센서 전체 제어 |
| `.env.example` | Pi 실행 설정 예제 |
| `backend.env.example` | 백엔드에 추가할 디바이스 키 예제 |
| `install.sh` | Pi 시스템/Python 패키지 자동 설치 |
| `run.sh` | 기부함 프로그램 실행 |
| `check_setup.sh` | 환경변수, 백엔드, 카메라, GPIO 진단 |
| `setup_service.sh` | 부팅 시 자동 실행 등록 |
| `deploy_to_pi.sh` | 개발 PC에서 Pi로 폴더 전송 |
| `tools/test_qr_camera.py` | QR 카메라 단독 테스트 |
| `tools/test_gpio.py` | 릴레이와 물품 센서 단독 테스트 |

이 프로그램은 다음 순서로 동작합니다.

1. 앱에 표시된 1회용 QR을 카메라로 읽습니다.
2. 백엔드 `POST /api/hardware/qr/validate`로 QR 유효성을 확인합니다.
3. 유효하면 릴레이를 켜서 전자 잠금장치를 엽니다.
4. 적외선 센서 또는 리미트 스위치로 물품 투입을 감지합니다.
5. 백엔드 `POST /api/hardware/qr/consume`으로 QR을 사용 완료 처리합니다.
6. 릴레이를 끄고 잠금장치를 닫습니다.

## 권장 부품

- Raspberry Pi 4 또는 5
- USB 웹캠
- 1채널 릴레이 모듈
- 12V 전자석 잠금장치 또는 솔레노이드 락
- 잠금장치용 별도 12V 전원 어댑터
- 적외선 장애물 감지 센서 또는 리미트 스위치
- 점퍼 케이블

잠금장치를 라즈베리파이 5V 핀으로 직접 구동하면 안 됩니다. 잠금장치는 별도 전원을 사용하고 릴레이의 `COM`, `NO` 접점으로 제어해야 합니다.

## 기본 배선

이 코드는 BCM GPIO 번호를 사용합니다.

| 장치 | 장치 핀 | Raspberry Pi |
| --- | --- | --- |
| 릴레이 | IN | GPIO17, 물리 핀 11 |
| 릴레이 | GND | GND |
| 릴레이 | VCC | 모듈 사양에 맞는 5V 또는 3.3V |
| 물품 센서 | OUT | GPIO27, 물리 핀 13 |
| 물품 센서 | GND | GND |
| 물품 센서 | VCC | 3.3V 권장 |
| USB 웹캠 | USB | USB 포트 |

센서 OUT이 5V로 출력되는 제품이면 GPIO에 직접 연결하지 말고 레벨 시프터나 분압 회로를 사용하세요.

## 백엔드 설정

프로젝트 루트 `.env` 또는 백엔드가 읽는 `.env`에 긴 랜덤 키를 추가합니다.

```env
DEVICE_API_KEY=충분히-길고-랜덤한-비밀키
```

라즈베리파이 `.env`의 `DEVICE_API_KEY`에도 반드시 같은 값을 넣어야 합니다.

백엔드는 라즈베리파이가 접근할 수 있는 주소에서 실행해야 합니다.

```bash
npm run dev
```

예를 들어 백엔드 PC의 내부 IP가 `192.168.0.10`이고 포트가 `3000`이면 Pi 설정은 다음과 같습니다.

```env
API_BASE_URL=http://192.168.0.10:3000
```

## 라즈베리파이 설치

개발 PC에서 Pi로 전송:

```bash
cd raspberry-pi
PI_HOST=라즈베리파이_IP ./deploy_to_pi.sh
```

Pi에 SSH 접속한 뒤:

```bash
cd ~/give-device
chmod +x *.sh
./install.sh
nano .env
```

`.env`에서 최소한 아래 값을 수정합니다.

```env
API_BASE_URL=http://백엔드-PC-IP:3000
DEVICE_API_KEY=백엔드와-동일한-비밀키
DEVICE_ID=give-box-01
MOCK_HARDWARE=false
```

실행:

```bash
./check_setup.sh
./run.sh
```

부품별 단독 테스트:

```bash
.venv/bin/python tools/test_qr_camera.py
.venv/bin/python tools/test_gpio.py
```

## GPIO 없이 먼저 테스트

라즈베리파이 부품 연결 전에 노트북이나 Pi에서 키보드 입력으로 전체 서버 흐름을 테스트할 수 있습니다.

```env
MOCK_HARDWARE=true
```

실행 후 앱의 QR 토큰을 입력하고 Enter를 누르면 QR 검증과 완료 처리 흐름을 확인할 수 있습니다.

## 부팅 시 자동 실행

```bash
./setup_service.sh
```

실시간 로그:

```bash
journalctl -u give-device.service -f
```

## 자주 바꾸는 설정

```env
# 릴레이가 반대로 동작하면 true/false 변경
RELAY_ACTIVE_HIGH=false

# 센서가 반대로 감지되면 true/false 변경
SENSOR_PULL_UP=true

# 물품 투입 대기 시간
ITEM_WAIT_TIMEOUT=60

# 센서가 이 시간 이상 연속 감지돼야 물품으로 인정
SENSOR_STABLE_SECONDS=1.0
```

## 주의 사항

- 앱과 라즈베리파이의 시간이 크게 다르면 30초 QR이 이미 만료된 것으로 처리될 수 있습니다. Pi에서 시간 동기화를 켜세요.
- 앱의 QR은 실제 카메라로 읽을 수 있는 QR이어야 합니다. 이 프로젝트의 QR 화면은 `toqr` 기반 실제 QR로 변경되어 있습니다.
- 운영 환경에서는 `DEVICE_API_KEY`를 Git에 올리지 마세요.
- 잠금장치가 열린 상태에서 프로그램이 종료돼도 `close()`에서 릴레이를 끄도록 되어 있지만, 별도의 물리 비상 잠금 설계도 권장합니다.
