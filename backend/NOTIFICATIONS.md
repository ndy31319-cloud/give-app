# 앱 내 거래 알림

홈 헤더 오른쪽의 벨을 통해 `/notifications`로 이동한다. 벨에는 전체 미확인 건수(99 초과는 99+)가 표시되며 알림 화면은 날짜별 목록, 전체/안 읽음 필터, 모두 읽음, 새로고침, 이전 알림 더 보기를 제공한다.

## 생성 시점

| 거래 변화 | 수신자 | 알림 코드 |
| --- | --- | --- |
| 나눔 신청 | 게시글 작성자 | pickup_request |
| 수락 | 신청자 | pickup_approved |
| 거절 | 신청자 | pickup_rejected |
| 취소 | 취소한 사람의 상대방 | pickup_canceled |
| 완료 | 완료 처리한 사람의 상대방 | pickup_completed |
| 응답 시간 만료 | 양쪽 참여자 | pickup_expired |

알림은 거래 상태 변경과 같은 SQL 트랜잭션에서 저장한다. 동일 요청 재시도로 알림이 중복 생성되지 않는다. 새 거래 알림은 `related_type=pickup`, `related_id=pickup_id`로 저장해 같은 게시글의 다른 신청과 구분한다. 클릭하면 읽음 처리 후 기존 신청 채팅방으로 이동한다. 기존 게시글 기준 알림은 게시글로 이동하고, 삭제된 연결 대상은 알림 내용만 확인할 수 있다.

## API

모든 API에 Bearer 인증이 필요하며 수신 회원은 토큰에서 결정한다.

- `GET /api/notifications/feed?before=<id>&unread=1`: 최신순 30개, `nextCursor`, 전체 `unreadCount`. 두 쿼리 모두 선택 사항.
- `PATCH /api/notifications/:id/read`: 자신의 알림을 읽음으로 저장. 타인/없는 알림은 404.
- `PATCH /api/notifications/read-all`, JSON `{ "throughId": 123 }`: 화면에서 확인한 최신 ID까지 자신의 알림을 읽음 처리. 조회 이후 도착한 새 알림은 보존.

알림 목록 진입/홈 복귀/수동 새로고침 시 조회하며 기존 앱 동기화 주기에도 배지 건수를 갱신한다(Firebase 구성 시 약 30초). 목록을 열어 둔 상태의 새 항목은 새로고침으로 확인한다. 휴대폰 잠금화면 푸시 및 일반 채팅 메시지의 새 알림 생성은 이번 범위에 포함하지 않는다.

## 적용 및 검증

새 코드의 거래 처리를 시작하기 전에 `npm run migrate:notifications`를 실행한다. 기존 알림을 보존하며 알림 종류 CHECK 제약에 거절/취소/만료 코드를 추가한다. 이전 거래 마이그레이션도 적용된 DB가 필요하다.

`npm run test:notifications:integration`은 설정된 MySQL에 임시 회원/게시글/신청/알림을 생성하고 종료 시 해당 데이터만 삭제한다. 인증·회원 격리, 신청별 채팅방 연결, 커서 페이지, 전체 미확인 건수, 읽음 지속성, 동시 새 알림 보존을 검증한다. `npm run test:trades:integration`은 실제 거래 상태 전이와 Firestore 전달, 중복 알림 방지까지 검증한다.

앱 소스와 API를 함께 반영해야 한다. 기존 설치 APK와 배포 서버에는 소스 수정만으로 자동 적용되지 않는다.
