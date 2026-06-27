### 2026-06-27

- 비대면 수령 요청 백엔드 API를 추가했다.
  - `POST /api/posts/:id/pickup-request` 라우트를 추가하고 로그인 토큰 인증을 적용했다.
  - 나눔글 상태가 `open`일 때만 수령 요청을 생성하도록 제한했다.
  - 요청자 본인이 작성한 나눔글에는 수령 요청을 보낼 수 없도록 막았다.
  - `PICKUP_REQUEST`에 요청자, 나눔글, 요청 상태, 희망 날짜, 희망 시간, 요청 메모, 요청 시각을 저장하도록 했다.
  - 수령 요청 생성 후 `ITEM_DONATE.status`를 `reserved`로 변경하도록 했다.
  - 나눔글 작성자에게 `pickup_request` 인앱 알림을 생성하도록 했다.
- 앱의 나눔글 상태값을 DB 기준에 맞춰 정리했다.
  - `DonateStatus`의 보관 요청 상태를 `storage_request`에서 `storage_requested`로 변경했다.
  - 백엔드 응답 상태 매핑에서 `storage_requested`를 앱 내부 상태로 인식하도록 했다.
  - 기존 `storage_request` 응답도 `storage_requested`로 변환되도록 호환 처리를 남겼다.
  - 상태 라벨 분기와 목데이터의 보관 요청 상태값을 `storage_requested`로 맞췄다.

### 2026-06-19

- Expo 앱 사진 등록과 AI 글쓰기 흐름을 다중 이미지 기준으로 정리했다.
  - 앱 글쓰기 화면에서 갤러리로 여러 장을 선택해도 첫 번째 사진만 AI 분석으로 넘기던 흐름을 선택한 이미지 전체를 넘기도록 수정했다.
  - `postAPI.checkHarmfulItem`이 단일 이미지와 이미지 배열을 모두 받을 수 있게 하고, 여러 장일 때 multipart `images` 필드로 백엔드 `/api/posts/analyze`에 전송하도록 했다.
  - 백엔드 사진 분석이 이미지마다 AI 서버를 따로 호출하던 구조를 AI 서버의 `file1`~`file5` 계약에 맞춰 한 번의 요청으로 묶어 보내도록 변경했다.
  - AI 서버가 여러 장을 보고 생성한 `suggested_title`, `ai_generated_post`, `category`, `is_same_item` 결과를 백엔드 응답 최상위에도 내려주고, 앱은 이 최상위 결과를 우선 사용하도록 정리했다.
  - 기존 `analyzed_images` 배열 응답은 유지해 기존 파싱과 디버깅 흐름이 깨지지 않도록 했다.
- Android/Expo 사진 선택과 개발 실행 상태를 점검했다.
  - Expo SDK 54 프로젝트에서 실제 설치 패키지가 `expo@54.0.35`, `react-native@0.81.5`, `expo-router@6.0.24`로 맞는 것을 확인했다.
  - `npx expo run` 실행 과정에서 생성된 Android package/permission 설정과 `ios` 실행 스크립트 변경이 작업트리에 남아 있음을 확인했다.
  - 갤러리 선택은 권한 확인/요청을 유지하되, Android Photo Picker와 충돌할 수 있는 `legacy: true` 강제 옵션을 제거했다.
  - 권한을 다시 물어볼 수 없는 상태에서는 기기 설정에서 사진 접근 권한을 허용하도록 안내하게 했다.
- 로컬 AI 서버와 ngrok fallback 사용 흐름을 정리했다.
  - Render 백엔드는 로컬 PC의 `127.0.0.1:8000`에 직접 접근할 수 없으므로, 로컬 AI 서버를 Render에서 사용하려면 ngrok 고정 도메인으로 터널링해야 함을 확인했다.
  - `AI_SERVER_URL` 뒤의 `/docs`는 제거하고, 원래 AI 서버 장애 시 `AI_SERVER_URL_FALLBACK=https://establish-railroad-motivate.ngrok-free.dev`로 넘어가는 구성을 안내했다.
  - ngrok agent `3.3.1`이 계정 최소 요구 버전보다 낮아 `ERR_NGROK_121`이 발생하는 것을 확인하고, `ngrok update`로 `3.39.8`까지 업데이트했다.
  - Expo LAN 접속 문제는 PC에서 `localhost:8081`과 `172.30.1.68:8081`은 응답하지만, 폰에서 PC의 `8081`에 접근하지 못하는 네트워크/방화벽 문제로 분리했다.
- 검증
  - `node --check backend/controllers/postController.js` 통과.
  - `frontend-app`에서 `npm run lint` 통과.
  - `frontend-app`의 `npx tsc --noEmit`은 기존 `chat.tsx messageId`, `backendClient.ts latitude undefined` 타입 오류로 실패했으며, 이번 다중 이미지 변경분에서 새 타입 오류는 확인되지 않았다.

