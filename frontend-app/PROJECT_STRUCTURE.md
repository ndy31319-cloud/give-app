# 나눔이음 (Give,기부) 프로젝트 구조 설명서

## 📁 프로젝트 개요
한국어 나눔 플랫폼 앱 MVP - 취약계층을 위한 나눔/필요 게시글 기능과 복지 정책 정보를 제공하는 모바일 웹 애플리케이션

---

## 🗂️ 전체 폴더 구조

```
/src/app/
├── App.tsx                    # 메인 앱 컴포넌트 - 모든 라우팅 설정
├── context/
│   └── AppContext.tsx        # 전역 상태 관리 (Context API) 📝 UPDATE
├── utils/                    # 유틸리티 함수들 ⭐ NEW
│   └── validation.ts         # 입력 폼 유효성 검사 함수 ⭐ NEW
├── services/                 # API 서비스 레이어 ⭐ NEW
│   └── api.ts                # 백엔드 API 호출 함수 모음 ⭐ NEW
├── components/               # 공통 컴포넌트 ⭐ REFACTORED
│   ├── BottomNav.tsx         # 하단 네비게이션 바 (4개 메뉴)
│   ├── PostCard.tsx          # 게시물 카드 컴포넌트 ⭐ NEW
│   ├── PageHeader.tsx        # 페이지 헤더 컴포넌트 ⭐ NEW
│   ├── TabBar.tsx            # 탭 바 컴포넌트 ⭐ NEW
│   ├── ErrorComponents.tsx   # 에러 핸들링 컴포넌트들 ⭐ NEW
│   ├── LoadingComponents.tsx # 로딩 상태 컴포넌트들 ⭐ NEW
│   ├── ui/                   # shadcn/ui 기반 UI 컴포넌트들
│   └── figma/                # Figma 관련 컴포넌트
│       └── ImageWithFallback.tsx  # 이미지 폴백 컴포넌트
└── pages/                    # 모든 화면/페이지 컴포넌트 ⭐ REFACTORED
    ├── auth/                 # 인증 관련 페이지 📝 UPDATE
    ├── home/                 # 홈 화면 페이지 ⭐ REFACTORED
    │   └── components/       # 홈 화면 전용 컴포넌트
    │       ├── HomeHeader.tsx
    │       ├── PostList.tsx
    │       └── FloatingWriteButton.tsx
    ├── write/                # 글쓰기 페이지 ⭐ REFACTORED
    │   └── components/       # 글쓰기 전용 컴포넌트
    │       ├── AICheckDialog.tsx
    │       └── WriteFormFields.tsx
    ├── search/               # 검색 페이지 ⭐ REFACTORED
    │   └── components/       # 검색 전용 컴포넌트
    │       ├── SearchHeader.tsx
    │       ├── SearchFilter.tsx
    │       ├── AIImageSearch.tsx
    │       ├── CategoryTabs.tsx
    │       └── SearchResults.tsx
    ├── policy/               # 정책 찾기 페이지 ⭐ REFACTORED
    │   └── components/       # 정책 전용 컴포넌트
    │       ├── PolicyCard.tsx
    │       ├── PolicyAITab.tsx
    │       ├── PolicyCategoryTab.tsx
    │       └── PolicyChatbotTab.tsx
    ├── chat/                 # 채팅 페이지
    └── mypage/               # 마이페이지
```

---

## 📄 주요 파일 설명

### 🔷 **루트 레벨 파일**

#### `/src/app/App.tsx`
**역할**: 애플리케이션의 최상위 컴포넌트. 모든 라우팅 설정을 관리합니다.

**주요 기능**:
- React Router를 사용한 페이지 라우팅 설정
- AppProvider로 전체 앱을 감싸서 전역 상태 관리
- 모든 페이지 컴포넌트를 import하고 경로와 연결
- 404 Not Found 페이지 라우팅 ⭐ NEW

**라우팅 구조**:
```
/ → /splash (2초 후 /login으로 리다이렉트)
/login → 로그인 화면
/home → 메인 홈 화면 (플로팅 글쓰기 버튼 포함)
/post/:id → 게시물 상세
/write → 글쓰기 선택
/search → 검색 화면 (AI 이미지 검색 포함)
/policy → 정책 찾기 (AI 추천/카테고리/챗봇)
/chat → 채팅 목록
/chat/:id → 채팅방 (추가 기능, 매너 평가, 프로필 보기)
/mypage → 마이페이지
/notifications → 알림 화면
/contact-admin → 관리자 문의
* → 404 Not Found 페이지 ⭐ NEW
```

---

### 🔷 **Context (전역 상태 관리)** 📝 UPDATE

#### `/src/app/context/AppContext.tsx`
**역할**: 애플리케이션 전체에서 사용하는 사용자 정보와 인증 상태를 관리합니다.

**제공하는 데이터**:
- `user`: 현재 로그인한 사용자 정보
  - id, name, email, phone ⭐, isVulnerable(취약계층 여부), vulnerableTypes ⭐, location, birthdate ⭐, bio ⭐, profileImage
- `setUser`: 사용자 정보를 업데이트하는 함수
- `isAuthenticated`: 로그인 여부 (boolean)
- `signupData`: 회원가입 단계별 임시 데이터 저장 ⭐ NEW
- `setSignupData`: 회원가입 데이터 업데이트 함수 ⭐ NEW

**업데이트 내용** ⭐:
- User 인터페이스 확장: phone, vulnerableTypes (배열), birthdate, bio 필드 추가
- 회원가입 플로우 개선: 각 단계에서 입력한 데이터를 signupData에 저장
- 정책 추천 시스템 연동: vulnerableTypes 기반 맞춤 정책 추천

