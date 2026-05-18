# GIVE Worklog

## 2026-04-14 이후 작업 요약

### 2026-05-18
- 로그인 실패 메시지와 비밀번호 검증 방식을 정리했다.
  - `POST /api/auth/login`에서 평문 비밀번호 fallback 로그인을 제거하고 bcrypt 해시 비밀번호만 허용하도록 유지했다.
  - 로그인 identifier가 이메일 형태인데 계정이 없으면 `등록되지 않은 이메일입니다.`를 반환하도록 했다.
  - 로그인 identifier가 전화번호 형태인데 계정이 없으면 `등록되지 않은 전화번호입니다.`를 반환하도록 했다.
  - 비밀번호가 틀리면 `비밀번호가 올바르지 않습니다.`를 반환하도록 했다.
  - 실패 응답에 `field` 값을 함께 내려 추후 프론트에서 입력칸별 오류 표시로 확장할 수 있게 했다.
- `frontend-app`의 mock 로그인도 실제 로그인 정책에 맞췄다.
  - 백엔드가 꺼져 mock 로그인 경로를 타더라도 이메일/전화번호 identifier로 사용자를 찾도록 바꿨다.
  - mock 로그인에서도 비밀번호를 확인하고, 틀리면 `비밀번호가 올바르지 않습니다.`를 반환하도록 했다.
- Android 에뮬레이터 갤러리 선택 문제를 수정했다.
  - 노트북 에뮬레이터에서 `android.provider.action.PICK_IMAGES`를 처리할 Activity가 없어 갤러리가 열리지 않는 문제를 확인했다.
  - `expo-image-picker`의 갤러리 호출에 `legacy: true`를 추가해 새 Android Photo Picker 대신 기존 파일 선택 방식을 사용하도록 했다.
  - 갤러리 선택에서 Android cropper 단계 오류를 피하기 위해 라이브러리 선택 시 `allowsEditing: true`를 제거했다.
- 이미지 선택 오류 확인을 쉽게 만들었다.
  - 글쓰기 사진 선택, 이미지 검색 사진 선택, 취약계층 증빙 이미지 선택, 마이페이지 프로필 사진 선택에서 실제 에러 메시지를 Alert와 console에 표시하도록 했다.
  - 덕분에 갤러리 문제의 실제 원인인 `No Activity found to handle Intent ... PICK_IMAGES` 메시지를 확인할 수 있었다.
- AI 이미지 판독 실패 원인을 확인했다.
  - 앱의 갤러리 문제와 별개로, 사진 선택 후 AI 판독은 `앱 -> 백엔드 -> AI 서버` 순서로 동작한다.
  - `Request failed with status code 404`는 백엔드가 호출하는 AI 서버 주소 또는 AI 서버의 실제 API 경로가 맞지 않을 때 발생할 수 있음을 확인했다.
  - AI 서버가 꺼져 있거나 ngrok 주소가 바뀐 경우 `.env`의 AI 서버 주소를 최신값으로 맞추고 백엔드를 재시작해야 한다고 정리했다.
- 검증:
  - `backend/routes/auth.js`에 대해 `node --check` 문법 검사를 통과했다.
  - `frontend-app`에서 `npm run lint`를 통과했다.

### 2026-04-20
- Firebase Admin 기반 채팅 백엔드 구조를 추가했다.
- `backend/routes/chat.js`에 채팅방 생성, 채팅방 목록 조회, 메시지 조회, 메시지 전송 API를 구현했다.
- `backend/lib/firebaseAdmin.js`를 추가해 Firebase Admin SDK 초기화를 분리했다.
- Firebase 서비스 계정 환경변수 설정 방식을 정리했다.
- Firestore API 활성화, Firestore Database 생성, Rules 설정 문제를 해결하며 채팅 기능을 실제로 테스트했다.
- 채팅방 중복 생성 방지를 추가했다.
- 같은 참여자 조합과 같은 게시글 기준으로 기존 채팅방을 재사용하도록 `roomKey`를 저장하게 했다.
- `backend/db.js`에서 `backend/.env`가 없으면 루트 `.env`를 읽도록 수정했다.
- DB `ca.pem` 경로 문제를 확인했고, 팀원 실행 시 `backend/ca.pem`이 필요하다는 점을 정리했다.
- 개발용 회원 정리 API를 보완했다.
- 잘못 만든 계정 삭제 시 회원과 관련 게시글/이미지/아이템 데이터를 함께 정리하도록 트랜잭션 기반 삭제 흐름을 만들었다.
- 개발 환경에서만 동작하는 삭제 API와 `x-dev-delete-key` 헤더 정책을 정리했다.