### 2026-06-16

- 웹키오스크 물품 목록과 상세 화면 표시 흐름을 정리했다.
  - 홈 화면의 `필요한 물품 찾기` 버튼이 쉬운모드가 아니라 기본 물품 목록(`/buyer-main`)으로 이동하도록 변경했다.
  - 홈 화면의 고정 크기 UI가 창 크기에 따라 잘리지 않도록 전용 반응형 스타일을 추가했다.
  - 기본 물품 목록과 쉬운모드 목록에서 `request`/`need` 게시글이 보이지 않도록 `donate`/`share` 게시글만 필터링했다.
  - 게시글 목록에서 상세 화면으로 이동할 때 목록 응답의 게시글 데이터를 함께 넘겨, 상세 API가 이미지를 누락해도 목록 이미지 정보를 fallback으로 사용할 수 있게 했다.
  - 상세 화면이 `description`만 보던 문제를 정리해 백엔드가 내려주는 `content`도 실제 게시글 본문으로 표시하도록 했다.
  - 깨진 이미지 URL이나 누락된 이미지가 브라우저 기본 깨진 이미지 아이콘으로 보이지 않도록 `PostImage` 공통 컴포넌트와 `이미지 없음` placeholder를 추가했다.
  - 상세 화면의 이미지/본문/버튼 영역 비율을 조정해 창 크기가 변해도 사진만 커지거나 `물품 받기` 버튼이 잘리지 않도록 했다.
- 웹키오스크 수령 확인 흐름을 브라우저 기본 팝업에서 화면 중앙 모달로 변경했다.
  - 쉬운모드 목록과 상세 화면의 `물품 받기` 버튼이 `window.confirm` 대신 앱 내부 `ReceiveConfirmModal`을 띄우도록 했다.
  - 확인 시 기존과 동일하게 `/code-login?postId=...&type=...`로 이동해 회원코드를 입력받도록 유지했다.
- 이미지 저장 백엔드 흐름을 Cloudinary 우선으로 정리했다.
  - `FIREBASE_STORAGE_BUCKET` 값이 잘못 들어간 경우 Cloudinary 설정이 있어도 Firebase 분기가 먼저 실행되던 문제를 피하기 위해 Cloudinary 설정이 있으면 Cloudinary 업로드를 먼저 사용하도록 순서를 변경했다.
  - Render 프록시 환경에서 업로드 URL이 `http://.../uploads/...`로 내려오는 문제를 줄이기 위해 업로드 URL 정규화 helper를 추가했다.
  - 게시글 작성 응답과 상세 조회 응답에 `image`, `imageUrl`, `image_url`, `images` 계열 필드를 함께 내려주도록 보강했다.
  - 기존 `/uploads/...` DB 값을 Firebase URL로 옮길 수 있는 dry-run 기본 복구 스크립트 `backend/scripts/migrateUploadsToFirebase.js`를 추가했다.
- 검증
  - `node --check backend/controllers/postController.js`, `backend/server.js`, `backend/routes/members.js`, `backend/routes/mypage.js`, `backend/scripts/migrateUploadsToFirebase.js` 통과.
  - `frontend-web` production build 통과.

### 2026-06-13

- 웹키오스크 API 연결과 동네 기반 조회 흐름을 정리했다.
  - `frontend-web/src/api/client.js`의 기본 API 주소를 Render 백엔드 `https://give-app.onrender.com`로 변경했다.
  - 웹키오스크 기본 위치를 성결대학교 시연 기준 `안양동` 및 좌표 `37.3798657, 126.9288104`로 잡았다.
  - 웹키오스크 물품 목록/쉬운모드/요청 목록이 저장된 사용자 동네 또는 기본 `안양동` 기준으로 `/api/posts?dongName=...`를 호출하도록 연결했다.
  - 백엔드 `/api/posts` 목록 조회가 `dongName`, `dong_name`, `neighborhood`, `location` 쿼리를 받아 해당 동네 게시글만 반환하도록 보강했다.
  - 로컬 웹키오스크 개발 주소 `localhost:3000`, `127.0.0.1:3000`을 백엔드 CORS 기본 허용 목록에 추가했다.
