# 관리자 문의 (6번)

관리자는 MEMBER.role_id = 2로 판정한다. 이메일/비밀번호는 코드에 넣지 않는다. 로그인 토큰의 역할 값으로 권한을 부여하지 않고 매 요청에서 현재 DB 역할을 확인한다. 답변 트랜잭션은 해당 회원 행의 공유 잠금과 문의 행의 배타 잠금으로 권한 변경 및 동시 답변을 보호한다.

## 화면

- 사용자 마이페이지 → 관리자에게 문의하기 → 내 문의함. 문의 작성, 전체/답변 대기/답변 완료 필터, 문의 상세 및 답변 조회.
- 관리자 마이페이지에는 문의 관리 메뉴 추가. 기본 답변 대기 탭, 대기 건수, 접수 순 목록, 답변 완료/전체 탭.
- 문의 작성은 계정/나눔·거래/앱 오류/기타 유형과 제목/내용. 연락처는 가입 이메일을 사용하며 이메일을 발송하지 않는다.
- 상세는 문의 카드 다음 답변 카드 또는 관리자 답변 작성 영역. 최초 답변 등록 후에는 읽기 전용. 수정/추가 답변은 이번 범위에 포함하지 않는다.
- 답변 등록 시 앱 내 알림을 저장하고 알림 클릭 시 해당 문의 상세로 이동한다.

## DB 및 API

배포 전에 `npm run migrate:inquiries` 실행. ADMIN_INQUIRY의 기존 데이터를 유지하며 category/answer/answered_by/answered_at/request_key 필드를 추가하고 회원별 request_key 유일 인덱스를 만든다. NOTIFICATION.related_type CHECK에 inquiry를 추가한다.

인증 필요:

- GET `/api/inquiries?mode=mine|admin&status=all|pending|answered&cursor=<id>`: 30개와 nextCursor, 해당 범위 전체 pendingCount. 관리자 대기는 ID 오름차순, 나머지는 내림차순.
- POST `/api/inquiries`: subject(1~200자), message(1~5000자), category, requestKey. 같은 회원의 동일 requestKey 재시도는 최초 접수 건 반환.
- GET `/api/inquiries/:id`: 본인 또는 관리자만 조회. 타인 문의는 404.
- POST `/api/inquiries/:id/reply`: answer(1~5000자). 관리자만 가능하며 pending 상태만 처리. 동시 등록/재시도 시 이미 답변됐으면 409.

답변 내용·작성 관리자·시각·상태와 회원 알림을 한 트랜잭션에서 저장한다. 기존 POST `/api/mypage/contact`도 같은 접수 서비스를 사용하며 메모리 저장으로 성공을 가장하지 않는다. 이전 클라이언트가 requestKey를 보내지 않는 경우 접수 재시도 중복 방지는 지원하지 않는다.

## 검증

`npm run test:inquiries:integration`은 임시 회원(관리자 역할 포함)과 문의를 생성 후 정리한다. 본인 문의 격리, 역할 위조/회수, 중복 접수, 입력 검증, 동시 답변, 영구 저장, 답변 알림 대상, 페이지 조회를 확인한다. 실제 관리자 계정과 기존 문의는 변경하지 않는다.

Render 배포는 이번 작업에서 진행하지 않았다. 실제 휴대폰 화면 검증은 별도 필요하다.