### 2026-04-20
- 게시글 작성 흐름을 백엔드 API에 맞춰 정리했다.
- 일반 회원은 `나눔해요`, 취약계층은 `필요해요` 글을 작성하도록 `role_id` 기반 분기를 수정했다.
- 개발 테스트용으로 `qr_code`가 없어도 `isVulnerable: true`이면 `role_id = 3`으로 가입되도록 예외를 추가했다.
- `AI_SERVER_URL`이 없을 때 이미지 분석 API가 명확한 오류를 반환하도록 정리했다.
- 요청글은 사진이 선택사항이고, 사진이 있을 때만 AI 검사 대상으로 보도록 정책을 정리했다.
- 게시글 작성 시 `item_condition`이 없거나 이상한 값이면 DB 제약조건에 맞는 `상태 무관`으로 보정하도록 수정했다.
- `ITEM_DONATE`, `ITEM_REQUEST`에 위치 스냅샷 컬럼이 필요하다는 점을 DB 담당자에게 전달할 SQL로 정리했다.
- DB에 `dong_name`, `latitude`, `longitude` 컬럼이 없어서 발생한 `Unknown column 'dong_name'` 오류를 분석했다.
- 작성 당시 위치가 게시글에 고정되어야 하므로 두 게시글 테이블 모두 위치 스냅샷 컬럼이 필요하다는 설계를 확정했다.

### 2026-04-20
- 프론트 채팅 연결을 보완했다.
- 게시글 상세에서 `채팅하기`를 누르면 실제 채팅방을 생성하고 `/chat/:roomId`로 이동하도록 연결했다.
- 게시글 카드에서 상세 이동 시 게시글 유형 `share`/`need`를 함께 넘기도록 수정했다.
- 상세 화면이 `post_id`만으로 다른 유형의 글을 잘못 불러오는 문제를 막기 위해 URL query에 `type`을 포함하도록 정리했다.
- `frontend/src/app/services/api.ts`에 채팅방 생성 API 호출을 추가했다.
- 로그인 후 현재 사용자 `member_id`를 저장해 메시지 발신자 구분에 사용하도록 보완했다.
- 채팅 목록과 채팅방 화면이 백엔드 채팅 API를 사용하도록 연결했다.

### 2026-04-20
- 지역 설정 화면을 수정했다.
- 지역 선택 버튼을 누르는 즉시 회원가입 API가 호출되던 문제를 고쳤다.
- 지역은 선택만 하도록 바꾸고, 하단 `회원가입` 버튼을 눌렀을 때만 가입 요청이 나가도록 변경했다.
- 현재 위치 기반 자동 설정은 추후 작업으로 남기고, 임시로 선택 또는 입력된 지역을 가입 정보로 보내도록 했다.

### 2026-04-20
- Firebase 실시간 채팅을 프론트에 연결했다.
- `frontend`에 Firebase 웹 SDK를 설치했다.
- `frontend/src/app/services/firebaseChat.ts`를 추가해 Firestore `onSnapshot` 기반 메시지 실시간 구독을 구현했다.
- 기존 2초 폴링 방식에서 채팅방 메시지만 Firestore 실시간 구독으로 전환했다.
- Firebase 웹 앱 설정값을 `frontend/.env`에서 읽도록 구성했다.
- `frontend/.env.example`을 추가해 필요한 웹 Firebase 환경변수를 문서화했다.
- `frontend/.env`가 Git에 올라가지 않도록 `.gitignore`를 보완했다.
- Firestore Rules 때문에 발생한 `Missing or insufficient permissions` 문제를 테스트 규칙으로 해결했다.

### 2026-04-20
- GitHub 협업 흐름을 정리했다.
- `master`에서 `main`으로 브랜치명을 맞췄다.
- 원격 저장소 `origin`을 연결하고 push 충돌을 rebase로 해결했다.
- GitHub Push Protection이 `.env`와 Firebase 서비스 계정 JSON을 막은 문제를 해결했다.
- `.env`, Firebase service account JSON, `ca.pem` 등 로컬 민감 파일을 Git에서 제외하는 방향으로 정리했다.
- 팀원이 `git pull`, `git clone`, ZIP 다운로드 중 어떤 방식으로 최신 코드를 받아야 하는지 안내했다.
- Git 미설치, ZIP 폴더라 `.git`이 없는 경우, `ca.pem` 누락으로 백엔드가 실행되지 않는 경우를 각각 정리했다.