- 물품보관함용 동적 QR을 게시글 기반 흐름으로 변경했다.
  - 기존 QR 화면의 자동 발급을 제거하고, 본인이 작성한 `나눔해요` 게시글을 먼저 선택한 뒤 QR을 발급하도록 앱 화면을 수정했다.
  - 앱 QR 발급 요청에 `purpose: donation_storage`와 선택한 `donateId`를 포함하도록 연결했다.
  - `DynamicQrSession`에 `donateId`를 포함하고, 백엔드 응답 매핑과 로컬 fallback 세션에도 반영했다.
  - 백엔드 `/api/device/qr/issue`가 `donation_storage` 목적일 때 `donate_id`를 필수로 검증하고, 선택한 나눔 게시글이 현재 로그인 회원의 게시글인지 확인하도록 보강했다.
  - QR 사용 완료 시 `DYNAMIC_QR.status = used`로 변경하고, 연결된 `ITEM_DONATE.status`를 `stored`로 갱신하도록 했다.
- 웹키오스크에서 물품보관함 QR을 사용할 수 있는 흐름을 추가했다.
  - 홈 화면 좌측 상단에 `물품보관함` 버튼을 추가하고 `/locker` 라우트로 이동하도록 했다.
  - `frontend-web/src/locker/LockerScreen.js`를 추가해 앱에서 발급된 보관함 QR을 웹키오스크 카메라로 인식하고 서버 검증 이후 디바이스 진행 상태 화면으로 넘어가도록 했다.
  - 디바이스 진행 상태는 시연 화면 기준 단어에 맞춰 `QR 인식`, `서버 검증`, `잠금 해제`, `물품 대기`, `물품 감지`, `데이터 반영`, `완료` 단계만 표시하도록 정리했다.
  - `html5-qrcode`를 추가해 HTTPS로 배포된 웹키오스크에서 아이패드 카메라 QR 인식이 가능하도록 준비했다.
  - 백엔드에 `POST /api/device/qr/storage/validate`, `POST /api/device/qr/storage/consume`을 추가해 웹키오스크가 로그인 없이 `donation_storage` QR을 검증하고 입고 완료 처리할 수 있게 했다.
- 웹키오스크 일반회원 로그인/회원가입 진입점을 정리했다.
  - 웹 홈의 기부자 로그인 버튼과 `/login-seller`, `/signup-seller`, `/login-buyer`, `/signup-buyer` 라우트를 제거했다.
  - 나눔받는 사람은 물품을 둘러본 뒤 수령 단계에서 `/code-login`으로 회원코드를 입력하는 흐름만 남겼다.
- 검증
  - `node --check backend/routes/device.js` 통과.
  - `frontend-web` production build 통과.
  - `frontend-app`의 `npx tsc --noEmit`은 기존 `chat.tsx messageId`, `backendClient.ts latitude undefined` 타입 오류로 실패했다. QR 변경분에서 새 타입 오류는 확인되지 않았다.

### 2026-06-09

- 채팅 메시지 전송 흐름을 중복 전송이 생기지 않도록 정리했다.
  - `sendMessage` 성공 후 프론트 상태에 메시지를 직접 한 번 더 추가하던 처리를 제거했다.
  - Firebase 실시간 구독으로 받은 메시지만 채팅방 메시지 목록에 반영되도록 했다.
  - 전송 버튼에 `isSending` 비활성화와 `sendingRef` 방어를 추가해 빠른 연타로 같은 메시지가 두 번 전송되지 않도록 했다.
- 채팅방 추가 기능의 위치/약속장소 흐름을 정리했다.
  - `위치 공유` 버튼은 실시간 위치 공유가 연결되기 전까지 채팅 메시지를 보내지 않고 안내만 띄우도록 했다.
  - `약속장소` 버튼은 카카오맵을 앱 안에서 열어 장소를 고르는 모달을 띄우도록 했다.
  - 약속장소 모달에 날짜 캘린더와 시간/분 스크롤 선택 UI를 추가했다.
  - 약속장소 전송 메시지에 장소명, 날짜, 시간, 좌표가 함께 들어가도록 했다.
  - 채팅 약속장소 지도에서는 지도 터치로 마커를 이동하되, 지도 드래그만으로 마커가 따라 움직이지 않도록 했다.
- 카카오맵 표시 방식을 앱/웹 환경에 맞게 분리했다.
  - 모바일 앱에서는 기존 `react-native-webview` 기반 카카오맵을 유지했다.
  - Expo Web localhost에서는 `react-native-webview`를 쓰지 않고 DOM에 카카오맵 SDK를 직접 붙이는 웹 전용 렌더러를 추가했다.
  - WebView와 웹 DOM 렌더러 모두 지도에서 선택한 좌표를 앱 상태로 반영하도록 정리했다.
