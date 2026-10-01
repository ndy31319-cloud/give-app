# GIVE

현재 프로젝트 구조는 아래 기준으로 정리합니다.

- `backend/`: 공통 API 서버
- `frontend-app/`: React Native 앱 프론트
- `frontend-web/`: 웹 키오스크 프론트

기존 웹 React 프론트였던 `frontend/` 폴더는 더 이상 사용하지 않아 제거했습니다.

로컬 환경 파일은 Git에 올리지 않습니다.

- 루트 `.env`
- `frontend-app/.env`
- `frontend-web/.env`
- `backend/ca.pem`
- `backend/serviceAccountKey.json`

## 거래 취소 사유 배포

API 서버를 업데이트하기 전에 `npm run migrate:trade-cancel-reason`을 실행합니다.
이 명령은 기존 나눔 요청을 유지하면서 `PICKUP_REQUEST.cancel_reason` 열을 추가하며, 다시 실행해도 중복 추가하지 않습니다.
취소 API(`POST /api/trades/:id/cancel`)는 JSON 본문의 `reason`에 1~200자의 사유를 받습니다.
서버를 먼저 배포한 뒤 앱을 업데이트해야 입력한 사유가 DB와 채팅 카드에 저장됩니다.