**사용 방법**:
```typescript
import { useApp } from "@/app/context/AppContext";

function MyComponent() {
  const { user, setUser, isAuthenticated, signupData, setSignupData } = useApp();
  // user.vulnerableTypes를 통해 취약계층 유형 접근
  // signupData로 회원가입 중간 데이터 관리
}
```

---

### 🔷 **유틸리티 함수** ⭐ NEW

#### `/src/app/utils/validation.ts`
**역할**: 입력 폼 유효성 검사를 위한 재사용 가능한 함수 모음

**제공하는 함수**:
- `validateEmail(email: string)`: 이메일 형식 검증 (정규식)
- `validatePhone(phone: string)`: 전화번호 형식 검증 (010-XXXX-XXXX)
- `validatePassword(password: string)`: 비밀번호 강도 검증 (8자 이상, 영문+숫자)
- `validatePasswordMatch(password, confirm)`: 비밀번호 일치 여부 검증
- `validateRequired(value: string)`: 필수 입력 검증
- `getValidationErrors()`: 여러 필드 한번에 검증

**사용 예시**:
```typescript
import { validateEmail, validatePhone } from "@/app/utils/validation";

const emailValid = validateEmail("test@example.com"); // true
const phoneValid = validatePhone("010-1234-5678"); // true
```

**적용 페이지**:
- VulnerableInfoScreen (취약계층 개인정보 입력)
- PersonalInfoScreen (일반 사용자 개인정보 입력)
- 실시간 검증 + 시각적 피드백 (빨간 테두리, 에러 메시지)

---

### 🔷 **API 서비스 레이어** ⭐ NEW

#### `/src/app/services/api.ts`
**역할**: 백엔드 API 호출을 위한 중앙화된 서비스 레이어

**구조**:
- `fetchAPI<T>()`: HTTP 요청 헬퍼 함수
- 각 도메인별 API 객체:
  - `authAPI`: 회원가입, 로그인, 로그아웃
  - `postAPI`: 게시물 CRUD, AI 유해물품 판단
  - `policyAPI`: 정책 추천, 카테고리 검색, 챗봇
  - `chatAPI`: 채팅 목록, 메시지 전송
  - `userAPI`: 프로필 수정, 통계 조회
  - `searchAPI`: 텍스트 검색, AI 이미지 검색

**현재 상태**:
- Mock 응답 반환 (프론트엔드 독립 개발 가능)
- TODO 주석으로 실제 API 호출 위치 표시
- 백엔드 구현 후 주석 해제 및 수정 필요

**사용 예시**:
```typescript
import { authAPI } from "@/app/services/api";

const { data, error } = await authAPI.login({
  email: "user@example.com",
  password: "password123"
});

if (error) {
  // 에러 처리
} else {
  setUser(data.user);
}
```

**백엔드 연동 시 참고**: `/API_SPECIFICATION.md` 문서 참조

---

### 🔷 **공통 컴포넌트** ⭐ REFACTORED

#### `/src/app/components/BottomNav.tsx`
**역할**: 앱 하단에 고정되는 네비게이션 바

**네비게이션 메뉴**:
1. 홈 (`/home`) - Home 아이콘
2. 정책 찾기 (`/policy`) - FileSearch 아이콘
3. 채팅 (`/chat`) - MessageCircle 아이콘
4. 마이페이지 (`/mypage`) - User 아이콘

---

#### `/src/app/components/PostCard.tsx` ⭐ NEW
**역할**: 게시물 카드를 표시하는 재사용 가능한 컴포넌트

**Props**:
- id: 게시물 ID
- type: "share" | "need"
- title: 제목
- location: 위치
- time: 시간
- image: 이미지 URL (선택)
- status: "available" | "reserved" | "completed" (선택)

**사용 위치**: HomeScreen, SearchScreen

---

#### `/src/app/components/PageHeader.tsx` ⭐ NEW
**역할**: 페이지 헤더를 표시하는 재사용 가능한 컴포넌트

**Props**:
- title: 페이지 제목
- showBackButton: 뒤로가기 버튼 표시 여부 (기본값: true)
- rightContent: 오른쪽 영역에 표시할 컨텐츠 (선택)

**사용 위치**: PolicyScreen 등

---

#### `/src/app/components/TabBar.tsx` ⭐ NEW
**역할**: 탭 메뉴를 표시하는 재사용 가능한 컴포넌트

**Props**:
- tabs: 탭 목록 (id, label, icon)
- activeTab: 현재 활성 탭 ID
- onTabChange: 탭 변경 콜백

**사용 위치**: HomeScreen, PolicyScreen

---

#### `/src/app/components/ErrorComponents.tsx` ⭐ NEW
**역할**: 에러 상황을 처리하는 컴포넌트 모음

**포함된 컴포넌트**:

1. **NotFoundPage (404 페이지)**
   - 큰 "404" 타이포그래피
   - "페이지를 찾을 수 없습니다" 메시지
   - 이전 페이지 / 홈으로 가기 버튼
   - App.tsx의 `path="*"` 라우트에 연결

2. **NetworkErrorPage (네트워크 오류)**
   - 빨간색 경고 아이콘 (AlertCircle)
   - "네트워크 연결 실패" 안내
   - "다시 시도" 버튼 (onRetry 콜백)

3. **EmptyState (데이터 없음)**
   - 커스터마이즈 가능 (아이콘, 제목, 설명, 액션)
   - 검색 결과 없음, 채팅 없음 등 다양한 상황에 재사용 가능