- 게시글 작성 화면의 카테고리 선택 흐름을 정리했다.
  - 하위 품목 선택 UI의 필수 검증을 제거했다.
  - 제목에 입력한 단어를 `PRODUCT.product_name`과 매칭해 추천 카테고리를 최대 3개 노출하도록 했다.
  - `전체 보기` 버튼을 추천 카테고리 오른쪽에 고정하고, 전체 목록에서 카테고리를 선택하면 선택한 카테고리만 상단 칩으로 남도록 했다.
  - `기타` 카테고리는 표시 순서에서 마지막으로 보내도록 정렬했다.
  - AI 추천 글쓰기 적용 시 AI가 준 카테고리/카테고리 이름을 DB 카테고리명으로 매핑해 자동 선택하도록 했다.
- 취약계층 회원의 `필요해요` 게시글 작성 흐름을 단순화했다.
  - 사진 없이도 작성 폼이 바로 보이도록 했다.
  - 취약계층 작성/수정 화면에서는 물품 상태 입력을 숨기고 필수 검증에서 제외했다.
- 게시글 목록/상세 표시와 삭제 흐름을 보완했다.
  - 내가 쓴 글은 거리 칩 자체가 보이지 않도록 했다.
  - 완료된 글 보기 필터에서는 내가 쓴 글이 목록에 뜨지 않도록 했다.
  - Expo Web localhost 환경에서는 `Alert.alert` 대신 `window.confirm`으로 삭제 확인을 처리하도록 했다.
  - 게시글 삭제 API가 참조 테이블 데이터를 먼저 정리하도록 보강했다.

### 2026-05-31

- 정책 챗봇 백엔드와 AI 서버 연동을 실제 AI 서버 명세에 맞게 수정했다.
  - `backend/routes/policies.js`에서 AI 서버 후보 경로에 `/api/chat/`를 추가했다.
  - AI 서버 `/api/chat/` 호출 시 요청 body를 `{ user_message, member_id }` 형식으로 변환하도록 했다.
  - AI 서버 응답의 `ai_response`, `recommended_policies`를 앱 응답의 `response`, `suggestedPolicies`로 매핑하도록 했다.
  - AI 서버 호출에서 로컬 프록시 환경변수 영향을 받지 않도록 `axios` 요청에 `proxy: false`를 추가했다.
- 정책 카테고리 화면의 정책 목록 로딩을 수정했다.
  - `policyAPI.listPolicies`가 `authToken`을 받아 `Authorization` 헤더를 붙여 `/api/policies`를 호출하도록 변경했다.
  - 정책 목록 조회 시 `authToken`을 전달하도록 화면을 변경했다.
  - 카테고리 버튼은 여러 개가 동시에 선택되지 않고 하나만 선택되도록 변경했다.
  - 정책 DB 카테고리에 맞춰 카테고리 목록을 `고용`, `문화` 등으로 정리했다.

### 2026-05-30

- Render 백엔드 배포 흐름을 정리하고 실제 배포 설정을 맞췄다.
  - 루트 `package.json`의 `npm start`가 `node backend/server.js`를 실행하므로 Render Root Directory는 비우고 Start Command는 `npm start`를 쓰는 방향으로 정리했다.
  - Render 환경변수 입력 방식과 `Add from .env` 사용 방식을 확인했다.
  - `backend/db.js`에서 `DB_CA_CERT` 환경변수를 우선 사용하고, 없으면 로컬 `backend/ca.pem`을 읽도록 수정했다.
  - `backend/.env.example`에 `DB_CA_CERT` 예시 값을 추가했다.
  - Expo 앱의 API 주소를 Render 백엔드 주소 `https://give-app.onrender.com`로 변경했다.
  - `backend/server.js`에 Expo Web 로컬 주소를 CORS 허용 목록에 추가하고, 추가 배포 주소는 `CORS_ORIGINS` 환경변수로 넣을 수 있게 정리했다.
  - AI 서버가 꺼져 있을 때 백엔드 AI 이미지 분석 요청이 오래 대기하지 않도록 AI 서버 호출에 20초 timeout을 추가했다.
  - AI 서버 연결 실패 시 `/api/posts/analyze`가 `503`과 명확한 안내 메시지를 반환하도록 수정했다.
- 정책 백엔드 API를 추가했다.
  - `GET /api/policies`
  - `GET /api/policies?category=...`
  - `POST /api/policies/history`
  - `GET /api/policies/recommended`
  - 검색 기록 저장 시 JWT의 `member_id` 기준으로 `SEARCH_HISTORY`에 저장하도록 했다.
  - 추천 기록이 없을 때 전체 정책 일부를 반환하는 fallback을 추가했다.
  - `MEMBER.gender`, `MEMBER.birth_date` 컬럼 존재 여부에 따른 방어 처리를 추가했다.

### 2026-05-29

