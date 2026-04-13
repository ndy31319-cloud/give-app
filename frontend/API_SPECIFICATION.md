# API 명세서 (API Specification)

나눔이음 (Give,기부) 백엔드 API 문서

---

## 🔐 인증 (Authentication)

### 회원가입
**POST** `/api/auth/signup`

**Request Body:**
```json
{
  "name": "홍길동",
  "email": "hong@example.com",
  "password": "password123!",
  "phone": "010-1234-5678",
  "birthdate": "1990-01-01",
  "isVulnerable": true,
  "vulnerableTypes": ["basic_livelihood", "disabled"],
  "location": "서울특별시 강남구 역삼동"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "name": "홍길동",
      "email": "hong@example.com",
      "phone": "010-1234-5678",
      "isVulnerable": true,
      "vulnerableTypes": ["basic_livelihood", "disabled"],
      "location": "서울특별시 강남구 역삼동",
      "birthdate": "1990-01-01",
      "createdAt": "2025-02-26T10:00:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 로그인
**POST** `/api/auth/login`

**Request Body:**
```json
{
  "email": "hong@example.com",
  "password": "password123!"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "name": "홍길동",
      "email": "hong@example.com",
      "isVulnerable": true,
      "location": "역삼동"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 로그아웃
**POST** `/api/auth/logout`

**Headers:**
```
Authorization: Bearer {token}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "로그아웃 되었습니다"
}
```

---

## 📝 게시물 (Posts)

### 게시물 목록 조회
**GET** `/api/posts`

**Query Parameters:**
- `type` (optional): `share` | `need` | `all`
- `category` (optional): `clothing` | `electronics` | `furniture` | `books` | `household`
- `status` (optional): `available` | `reserved` | `completed`
- `search` (optional): 검색어
- `page` (optional): 페이지 번호 (default: 1)
- `limit` (optional): 페이지당 개수 (default: 20)
- `sort` (optional): `latest` | `distance` | `popular`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "id": "post_123",
        "type": "share",
        "title": "겨울 외투 나눔",
        "description": "깨끗한 상태의 겨울 외투입니다",
        "category": "clothing",
        "location": "역삼동",
        "status": "available",
        "images": ["https://..."],
        "author": {
          "id": "user_456",
          "name": "김나눔",
          "temperature": 36.5
        },
        "createdAt": "2025-02-26T09:00:00Z",
        "distance": 1.2
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45
    }
  }
}
```

---

### 게시물 상세 조회
**GET** `/api/posts/:id`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "post_123",
    "type": "share",
    "title": "겨울 외투 나눔",
    "description": "깨끗한 상태의 겨울 외투입니다. 사이즈는 95입니다.",
    "category": "clothing",
    "location": "역삼동",
    "status": "available",
    "images": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ],
    "author": {
      "id": "user_456",
      "name": "김나눔",
      "temperature": 36.5,
      "profileImage": "https://..."
    },
    "createdAt": "2025-02-26T09:00:00Z",
    "views": 125
  }
}
```

---

### 게시물 작성
**POST** `/api/posts`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request Body (FormData):**
```
type: share
title: 겨울 외투 나눔
description: 깨끗한 상태의 겨울 외투입니다
category: clothing
location: 역삼동
images: [File, File, ...]
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "post_789",
    "type": "share",
    "title": "겨울 외투 나눔",
    "status": "available",
    "createdAt": "2025-02-26T10:30:00Z"
  }
}
```

---

### AI 유해물품 판단
**POST** `/api/posts/check-harmful`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "약 나눔",
  "description": "먹다 남은 약 나눔합니다",
  "images": ["base64_encoded_image"]
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "isHarmful": true,
    "reason": "의약품은 나눔이 금지된 품목입니다",
    "confidence": 0.95
  }
}
```

---

## 🔍 검색 (Search)

### 텍스트 검색
**GET** `/api/search`

**Query Parameters:**
- `q`: 검색어 (required)
- `type`: `share` | `need`
- `category`: 카테고리
- `page`: 페이지 번호

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "results": [...],
    "total": 23
  }
}
```

---

### AI 이미지 검색
**POST** `/api/search/image`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request Body:**
```
image: File
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "detectedItem": "노트북",
    "confidence": 0.92,
    "results": [
      {
        "id": "post_456",
        "title": "노트북 나눔",
        "similarity": 0.88
      }
    ]
  }
}
```

---

## 🏛️ 정책 (Policy)

### AI 맞춤 정책 추천
**GET** `/api/policies/recommended`

**Headers:**
```
Authorization: Bearer {token}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "policies": [
      {
        "id": "policy_123",
        "title": "긴급복지 생계지원",
        "category": "생활비",
        "description": "갑작스런 위기상황으로 생계유지가 곤란한 저소득층에게 생계비를 지원합니다",
        "target": "기초생활수급자, 차상위계층",
        "support": "1인 가구 월 62만원 지원",
        "eligibility": ["소득 기준 충족", "재산 기준 충족"],
        "howToApply": "주민센터 방문 또는 온라인 신청",
        "matchScore": 0.95
      }
    ]
  }
}
```

---

### 카테고리별 정책 조회
**GET** `/api/policies`