**사용 예시**:
```typescript
import { EmptyState } from "@/app/components/ErrorComponents";

<EmptyState
  icon={Search}
  title="검색 결과가 없습니다"
  description="다른 검색어를 시도해보세요"
  actionLabel="필터 초기화"
  onAction={resetFilters}
/>
```

---

#### `/src/app/components/LoadingComponents.tsx` ⭐ NEW
**역할**: 로딩 상태를 시각화하는 컴포넌트 모음

**포함된 컴포넌트**:

1. **LoadingSpinner**
   - 크기 옵션: sm (4x4), default (8x8), lg (12x12)
   - 파란색 회전 애니메이션 (Loader2 아이콘)

2. **LoadingOverlay**
   - 전체 화면 dimming (검은 배경 50% 투명도)
   - 중앙에 큰 스피너 표시
   - 선택적 메시지 표시 가능

3. **LoadingPage**
   - 전체 페이지 로딩 (min-h-screen)
   - 중앙에 큰 스피너만 표시

**사용 예시**:
```typescript
import { LoadingSpinner, LoadingOverlay } from "@/app/components/LoadingComponents";

// 버튼 내부 로딩
<Button disabled={isLoading}>
  {isLoading ? <LoadingSpinner size="sm" /> : "제출"}
</Button>

// 전체 화면 로딩
{isLoading && <LoadingOverlay message="AI 분석 중..." />}
```

**적용 시나리오**:
- AI 유해물품 판단 (2초 로딩)
- AI 이미지 검색 (1.5초 로딩)
- 챗봇 응답 대기
- 데이터 불러오기

---

## 📱 페이지별 상세 설명

### 🔐 **Auth (인증 관련 페이지)** - `/src/app/pages/auth/` 📝 UPDATE

#### `SplashScreen.tsx`
**역할**: 앱 시작 시 보이는 초기 화면

**주요 기능**:
- 블루/화이트 그라데이션 배경
- "Give,기부" 큰 글씨로 브랜드 표시
- 2초 대기 후 자동으로 `/login`으로 이동
- 애니메이션 효과 포함

---

#### `LoginScreen.tsx` 📝 UPDATE
**역할**: 사용자 로그인 화면

**업데이트 내용** ⭐:
- **실시간 유효성 검사 적용**
  - `validation.ts` 유틸리티 함수 사용
  - 이메일: 필수 입력 + 이메일 형식 검증
  - 비밀번호: 필수 입력 검증
  - `onBlur` 이벤트에서 필드별 검증
  - `touched` 상태로 사용자가 입력한 필드만 에러 표시
- **시각적 피드백**
  - 빨간색 테두리 (border-red-500)
  - 에러 메시지 표시
- **로그인 버튼 동작**
  - 유효성 검사 실패 시 로그인 중단
  - 모든 검증 통과 시에만 `/home`으로 이동

**주요 기능**:
- 이메일, 비밀번호 입력 필드
- "로그인" 버튼 클릭 시 → 유효성 검사 → `/home`으로 이동 ⭐
- "회원가입" 링크 → `/signup`으로 이동
- 소셜 로그인 버튼 (카카오, 네이버, 구글)
- 비밀번호 찾기 버튼

---

#### `SignupScreen.tsx` 📝 UPDATE
**역할**: 회원가입 시작 화면

**업데이트 내용** ⭐:
- **UI 간소화**: 개인정보 입력 폼 제거
- **단순 선택 화면**: "취약계층이신가요?" 질문만 표시
- **2가지 경로 분기**:
  - "예, 맞습니다" → `/vulnerable-select` (유형 선택)
  - "아니요" → `/personal-info` (일반 사용자 개인정보 입력)
- 안내 문구: "취약계층 인증은 선택사항이며, 나중에 마이페이지에서도 등록 가능합니다"

**주요 기능**:
- "취약계층이신가요?" 질문 제시
- "예, 맞습니다" → `/vulnerable-select`
- "아니요" → `/personal-info`

---

#### `VulnerableSelectScreen.tsx` 📝 UPDATE
**역할**: 취약계층 유형 선택 화면

**업데이트 내용** ⭐:
- 선택한 유형을 `signupData.vulnerableTypes` 배열에 저장
- 최소 1개 이상 선택 필수 (유효성 검사)
- 에러 메시지 표시 (선택 안했을 때)
- `useApp()` 훅으로 전역 상태 관리

**주요 기능**:
- 7가지 취약계층 카테고리 선택 (다중 선택 가능)
  - 기초생활수급자 (basic_livelihood)
  - 차상위계층 (near_poverty)
  - 한부모가정 (single_parent)
  - 장애인 (disabled)
  - 노인 (elderly)
  - 아동/청소년 (youth)
  - 기타 (other)
- 체크박스 UI로 다중 선택
- "다음" 버튼 → `/vulnerable-info`

---

#### `VulnerableInfoScreen.tsx` 📝 UPDATE
**역할**: 취약계층 개인정보 입력 화면

**업데이트 내용** ⭐:
- **실시간 유효성 검사 적용**
  - `validation.ts` 유틸리티 함수 사용
  - `onBlur` 이벤트에서 필드별 검증
  - `touched` 상태로 사용자가 입력한 필드만 에러 표시
  - 빨간색 테두리 + 에러 메시지 UI
- **전역 상태 저장**
  - 입력 완료 후 `signupData`에 누적 저장
  - 다음 화면(LocationSettingScreen)에서 활용