- 웹키오스크용 `요청해요` 백엔드 API를 정리했다.
  - 웹키오스크 요청글 작성 전용으로 `POST /api/wanted` 라우트를 추가했다.
  - 요청글 목록/상세 조회는 새로 만들지 않고 기존 `GET /api/posts`, `GET /api/posts/:id?type=request`를 계속 사용하도록 정리했다.
  - `POST /api/wanted`는 취약계층 회원(`role_id = 3`)만 작성 가능하도록 검증했다.
  - 웹키오스크 요청글은 `ITEM_REQUEST.created_from = 'web'`으로 저장하고, 앱에서 작성한 요청글은 기본 `created_from = 'app'`으로 저장하도록 보완했다.
  - 요청글 목록/상세 응답에 `createdFrom`, `created_from`을 포함해 앱에서 키오스크 작성 글을 구분할 수 있도록 했다.
  - 요청글은 `content`가 비어 있거나 `null`이어도 처리되도록 했다.
- 웹키오스크 인증번호 로그인 API를 추가했다.
  - `backend/routes/auth.js`에 `POST /api/auth/code-login` 라우트를 추가했다.
  - `VULNERABLE_CERTIFICATE.certificate_no`로 인증서를 조회하고, `status = active`, `expires_at` 유효 조건을 검사하도록 했다.
  - 인증서의 `name`과 `phone` 숫자값을 기준으로 기존 `MEMBER`를 먼저 조회하도록 했다.
  - 기존 앱 회원이 있으면 키오스크 회원을 새로 만들지 않고 해당 회원으로 로그인하도록 했다.
  - 기존 회원 또는 키오스크 회원의 `nickname`이 비어 있으면 `이웃0000` 형식의 닉네임을 자동 생성해 저장하도록 했다.
- 정책 기능 구현 방향을 정리했다.
  - 정책 탭의 3개 모드를 `AI 추천`, `챗봇`, `카테고리`로 나누어 정리했다.
  - `POLICY` 테이블 실제 컬럼 기준으로 프론트 응답 key 매핑을 정리했다.
  - 프론트 key를 DB 컬럼명으로 바꾸기보다 백엔드 API 응답에서 프론트용 key로 변환해 내려주는 방향으로 정리했다.
- 정책 챗봇 API를 추가했다.
  - `backend/routes/policies.js`를 새로 만들고 `POST /api/policies/chatbot`을 추가했다.
  - `backend/server.js`에 `/api/policies` 라우트를 등록했다.
  - 앱에서 보내는 `message`, `conversationHistory`를 받아 JWT 인증 후 처리하도록 했다.
  - 로그인 회원 정보와 `POLICY` 테이블의 정책 목록을 조회해 AI 서버에 전달할 context를 구성하도록 했다.

### 2026-05-23

- 마이페이지 관련 기능을 백엔드 API와 실제 화면 흐름에 맞춰 정리했다.
  - 메인 마이페이지 QR 카드 추가는 사용자의 요청에 따라 제외했다.
  - 프로필 수정, 프로필 이미지 업로드, 동네 설정, 나눔 통계, 나의 나눔/활동, 설정, 관리자 문의, 동적 QR, 알림 설정 쪽을 우선 연결했다.
- 게시글 수정 API를 `PATCH` 방식으로 정리했다.
  - `backend/routes/posts.js`에서 게시글 수정 라우트를 `PATCH /api/posts/:id`로 변경했다.
  - `backend/controllers/postController.js`에서 게시글 타입을 query/body 양쪽에서 안정적으로 읽도록 보완했다.
  - `frontend-app/src/services/api.ts`의 게시글 수정 호출도 `PATCH`로 맞췄다.
- 프로필 수정 기능을 보강했다.
  - `backend/routes/members.js`에서 `GET /api/members/me`, `PATCH /api/members/me`가 `bio`, `profile_image`를 다루도록 수정했다.
  - `PATCH /api/members/me/profile-image` API를 추가했다.
  - 업로드된 프로필 이미지는 `/uploads/...` URL로 정리해서 `MEMBER.profile_image`에 저장했다.
  - 앱의 프로필 이미지/자기소개 흐름을 백엔드 API와 연결했다.
- 알림 API를 추가했다.
  - `backend/routes/notifications.js`를 새로 만들고 `backend/server.js`에 `/api/notifications` 라우트를 등록했다.
  - `GET /api/notifications`: 기존 DB 문서의 `NOTIFICATION` 테이블 구조에 맞춰 알림 목록을 조회한다.
  - `PATCH /api/notifications/:id/read`: 알림 읽음 처리를 한다.
  - `GET /api/notifications/settings/me`: 사용자별 알림 설정을 조회한다.
  - `PATCH /api/notifications/settings/me`: 사용자별 알림 설정을 저장한다.