### 2026-04-21
- React Native 전환과 백엔드 영향 범위를 정리했다.
- 현재 프론트가 React Native가 아니라 Vite 기반 웹 React임을 확인했다.
- React Native로 전환해도 백엔드는 대부분 유지 가능하고, 파일 업로드와 위치 전달 방식만 테스트가 필요하다고 정리했다.
- 웹 키오스크와 앱 프론트가 모두 같은 백엔드 API를 사용할 수 있도록 API 서버 중심 구조가 중요하다고 정리했다.
- Zustand를 쓰는 웹 키오스크 프론트가 백엔드 API를 호출하고 store에 저장하는 방식으로 연동된다는 개념을 정리했다.

### 2026-04-23
- 채팅방 나가기 기능 구현 여부를 확인했다.
- API 명세서 기준으로 `DELETE /api/chats/rooms/{chat_room_id}`가 필요함을 확인했다.
- `backend/routes/chat.js`에 `DELETE /api/chats/rooms/:roomId`를 추가했다.
- 사용자가 채팅방을 나가면 `participants`, `participantIds`에서 해당 사용자를 제거하도록 구현했다.
- 남은 참여자가 없으면 메시지 서브컬렉션과 채팅방 문서를 삭제하도록 처리했다.
- `frontend/src/app/services/api.ts`에 `chatAPI.leaveRoom(chatId)`를 추가했다.
- `frontend/src/app/pages/chat/ChatRoomScreen.tsx`의 `채팅방 나가기` 버튼을 실제 API 호출에 연결했다.
- 나가기 전 확인창을 띄우고, 성공하면 `/chat` 목록으로 이동하도록 구현했다.

## 남은 주의사항
- `채팅방 나가기` 관련 변경사항은 작성 당시 아직 커밋되지 않은 상태였다.
- `frontend/.env`, 루트 `.env`, `backend/ca.pem`은 로컬 설정 파일이므로 GitHub에 올리지 않는다.
- Firestore 테스트 규칙은 개발용이며, 배포 전에는 참여자만 읽고 쓸 수 있도록 보안 규칙을 강화해야 한다.
- React Native 전환 시 백엔드는 대부분 유지 가능하지만, 이미지 업로드 `FormData` 형식과 위치 권한 기반 요청 형식은 별도 테스트가 필요하다.

### 2026-05-11
- 작업 범위: 사용자가 "프론트엔드는 건드리지 말고 백엔드만 수정"을 요청했다.
- 마이페이지 백엔드 API를 보강했다.
  - `GET /api/mypage/summary`: 마이페이지 메인용 회원 정보, 나눔 수, 신청 수, 활성 QR 상태, 디바이스 대기 상태를 반환한다.
  - `GET /api/mypage/histories`: 내가 작성한 나눔/요청 내역을 이미지와 함께 반환하도록 보강했다.
  - `GET /api/mypage/stats`: 3개월/6개월/1년 기준 나눔 통계 데이터를 반환한다.
  - `POST /api/mypage/contact`: 관리자 문의 등록 API를 추가했다. 현재는 DB 테이블이 없어 메모리 임시 저장 방식이다.
- 회원 관련 마이페이지 API를 보강했다.
  - `PATCH /api/members/me`: 이름, 닉네임, 이메일, 전화번호, 비밀번호 수정이 가능하도록 보강했다.
  - `PATCH /api/members/me/location`: 동네명만으로도 동네 수정이 가능하도록 보강했다.
  - `GET /api/members/me/posts`: 내가 작성한 나눔/요청 글 조회 API를 추가했다.
  - `GET /api/members/me/likes`: 찜한 글 조회 API를 추가했다.
- 동적 QR 및 키오스크 로그인용 백엔드 API를 추가했다.
  - `POST /api/device/qr/issue`: 앱에 로그인한 회원이 로그인용 QR 토큰을 발급받는다.
  - `POST /api/device/qr/validate`: QR 토큰 유효성을 검증한다.
  - `POST /api/device/qr/consume`: QR 토큰을 사용 완료 처리한다.
  - `POST /api/device/qr/kiosk-login`: 키오스크가 앱 로그인용 QR을 스캔한 뒤 회원 정보를 확인하고 키오스크 세션을 만든다.
  - `GET /api/device/relay`, `GET /api/device/sensor`: 기부함 디바이스 상태 테스트용 응답을 반환한다.
  - `backend/routes/device.js` 파일을 새로 만들고 `backend/server.js`에 `/api/device` 라우트를 연결했다.