- **취약계층 증명서류 업로드 필드 추가** ⭐ NEW
  - 파일 업로드 UI (드래그 앤 드롭 스타일)
  - PDF, JPG, PNG 파일 지원
  - 선택사항 (필수 아님)
  - 업로드된 파일명 표시 및 삭제 기능
  - 안내: "기초생활수급자증명서, 장애인등록증 등"

**입력 필드 및 유효성 검사**:
- 이름: 필수 입력
- 이메일: 필수 + 이메일 형식 검증
- 전화번호: 필수 + 010-XXXX-XXXX 형식 검증
- 생년월일: 필수
- **취약계층 증명서류: 선택사항 (파일 업로드)** ⭐
- 비밀번호: 필수 + 8자 이상, 영문+숫자 포함
- 비밀번호 확인: 비밀번호와 일치 여부

---

#### `PersonalInfoScreen.tsx` 📝 UPDATE
**역할**: 일반 사용자 개인정보 입력 화면 (취약계층 아닌 경우)

**업데이트 내용** ⭐:
- VulnerableInfoScreen과 동일한 유효성 검사 적용
- `isVulnerable: false`로 설정하여 전역 상태 저장
- 동일한 입력 필드 및 검증 로직

---

#### `LocationSettingScreen.tsx` 📝 UPDATE
**역할**: 동네 설정 화면 (회원가입 마지막 단계)

**업데이트 내용** ⭐:
- **회원가입 완료 처리**
  - `signupData`의 모든 정보 + 선택한 동네를 합쳐서
  - `user` 객체 생성 및 전역 상태에 저장
  - `signupData` 초기화 (회원가입 완료)
- 검색 기능 개선: 입력한 동네 이름으로 필터링

**주요 기능**:
- 동네 검색 (서울 강남/송파 지역 5개 옵션)
- 동네 선택 → 회원가입 완료 → `/home`
- "나중에 설정하기" → "미설정" 상태로 회원가입 완료

---

### 🏠 **Home (홈 화면)** - `/src/app/pages/home/` ⭐ REFACTORED

#### `HomeScreen.tsx`
**역할**: 앱의 메인 홈 화면. 나눔 게시물 목록을 표시합니다.

**컴포넌트 구조** ⭐ NEW:
- `HomeHeader` - 위치, 검색, 알림 버튼이 있는 헤더
- `TabBar` - 전체/나눔해요/필요해요 탭 메뉴
- `PostList` - 게시물 목록 표시
- `FloatingWriteButton` - 플로팅 글쓰기 버튼

**주요 기능**:
- 상단: 현재 동네 표시 + 검색 아이콘 + 알림 아이콘
- 카테고리 탭 (전체, 나눔해요, 필요해요)
- 게시물 목록 카드 (우측에 작은 썸네일 이미지)
- 우측 하단 플로팅 글쓰기 버튼 (파란색 원형)
- 검색 아이콘 클릭 → `/search`
- 플로팅 버튼 클릭 → `/write`

#### `/src/app/pages/home/components/` ⭐ NEW

**HomeHeader.tsx**: 위치 표시, 검색 버튼, 알림 버튼을 포함한 헤더 컴포넌트

**PostList.tsx**: 게시물 목록을 표시하는 컴포넌트 (PostCard 사용)

**FloatingWriteButton.tsx**: 우측 하단 플로팅 글쓰기 버튼

---

#### `PostDetailScreen.tsx`
**역할**: 게시물 상세 화면

**주요 기능**:
- 게시물 이미지 (높이 240px)
- 작성자 정보 (프로필, 이름, 동네)
- 제목, 상세 설명, 위치, 작성 시간
- 하단 고정 버튼: "채팅하기", "나눔 신청"

---

#### `NotificationsScreen.tsx`
**역할**: 알림 목록 화면

**주요 기능**:
- 채팅, 나눔, 시스템 알림 표시
- 읽음/안읽음 상태 (안읽은 알림은 파란색 배경)
- 알림 타입별 아이콘 색상 구분
  - chat: 파란색 (MessageCircle)
  - share: 초록색 (Heart)
  - system: 회색 (Bell)

---

### ✏️ **Write (글쓰기)** - `/src/app/pages/write/` ⭐ REFACTORED

#### `WriteSelectScreen.tsx`
**역할**: 게시글 유형 선택 화면

**주요 기능**:
- "나눔해요" 카드 → `/write/form?type=share`
- "필요해요" 카드 → `/write/form?type=need`

---

#### `WriteFormScreen.tsx`
**역할**: 게시글 작성 폼 화면

**컴포넌트 구조** ⭐ NEW:
- `WriteFormFields` - 입력 폼 필드들
- `AICheckDialog` - AI 유해물품 판단 다이얼로그

**주요 기능**:
- "나눔해요" 선택 시에만 AI 유해물품 판단 팝업
- AI 판단 시나리오: 2초 로딩 → 안전 ✅ / 위험 ⚠️
- 입력 필드: 이미지(최대 10장), 제목, 카테고리, 설명, 거래 장소

#### `/src/app/pages/write/components/` ⭐ NEW

**AICheckDialog.tsx**: AI 유해물품 판단 결과를 표시하는 다이얼로그

**WriteFormFields.tsx**: 글쓰기 입력 폼 필드들 (이미지, 제목, 카테고리, 설명, 위치)

---

### 🔍 **Search (검색)** - `/src/app/pages/search/` ⭐ REFACTORED

#### `SearchScreen.tsx`
**역할**: 게시물 검색 및 필터링 화면

