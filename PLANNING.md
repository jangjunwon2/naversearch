# 네이버 검색 순위 체크 — 기획/현황 문서

> 최종 업데이트: 2026-06-05
> 상태: 핵심 기능 구현 완료, 로컬 동작 중 · 온라인 배포 준비 완료(미배포)

네이버 검색에서 업체명·작성자 ID의 노출 순위를 추적하고, 키워드 리서치(검색량·포화지수)와
마케팅 공략 우선순위까지 제공하는 통합 SEO/마케팅 도구.

---

## 1. 현재 구현 상태 (완료)

### 탭 구성
`📢 업체명 체크 · 📝 ID 순위 · 🔑 키워드 리서치 · 📊 마케팅 대시보드 · 🛡️ 금칙어 검사 · 📅 히스토리`

### 기능 1 — 업체명 체크 ✅
- 키워드 리스트 전체로 통합검색 → 업체명이 포함된 게시물(블로그/카페/지식인/인플루언서)의 **통합검색 노출 순위**
- **카페 댓글 / 지식인 답글** 내 업체명 언급 수 + **내용 샘플(최대 3개)**
- **📍 종합 노출 순위 표**: 키워드별로 "내 업체가 몇위·몇위에 노출되는지" 한눈에
- SSE 실시간 진행률 + 스캔 취소

### 기능 2 — ID별 순위 체크 ✅
- 특정 작성자 ID 글이 통합검색에서 몇 위인지, 미노출 시 **블로그 탭 몇 페이지 몇 번째**(폴백)

### 기능 3 — 금칙어 검사 ✅
- 금칙어 사전 CRUD(단건/일괄) + 본문 검사
- **띄어쓰기 무시** 매칭("도 박" → "도박") + 원문 하이라이트

### 기능 4 — 키워드 리서치 ✅
- **검색광고 키워드도구 API**: 연관 키워드 + 월간 검색수(PC/모바일) + 막대그래프
- **검색 오픈 API(블로그)**: 블로그 총 문서수, 최근 30일 제목 매치 월 발행량
- **콘텐츠 포화지수**(블랙키위식: 월발행량÷검색량×100, 5단계 라벨) + **누적경쟁**(블로그총÷검색량)
- **입력 키워드 전체**(최대 100개, 5개씩 배치) + **CSV/엑셀 업로드** + 정렬/필터 + CSV 내보내기
- 행 선택 → 목록 저장 / 업체명·ID 스캔으로 전송

### 기능 5 — 마케팅 대시보드 ✅
- **🎯 공략 우선순위**: 검색량+포화지수+내 순위 → 기회점수 + 액션(🔥최우선/✍️공략/📈개선/🛡️유지)
- **🔀 변화 하이라이트**: 직전 스캔 대비 상승/하락/신규진입/이탈
- **📈 추이**: 누적 스캔의 순위 추이 표
- **⏰ 자동 주기 스캔**: 6/12/24h·2일·주1회 스케줄(최소 6h) → 추이 자동 누적, ON/OFF·지금실행·삭제

### 부가 기능 ✅
- **검색어 목록 관리**: 키워드 세트 저장/불러오기/삭제 → 원클릭 스캔
- **히스토리**: 저장/불러오기/삭제 + **CSV export**
- **비밀번호 게이트**(opt-in): `APP_PASSWORD` 설정 시 진입 보호
- **레이트리밋**: 공개 배포 시 API 남용 방지(IP당 분당 스캔15·키워드20)
- **네이버 구조변경 대응**: 전체 페이지 URL 기반 감지 + 폴백 수집 + 블록 병합(클래스 변경에도 누락 0)

---

## 2. 아키텍처

```
backend/
├── server.js              # Express 진입점(라우트 마운트 + SSE + 정적 서빙 + 스케줄러 가동)
├── lib/
│   ├── naverClient.js     # UA/헤더/sleep/URL정규화/횟수카운트
│   ├── integratedSearch.js# 통합검색 스마트블록 파싱(블로그/카페/지식인/인플루언서)
│   ├── blogTab.js         # 블로그 탭 폴백(페이지/순번)
│   ├── cafeComments.js    # 카페 댓글 집계 + 샘플
│   ├── kinAnswers.js      # 지식인 답글 집계 + 샘플
│   ├── forbiddenMatcher.js# 금칙어 매칭(공백 무시 + 위치 매핑)
│   ├── scanEngine.js      # 공용 SSE 스캔 엔진(company/id)
│   ├── searchAdClient.js  # 검색광고 키워드도구 API(HMAC 서명)
│   ├── blogSearchApi.js   # 검색 오픈 API(블로그 총수/월발행)
│   ├── store.js           # JSON 저장소(history/forbidden/keyword-lists/schedules)
│   ├── scheduler.js       # 자동 주기 스캔 루프
│   ├── rateLimit.js       # 인메모리 IP 레이트리밋
│   ├── auth.js            # 비밀번호 게이트
│   └── loadEnv.js         # .env 로더(무의존)
├── routes/                # companyScan·idScan·forbidden·keywords·keywordLists·schedules·history·auth
└── store/                 # *.json (런타임 생성, git 제외)

frontend/src/
├── App.jsx                # 탭 네비 + 스캔 SSE 오케스트레이션
├── components/            # CompanyScanPanel·IdScanPanel·KeywordResearchPanel·MarketingDashboard
│                          # ResultsView·KeywordDetail·ScanHistory·ForbiddenWordPanel
│                          # KeywordListControls·ScanProgress·AuthGate
```

