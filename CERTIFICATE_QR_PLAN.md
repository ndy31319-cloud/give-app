# 취약계층 인증서 QR 계획

## 목적

취약계층 인증서에 들어가는 QR은 회원가입과 웹키오스크 이용 시 취약계층 여부를 확인하기 위한 검증 수단이다.

- 회원가입: 유효한 취약계층 인증서 QR이면 취약계층 회원으로 가입할 수 있다.
- 웹키오스크: 서비스 회원 여부와 관계없이 유효한 취약계층 인증서 QR이면 키오스크를 이용할 수 있다.

QR 안에는 이름, 전화번호, 생년월일 같은 개인정보를 넣지 않는다. QR에는 백엔드에서 검증할 수 있는 랜덤 토큰만 넣는다.

## 용어 정리

- `certificate_no`: 실제 인증서 발급번호 또는 문서번호. 모든 인증서에 있는 고유 번호다.
- `qr_token`: QR 안에 들어가는 랜덤 검증 토큰. 프론트가 이 값을 백엔드로 보낸다.
- `certificate_id`: 우리 DB 내부에서 쓰는 PK.

하나만 고르면 QR 검증에는 `token`을 사용한다.

```txt
QR 안에 넣는 값 = qr_token
프론트가 보내는 값 = certificateToken
백엔드가 조회하는 컬럼 = VULNERABLE_CERTIFICATE.qr_token
```

## 추천 DB 구조

기존 `CERTIFICATION_CODE`는 회원가입용 일회성 코드 성격이 강하다. 키오스크에서도 반복 검증하려면 인증서 자체를 저장하는 새 테이블을 분리하는 것이 깔끔하다.

```sql
CREATE TABLE VULNERABLE_CERTIFICATE (
  certificate_id INT AUTO_INCREMENT PRIMARY KEY,

  certificate_no VARCHAR(100) NOT NULL UNIQUE,
  qr_token VARCHAR(255) NOT NULL UNIQUE,

  beneficiary_type VARCHAR(50) NOT NULL,

  name VARCHAR(50) NOT NULL,
  birth_date DATE NULL,
  phone VARCHAR(20) NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'active',
  valid_from DATE NULL,
  valid_until DATE NULL,

  member_id INT NULL,
  signup_used_at DATETIME NULL,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 회원가입 검증 흐름

회원가입은 유효한 인증서이면서 아직 회원가입에 사용되지 않은 인증서만 통과시킨다.

```sql
SELECT *
FROM VULNERABLE_CERTIFICATE
WHERE qr_token = ?
  AND status = 'active'
  AND (valid_until IS NULL OR valid_until >= CURDATE())
  AND member_id IS NULL;
```

회원가입 성공 후에는 인증서를 새 회원과 연결한다.

```sql
UPDATE VULNERABLE_CERTIFICATE
SET member_id = ?,
    signup_used_at = NOW()
WHERE certificate_id = ?;
```

`MEMBER` 테이블에는 기존 구조처럼 취약계층 회원을 `role_id = 3`으로 저장한다.

## 웹키오스크 검증 흐름

웹키오스크는 우리 서비스 회원인지 확인하는 기능이 아니다. 취약계층 인증서가 유효하면 키오스크 사용을 허용한다.

따라서 키오스크 검증에서는 `member_id IS NULL` 조건을 사용하지 않는다.

```sql
SELECT *
FROM VULNERABLE_CERTIFICATE
WHERE qr_token = ?
  AND status = 'active'
  AND (valid_until IS NULL OR valid_until >= CURDATE());
```

응답에는 개인정보 원문을 그대로 주지 않고 필요한 경우 마스킹해서 준다.

```json
{
  "success": true,
  "data": {
    "eligible": true,
    "certificate": {
      "status": "valid",
      "beneficiaryType": "basic_livelihood",
      "name": "김**",
      "phone": "010-****-1234"
    }
  },
  "message": "취약계층 인증이 확인되었습니다."
}
```

## 백엔드 토큰 생성

Node.js 기본 `crypto`로 랜덤 토큰을 만들 수 있다. 별도 패키지는 필요 없다.

```js
const crypto = require("crypto");

function generateQrToken() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = generateQrToken;
```

QR 이미지까지 백엔드에서 만들고 싶다면 `qrcode` npm 패키지를 사용할 수 있다.

```js
const QRCode = require("qrcode");

const qrImageDataUrl = await QRCode.toDataURL(qrToken);
```

다만 현재 계획에서는 백엔드는 `qr_token`을 만들고 DB에 저장하며, 프론트나 관리자 화면에서 그 토큰을 QR 이미지로 변환하는 방식이 가장 단순하다.

## 백엔드 추가 예상 파일

```txt
backend
├─ controllers
│  └─ certificateQrController.js
├─ routes
│  └─ certificateQrRoutes.js
├─ lib
│  ├─ mask.js
│  └─ qrToken.js
└─ server.js
```

예상 API:

```txt
POST /api/certificates/qr/verify
```

회원가입과 키오스크가 같은 검증 API를 사용할 수 있다. 요청에 `purpose`를 넣으면 상황별 응답을 나눌 수 있다.

```json
{
  "certificateToken": "qr_token_value",
  "purpose": "signup"
}
```

```json
{
  "certificateToken": "qr_token_value",
  "purpose": "kiosk_access"
}
```

## 중요한 결정

- 로그인한 사용자에게 QR을 발급하는 구조가 아니다.
- 회원가입과 웹키오스크 모두 인증서 QR을 스캔해서 취약계층 여부를 확인한다.
- 웹키오스크는 서비스 회원이 아니어도 유효한 인증서면 통과한다.
- QR에는 개인정보를 넣지 않고 `qr_token`만 넣는다.
- `certificate_no`는 실제 인증서 발급번호로 보관한다.
- 회원가입은 인증서를 한 회원에게 연결하므로 1회성으로 처리한다.
- 키오스크는 인증서 유효 여부만 보므로 반복 사용 가능하게 처리한다.