**컴포넌트 구조** ⭐ NEW:
- `SearchHeader` - 검색바, 필터 버튼, 카메라 버튼
- `CategoryTabs` - 카테고리 탭 메뉴
- `SearchFilter` - 필터 Sheet
- `AIImageSearch` - AI 이미지 검색 Dialog
- `SearchResults` - 검색 결과 목록 (정렬 포함)

**업데이트 내용** ⭐:
- **정렬 기능 추가**
  - `sortBy` 상태: `latest` (최신순), `distance` (거리순), `popular` (인기순)
  - Select 드롭다운으로 정렬 옵션 선택
  - 검색 결과 개수 표시 (예: "검색 결과 5개")
- **Empty State 적용**
  - 검색 결과 없을 때 안내 메시지 + 아이콘
  - "다른 검색어나 필터를 시도해보세요" 가이드

**기존 기능**:
- 검색바 (검색어 입력) + 카메라 아이콘 (AI 이미지 검색)
- 필터 버튼 (Sheet로 열림)
  - 게시글 유형 (나눔해요/필요해요)
  - 상태 (나눔 가능/예약중/완료)
  - 거리 (1km/3km/5km)
- 카테고리 탭 (전체, 의류, 전자제품, 가구, 도서, 생활용품)

#### `/src/app/pages/search/components/` ⭐ NEW

**SearchHeader.tsx**: 검색바와 필터/카메라 버튼이 있는 헤더

**SearchFilter.tsx**: 게시글 유형, 상태, 거리 필터를 설정하는 Sheet

**AIImageSearch.tsx**: AI 이미지 검색을 위한 Dialog

**CategoryTabs.tsx**: 카테고리 탭 메뉴

**SearchResults.tsx**: 검색 결과 목록과 정렬 옵션

---

### 🏛️ **Policy (정책 찾기)** - `/src/app/pages/policy/` ⭐ REFACTORED

#### `PolicyScreen.tsx`
**역할**: 취약계층을 위한 복지 정책 정보 제공 화면

**컴포넌트 구조** ⭐ NEW:
- `PageHeader` - 페이지 헤더
- `TabBar` - AI 추천/카테고리/챗봇 탭
- `PolicyAITab` - AI 추천 탭 내용
- `PolicyCategoryTab` - 카테고리 탭 내용
- `PolicyChatbotTab` - 챗봇 탭 내용

**업데이트 내용** ⭐:
- **AI 추천 맞춤화**
  - `useApp()` 훅으로 사용자 정보 가져오기
  - `user.vulnerableTypes` 기반 필터링
  - 사용자의 취약계층 유형에 맞는 정책만 추천
  - 예: 장애인 선택 시 → "장애인 활동지원 서비스" 우선 추천
- **정책 데이터 확장**
  - 각 정책에 `targetTypes` 필드 추가
  - 7개 정책 → 사용자 맞춤 3~5개 추천

**주요 기능**:
- **3개 탭**: AI 추천 / 카테고리 / 챗봇

1. **AI 추천 탭** 📝 UPDATE
   - 회원가입 시 입력한 취약계층 유형 활용
   - 맞춤 정책 카드 표시 (제목, 카테고리, 설명, 대상, 지원 내용)
   - "자세히 보기" 버튼

2. **카테고리 탭**
   - 8개 카테고리 다중 선택 (생활비, 주거, 의료, 교육, 양육, 일자리, 복지, 기타)
   - 선택된 카테고리의 정책만 필터링하여 표시

3. **챗봇 탭**
   - 대화형 UI (사용자/봇 메시지 구분)
   - 메시지 입력 → 1초 후 AI 응답 시뮬레이션
   - Enter 키로 전송 가능

#### `/src/app/pages/policy/components/` ⭐ NEW

**PolicyCard.tsx**: 정책 정보를 표시하는 카드 컴포넌트

**PolicyAITab.tsx**: AI 추천 탭 컨텐츠

**PolicyCategoryTab.tsx**: 카테고리 선택 및 필터링 탭

**PolicyChatbotTab.tsx**: 챗봇 대화 UI

**Mock 정책 데이터** (7개):
- 긴급복지 생계지원 (기초생활수급자, 차상위계층)
- 주거급여 지원 (기초생활수급자, 차상위계층, 한부모가정)
- 한부모가정 아동양육비 (한부모가정)
- 장애인 활동지원 서비스 (장애인)
- 노인 일자리 지원사업 (노인)
- 청소년 교육비 지원 (아동/청소년, 기초생활수급자)
- 의료급여 지원 (기초생활수급자, 장애인, 노인)

---

### 💬 **Chat (채팅)** - `/src/app/pages/chat/`

#### `ChatListScreen.tsx`
**역할**: 채팅 목록 화면

**주요 기능**:
- 채팅방 목록 표시 (상대방 이름, 마지막 메시지, 시간)
- 읽지 않은 메시지 개수 (빨간 뱃지)
- 채팅방 클릭 → `/chat/:id`

---

#### `ChatRoomScreen.tsx`
**역할**: 1:1 채팅방 화면

**주요 기능**:
1. **좌측 "+" 버튼**: 사진, 카메라, 위치공유, 거래약속
2. **우측 상단 "..." 메뉴**: 매너 평가, 신고, 차단, 채팅방 나가기
3. **상대방 프로필 클릭**: 매너온도, 나눔 횟수, 응답률, 가입일, 후기 표시
4. **매너 평가 다이얼로그**: "매너있어요" / "아쉬워요" 선택 후 코멘트 작성

---