- 동적 QR API를 DB 기반으로 정리했다.
  - `backend/routes/device.js`에서 동적 QR 발급/검증/사용 처리를 `DYNAMIC_QR` 테이블 기반으로 변경했다.
  - QR 토큰, 표시 코드, 만료 시간, 사용 여부, 상태값을 서버에서 관리하도록 했다.
- 검증
  - 백엔드 주요 파일에 대해 `node --check` 문법 체크를 통과했다.
  - `frontend-app`에서 `npx tsc --noEmit` 타입 체크를 통과했다.
  - `frontend-app`에서 `npm run lint`를 통과했다.

### 2026-05-19

- 기존 프로젝트 구조와 실행 환경을 정리했다.
  - `backend`는 Express/MySQL 백엔드이며 루트 `GIVE` 폴더에서 `npm start`로 실행하는 구조임을 확인했다.
  - `frontend-app`은 Expo/React Native 프로젝트로 정리했다.
  - `frontend-web`은 Create React App 기반 웹키오스크 프로젝트로 정리했다.
- 앱과 백엔드 연결 상태를 점검했다.
  - Android 에뮬레이터 기준 로컬 API 주소는 `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`을 사용하도록 정리했다.
  - 백엔드는 루트 `GIVE`에서 별도 실행해야 하고, 앱은 `frontend-app`에서 `npm run android` 또는 `npm run android:clear`로 실행하도록 정리했다.
  - 회원가입, 이미지 분석, 마이페이지, 채팅 API 경로를 PDF API 명세 기준으로 맞췄다.
  - JWT 설정이 루트 `.env`와 백엔드 인증 미들웨어에서 같은 값을 쓰도록 정리했다.
- 웹프론트 상태를 정리했다.
  - `frontend-web`은 아직 백엔드 API와 완전히 연결되지 않은 mock 구조임을 확인했다.
  - 웹프론트를 백엔드에 연결하려면 `.env.local` API 주소와 로그인/회원가입 컴포넌트 fetch 연결이 필요하다고 정리했다.
- 검증
  - `frontend-app`에서 `npx tsc --noEmit` 통과.
  - `frontend-app`에서 `npm run lint` 통과.
  - 백엔드 주요 변경 파일에 대해 `node --check` 통과.

### 2026-05-18

- Android 에뮬레이터 실행 환경을 점검했다.
  - Expo 앱은 Android 에뮬레이터 기준 `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`을 사용하도록 정리했다.
  - 백엔드 서버는 로컬 `3000` 포트에서 실행하는 구조로 확인했다.
- 로그인 문제를 점검했다.
  - DB에 bcrypt 해시가 아닌 과거 테스트용 평문 비밀번호가 남아 있는 경우 기존 로그인 로직에서 실패하는 문제를 확인했다.
  - 해시 비밀번호는 `bcrypt.compare()`로 검증하고, 해시가 아닌 테스트 계정은 지정된 테스트 비밀번호만 통과하도록 fallback을 추가했다.
  - 테스트 fallback 비밀번호로 `User1234!`, `Bene1234!`를 허용했다.
- 게시글 등록 중 DB `product_id` 오류를 수정했다.
  - 프론트 mock 값인 `product_3` 같은 문자열이 MySQL 정수 컬럼에 들어가며 `Incorrect integer value`가 발생하는 문제를 확인했다.
  - 백엔드에서 mock product id와 카테고리를 실제 `PRODUCT.product_id`로 매핑하도록 보정했다.
  - 프론트에서도 카테고리별 기본 product id를 내려주도록 보완했다.
- 게시글 목록 새로고침 문제를 분석하고 수정했다.
  - 등록 직후에는 프론트 메모리에 글이 추가되어 보이지만 새로고침 후에는 `/api/posts` 응답으로 목록을 다시 만드는 구조임을 확인했다.
  - 백엔드 게시글 목록 API가 본문, 작성자, 위치, 카테고리, 이미지 URL, 고유 id를 내려주도록 확장했다.
- AI 서버 연결 문제를 점검했다.
  - AI 글쓰기/이미지 분석 실패 원인으로 Gemini API key invalid, ngrok 502, Gemini quota 초과 가능성을 확인했다.
  - ngrok `ERR_NGROK_8012`는 터널은 살아 있으나 upstream 로컬 AI 서버 연결이 거부되는 상태로 분석했다.
  - Gemini `429 RESOURCE_EXHAUSTED`는 무료 계정 요청 한도 초과로 AI 호출 단계에서 실패하는 상황으로 정리했다.
- 검증
  - 프론트 `npm run lint` 통과.
  - 프론트 `npx tsc --noEmit` 통과.
  - 백엔드 주요 변경 파일 `node --check` 통과.

### 2026-05-14

