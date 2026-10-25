# 정책 데이터 가져오기

정책 수를 늘릴 때는 정부24 또는 공공데이터포털에서 받은 검증된 원본만 사용한다. 임의의 정책명, 금액, 신청기간, 링크를 생성해 넣지 않는다. 정부24의 공공서비스 정보는 공공데이터포털 Open API 활용신청으로 받을 수 있으며, API 서비스키는 프로젝트 환경변수나 JSON 파일에 직접 커밋하지 않는다.

## 입력 형식

`policies.json`은 배열 또는 `{ "policies": [] }` 형식이다.

```json
[
  {
    "policy_name": "정책명",
    "category": "주거",
    "agency": "담당 기관",
    "summary": "정책 요약",
    "content": "정책 원문 또는 상세 설명",
    "target_criteria": "지원 대상",
    "support_detail": "지원 내용",
    "application_method": "주민센터 방문 또는 온라인 신청",
    "ai_search_text": "검색에 사용할 핵심 문장",
    "official_url": "https://공식-정책-페이지",
    "application_url": "https://공식-신청-페이지",
    "application_period": "공고 확인",
    "region": "전국",
    "source_updated_at": "2026-01-01"
  }
]
```

`policy_name`, `agency`, `summary`, `content`는 필수이며 URL은 `http` 또는 `https`만 허용한다. 같은 정책명·기관·지역은 한 번만 반영된다. 기존 정책의 비어 있지 않은 값은 빈 값으로 덮어쓰지 않는다. 전체 가져오기는 하나라도 검증에 실패하면 롤백된다.

## 실행

```bash
node backend/scripts/importPolicies.js /absolute/path/policies.json
```

한 번에 최대 1,200개까지 처리하며, 1,000개를 넣어도 AI 요청에는 검색 상위 정책만 전달된다. 따라서 정책 DB를 늘려도 요청마다 1,000개 전체가 모델에 전송되지는 않는다.

## 정부24 정책 동기화

정부24 API에서 목록을 받아 현재 `POLICY` 테이블 형식으로 변환하는 명령을 추가했다. 먼저 실제 DB를 변경하지 않는 미리보기로 확인한다.

```bash
npm run sync:policies -- --dry-run
```

확인 후 실행하면 최대 `ODCLOUD_POLICY_SYNC_LIMIT`건을 가져와 기존 검증·중복 제거·트랜잭션 업서트 로직을 통해 DB에 반영한다.

```bash
npm run sync:policies
```

기본값은 목록 API만 사용해 호출량을 낮추는 방식이다. 상세 설명과 온라인 신청 URL까지 보강할 때만 다음을 켠다. 상세 API는 정책마다 추가 호출되므로 기본값으로 자동 실행하지 않는다.

```env
ODCLOUD_FETCH_DETAILS=true
```

## 정부24 API 환경변수

정부24 공공서비스 API 키는 백엔드가 정책을 DB로 동기화할 때만 사용한다. 루트 `.env` 또는 `backend/.env` 중 실제 백엔드가 읽는 파일에 다음 값을 설정한다. 현재 `backend/db.js`는 `backend/.env`가 있으면 그 파일을, 없으면 루트 `.env`를 읽는다.

```env
ODCLOUD_BASE_URL=https://api.odcloud.kr/api
ODCLOUD_API_KEY=발급받은_서비스키
ODCLOUD_SERVICE_LIST_PATH=/gov24/v3/serviceList
ODCLOUD_SERVICE_DETAIL_PATH=/gov24/v3/serviceDetail
ODCLOUD_SUPPORT_CONDITIONS_PATH=/gov24/v3/supportConditions
ODCLOUD_POLICY_SYNC_LIMIT=1000
```

Swagger 기준으로 목록·상세·지원조건 API가 분리되어 있다. 서비스키만 등록한다고 기존 175개 정책이 자동으로 바뀌지는 않으며, 동기화 작업을 실행할 때 API를 호출해 검증된 데이터만 `POLICY`에 적재해야 한다. Render에서 동기화를 실행할 때는 같은 변수를 백엔드 서비스에 추가하고, 키를 프론트엔드나 `ai-server` 환경변수에 넣지 않는다.