### 👤 **MyPage (마이페이지)** - `/src/app/pages/mypage/`

#### `MyPageScreen.tsx`
**역할**: 마이페이지 메인 화면

**메뉴 리스트**:
- 내동네 설정 → `/my-location`
- 나의 나눔/활동 → `/my-shares`
- 나눔통계 → `/my-stats`
- 설정 → `/settings`
- 관리자에게 문의하기 → `/contact-admin`

---

#### `ContactAdminScreen.tsx`
**역할**: 관리자 문의 화면

**주요 기능**:
- 제목, 이메일, 문의 내용 입력
- 안내사항 (평일 09:00~18:00, 1~2일 내 답변)
- "문의하기" 버튼 → 알림 표시 후 마이페이지 복귀

---

#### `ProfileEditScreen.tsx`
**역할**: 프로필 수정 화면

**주요 기능**:
- 프로필 이미지 편집 (카메라 아이콘)
- 이름, 전화번호, 이메일, 자기소개 수정
- "저장" 버튼

---

#### `MyLocationScreen.tsx`
**역할**: 내동네 설정 화면

**주요 기능**:
- 현재 설정된 동네 표시
- 지도 UI
- "현재 위치로 재설정" 버튼

---

#### `MyStatsScreen.tsx`
**역할**: 나눔 통계 화면

**주요 기능**:
- 월별 나눔 통계 그래프 (recharts 라이브러리)
- 통계 카드: 총 나눔 횟수, 이번 달 나눔, 받은 감사 인사
- 평균치와 비교선 (빨간 점선)

---

#### `MySharesScreen.tsx`
**역할**: 나의 나눔/활동 내역 화면

**주요 기능**:
- 탭 전환 (나눔완료 / 진행중)
- 나눔완료 항목 클릭 → 후기 팝업 (Dialog)
- 진행중 항목 클릭 → 게시물 상세 페이지

---

#### `SettingsScreen.tsx`
**역할**: 설정 화면

**주요 기능**:
- 계정 설정 (비밀번호/전화번호 변경)
- 알림 설정 (채팅/나눔/이벤트)
- 앱 정보 (버전 v1.0.0, 약관, 라이선스)
- 로그아웃, 회원탈퇴

---

## 🎨 UI 컴포넌트 (shadcn/ui 기반)

### `/src/app/components/ui/`

프로젝트에서 사용되는 재사용 가능한 UI 컴포넌트들:

- **Button**: 다양한 variant (default, outline, ghost 등)
- **Input**: 텍스트 입력 필드
- **Textarea**: 여러 줄 텍스트 입력
- **Badge**: 작은 라벨/태그
- **Sheet**: 옆/아래에서 슬라이드되는 패널
- **Dialog**: 모달 팝업
- **Checkbox**: 체크박스
- **Select**: 드롭다운 선택

---

## 🔄 주요 사용자 플로우

### 1️⃣ **회원가입 플로우** 📝 UPDATE
```
/splash (2초 대기) → /login → "회원가입" 클릭
→ /signup (취약계층 여부 간단 선택) ⭐

[취약계층인 경우]
→ /vulnerable-select (유형 선택, signupData 저장) ⭐
→ /vulnerable-info (개인정보 입력 + 증명서류 업로드, 유효성 검사, signupData 누적) ⭐

[일반 사용자인 경우]
→ /personal-info (개인정보 입력, 증명서류 필드 없음, 유효성 검사, signupData 저장) ⭐

[공통]
→ /location-setting (동네 설정)
→ signupData + location → user 생성 및 전역 상태 저장 ⭐
→ /home (가입 완료, 정책 추천 활성화) ⭐
```

### 2️⃣ **정책 추천 플로우** ⭐ UPDATE
```
/home → 하단 네비게이션 "정책 찾기" 탭 클릭
→ /policy (AI 추천 탭)
→ user.vulnerableTypes 기반 맞춤 정책 표시 ⭐
   예: [기초생활수급자, 장애인] 선택 시
   → "긴급복지 생계지원", "장애인 활동지원 서비스", "의료급여 지원" 추천
→ 정책 카드 "자세히 보기" 클릭
```

### 3️⃣ **게시글 작성 플로우**
```
/home → 우측 하단 플로팅 버튼 클릭
→ /write (나눔해요/필요해요 선택)
→ /write/form?type=share (또는 need)
→ [나눔해요인 경우] AI 유해물품 판단 팝업 (2초 로딩) ⭐
→ 게시글 작성 후 "완료"
→ /home
```

### 4️⃣ **검색 및 정렬 플로우** ⭐ UPDATE
```
/home → 우측 상단 검색 아이콘 클릭
→ /search
→ 검색어 입력 또는 카메라 아이콘으로 이미지 검색
→ 정렬 옵션 선택 (최신순/거리순/인기순) ⭐
→ 필터 설정 (유형/상태/거리/카테고리)
→ 결과 목록 ({N}개 표시) ⭐
→ 게시물 클릭 → /post/:id
```

### 5️⃣ **나눔 신청 플로우**
```
/home → 게시물 카드 클릭
→ /post/:id (게시물 상세)
→ "채팅하기" 클릭
→ /chat/:id (채팅방)
→ "+" 버튼으로 사진/위치 공유
→ 채팅으로 거래 진행
→ "..." 메뉴에서 매너 평가
```

### 6️⃣ **관리자 문의 플로우**
```
/home → 하단 네비게이션 "MY" 탭 클릭
→ /mypage
→ "관리자에게 문의하기" 클릭
→ /contact-admin
→ 제목/이메일/내용 입력 후 "문의하기"
→ 알림 표시 후 /mypage로 복귀
```