- 채팅방 후기 작성 기능을 백엔드에 추가했다.
  - `GET /api/chats/:roomId/review-status`
  - `GET /api/chats/rooms/:roomId/review-status`
  - `POST /api/chats/:roomId/review`
  - `POST /api/chats/rooms/:roomId/review`
  - 후기 가능 조건: 채팅방 참여자이며, 연결된 나눔글 상태가 `completed`이고, 본인 나눔글이 아니며, 아직 후기를 작성하지 않은 경우.
  - `REVIEW` 테이블이 있으면 DB에 저장하고, 없으면 개발용으로 메모리 임시 저장한다.
- 게시글 상태 변경 로직을 보강했다.
  - `PUT /api/posts/:id?type=donate`에서 `status`도 수정 가능하게 했다.
  - `PATCH /api/posts/:id/status?type=donate` 라우트를 추가했다.
  - 나눔글 상태가 `completed`가 되어야 후기 작성 가능 상태가 된다.
- 로그인 API 응답을 프론트가 쓰기 쉬운 형태로 보강했다.
  - `POST /api/auth/login`이 이메일 또는 전화번호를 identifier로 받을 수 있게 했다.
  - 응답에 `data.user` 객체를 포함하도록 했다.
- AI 이미지 분석 서버 주소를 루트 `.env`에 갱신했다.
  - `AI_SERVER_URL`은 ngrok `/docs` 주소로 저장했으며, 백엔드는 자동으로 `/api/image` 호출 주소로 변환한다.
  - 실제 주소/비밀값은 워크로그에 기록하지 않는다.
- 취약계층 인증서 QR 기능은 아직 구현하지 않았다. 설계만 합의했다.
  - 취약계층 QR은 로그인용이 아니라 "자격 인증용"이다.
  - 앱에서는 취약계층 인증서 QR을 스캔해 이름, 전화번호, 주소, 인증서 번호 등을 자동 입력하고 DB 사전 등록 정보와 대조한다.
  - 키오스크에서는 회원가입/로그인 없이 취약계층 인증서 QR만으로 자격을 확인하고 나눔받기 절차로 진행한다.
  - 나눔을 실제로 받으면 어떤 인증서의 사람이 어떤 물건을 받았는지 DB 로그를 남겨야 한다.
- DB 담당자에게 전달할 최종 요청사항을 정리했다.
  - `REVIEW` 테이블은 이미 있으므로 새로 만들 필요 없음. 다만 `UNIQUE(donate_id, writer_id)` 제약 추가 권장.
  - `VULNERABLE_CERTIFICATE` 테이블 추가 필요: 취약계층 인증서 QR 검증용.
  - `DONATION_RECEIPT_LOG` 테이블 추가 필요: 비회원 취약계층 QR 수령 기록 저장용.
  - `DYNAMIC_QR` 테이블 추가 권장: 앱 로그인용 QR 기록 보존 및 재사용 방지용.
  - `CONTACT_INQUIRY` 테이블 추가 권장: 마이페이지 관리자 문의 저장용.
  - `MEMBER.profile_image`, `MEMBER.bio` 컬럼은 프로필 사진/자기소개 저장이 필요할 경우 선택 추가.
- 기존 DB 테이블 문서 확인 결과:
  - `ITEM_DONATE.status`에 `completed`가 이미 명시되어 있으므로 별도 상태값 추가 요청은 필요 없다.
  - 찜 테이블은 `ITEM_DONATE_LIKE`, `ITEM_REQUEST_LIKE`가 이미 있으므로 DB 담당자에게 새 테이블 요청은 필요 없다. 백엔드 SQL이 이 이름을 사용하도록 맞추면 된다.
- 검증:
  - 변경한 주요 백엔드 파일에 대해 `node --check` 문법 검사를 통과했다.
  - 실제 서버 실행 및 DB 연결 통합 테스트는 아직 하지 않았다.
- 남은 일:
  - DB 담당자가 추가/제약 변경을 반영하면 백엔드 SQL을 메모리 임시 저장에서 DB 저장으로 전환해야 한다.
  - 취약계층 인증서 QR 검증 API와 수령 로그 API는 구현 전 사용자 확인을 먼저 받아야 한다.
  - 프론트 연결은 별도 작업이다. 현재 요청 범위에서는 프론트 파일을 수정하지 않았다.

### 2026-05-14
- 현재 프로젝트 구조를 정리했다.
  - `backend`: Express/MySQL 백엔드. 루트 `GIVE` 폴더에서 `npm start`로 실행한다.
  - `frontend-app`: 모바일 앱 프론트. `https://github.com/gkstmdwo999/give_PJ.git`에서 받은 Expo/React Native 프로젝트다.
  - `frontend-web`: 웹 프론트. `https://github.com/LeeYongWo-o/web_project.git`에서 받은 Create React App 프로젝트다.
