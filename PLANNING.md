# 네이버 검색 순위 체크 프로그램 - 기획 문서

## 📋 프로젝트 개요

네이버 검색에서 특정 업체명, ID, 키워드의 순위를 추적하고, 금칙어를 검사하는 통합 관리 도구

**버전**: 1.0.0  
**상태**: 기획 중  

---

## 🎯 핵심 기능 3가지

### 1️⃣ **특정 업체 이름 체크**

#### 개요
- 사전에 설정한 **키워드 리스트**를 기준으로 네이버 검색
- 업체명이 포함된 게시물의 **순위 추적**
- 카페/지식인의 **댓글, 답글** 내 업체명 언급 횟수 집계

#### 세부 기능

| 기능 | 설명 | 대상 |
|------|------|------|
| **통합검색 순위** | 각 키워드당 업체명의 순위 기록 | 블로그, 뉴스, 웹문서 |
| **카페 댓글 추적** | 해당 게시물의 댓글에 업체명 포함 여부 & 개수 | 카페 게시물 |
| **지식인 답글 추적** | 질문의 답변/댓글에 업체명 포함 여부 & 개수 | 지식인 게시물 |
| **시간대별 기록** | 언제 검색했는지, 순위 변화 추적 | 모든 결과 |

#### 데이터 구조
```javascript
{
  scanId: "20260605_company_scan_001",
  scanType: "company_name",
  companyName: "회사명",
  keywords: ["키워드1", "키워드2"],
  results: [
    {
      keyword: "키워드1",
      searchResults: [
        {
          rank: 1,
          title: "게시물 제목",
          url: "https://...",
          source: "blog|cafe|kin", // 블로그, 카페, 지식인
          excerpt: "미리보기 텍스트"
        }
      ],
      cafeComments: {
        totalCount: 5,
        posts: [
          {
            url: "https://cafe.naver.com/...",
            commentCount: 3,
            commentSamples: ["업체명이 들어간 댓글", ...]
          }
        ]
      },
      kinAnswers: {
        totalCount: 2,
        posts: [...]
      }
    }
  ],
  timestamp: "2026-06-05T10:30:00Z"
}
```

---

### 2️⃣ **ID별 순위 체크**

#### 개요
- 특정 **아이디(작성자ID)**로 작성한 게시물 추적
- 통합검색에서의 **순위 확인**
- 통합검색에 미노출시 **블로그 탭 페이지 위치** 확인

#### 세부 기능

| 기능 | 설명 | 상세 |
|------|------|------|
| **통합검색 순위 감지** | 해당 ID의 글이 통합검색에서 몇 위인지 확인 | 순위 1-30 기록 |
| **블로그 탭 위치** | 통합검색에 없으면 블로그 탭에서 검색 | 페이지/순번 기록 |
| **여러 키워드 검색** | 표에 정리된 모든 키워드로 한 번에 검색 | 일괄 처리 |
| **글 URL 자동 감지** | 검색된 글의 URL 기록 | 추후 모니터링용 |

#### 데이터 구조
```javascript
{
  scanId: "20260605_id_scan_001",
  scanType: "user_id",
  userId: "사용자아이디",
  platform: "blog|cafe|kin",
  keywords: ["키워드1", "키워드2"],
  results: [
    {
      keyword: "키워드1",
      status: "found|not_found",
      location: {
        section: "integrated|blog|cafe|kin",
        rank: 5,                    // 통합검색에서의 순위
        pageNumber: 2,              // 블로그 탭 페이지
        positionInPage: 3           // 해당 페이지의 몇 번째
      },
      postUrl: "https://...",
      foundAt: "2026-06-05T10:30:00Z"
    }
  ],
  timestamp: "2026-06-05T10:30:00Z"
}
```

---

### 3️⃣ **금칙어 검색 (Forbidden Word Check)**