---

## 🛠️ 기술 스택

- **React 18**: UI 라이브러리
- **TypeScript**: 타입 안정성
- **React Router v6**: 클라이언트 사이드 라우팅
- **Tailwind CSS v4**: 스타일링
- **shadcn/ui**: UI 컴포넌트 라이브러리
- **Lucide React**: 아이콘
- **Recharts**: 차트/그래프
- **Context API**: 전역 상태 관리

---

## 📊 데이터 구조

### User (사용자) 📝 UPDATE
```typescript
{
  id: string;
  name: string;
  email: string;
  phone?: string;                    // ⭐ 전화번호
  isVulnerable: boolean;             // 취약계층 여부
  vulnerableTypes?: string[];        // ⭐ 취약계층 유형 배열
  location: string;                  // 현재 동네
  birthdate?: string;                // ⭐ 생년월일
  bio?: string;                      // ⭐ 자기소개
  profileImage?: string;
}
```

### Post (게시물)
```typescript
{
  id: string;
  type: "share" | "need";            // 나눔해요 / 필요해요
  title: string;
  description: string;
  location: string;
  time: string;
  status: "available" | "reserved" | "completed";
  category: string;
  author: {
    name: string;
    temperature: number;             // 매너온도
  };
  images: string[];
  distance?: number;                 // ⭐ km (검색 시 사용)
}
```

### Policy (정책) 📝 UPDATE
```typescript
{
  id: string;
  title: string;
  category: string;
  description: string;
  target: string;                    // 지원 대상
  support: string;                   // 지원 내용
  targetTypes?: string[];            // ⭐ 매칭용 취약계층 유형
}
```

### Chat (채팅)
```typescript
{
  id: string;
  participant: string;               // 상대방 이름
  lastMessage: string;
  time: string;
  unreadCount: number;
}
```

### Message (메시지)
```typescript
{
  id: string;
  text: string;
  sender: "me" | "other";
  time: string;
  type?: "text" | "image" | "location";  // ⭐ 메시지 타입
}
```

### Notification (알림)
```typescript
{
  id: string;
  type: "share" | "chat" | "system";
  title: string;
  message: string;
  time: string;
  isRead: boolean;
}
```

---

## 🎯 주요 기능 요약

### ✅ 완료된 기능:
1. ✓ 사용자 인증 플로우 (로그인, 회원가입, **유효성 검사** ⭐)
2. ✓ 취약계층 선택 및 정보 입력 (**전역 상태 연동** ⭐)
3. ✓ 동네 설정 (**회원가입 완료 처리** ⭐)
4. ✓ 스플래시 화면 ("Give,기부" 브랜딩)
5. ✓ 홈 화면 (게시물 목록, 플로팅 글쓰기 버튼)
6. ✓ 게시물 상세 (이미지 포함)
7. ✓ 게시글 작성 (나눔해요/필요해요, AI 유해물품 판단)
8. ✓ 검색 및 필터링 (**정렬 기능, Empty State** ⭐)
9. ✓ 정책 찾기 (**AI 맞춤 추천, 카테고리, 챗봇** ⭐)
10. ✓ 채팅 기능 (추가 기능, 매너 평가, 프로필 보기)
11. ✓ 알림 화면
12. ✓ 마이페이지 (프로필, 통계, 활동 내역)
13. ✓ 관리자 문의
14. ✓ 나눔 후기 팝업
15. ✓ 하단 네비게이션 바 (4개 메뉴)
16. ✓ 반응형 모바일 UI
17. ✓ **에러 핸들링** (404, Network Error, Empty State) ⭐
18. ✓ **로딩 상태 관리** (Spinner, Overlay) ⭐
19. ✓ **백엔드 연동 준비** (API 서비스 레이어) ⭐

---

## 💡 개발 가이드

### 새로운 페이지 추가하기
1. `/src/app/pages/` 하위에 새 파일 생성
2. `/src/app/App.tsx`에 import 및 Route 추가
3. 필요시 BottomNav에 메뉴 추가

### 전역 상태 추가하기
1. `/src/app/context/AppContext.tsx` 수정
2. Context 타입 업데이트
3. 필요한 컴포넌트에서 `useApp()` 훅 사용

### 유효성 검사 추가하기 ⭐ NEW
```typescript
import { validateEmail, validatePhone } from "@/app/utils/validation";

const [errors, setErrors] = useState<Record<string, string>>({});
const handleBlur = (field: string) => {
  const error = validateEmail(value) ? "" : "올바른 이메일이 아닙니다";
  setErrors({ ...errors, [field]: error });
};
```

### API 호출하기 ⭐ NEW
```typescript
import { authAPI } from "@/app/services/api";

const { data, error } = await authAPI.login({ email, password });
if (error) {
  // 에러 처리
} else {
  setUser(data.user);
}
```

### UI 컴포넌트 사용하기
```typescript
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Dialog } from "@/app/components/ui/dialog";
import { LoadingSpinner } from "@/app/components/LoadingComponents"; // ⭐
import { EmptyState } from "@/app/components/ErrorComponents"; // ⭐
```

---

## 📝 참고사항

- **Mock 데이터**: 모든 게시물, 채팅, 사용자, 정책 데이터는 현재 하드코딩된 Mock 데이터입니다
- **이미지**: Unsplash API를 통해 실제 이미지를 사용하고 있습니다
- **상태 관리**: Context API로 전역 상태 관리 (회원가입 데이터 흐름 포함 ⭐)
- **라우팅**: React Router의 BrowserRouter 사용
- **스타일링**: Tailwind CSS 유틸리티 클래스 사용
- **백엔드 연동**: `/API_SPECIFICATION.md` 참조하여 API 구현 ⭐

