# 파워링크·플레이스 순위 추적 설계

**날짜:** 2026-06-06  
**범위:** 파워링크(paid ads) + 네이버 플레이스 순위 추적, 별도 탭으로 신설

---

## 배경 및 목적

기존 스캔 시스템은 네이버 통합검색의 유기적 콘텐츠(블로그·카페·지식인·인플루언서)만 추적하며, 파워링크와 플레이스 블록은 의도적으로 제외하고 있다. 사업자 입장에서는 유료 광고(파워링크)와 지역 매장(플레이스)의 키워드별 순위가 SEO 못지않게 중요하므로, 이를 별도 탭으로 추적하는 기능을 추가한다.

---

## 아키텍처

### 신규 파일
```
backend/lib/fullPageScraper.js     ← SERP 전체 위→아래 파싱
backend/lib/adplaceScanEngine.js   ← 키워드별 스캔 오케스트레이터
backend/routes/adplaceScan.js      ← POST /api/scan/adplace
frontend/src/components/AdPlaceScanPanel.jsx  ← 새 탭 UI
```

### 수정 파일
```
backend/server.js     ← 라우트 마운트 1줄 추가
frontend/src/App.jsx  ← 탭 추가
```

### 기존 파일 재사용 (무수정)
- `naverClient.js` — 헤더·sleep·normalizeUrl
- `store.js` — 히스토리 저장 (scanType: 'adplace')
- `rateLimit.js` — IP 제한
- `ScanProgress.jsx` — SSE 진행률 컴포넌트
- `GET /api/scan/progress` — SSE 엔드포인트

---

## fullPageScraper.js

네이버 통합검색 결과 페이지를 한 번 요청해 **파워링크 블록**과 **플레이스 블록**을 순서대로 추출한다.

### 파워링크 파싱
- 대상 셀렉터: `.ad_area`, `[class*="power_link"]`, `[class*="ca_ad"]`
- 각 광고 항목에서 제목·설명·랜딩 URL 추출
- 순위 = DOM 상의 등장 순서 (1-indexed)

### 플레이스 파싱
- 대상 셀렉터: `[class*="splace"]`, `.place_inner`, `.place_list`
- 각 매장 항목에서 업체명·별점·리뷰수·플레이스 ID(지도 링크 URL) 추출
- 순위 = 블록 내 등장 순서 (1-indexed)

### 반환 구조
```javascript
{
  powerLinkItems: [
    { rank: 1, title: string, description: string, url: string, domain: string }
  ],
  placeItems: [
    { rank: 1, name: string, placeId: string, rating: number, reviewCount: number }
  ]
}
```

---

## adplaceScanEngine.js

키워드 배열을 순회하며 `fullPageScraper`를 호출하고, 결과를 식별자로 매칭해 SSE로 진행률을 스트리밍한다.

### 입력
```javascript
{
  keywords: string[],
  identifiers: {
    name: string,       // 업체명 (필수, 부분 일치)
    domain?: string,    // 파워링크 URL 도메인 (선택)
    placeId?: string    // 네이버 플레이스 ID (선택)
  },
  scanId: string
}
```

### 매칭 우선순위
- **파워링크**: `domain` 완전 일치 → `name` 부분 일치 (대소문자·공백 무시)
- **플레이스**: `placeId` 완전 일치 → `name` 부분 일치

### 키워드당 결과
```javascript
{
  keyword: string,
  powerLink: {
    exposed: boolean,
    rank: number | null,    // 노출 순위 (1-indexed), 미노출 시 null
    totalAds: number,       // 해당 키워드 전체 광고 수
    title: string | null,
    url: string | null
  },
  place: {
    exposed: boolean,
    rank: number | null,    // 플레이스 블록 내 순위, 미노출 시 null
    totalPlaces: number,    // 블록 내 전체 매장 수
    name: string | null,
    rating: number | null,
    reviewCount: number | null
  }
}
```

### 딜레이
기존 scanEngine과 동일하게 키워드 사이 1,500ms + 랜덤 1,500ms 적용.

---

## API 라우트

### POST /api/scan/adplace
```
Body: { keywords: string[], identifiers: { name, domain?, placeId? } }
Response: { scanId: string }
```
- `rateLimit` 미들웨어 적용 (기존 /api/scan/* 동일 설정)
- `adplaceScanEngine`을 비동기 실행 후 즉시 `scanId` 반환
- 진행률은 기존 `GET /api/scan/progress?scanId=` SSE로 수신

### 히스토리 저장
기존 `store.js`의 `saveHistory()`를 `scanType: 'adplace'`로 호출. 기존 히스토리 탭에서 함께 조회된다.

---

## 프론트엔드: AdPlaceScanPanel.jsx

### 입력 폼
```
키워드 입력창 (기존 방식과 동일)

[ 업체명        ] ← 필수
[ 도메인        ] ← 선택 (파워링크 매칭용)
[ 플레이스 ID   ] ← 선택 (정확한 매칭용)

[스캔 시작] 버튼
```

### 결과 테이블
```
┌──────────────┬───────────────────┬───────────────────┐
│   키워드     │    파워링크       │     플레이스      │
├──────────────┼───────────────────┼───────────────────┤
│ 강남 치과    │  🟢 2위 (총 5개) │  🟡 4위 (총 10개)│
│ 임플란트     │  ❌ 미노출        │  🟢 1위 (총 8개) │
└──────────────┴───────────────────┴───────────────────┘
```

**순위 색상 기준**
- 1~3위: 초록
- 4~10위: 노랑
- 미노출: 회색

### 상태 흐름
1. 스캔 시작 → `POST /api/scan/adplace` → `scanId` 수신
2. `EventSource(/api/scan/progress?scanId=)` 연결
3. `keyword_scanned` 이벤트마다 테이블 행 추가
4. `complete` 이벤트에서 SSE 종료

---

## 검증 방법

1. 서버 시작 후 `POST /api/scan/adplace` 직접 호출해 JSON 응답 확인
2. 실제 파워링크 광고가 있는 키워드로 스캔 → 순위 1개 이상 반환 확인
3. 실제 네이버 플레이스 매장이 있는 키워드로 스캔 → 플레이스 순위 반환 확인
4. 미노출 키워드에서 `exposed: false`, `rank: null` 반환 확인
5. 프론트 탭에서 SSE 진행률 실시간 업데이트 확인
6. 기존 업체명 스캔 탭 동작 이상 없음 확인