### 기술 스택
React 18 + Vite / Express 4 + Cheerio / JSON 파일 저장 / xlsx(동적 임포트) / lucide-react

### 주요 API 엔드포인트
- 스캔: `POST /api/scan/company`·`/api/scan/id`, `GET /api/scan/progress`(SSE), `POST /api/scan/cancel`
- 금칙어: `GET/POST/PUT/DELETE /api/forbidden/words`, `POST /api/forbidden/check`
- 키워드: `POST /api/keywords`
- 검색어 목록: `GET/POST/PUT/DELETE /api/keyword-lists`
- 스케줄: `GET/POST/PUT/DELETE /api/schedules`, `POST /api/schedules/:id/run`
- 히스토리: `GET /api/history`, `DELETE /api/history/:id`, `GET /api/export/:scanId`
- 인증: `GET /api/auth/status`, `POST /api/auth/login`·`/logout`

### 환경변수(.env)
```
NAVER_SEARCHAD_API_KEY / NAVER_SEARCHAD_SECRET_KEY / NAVER_SEARCHAD_CUSTOMER_ID  # 검색광고
NAVER_OPENAPI_CLIENT_ID / NAVER_OPENAPI_CLIENT_SECRET                            # 검색 오픈API
APP_PASSWORD   # (선택) 접근 비밀번호
PORT           # (선택) 기본 5000
```

### 실행
```
npm run setup   # 루트+프론트 의존성 설치
npm run build   # 프론트 빌드
npm start       # http://localhost:5000
```

---

## 3. 배포 현황

- **방식 확정**: Oracle Cloud Always Free + **춘천(한국)** 리전 VPS (무료 영구 · 한국 IP로 네이버 차단 회피 · 상시)
- **준비 완료**: `git` 초기화 + GitHub 푸시(`jangjunwon2/naversearch`), `render.yaml`, `.gitignore`, `DEPLOY.md`, `ORACLE-DEPLOY.md`, 레이트리밋, 비밀번호 게이트
- **공개 정책**: 누구나 공개 + 내 API 키 공유 (→ 레이트리밋으로 보호, 필요 시 `APP_PASSWORD` 권장)
- **보류**: 오라클 가입/콘솔 에러로 VM 생성 대기 중 → 해결되면 `ORACLE-DEPLOY.md` 따라 진행

---

## 4. 앞으로 할 일 (로드맵)

### 배포 마무리
- [ ] Oracle Cloud 춘천 VM 생성 → 방화벽(2겹)·Node·PM2·스왑 → `git clone` + `.env` + `npm run build` + `pm2 start`
- [ ] (선택) 도메인 연결 + Nginx 리버스 프록시 + HTTPS(certbot) — SSE 위해 `proxy_buffering off`
- [ ] (선택) 데이터 영속 디스크 / 외부 DB (재배포 시 히스토리·목록 보존)

### 기능 고도화
- [ ] **경쟁사 비교**: 내 업체 vs 경쟁 업체(들)를 같은 키워드에서 나란히 비교(점유 현황)
- [ ] **포화지수 정확도**: 월 발행량 표본(최근 100건) 한계 → 페이징/캐싱으로 정확도 개선(공개 배포 시 호출량 균형 고려)
- [ ] **알림**: 순위 급락/신규 진입/이탈 시 알림(이메일·웹훅 등)
- [ ] **지식인 답글 양성 케이스 검증**: 업체명이 실제 답글에 달린 글로 `kinAnswers.js` 셀렉터 정밀화
- [ ] **키워드 리서치 대량 처리 UX**: 100개 초과 분할 안내, 진행률 표시 강화

### 품질/운영
- [ ] 테스트 코드(스크래퍼 파서·금칙어 매칭·포화지수 계산 단위 테스트)
- [ ] 진단 스크립트 정리(`backend/probe.js`·`kin-probe.js`·`e2e-test.js`는 운영용 진단 도구로 유지)
- [ ] 에러 로깅/모니터링(배포 후 `pm2 logs` 기반)

---

## 5. 알려진 제약
- 순위 스캔은 네이버 검색 페이지 스크래핑 기반 → **해외 IP는 차단 가능**(한국 VPS로 회피)
- 네이버 통합검색 블록 순서는 **시점·세션(로그인)에 따라 변동** → 도구는 받은 응답을 그대로 반영
- 월 발행량/포화지수는 **블로그 기준**(오픈API가 카페글 발행일자 미제공)이며 인기 키워드는 표본 한계로 보수적
- 공개 + 공유 키 구성은 API 할당량을 함께 소진 → 레이트리밋·비밀번호 게이트로 완화
