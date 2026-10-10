# 회원별 정적 QR 테스트

대상은 `GIVE_주소변경_회원목록_2026-10-10.xlsx`의 기부자 10명과 수혜자 10명이다. 회원 ID는 `backend/scripts/issueStaticMemberQrs.js`에 기록되어 있다.

```powershell
node backend/scripts/issueStaticMemberQrs.js
node backend/scripts/issueStaticMemberQrs.js --apply
```

첫 명령은 DB의 대상과 역할·주소를 확인한다. `--apply`는 `MEMBER_QR` 테이블에 회원별 무작위 토큰을 한 번만 저장하고, `outputs/<작업 ID>/static-member-qr/`에 스캔 가능한 PNG와 `index.html`을 만든다. 다시 실행해도 기존 토큰은 유지된다. QR 이미지와 토큰은 저장소에 커밋하지 않는다.

- 앱: 마이페이지 → **내 회원 QR** (`GET /api/member-qr/me`, 본인 로그인 필요)
- 웹 키오스크 인식 시험: `/member-qr-test` (`POST /api/member-qr/validate`)
- 운영 환경의 인식 시험 API: `KIOSK_API_KEY`와 동일한 `REACT_APP_KIOSK_API_KEY`를 설정해야 한다.

정적 QR 자체는 회원 식별자다. 보관함 사용 권한은 `LOCKER_TRANSFER`의 거래 상태를 서버가 매번 확인한다. 기존 취약계층 인증서의 `WF-####-####` 회원코드는 앱을 사용하지 않는 수혜자의 수령 확인에 사용한다.

## 보관함 연동

1. `npm run migrate:member-qr`와 `npm run migrate:locker`로 회원 QR·보관함 테이블을 만든다. 현재 저장소의 개발 DB에는 적용했다. 앱 신규 가입자는 가입 트랜잭션에서 QR을 발급받고, 기존 회원은 마이페이지 첫 조회 때 한 번 발급받는다.
2. 서버와 라즈베리파이에 동일한 `DEVICE_API_KEY`를 설정한다. 키가 없으면 기기 API는 503을 반환한다.
3. 나눔자는 앱 마이페이지의 회원 QR 화면에서 수락된 거래와 상대 닉네임을 확인하고 선택한다. `POST /api/locker/select/:pickupId`가 승인된 거래 당사자인지 검사한다.
4. 선택 후 나눔자 QR은 투입용으로 활성화된다. 기존 파이 브랜치가 호출하는 `POST /api/hardware/qr/validate`에서 서버가 정적 QR과 거래 상태를 검사한다. 센서가 물품을 감지하면 `POST /api/hardware/qr/consume`이 보관 상태로 전환한다. 이후 수혜자 QR이 수령용으로 활성화된다.
5. 수령용 서버 API는 `POST /api/locker/device/scan` (`action: pickup`)과 `POST /api/locker/device/confirm` (`action: pickup`)이다. 수혜자의 정적 QR 또는 유효한 WF 회원코드를 받는다.

현재 파이 브랜치는 물품 투입 감지만 구현한다. 수령 시 물품 제거 감지와 문 제어는 파이 담당 코드에서 연결해야 한다. 서버는 이 동작을 대신 확인할 수 없다. 실제 승인 거래와 실물 보관함을 이용한 종단 간 시험도 남아 있다.