- 로그인 실패 메시지와 비밀번호 검증 방식을 정리했다.
  - `POST /api/auth/login`에서 평문 비밀번호 fallback 로그인을 제거하고 bcrypt 해시 비밀번호만 허용하도록 유지했다.
  - 로그인 identifier가 이메일 형태인데 계정이 없으면 `등록하지 않은 이메일입니다.`를 반환하도록 했다.
  - 로그인 identifier가 전화번호 형태인데 계정이 없으면 `등록하지 않은 전화번호입니다.`를 반환하도록 했다.
  - 비밀번호가 틀리면 `비밀번호가 올바르지 않습니다.`를 반환하도록 했다.
  - 실패 응답에 `field` 값을 함께 내려 추후 프론트에서 입력칸별 오류 표시로 확장할 수 있게 했다.
- `frontend-app`의 mock 로그인도 실제 로그인 정책에 맞췄다.
  - 백엔드가 꺼져 mock 로그인 경로를 타더라도 이메일/전화번호 identifier로 사용자를 찾도록 바꿨다.
  - mock 로그인에서도 비밀번호를 확인하고, 틀리면 `비밀번호가 올바르지 않습니다.`를 반환하도록 했다.
- Android 에뮬레이터 갤러리 선택 문제를 수정했다.
  - 일부 에뮬레이터에서 `android.provider.action.PICK_IMAGES`를 처리할 Activity가 없어 갤러리가 열리지 않는 문제를 확인했다.
  - `expo-image-picker` 갤러리 호출에 `legacy: true`를 추가해 Android Photo Picker 대신 기존 파일 선택 방식을 사용하도록 했다.
  - Android cropper 단계 오류를 줄이기 위해 이미지 선택에서 `allowsEditing: true`를 제거했다.
- 이미지 선택 오류 확인을 쉽게 만들었다.
  - 글쓰기 사진 선택, 이미지 검색 사진 선택, 취약계층 증빙 이미지 선택, 마이페이지 프로필 사진 선택에서 실제 오류 메시지를 Alert와 console에 표시하도록 했다.
- AI 이미지 자동 실패 원인을 확인했다.
  - 사진 선택 뒤 AI 자동 분석은 `앱 -> 백엔드 -> AI 서버` 순서로 동작함을 정리했다.
  - `Request failed with status code 404`는 백엔드가 호출하는 AI 서버 주소 또는 실제 API 경로가 맞지 않을 때 발생할 수 있음을 확인했다.
  - AI 서버가 꺼져 있거나 ngrok 주소가 바뀐 경우 `.env`의 AI 서버 주소를 최신값으로 맞추고 백엔드를 재시작해야 한다고 정리했다.
- 검증
  - `backend/routes/auth.js`에 대해 `node --check` 통과.
  - `frontend-app`에서 `npm run lint` 통과.

### 2026-05-11

- 작업 범위는 사용자의 요청대로 프론트는 건드리지 않고 백엔드만 수정하는 것으로 정리했다.
- 마이페이지 백엔드 API를 보강했다.
  - `GET /api/mypage/summary`: 마이페이지 메인에 필요한 회원 정보, 나눔 수, 요청 수, 활성 QR 상태, 디바이스 대기 상태를 반환하도록 했다.
  - `GET /api/mypage/histories`: 내가 작성한 나눔/요청 내역을 이미지와 함께 반환하도록 보강했다.
  - `GET /api/mypage/stats`: 3개월/6개월/1년 기준 나눔 통계 데이터를 반환하도록 했다.
  - `POST /api/mypage/contact`: 관리자 문의 등록 API를 추가했다. 현재는 DB 테이블이 없어 메모리 임시 저장 방식이다.
- 회원 관련 마이페이지 API를 보강했다.
  - `PATCH /api/members/me`: 이름, 닉네임, 이메일, 전화번호, 비밀번호 수정이 가능하도록 보강했다.
  - `PATCH /api/members/me/location`: 동네명만으로도 동네 수정이 가능하도록 보강했다.
  - `GET /api/members/me/posts`: 내가 작성한 나눔/요청 글 조회 API를 추가했다.
  - `GET /api/members/me/likes`: 찜한 글 조회 API를 추가했다.
- 동적 QR 및 키오스크 로그인용 백엔드 API를 추가했다.
  - `POST /api/device/qr/issue`: 앱에 로그인한 회원이 로그인용 QR 토큰을 발급받도록 했다.
  - `POST /api/device/qr/validate`: QR 토큰 유효성을 검증하도록 했다.
  - `POST /api/device/qr/consume`: QR 토큰을 사용 완료 처리하도록 했다.
  - `POST /api/device/qr/kiosk-login`: 키오스크가 앱 로그인용 QR을 스캔하면 회원 정보를 확인하고 키오스크 세션을 만들도록 했다.