**Query Parameters:**
- `categories`: 카테고리 배열 (예: `생활비,주거,의료`)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "policies": [...]
  }
}
```

---

### 챗봇 질의
**POST** `/api/policies/chatbot`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "전세 자금 대출을 받고 싶어요",
  "conversationHistory": [
    {
      "role": "user",
      "message": "안녕하세요"
    },
    {
      "role": "bot",
      "message": "안녕하세요! 어떤 정책이 필요하신가요?"
    }
  ]
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "response": "전세 자금 대출을 위해서는 주거급여 지원 프로그램을 추천드립니다.",
    "suggestedPolicies": [
      {
        "id": "policy_456",
        "title": "주거급여 지원"
      }
    ]
  }
}
```

---

## 💬 채팅 (Chat)

### 채팅 목록 조회
**GET** `/api/chats`

**Headers:**
```
Authorization: Bearer {token}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "chats": [
      {
        "id": "chat_123",
        "participant": {
          "id": "user_456",
          "name": "김나눔",
          "profileImage": "https://..."
        },
        "lastMessage": {
          "text": "네, 내일 뵙겠습니다!",
          "timestamp": "2025-02-26T10:15:00Z"
        },
        "unreadCount": 2,
        "updatedAt": "2025-02-26T10:15:00Z"
      }
    ]
  }
}
```

---

### 메시지 조회
**GET** `/api/chats/:chatId/messages`

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
- `page`: 페이지 번호
- `limit`: 개수

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg_789",
        "sender": {
          "id": "user_123",
          "name": "홍길동"
        },
        "text": "안녕하세요!",
        "type": "text",
        "timestamp": "2025-02-26T10:00:00Z",
        "isRead": true
      },
      {
        "id": "msg_790",
        "sender": {
          "id": "user_456",
          "name": "김나눔"
        },
        "text": "",
        "type": "image",
        "imageUrl": "https://...",
        "timestamp": "2025-02-26T10:05:00Z",
        "isRead": true
      }
    ]
  }
}
```

---

### 메시지 전송
**POST** `/api/chats/:chatId/messages`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "text": "네, 내일 뵙겠습니다!",
  "type": "text"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "msg_791",
    "text": "네, 내일 뵙겠습니다!",
    "timestamp": "2025-02-26T10:15:00Z"
  }
}
```

---

### 매너 평가
**POST** `/api/chats/:chatId/review`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "type": "positive",
  "reasons": ["친절해요", "시간약속을 잘 지켜요"],
  "comment": "정말 좋은 분이셨습니다!"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "매너 평가가 완료되었습니다"
}
```

---

## 👤 사용자 (User)

### 프로필 조회
**GET** `/api/users/:userId`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "user_456",
    "name": "김나눔",
    "location": "역삼동",
    "temperature": 36.5,
    "shareCount": 42,
    "responseRate": 95,
    "joinedAt": "2024-01-15",
    "reviews": [
      {
        "author": "홍길동",
        "comment": "친절하고 좋은 분입니다",
        "rating": 5
      }
    ]
  }
}
```

---

### 프로필 수정
**PUT** `/api/users/profile`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "홍길동",
  "phone": "010-1234-5678",
  "bio": "나눔을 좋아하는 사람입니다"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "name": "홍길동",
    "phone": "010-1234-5678",
    "bio": "나눔을 좋아하는 사람입니다",
    "updatedAt": "2025-02-26T10:30:00Z"
  }
}
```

---

### 동네 설정
**PUT** `/api/users/location`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "location": "서울특별시 강남구 삼성동"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "location": "서울특별시 강남구 삼성동",
    "updatedAt": "2025-02-26T10:30:00Z"
  }
}
```

---

### 나눔 통계 조회
**GET** `/api/users/stats`

**Headers:**
```
Authorization: Bearer {token}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "totalShares": 102,
    "thisMonthShares": 12,
    "thanksReceived": 87,
    "monthlyStats": [
      { "month": "1월", "count": 8 },
      { "month": "2월", "count": 12 }
    ],
    "average": 8.5
  }
}
```

---

### 나의 나눔 목록
**GET** `/api/users/shares`

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
- `status`: `completed` | `ongoing`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "shares": [
      {
        "id": "post_123",
        "title": "겨울 외투 나눔",
        "status": "completed",
        "date": "2025-02-20",
        "image": "https://...",
        "review": {
          "rating": 5,
          "comment": "감사합니다!"
        }
      }
    ]
  }
}
```

---

## 🚨 에러 응답

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력 데이터가 유효하지 않습니다",
    "details": [
      {
        "field": "email",
        "message": "올바른 이메일 형식이 아닙니다"
      }
    ]
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "인증이 필요합니다"
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "권한이 없습니다"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "요청한 리소스를 찾을 수 없습니다"
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "서버 오류가 발생했습니다"
  }
}
```

---

## 📌 참고사항

### 인증
- 모든 인증이 필요한 API는 `Authorization: Bearer {token}` 헤더를 포함해야 합니다
- JWT 토큰 유효기간: 7일
- Refresh Token은 별도 엔드포인트로 갱신

### Rate Limiting
- IP당 분당 60 요청
- 인증된 사용자는 분당 120 요청

### Pagination
- 기본 페이지 크기: 20
- 최대 페이지 크기: 100

### 이미지 업로드
- 최대 파일 크기: 10MB
- 지원 형식: JPG, PNG, WEBP
- 한 번에 최대 10장까지 업로드 가능

---

백엔드 구현 시 이 명세서를 참고하여 API를 개발하시면 됩니다.
