# Edit Guide

이 파일은 "어디를 수정해야 하는지" 빠르게 찾기 위한 안내서입니다.

## 1. 라우팅 진입점

- `app/`
  - Expo Router 기준 실제 페이지 진입 파일입니다.
  - 대부분은 화면 컴포넌트를 그대로 export 하는 얇은 래퍼입니다.

자주 쓰는 경로:
- `app/login.tsx` : 로그인 화면 진입
- `app/signup.tsx` : 회원가입 시작 화면 진입
- `app/location-setting.tsx` : 가입 중 동네 설정 화면 진입
- `app/(tabs)/index.tsx` : 홈 탭 진입
- `app/(tabs)/chat.tsx` : 채팅 목록 탭 진입
- `app/(tabs)/policy.tsx` : 정책 탭 진입
- `app/(tabs)/mypage.tsx` : 마이페이지 탭 진입
- `app/write/form.tsx` : 글쓰기 폼 진입
- `app/post/[id].tsx` : 게시글 상세 진입
- `app/chat/[id].tsx` : 채팅방 상세 진입

## 2. 화면 로직

- `src/screens/auth.tsx`
  - 스플래시, 로그인, 회원가입, 취약계층 선택, 가입용 동네 설정 로직
- `src/screens/home.tsx`
  - 홈, 게시글 상세, 알림, 글쓰기 선택, 글쓰기 폼, 검색 로직
- `src/screens/chat.tsx`
  - 채팅 목록/채팅방 로직
- `src/screens/policy.tsx`
  - 정책 추천/카테고리/챗봇 UI 로직
- `src/screens/mypage.tsx`
  - 프로필 수정, 내 동네 설정, 나의 활동, 통계, 설정 로직

## 3. 화면 스타일

스타일은 화면 로직 파일과 분리해 두었습니다.

- `src/screens/auth.styles.ts`
  - 로그인/회원가입/가입 동네 설정 스타일
- `src/screens/home.styles.ts`
  - 홈/상세/알림/글쓰기/검색 스타일

추가로 화면이 더 커지면 같은 방식으로 아래도 분리하면 됩니다:
- `src/screens/chat.tsx`
- `src/screens/policy.tsx`
- `src/screens/mypage.tsx`

## 4. 공통 UI 컴포넌트

- `src/components/common/AppButton.tsx` : 공통 버튼
- `src/components/common/AppHeader.tsx` : 상단 헤더
- `src/components/common/AppModal.tsx` : 공통 모달
- `src/components/common/AppScreen.tsx` : 기본 화면 래퍼
- `src/components/common/AppTextField.tsx` : 공통 입력창
- `src/components/common/PillTabs.tsx` : 탭/필터 pill UI
- `src/components/common/PostCard.tsx` : 게시글 카드

## 5. 데이터/상태/API

- `src/context/AppContext.tsx`
  - 앱 전역 상태
  - 로그인 상태, 회원가입 draft, 게시글/채팅/알림 상태 관리

- `src/services/api.ts`
  - 프론트에서 사용하는 API 레이어
  - 현재는 명세서 기준 mock + 실제 fetch fallback 구조
  - 회원, 인증코드, 기부글, 요청글, 커뮤니티, 채팅, 정책, 신고, 공지, 수령요청, 알림, 후기 API 포함

- `src/data/mockData.ts`
  - 더미 데이터 모음
  - 회원가입 예시 20개 포함
  - 백엔드 미구현 기능도 프론트에서 먼저 붙일 수 있게 목업 데이터 제공

- `src/types/app.ts`
  - 앱 전체 타입 정의
  - 회원, 게시글, 채팅, 정책, 신고, 알림, 후기 등 명세 기반 타입 포함

## 6. 자주 수정하는 기능별 위치

### 로그인/회원가입
- 로직: `src/screens/auth.tsx`
- 스타일: `src/screens/auth.styles.ts`
- 상태 저장: `src/context/AppContext.tsx`
- 회원 API: `src/services/api.ts`
- 테스트용 가입 예시: `src/data/mockData.ts`

### 주소/동네 5km
- 화면 입력: `src/screens/auth.tsx`, `src/screens/mypage.tsx`
- 거리 계산/검색: `src/utils/location.ts`
- 기본 더미 주소: `src/data/mockData.ts`

### 글쓰기 + 사진 업로드 + AI 판독
- 화면: `src/screens/home.tsx`
- 스타일: `src/screens/home.styles.ts`
- 업로드/판독 API: `src/services/api.ts`
- 이미지 선택 유틸: `src/utils/imagePicker.ts`

### 정책 추천
- 화면: `src/screens/policy.tsx`
- 정책 더미 데이터: `src/data/mockData.ts`
- 정책 API: `src/services/api.ts`

### 채팅
- 화면: `src/screens/chat.tsx`
- 채팅 상태: `src/context/AppContext.tsx`
- 채팅 API/더미 데이터: `src/services/api.ts`, `src/data/mockData.ts`

### 마이페이지/프로필
- 화면: `src/screens/mypage.tsx`
- 전역 사용자 상태: `src/context/AppContext.tsx`

## 7. 디자인만 바꾸고 싶을 때

- 공통 색상: `src/theme/colors.ts`
- 특정 화면 스타일: `src/screens/*.styles.ts`
- 공통 버튼/입력/헤더: `src/components/common/*`

## 8. 실행

- `npm run android`
- `npm run android:clear`
- `npm run ios`
- `npm run lint`
- `npx tsc --noEmit`

## 9. 추천 수정 순서

1. 먼저 `app/`에서 어떤 화면이 열리는지 확인
2. 실제 로직은 `src/screens/`에서 수정
3. 전역 상태가 필요하면 `src/context/AppContext.tsx` 확인
4. API 형식은 `src/services/api.ts` 확인
5. 타입이 바뀌면 `src/types/app.ts` 먼저 수정
6. UI만 바꾸면 `*.styles.ts` 또는 `src/components/common/` 수정