- 채팅방 후기 작성 기능을 백엔드에 추가했다.
  - `GET /api/chats/:roomId/review-status`
  - `GET /api/chats/rooms/:roomId/review-status`
  - `POST /api/chats/:roomId/review`
  - `POST /api/chats/rooms/:roomId/review`
  - 후기 가능 조건은 채팅방 참여자이고, 연결된 나눔글 상태가 `completed`이며, 본인 나눔글이 아니고, 아직 후기를 작성하지 않은 경우로 제한했다.
- 게시글 상태 변경 로직을 보강했다.
  - `PUT /api/posts/:id?type=donate`에서 `status`를 수정할 수 있게 했다.
  - `PATCH /api/posts/:id/status?type=donate` 라우트를 추가했다.
- 로그인 API 응답을 프론트가 읽기 쉬운 형태로 보강했다.
  - `POST /api/auth/login`에서 이메일 또는 전화번호를 identifier로 받을 수 있게 했다.
  - 응답에 `data.user` 객체를 포함하도록 했다.
- DB 담당자에게 전달할 최종 요청사항을 정리했다.
  - `REVIEW` 테이블은 이미 있으므로 새로 만들 필요는 없다. 다만 `UNIQUE(donate_id, writer_id)` 제약 추가를 권장한다.
  - `VULNERABLE_CERTIFICATE`, `DONATION_RECEIPT_LOG`, `DYNAMIC_QR`, `CONTACT_INQUIRY` 테이블 추가 필요성을 정리했다.
- 검증
  - 변경한 주요 백엔드 파일에 대해 `node --check` 문법 검사를 통과했다.
  - 실제 서버 실행 및 DB 연결 통합 테스트는 아직 진행하지 않았다.

### 2026-04-23

- 채팅방 나가기 기능 구현 여부를 확인했다.
- API 명세서 기준으로 `DELETE /api/chats/rooms/{chat_room_id}`가 필요함을 확인했다.
- `backend/routes/chat.js`에 `DELETE /api/chats/rooms/:roomId`를 추가했다.
- 사용자가 채팅방을 나가면 `participants`, `participantIds`에서 해당 사용자를 제거하도록 구현했다.
- 남은 참여자가 없으면 메시지 서브컬렉션과 채팅방 문서를 삭제하도록 처리했다.
- `frontend/src/app/services/api.ts`에 `chatAPI.leaveRoom(chatId)`를 추가했다.
- `frontend/src/app/pages/chat/ChatRoomScreen.tsx`의 채팅방 나가기 버튼을 실제 API 호출에 연결했다.
- 나가기 전 확인창을 띄우고, 성공하면 `/chat` 목록으로 이동하도록 구현했다.

### 2026-04-21

- React Native 전환과 백엔드 영향 범위를 정리했다.
- 현재 프론트가 React Native가 아니라 Vite 기반 React 앱임을 확인했다.
- React Native로 전환해도 백엔드는 대부분 유지 가능하고, 파일 업로드와 위치 전달 방식만 테스트가 필요하다고 정리했다.
- 새 키오스크와 앱이 모두 같은 백엔드 API를 사용하려면 API 서버 중심 구조가 중요하다고 정리했다.
- Zustand를 쓰는 새 키오스크 앱이 백엔드 API를 호출하고 store에 저장하는 방식으로 연동한다는 개념을 정리했다.

### 2026-04-20

- Firebase Admin 기반 채팅 백엔드 구조를 추가했다.
- `backend/routes/chat.js`에 채팅방 생성, 채팅방 목록 조회, 메시지 조회, 메시지 전송 API를 구현했다.
- `backend/lib/firebaseAdmin.js`를 추가해 Firebase Admin SDK 초기화를 분리했다.
- Firebase 서비스 계정 환경변수 설정 방식을 정리했다.
- Firestore API 활성화, Firestore Database 생성, Rules 설정 문제를 해결하며 채팅 기능을 실제로 테스트했다.
- 채팅방 중복 생성 방지를 추가했다.
- 같은 참여자 조합과 같은 게시글 기준으로 기존 채팅방을 재사용하도록 `roomKey`를 저장하게 했다.
- `backend/db.js`에서 `backend/.env`가 없으면 루트 `.env`를 읽도록 수정했다.
- DB `ca.pem` 경로 문제를 확인했고, 서버 실행 시 `backend/ca.pem`이 필요하다는 점을 정리했다.
- 개발용 회원 정리 API를 보완했다.
- 잘못 만든 계정 삭제 시 회원과 관련 게시글/이미지/아이템 데이터를 함께 정리하도록 트랜잭션 기반 삭제 흐름을 만들었다.
- 개발 환경에서만 동작하는 삭제 API는 `x-dev-delete-key` 헤더 확인으로 정리했다.
