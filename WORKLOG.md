# GIVE Worklog

## 2026-04-14 이후 작업 요약

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