#### 개요
- 미리 정의된 **금칙어 사전** 관리
- 현재 작성한 게시글에 **금칙어가 얼마나 포함**되어 있는지 검사
- **띄어쓰기 무시** 기준으로 매칭

#### 세부 기능

| 기능 | 설명 | 예시 |
|------|------|------|
| **금칙어 사전 관리** | 금칙어 리스트 추가/삭제/편집 | UI에서 직접 관리 |
| **텍스트 입력 분석** | 게시글 본문에서 금칙어 검출 | 실시간 검사 |
| **띄어쓰기 무시 매칭** | 띄어쓰기를 무시하고 검사 | "나쁜말" = "나 쁜 말" 인식 |
| **결과 리포트** | 금칙어별 포함 개수 & 위치 표시 | 하이라이트 표시 |

#### 데이터 구조
```javascript
{
  scanId: "20260605_forbidden_scan_001",
  scanType: "forbidden_words",
  text: "검사할 게시글 본문",
  forbiddenWords: [
    {
      word: "금칙어",
      category: "negative|marketing|etc",
      severity: "high|medium|low"
    }
  ],
  results: [
    {
      word: "금칙어",
      count: 3,
      positions: [
        {
          index: 5,
          context: "...금칙어포함된문맥..."
        }
      ]
    }
  ],
  timestamp: "2026-06-05T10:30:00Z"
}
```

---

## 🏗️ 시스템 아키텍처

### 전체 흐름도
```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐ │
│  │ Control      │  │ Dashboard &    │  │ Forbidden Word  │ │
│  │ Panel        │  │ Results        │  │ Manager         │ │
│  └──────────────┘  └────────────────┘  └──────────────────┘ │
└──────────────┬──────────────────────────────────────────────┘
               │ HTTP/API
┌──────────────▼──────────────────────────────────────────────┐
│              Backend (Express.js + Cheerio)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ API Routes:                                          │  │
│  │ • POST /api/scan/company-name                       │  │
│  │ • POST /api/scan/user-id                            │  │
│  │ • POST /api/check/forbidden-words                   │  │
│  │ • GET /api/scan-history                             │  │
│  │ • POST /api/forbidden-words (CRUD)                  │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Core Services:                                       │  │
│  │ • NaverSearchScraper (웹 크롤링)                     │  │
│  │ • CommentAnalyzer (댓글/답글 분석)                   │  │
│  │ • ForbiddenWordMatcher (금칙어 검사)                │  │
│  │ • RankTracker (순위 추적)                            │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│              Database (SQLite / JSON)                        │
│  • scan_results (검색 결과)                                 │
│  • scan_history (검색 히스토리)                             │
│  • forbidden_words (금칙어 사전)                            │
│  • keyword_lists (키워드 템플릿)                            │
│  • user_settings (사용자 설정)                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 데이터베이스 스키마

### 테이블 1: `scan_results`
```sql
CREATE TABLE scan_results (
  id TEXT PRIMARY KEY,
  scan_type VARCHAR(50),           -- 'company_name' | 'user_id' | 'forbidden_words'
  search_keyword VARCHAR(255),
  result_data JSON,               -- 검색 결과 상세 데이터
  created_at DATETIME,
  updated_at DATETIME,
  status VARCHAR(50)              -- 'pending' | 'completed' | 'failed'
);
```

### 테이블 2: `scan_history`
```sql
CREATE TABLE scan_history (
  id INTEGER PRIMARY KEY,
  scan_id TEXT,
  scan_type VARCHAR(50),
  keywords TEXT,                  -- JSON array
  result_summary TEXT,           -- 간단한 요약
  created_at DATETIME
);
```

### 테이블 3: `forbidden_words`
```sql
CREATE TABLE forbidden_words (
  id INTEGER PRIMARY KEY,
  word VARCHAR(255) UNIQUE,
  category VARCHAR(100),          -- 'negative' | 'marketing' | 'spam' etc
  severity VARCHAR(50),           -- 'high' | 'medium' | 'low'
  created_at DATETIME,
  updated_at DATETIME
);
```

### 테이블 4: `keyword_lists`
```sql
CREATE TABLE keyword_lists (
  id INTEGER PRIMARY KEY,
  list_name VARCHAR(255),
  keywords TEXT,                 -- JSON array
  created_at DATETIME,
  updated_at DATETIME
);
```

---

## 🔌 API 엔드포인트 설계

### 1. 특정 업체명 검색
```
POST /api/scan/company-name
Content-Type: application/json