---

## 🆕 최근 업데이트 (v3.0) ⭐

### 8가지 주요 개선사항:

0. **✅ 컴포넌트 구조 리팩토링** ⭐ NEW (v3.0)
   - 공통 컴포넌트 추가: PostCard, PageHeader, TabBar
   - 페이지별 컴포넌트 분리:
     - Home: HomeHeader, PostList, FloatingWriteButton
     - Policy: PolicyCard, PolicyAITab, PolicyCategoryTab, PolicyChatbotTab
     - Search: SearchHeader, SearchFilter, AIImageSearch, CategoryTabs, SearchResults
     - Write: AICheckDialog, WriteFormFields
   - 재사용성 및 유지보수성 향상
   - 파일: 총 15개의 새로운 컴포넌트 파일

### 7가지 주요 개선사항 (v2.5):

1. **✅ 전역 상태 관리 강화**
   - AppContext에 `signupData`, `vulnerableTypes` 등 추가
   - 회원가입 데이터가 정책 추천에 자동 반영
   - 파일: `/src/app/context/AppContext.tsx`

2. **✅ 입력 폼 유효성 검사**
   - `validation.ts` 유틸리티 함수 작성
   - 실시간 검증 + 시각적 피드백 (빨간 테두리, 에러 메시지)
   - 적용: VulnerableInfoScreen, PersonalInfoScreen
   - 파일: `/src/app/utils/validation.ts`

3. **✅ AI 로직 UI 피드백 강화**
   - LoadingSpinner, LoadingOverlay 컴포넌트 생성
   - 유해물품 판단, 이미지 검색 시나리오 준비
   - 파일: `/src/app/components/LoadingComponents.tsx`

4. **✅ 검색 및 필터링 고도화**
   - 정렬 기능 추가 (최신순/거리순/인기순)
   - Empty State 구현 (검색 결과 없을 때)
   - 검색 결과 개수 표시
   - 파일: `/src/app/pages/search/SearchScreen.tsx`

5. **✅ 에러 핸들링 페이지 제작**
   - NotFoundPage (404 페이지)
   - NetworkErrorPage (네트워크 오류)
   - EmptyState (데이터 없음, 재사용 가능)
   - 파일: `/src/app/components/ErrorComponents.tsx`

6. **✅ 통합 디버깅 및 반응형 최적화**
   - 모든 화면 반응형 디자인 점검
   - 터치 인터랙션 최적화
   - 모바일 우선 디자인 적용

7. **✅ 백엔드 연동 준비**
   - `api.ts` - 36개 API 함수 작성 (Mock 응답)
   - `API_SPECIFICATION.md` - 전체 API 명세서
   - 프론트엔드 독립 개발 가능
   - 파일: `/src/app/services/api.ts`, `/API_SPECIFICATION.md`

### 변경된 파일 요약 (v3.0):
- 📝 **수정**: HomeScreen.tsx ⭐, PolicyScreen.tsx ⭐, SearchScreen.tsx ⭐, WriteFormScreen.tsx ⭐, PROJECT_STRUCTURE.md ⭐
- ⭐ **신규 컴포넌트 (15개)**:
  - 공통: PostCard.tsx, PageHeader.tsx, TabBar.tsx
  - Home: HomeHeader.tsx, PostList.tsx, FloatingWriteButton.tsx
  - Policy: PolicyCard.tsx, PolicyAITab.tsx, PolicyCategoryTab.tsx, PolicyChatbotTab.tsx
  - Search: SearchHeader.tsx, SearchFilter.tsx, AIImageSearch.tsx, CategoryTabs.tsx, SearchResults.tsx
  - Write: AICheckDialog.tsx, WriteFormFields.tsx

### 변경된 파일 요약 (v2.5):
- 📝 **수정**: AppContext.tsx, SignupScreen.tsx ⭐, VulnerableSelectScreen.tsx, VulnerableInfoScreen.tsx ⭐, PersonalInfoScreen.tsx, LocationSettingScreen.tsx, SearchScreen.tsx, PolicyScreen.tsx, LoginScreen.tsx ⭐, App.tsx
- ⭐ **신규**: validation.ts, api.ts, ErrorComponents.tsx, LoadingComponents.tsx, API_SPECIFICATION.md, IMPLEMENTATION_REPORT.md

### 주요 개선사항 (최신):
- **SignupScreen**: UI 간소화 (취약계층 여부만 선택) ⭐
- **VulnerableInfoScreen**: 취약계층 증명서류 업로드 필드 추가 ⭐
- **LoginScreen**: 유효성 검사 추가 (빈 값 로그인 방지) ⭐
- **회원가입 플로우**: 취약계층 여부에 따라 증명서류 필드 조건부 표시 ⭐

---

## 📚 관련 문서

- **API 명세서**: `/API_SPECIFICATION.md` ⭐ NEW
- **구현 완료 보고서**: `/IMPLEMENTATION_REPORT.md` ⭐ NEW
- **프로젝트 구조**: (이 문서)

---

이 문서는 프로젝트의 전체 구조와 각 파일의 역할, 그리고 최근 개선사항을 이해하는 데 도움을 주기 위해 작성되었습니다. 
각 컴포넌트와 페이지의 세부 구현은 해당 파일을 직접 참조하세요.