- `frontend-app` 폴더 구조를 평탄화했다.
  - 이전에는 `frontend-app/give_PJ`처럼 한 단계 더 들어가 있었으나, 현재는 `frontend-app` 자체가 프론트 앱 루트다.
  - `frontend-app`의 Git 원격은 `https://github.com/gkstmdwo999/give_PJ.git`이다.
- `frontend-app` 백엔드 연결 상태:
  - Android 에뮬레이터 기준 로컬 API 주소는 `frontend-app/.env.local`에 `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`으로 설정했다.
  - PC 웹/브라우저 기준으로 볼 때는 `http://localhost:3000`을 쓰지만, Android 에뮬레이터에서는 PC의 localhost가 `10.0.2.2`다.
  - 백엔드는 루트 `GIVE`에서 `npm start`로 별도 실행해야 하고, 앱은 `frontend-app`에서 `npm run android` 또는 `npm run android:clear`로 실행한다.
- `frontend-app`에서 PDF API 명세서 기준으로 일부 API 경로를 맞췄다.
  - 회원가입 기본 경로: `/api/members/signup`
  - 이미지 분석 기본 경로: `/api/posts/analyze`
  - 마이페이지 요약/내역/통계/문의: `/api/mypage/summary`, `/api/mypage/histories`, `/api/mypage/stats`, `/api/mypage/contact`
  - 내 정보 수정/동네 수정: `/api/members/me`, `/api/members/me/location`
  - 채팅 목록/메시지 조회: `/api/chats/rooms`, `/api/chats/rooms/:roomId/messages`
- `frontend-app` 마이페이지 일부 기능을 백엔드 API 호출로 연결했다.
  - 프로필 수정, 동네 수정, 나눔 통계, 나눔/활동 내역, 관리자 문의가 API를 호출하도록 변경했다.
- 백엔드 JWT 설정을 정리했다.
  - `backend/server.js`가 루트 `.env`를 읽도록 변경했다.
  - `POST /api/auth/login`과 인증 미들웨어가 같은 `JWT_SECRET`을 쓰도록 기본값을 맞췄다.
  - 회원가입 API가 성공 시 로그인 응답과 비슷하게 `data.token`, `data.user`를 반환하도록 보강했다.
- 로그인 관련 확인:
  - `asdf@asdf.com` 계정은 DB에 존재한다.
  - DB에 일부 오래된 테스트 계정은 `pw1`, `pw2` 같은 평문 비밀번호로 저장되어 있으나, 로그인은 bcrypt 해시 계정만 허용하는 상태로 유지했다.
  - 따라서 평문 비밀번호 계정은 로그인되지 않는다. 필요하면 새로 회원가입해서 bcrypt 해시 계정을 만들어야 한다.
- `frontend-web` 상태:
  - `frontend-web`은 방금 받은 웹 프론트 저장소이며, 현재는 백엔드 API와 연결되지 않은 목업 구조다.
  - 로그인/회원가입은 Zustand 로컬 상태와 alert/console 기반이고, `/api/auth/login`, `/api/members/signup` 호출은 아직 없다.
  - 웹 프론트를 백엔드에 연결하려면 `frontend-web/.env.local`에 `REACT_APP_API_URL=http://localhost:3000`을 두고, 로그인/회원가입 컴포넌트에서 fetch/axios로 백엔드 API를 호출하도록 수정해야 한다.
  - CRA 웹 기본 포트도 3000이라 백엔드와 충돌한다. 웹 실행 시에는 예를 들어 `PORT=3001 npm start`로 실행하는 것이 좋다.
- `frontend-web/givegive.zip`은 원격 저장소에 들어있던 압축파일이었고, 실행에는 필요 없어 보여 로컬에서 삭제했다. 삭제 상태는 `frontend-web` Git 변경사항으로 남아 있다.
- 검증:
  - `frontend-app`에서 `npx tsc --noEmit` 통과.
  - `frontend-app`에서 `npm run lint` 통과.
  - 백엔드 주요 변경 파일에 대해 `node --check` 통과.
- 주의:
  - 루트 `.env`와 `frontend-app/.env.local`은 로컬 설정 파일이며 GitHub에 올리지 않는다.
  - 백엔드 비밀값, DB 비밀번호, Firebase private key 등은 워크로그에 기록하지 않는다.