Request:
{
  "companyName": "회사명",
  "keywords": ["키워드1", "키워드2"],
  "checkCafeComments": true,
  "checkKinAnswers": true
}

Response:
{
  "scanId": "20260605_company_scan_001",
  "status": "completed",
  "results": [...]
}
```

### 2. ID별 순위 검색
```
POST /api/scan/user-id
Content-Type: application/json

Request:
{
  "userId": "사용자아이디",
  "platform": "blog",  -- blog | cafe | kin
  "keywords": ["키워드1", "키워드2"],
  "searchBlogFallback": true
}

Response:
{
  "scanId": "20260605_id_scan_001",
  "status": "completed",
  "results": [...]
}
```

### 3. 금칙어 검사
```
POST /api/check/forbidden-words
Content-Type: application/json

Request:
{
  "text": "검사할 게시글 본문",
  "ignoreSpaces": true
}

Response:
{
  "scanId": "20260605_forbidden_scan_001",
  "totalViolations": 5,
  "results": [...]
}
```

### 4. 금칙어 사전 관리
```
GET  /api/forbidden-words                  -- 전체 조회
POST /api/forbidden-words                  -- 추가
PUT  /api/forbidden-words/:id              -- 수정
DELETE /api/forbidden-words/:id            -- 삭제
```

### 5. 스캔 히스토리 조회
```
GET /api/scan-history?type=company_name&limit=20
GET /api/scan-history/:scanId
```

---

## 🎨 UI/UX 구조

### 페이지 1: Control Panel (제어 패널)
```
┌─────────────────────────────────┐
│  네이버 검색 순위 체커           │
├─────────────────────────────────┤
│  
│  [1] 특정 업체명 체크
│  ┌─────────────────────────────┐
│  │ 업체명: [입력칸]             │
│  │ 키워드 목록:                  │
│  │ ☐ 키워드1                    │
│  │ ☐ 키워드2                    │
│  │ ☐ 키워드3 추가하기           │
│  │ ☑ 카페 댓글 확인            │
│  │ ☑ 지식인 답글 확인          │
│  │ [검색 시작]                   │
│  └─────────────────────────────┘
│
│  [2] ID별 순위 체크
│  ┌─────────────────────────────┐
│  │ 아이디: [입력칸]             │
│  │ 플랫폼: [블로그▼]            │
│  │ 키워드 목록: [선택칸▼]      │
│  │ ☑ 블로그 탭도 검색          │
│  │ [검색 시작]                   │
│  └─────────────────────────────┘
│
│  [3] 금칙어 검사
│  ┌─────────────────────────────┐
│  │ [텍스트 입력 또는 붙여넣기]  │
│  │                              │
│  │ [분석 시작]                   │
│  └─────────────────────────────┘
│
└─────────────────────────────────┘
```

### 페이지 2: Dashboard (결과 조회)
```
┌──────────────────────────────────────┐
│  검색 결과                            │
├──────────────────────────────────────┤
│
│  필터: [스캔 타입▼] [기간▼]
│
│  ┌──────────────────────────────────┐
│  │ 2026-06-05 | 회사명 검색         │
│  │ 📊 결과 보기                      │
│  │ 🗑️ 삭제                          │
│  └──────────────────────────────────┘
│
│  ┌─────────────────────────────────────────────────────┐
│  │ 키워드 | 순위 | 원본URL | 카페댓글 | 지식인답글  │
│  ├─────────────────────────────────────────────────────┤
│  │ 키워드1│  3위 │ [링크]  │   5개    │    2개     │
│  │ 키워드2│ 12위 │ [링크]  │   0개    │    0개     │
│  │ 키워드3│미노출│   -     │   -      │    -       │
│  └─────────────────────────────────────────────────────┘
│
└──────────────────────────────────────┘
```

### 페이지 3: 금칙어 관리자
```
┌─────────────────────────────────────┐
│  금칙어 사전                         │
├─────────────────────────────────────┤
│
│  [+ 새 금칙어 추가]
│
│  ┌────────────────────────────────┐
│  │ 검색: [입력칸]                │
│  └────────────────────────────────┘
│
│  ┌────────────────────────────────────────┐
│  │ 금칙어 | 카테고리 | 심각도 | 작업    │
│  ├────────────────────────────────────────┤
│  │ 나쁜말  │ 부정  │ 높음  │ ✏️ 🗑️   │
│  │ 스팸    │ 스팸  │ 높음  │ ✏️ 🗑️   │
│  │ 광고    │ 마케팅│ 중간  │ ✏️ 🗑️   │
│  └────────────────────────────────────────┘
│
└─────────────────────────────────────┘
```

---

## 🔧 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| **Frontend** | React | 18.3.x |
| **Frontend Build** | Vite | 5.3.x |
| **Backend** | Express.js | 4.21.x |
| **Scraping** | Cheerio | 1.0.x |
| **Database** | SQLite3 | 최신 |
| **HTTP Client** | node-fetch | 최신 |
| **CORS** | cors | 2.8.x |
| **CLI** | Node.js | 18.x+ |

---

## 📅 개발 로드맵

### Phase 1: 기반 구축 (1주)
- [ ] 백엔드 API 라우팅 구조 설정
- [ ] SQLite 데이터베이스 스키마 작성
- [ ] 네이버 검색 크롤러 기본 모듈 개발
- [ ] CORS/Express 미들웨어 설정

### Phase 2: 특정 업체명 검색 (2주)
- [ ] 통합검색 결과 파싱 로직
- [ ] 카페 댓글 크롤링 기능
- [ ] 지식인 답글 크롤링 기능
- [ ] 결과 저장 및 조회 API
- [ ] 프론트엔드 UI 구현

### Phase 3: ID별 순위 검색 (1.5주)
- [ ] 특정 ID의 글 검색 로직
- [ ] 블로그 탭 폴백 검색
- [ ] 순위 추적 로직
- [ ] 프론트엔드 UI 구현

### Phase 4: 금칙어 검사 (1주)
- [ ] 금칙어 사전 CRUD API
- [ ] 띄어쓰기 무시 매칭 알고리즘
- [ ] 텍스트 분석 엔진
- [ ] 프론트엔드 UI 구현

### Phase 5: 고도화 및 최적화 (1.5주)
- [ ] 에러 핸들링 강화
- [ ] 성능 최적화
- [ ] 테스트 작성
- [ ] 배포 준비

---

## ⚠️ 기술적 고려사항

### 1. 네이버 크롤링 정책
- User-Agent 설정 필수
- 요청 간격 조절 (과도한 크롤링 방지)
- robots.txt 준수
- IP 차단 시 프록시 고려

### 2. 성능
- 대량 키워드 검색시 병렬 처리
- 검색 결과 캐싱
- 진행 상황 실시간 업데이트 (WebSocket 고려)

### 3. 정확성
- 동일한 게시물 중복 제거
- URL 정규화
- 순위 변동 추적

### 4. 보안
- 입력값 검증
- XSS 방지
- SQL Injection 방지 (Parameterized Query)

---

## 📝 다음 단계

1. **데이터베이스 설계 상세화** - SQL 스키마 작성
2. **API 상세 설계** - 요청/응답 예시 작성
3. **프론트엔드 컴포넌트 구조** - React 컴포넌트 계층도
4. **개발 시작** - Phase 1부터 단계별 진행

---
