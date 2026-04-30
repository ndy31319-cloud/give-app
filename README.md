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
