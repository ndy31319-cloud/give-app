# Give,기부 React Native App

Expo Router 기반 React Native 프론트엔드 프로젝트입니다.

수정 위치를 빠르게 찾으려면 `EDIT_GUIDE.md`를 먼저 보면 됩니다.

## 실행

Android Studio 에뮬레이터 실행 후 아래 명령을 사용합니다.

```bash
npm install
npm run android
```

기본값은 `LAN` 모드입니다. 현재 환경에서는 `localhost`보다 `LAN` 연결이 더 안정적입니다.

에뮬레이터가 열렸는데 로딩이 꼬인 것처럼 보이면 캐시를 비우고 다시 실행합니다.

```bash
npm run android:clear
```

로컬호스트 모드가 꼭 필요할 때만 아래를 사용합니다.

```bash
npm run android:localhost
```

실제 휴대폰 Expo Go로 QR을 스캔할 때는 LAN 모드를 사용합니다.

```bash
npm start
```

## 주요 구조

- `app/`: Expo Router 라우트
- `src/screens/`: 화면별 React Native UI
- `src/components/common/`: 공통 버튼, 헤더, 입력창, 카드
- `src/context/`: 전역 상태
- `src/services/`: 프론트 API 호출 및 이미지 파일 업로드
- `src/utils/`: 위치, 시간, 유효성 검사, 이미지 선택 유틸

## 반영 기능

- 주소 입력 기반 동네 설정
- 기본 동네 반경 5km 필터
- 사진 파일 자체 `FormData` 업로드
- 사진 등록 직후 AI 유해물품 판독
- 유해물품 차단 팝업 및 홈 이동
- 안전 판독 후 글쓰기 진입
- 선택형 AI 추천 글쓰기
