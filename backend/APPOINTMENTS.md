# 거래 약속 관리 (4번)

수락된 진행 중 거래에서 양쪽 참여자가 장소·시간을 제안할 수 있다. 상대방이 확인하면 확정된다. 이미 확정된 약속이 있으면 변경 제안 중에도 기존 약속을 유지하고, 상대방이 변경안을 확정할 때 교체한다. 종료된 거래의 약속은 기록으로만 조회한다.

## 저장 및 API

배포 전 `npm run migrate:appointments`를 실행한다. PICKUP_REQUEST에 nullable JSON `appointment`를 추가하며 기존 신청 데이터는 보존한다. 기존 거래 마이그레이션이 선행되어야 한다.

- `GET /api/trades/:id`: 기존 거래 응답에 `appointment` 추가.
- `PUT /api/trades/:id/appointment`: `{revision, at, place, latitude, longitude}`. UTC ISO 시간, 1~200자 장소, 좌표는 둘 다 숫자 또는 null.
- `POST /api/trades/:id/appointment/confirm`: `{revision}`. 제안한 당사자는 확정할 수 없다.
- 마이페이지 activity 응답의 보낸/받은 신청에도 같은 `appointment`를 반환한다.

JSON 구조는 `{revision, confirmed, pending}`. 제안/확정 때마다 revision이 증가한다. 화면에서 읽은 revision을 보내며 오래된 값은 409로 거절해 다른 사람의 변경을 덮어쓰거나 과거 제안을 확정하지 못하게 한다. 타인은 403, 수락 전/거래 종료 후 변경은 409, 과거·잘못된 시간이나 좌표는 400이다. 시각은 UTC로 저장하고 앱에서는 기기 시간대로 표시/입력한다.

게시글 → 신청 순서로 SQL 행을 잠그고 약속과 상대방 알림을 같은 트랜잭션에서 저장한다. 기존 chat_synced 큐로 Firestore 요청 카드에 전달하며 전송 실패 시 재시도한다. 약속 알림은 기존 `request` 유형과 `pickup` 연결을 사용하므로 알림함에서 해당 거래 채팅방으로 이동한다.

## 앱

채팅방 상단 거래 카드에 확정된 약속과 미확정 변경안을 구분한다. 약속 잡기/변경 제안을 누르면 기존 카카오맵·달력·시간 선택 하단 창이 열린다. 장소는 직접 입력할 수도 있으며 직접 편집하면 이전 좌표는 해제되어 잘못된 핀을 보내지 않는다. 상대방에게만 약속 확정 버튼을 제공한다. 마이페이지는 회원 유형별 신청 탭에서 같은 요약과 지도 링크를 보여주며 수정·확정은 채팅방에서 한다. 예전 텍스트 약속 메시지는 그대로 열람하되 자동으로 확정 기록으로 변환하지 않는다.

## 검증

`node --test backend/tests/appointment.test.js backend/tests/trades.integration.js backend/tests/activity.integration.js`

통합 검증은 설정된 실제 DB/Firestore에 임시 데이터만 생성하고 정리한다. 동시 제안, 자기 제안 확정 차단, 오래된 버전 거절, 변경 중 기존 확정 유지, 활동 내역/Firestore 조회 일치, 취소 후 확정 차단 및 중복 알림 방지를 검증한다.

소스와 연결 DB의 스키마를 수정한 단계이며 Render 배포 및 실제 휴대폰 화면 검증은 별도로 필요하다.
