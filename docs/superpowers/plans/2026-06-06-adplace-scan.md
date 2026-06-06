# 파워링크·플레이스 순위 추적 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 네이버 통합검색 결과에서 파워링크(유료광고)와 플레이스(지역 매장) 순위를 키워드별로 추적하는 별도 탭 기능 추가

**Architecture:** `fullPageScraper.js`가 SERP를 파싱하고, `adplaceScanEngine.js`가 기존 scanEngine과 동일한 SSE 인터페이스로 스캔을 관리한다. server.js의 `/api/scan/progress` 핸들러를 확장해 adplace 스캔도 수신한다. 프론트는 자체 상태를 가진 독립 컴포넌트로 구현한다.

**Tech Stack:** Node.js CJS (require/module.exports), cheerio, node:test, React 18 + fetch API

---

### Task 1: `fullPageScraper.js` — SERP 파싱 모듈

**Files:**
- Create: `backend/lib/__tests__/fullPageScraper.test.js`
- Create: `backend/lib/fullPageScraper.js`

- [ ] **Step 1: 테스트 파일 작성**

```javascript
// backend/lib/__tests__/fullPageScraper.test.js
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const cheerio = require('cheerio');
const { parsePowerLinks, parsePlaces, extractDomain } = require('../fullPageScraper');

describe('extractDomain', () => {
  test('www를 제거하고 hostname 반환', () => {
    assert.equal(extractDomain('https://www.example.com/page'), 'example.com');
  });
  test('잘못된 URL이면 빈 문자열 반환', () => {
    assert.equal(extractDomain('not-a-url'), '');
  });
});

describe('parsePowerLinks', () => {
  test('순위·제목·도메인을 추출한다', () => {
    const html = `
      <div class="ad_area">
        <ul><li><a class="link_tit" href="https://bizA.com/page">업체A</a><p class="desc">설명A</p></li>
        <li><a class="link_tit" href="https://bizB.com/">업체B</a></li></ul>
      </div>`;
    const $ = cheerio.load(html);
    const items = parsePowerLinks($);
    assert.equal(items.length, 2);
    assert.equal(items[0].rank, 1);
    assert.equal(items[0].title, '업체A');
    assert.equal(items[0].domain, 'bizA.com');
    assert.equal(items[0].description, '설명A');
    assert.equal(items[1].rank, 2);
    assert.equal(items[1].title, '업체B');
  });

  test('광고 블록 없으면 빈 배열 반환', () => {
    const $ = cheerio.load('<div class="organic">내용</div>');
    assert.deepEqual(parsePowerLinks($), []);
  });

  test('제목 없는 li는 건너뛴다', () => {
    const html = `
      <div class="power_link">
        <ul><li><a></a></li><li><a href="https://x.com">실제업체</a></li></ul>
      </div>`;
    const $ = cheerio.load(html);
    const items = parsePowerLinks($);
    assert.equal(items.length, 1);
    assert.equal(items[0].title, '실제업체');
  });
});

describe('parsePlaces', () => {
  test('순위·업체명·placeId를 추출한다', () => {
    const html = `
      <div class="splace_section">
        <ul>
          <li><a class="place_bluelink" href="https://map.naver.com/v5/entry/place/12345">매장A</a></li>
          <li><a class="place_bluelink" href="https://map.naver.com/v5/entry/place/67890">매장B</a></li>
        </ul>
      </div>`;
    const $ = cheerio.load(html);
    const items = parsePlaces($);
    assert.equal(items.length, 2);
    assert.equal(items[0].rank, 1);
    assert.equal(items[0].name, '매장A');
    assert.equal(items[0].placeId, '12345');
    assert.equal(items[1].rank, 2);
    assert.equal(items[1].placeId, '67890');
  });

  test('플레이스 블록 없으면 빈 배열 반환', () => {
    const $ = cheerio.load('<div class="blog">내용</div>');
    assert.deepEqual(parsePlaces($), []);
  });

  test('별점과 리뷰 수를 파싱한다', () => {
    const html = `
      <div class="splace_section">
        <ul><li>
          <a class="place_bluelink" href="/place/111">카페X</a>
          <span class="star_score">4.5</span>
          <span class="review_cnt">리뷰 1,234</span>
        </li></ul>
      </div>`;
    const $ = cheerio.load(html);
    const [item] = parsePlaces($);
    assert.equal(item.rating, 4.5);
    assert.equal(item.reviewCount, 1234);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```
cd "C:\Users\jun92\Desktop\검색 순위 체크"
node --test backend/lib/__tests__/fullPageScraper.test.js
```
Expected: `Cannot find module '../fullPageScraper'` 오류

- [ ] **Step 3: `fullPageScraper.js` 구현**

```javascript
// backend/lib/fullPageScraper.js
const cheerio = require('cheerio');
const { defaultHeaders } = require('./naverClient');

const NAVER_SEARCH = 'https://search.naver.com/search.naver';

const PL_CONTAINERS = ['[class*="power_link"]', '[class*="ad_area"]', '[class*="lst_ad"]'];
const PLACE_CONTAINERS = ['[class*="splace"]', '[class*="place_area"]', '[class*="place_section"]'];

function extractDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function parsePowerLinks($) {
  const items = [];
  let container = null;
  for (const sel of PL_CONTAINERS) {
    const el = $(sel).first();
    if (el.length) { container = el; break; }
  }
  if (!container || !container.length) return items;

  container.find('li').each((_, el) => {
    const $el = $(el);
    const titleEl = $el.find('a[class*="tit"], a[class*="title"], strong a, a').first();
    const title = titleEl.text().trim();
    if (!title) return;
    let url = titleEl.attr('data-href') || titleEl.attr('href') || '';
    if (url.startsWith('/')) url = 'https://search.naver.com' + url;
    const desc = $el.find('[class*="desc"], [class*="dsc"], p').first().text().trim() || null;
    items.push({ rank: items.length + 1, title, description: desc, url: url || null, domain: extractDomain(url) });
  });
  return items;
}

function parsePlaces($) {
  const items = [];
  let container = null;
  for (const sel of PLACE_CONTAINERS) {
    const el = $(sel).first();
    if (el.length) { container = el; break; }
  }
  if (!container || !container.length) return items;

  container.find('li').each((_, el) => {
    const $el = $(el);
    const nameEl = $el.find('[class*="place_bluelink"], [class*="name"], a[class*="title"], a').first();
    const name = nameEl.text().trim();
    if (!name) return;

    let placeId = null;
    $el.find('a').each((__, a) => {
      const m = ($(a).attr('href') || '').match(/\/place\/(\d+)/);
      if (m) { placeId = m[1]; return false; }
    });

    const ratingText = $el.find('[class*="star"], [class*="rating"], [class*="avg"]').first().text().trim();
    const rating = parseFloat(ratingText) || null;
    const reviewText = $el.find('[class*="review"], [class*="cnt"], [class*="count"]').first().text().trim();
    const reviewMatch = reviewText.match(/[\d,]+/);
    const reviewCount = reviewMatch ? parseInt(reviewMatch[0].replace(/,/g, ''), 10) : null;
    items.push({ rank: items.length + 1, name, placeId, rating, reviewCount });
  });
  return items;
}

async function scrapeFullPage(keyword) {
  const url = `${NAVER_SEARCH}?query=${encodeURIComponent(keyword)}`;
  const res = await fetch(url, { headers: defaultHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${keyword}`);
  const $ = cheerio.load(await res.text());
  return { powerLinkItems: parsePowerLinks($), placeItems: parsePlaces($) };
}

module.exports = { scrapeFullPage, parsePowerLinks, parsePlaces, extractDomain };
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```
node --test backend/lib/__tests__/fullPageScraper.test.js
```
Expected: 7개 테스트 모두 `✓`

- [ ] **Step 5: 커밋**

```
git add backend/lib/fullPageScraper.js backend/lib/__tests__/fullPageScraper.test.js
git commit -m "feat: fullPageScraper — 파워링크·플레이스 SERP 파싱 모듈 추가"
```

---

### Task 2: `adplaceScanEngine.js` — SSE 스캔 오케스트레이터

**Files:**
- Create: `backend/lib/__tests__/adplaceScanEngine.test.js`
- Create: `backend/lib/adplaceScanEngine.js`

- [ ] **Step 1: 테스트 파일 작성**

```javascript
// backend/lib/__tests__/adplaceScanEngine.test.js
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { matchPowerLink, matchPlace } = require('../adplaceScanEngine');

const plItems = [
  { rank: 1, title: '경쟁사A', domain: 'competitor-a.com', url: 'https://competitor-a.com/' },
  { rank: 2, title: '홍길동치과 강남점', domain: 'hgd-dental.com', url: 'https://hgd-dental.com/' },
  { rank: 3, title: '다른업체', domain: 'other.com', url: 'https://other.com/' },
];
const placeItems = [
  { rank: 1, name: '경쟁매장', placeId: '11111', rating: 4.2, reviewCount: 100 },
  { rank: 2, name: '홍길동치과', placeId: '22222', rating: 4.8, reviewCount: 312 },
  { rank: 3, name: '다른매장', placeId: '33333', rating: 3.9, reviewCount: 50 },
];

describe('matchPowerLink', () => {
  test('도메인으로 매칭한다', () => {
    assert.equal(matchPowerLink(plItems, { name: '', domain: 'hgd-dental.com' }).rank, 2);
  });
  test('업체명 부분 일치로 매칭한다', () => {
    assert.equal(matchPowerLink(plItems, { name: '홍길동치과', domain: '' }).rank, 2);
  });
  test('도메인이 업체명보다 우선한다', () => {
    const conflict = [
      { rank: 1, title: '홍길동치과', domain: 'wrong.com' },
      { rank: 2, title: '다른업체', domain: 'hgd-dental.com' },
    ];
    assert.equal(matchPowerLink(conflict, { name: '홍길동치과', domain: 'hgd-dental.com' }).rank, 2);
  });
  test('공백 무시 매칭', () => {
    assert.equal(matchPowerLink(plItems, { name: '홍 길 동 치 과', domain: '' }).rank, 2);
  });
  test('매칭 없으면 null', () => {
    assert.equal(matchPowerLink(plItems, { name: '없는업체', domain: '' }), null);
  });
});

describe('matchPlace', () => {
  test('placeId로 정확히 매칭한다', () => {
    assert.equal(matchPlace(placeItems, { name: '', placeId: '22222' }).rank, 2);
  });
  test('업체명 부분 일치로 매칭한다', () => {
    assert.equal(matchPlace(placeItems, { name: '홍길동', placeId: '' }).rank, 2);
  });
  test('placeId가 업체명보다 우선한다', () => {
    const conflict = [
      { rank: 1, name: '홍길동치과', placeId: '11111' },
      { rank: 2, name: '다른매장', placeId: '22222' },
    ];
    assert.equal(matchPlace(conflict, { name: '홍길동치과', placeId: '22222' }).rank, 2);
  });
  test('매칭 없으면 null', () => {
    assert.equal(matchPlace(placeItems, { name: '없는매장', placeId: '' }), null);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```
node --test backend/lib/__tests__/adplaceScanEngine.test.js
```
Expected: `Cannot find module '../adplaceScanEngine'` 오류

- [ ] **Step 3: `adplaceScanEngine.js` 구현**

```javascript
// backend/lib/adplaceScanEngine.js
const { scrapeFullPage } = require('./fullPageScraper');
const { sleep } = require('./naverClient');
const store = require('./store');

const MIN_DELAY = 1500;
const RAND_DELAY = 1500;

const activeScans = new Map();

function createScan(total) {
  const scanId = 'adplace_' + Date.now();
  activeScans.set(scanId, { cancelled: false, total, client: null });
  return scanId;
}

function hasScan(scanId) { return activeScans.has(scanId); }
function getScan(scanId) { return activeScans.get(scanId); }
function attachClient(scanId, res) { const s = activeScans.get(scanId); if (s) s.client = res; }
function detachClient(scanId) { const s = activeScans.get(scanId); if (s) s.client = null; }
function cancelScan(scanId) {
  const s = activeScans.get(scanId);
  if (!s) return false;
  s.cancelled = true;
  return true;
}

function normalize(str) { return (str || '').replace(/\s/g, '').toLowerCase(); }

function matchPowerLink(items, identifiers) {
  const cleanDomain = (identifiers.domain || '').replace(/^www\./, '');
  for (const item of items) {
    if (cleanDomain && item.domain && item.domain.includes(cleanDomain)) return item;
    if (identifiers.name && item.title && normalize(item.title).includes(normalize(identifiers.name))) return item;
  }
  return null;
}

function matchPlace(items, identifiers) {
  for (const item of items) {
    if (identifiers.placeId && item.placeId === identifiers.placeId) return item;
    if (identifiers.name && item.name && normalize(item.name).includes(normalize(identifiers.name))) return item;
  }
  return null;
}

async function runScan(scanId, { keywords, identifiers }) {
  const scanObj = activeScans.get(scanId);
  if (!scanObj) return;
  const results = [];
  const sendSSE = (data) => { if (scanObj.client) scanObj.client.write(`data: ${JSON.stringify(data)}\n\n`); };

  try {
    for (let i = 0; i < keywords.length; i++) {
      if (scanObj.cancelled) {
        sendSSE({ type: 'cancelled', message: '스캔이 중단되었습니다.' });
        activeScans.delete(scanId);
        return;
      }
      const keyword = keywords[i];
      sendSSE({ type: 'progress', current: i + 1, total: keywords.length, keyword, status: 'scanning' });

      let keywordResult;
      try {
        const { powerLinkItems, placeItems } = await scrapeFullPage(keyword);
        const matchedPL = matchPowerLink(powerLinkItems, identifiers);
        const matchedPlace = matchPlace(placeItems, identifiers);
        keywordResult = {
          keyword,
          powerLink: matchedPL
            ? { exposed: true, rank: matchedPL.rank, totalAds: powerLinkItems.length, title: matchedPL.title, url: matchedPL.url }
            : { exposed: false, rank: null, totalAds: powerLinkItems.length, title: null, url: null },
          place: matchedPlace
            ? { exposed: true, rank: matchedPlace.rank, totalPlaces: placeItems.length, name: matchedPlace.name, rating: matchedPlace.rating, reviewCount: matchedPlace.reviewCount }
            : { exposed: false, rank: null, totalPlaces: placeItems.length, name: null, rating: null, reviewCount: null },
        };
        sendSSE({ type: 'keyword_scanned', current: i + 1, total: keywords.length, keyword, result: keywordResult });
      } catch (err) {
        console.error(`파워링크/플레이스 스캔 오류 "${keyword}":`, err.message);
        keywordResult = {
          keyword,
          powerLink: { exposed: false, rank: null, totalAds: 0, title: null, url: null },
          place: { exposed: false, rank: null, totalPlaces: 0, name: null, rating: null, reviewCount: null },
        };
        sendSSE({ type: 'keyword_error', current: i + 1, total: keywords.length, keyword, error: err.message });
      }
      results.push(keywordResult);
      if (i < keywords.length - 1) await sleep(MIN_DELAY + Math.random() * RAND_DELAY);
    }

    const record = {
      id: scanId,
      scanType: 'adplace',
      timestamp: new Date().toISOString(),
      identifiers,
      keywordsCount: keywords.length,
      results,
    };
    store.addRecord(record);
    sendSSE({ type: 'complete', record });
  } catch (error) {
    console.error('광고/플레이스 스캔 치명적 오류:', error);
    sendSSE({ type: 'error', message: error.message });
  } finally {
    if (scanObj.client) scanObj.client.end();
    activeScans.delete(scanId);
  }
}

module.exports = { createScan, hasScan, getScan, attachClient, detachClient, cancelScan, runScan, matchPowerLink, matchPlace };
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```
node --test backend/lib/__tests__/adplaceScanEngine.test.js
```
Expected: 9개 테스트 모두 `✓`

- [ ] **Step 5: 전체 테스트 실행 — 기존 테스트 회귀 없음 확인**

```
npm test
```
Expected: 모든 테스트 `✓` (rankDiff + fullPageScraper + adplaceScanEngine)

- [ ] **Step 6: 커밋**

```
git add backend/lib/adplaceScanEngine.js backend/lib/__tests__/adplaceScanEngine.test.js
git commit -m "feat: adplaceScanEngine — 파워링크·플레이스 SSE 스캔 엔진 추가"
```

---

### Task 3: API 라우트 + `server.js` 수정

**Files:**
- Create: `backend/routes/adplaceScan.js`
- Modify: `backend/server.js`

- [ ] **Step 1: 라우트 파일 작성**

```javascript
// backend/routes/adplaceScan.js
const express = require('express');
const router = express.Router();
const engine = require('../lib/adplaceScanEngine');

router.post('/', (req, res) => {
  const { keywords, identifiers } = req.body;
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ error: '키워드 목록이 필요합니다.' });
  }
  if (!identifiers || !identifiers.name || !identifiers.name.trim()) {
    return res.status(400).json({ error: '업체명(identifiers.name)이 필요합니다.' });
  }
  const cleanIdentifiers = {
    name: identifiers.name.trim(),
    domain: (identifiers.domain || '').trim() || undefined,
    placeId: (identifiers.placeId || '').trim() || undefined,
  };
  const scanId = engine.createScan(keywords.length);
  engine.runScan(scanId, { keywords, identifiers: cleanIdentifiers });
  res.json({ success: true, scanId });
});

module.exports = router;
```

- [ ] **Step 2: `server.js` 수정 — adplaceEngine require 추가, 라우트 마운트, progress 핸들러 확장**

`backend/server.js` 에서 아래 세 곳을 수정한다.

**[수정 1]** line 8 `const engine = require('./lib/scanEngine');` 아래에 추가:
```javascript
const adplaceEngine = require('./lib/adplaceScanEngine');
```

**[수정 2]** line 31 `app.use('/api/scan/company', ...)` 아래에 추가:
```javascript
app.use('/api/scan/adplace', scanLimiter, require('./routes/adplaceScan'));
```

**[수정 3]** `/api/scan/progress` 핸들러 전체를 아래로 교체:
```javascript
app.get('/api/scan/progress', (req, res) => {
    const scanId = req.query.scanId;
    const eng = engine.hasScan(scanId) ? engine
               : adplaceEngine.hasScan(scanId) ? adplaceEngine
               : null;
    if (!scanId || !eng) {
        return res.status(404).end();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    eng.attachClient(scanId, res);
    const scan = eng.getScan(scanId);
    res.write(`data: ${JSON.stringify({ type: 'init', total: scan.total })}\n\n`);

    req.on('close', () => eng.detachClient(scanId));
});
```

- [ ] **Step 3: 서버 재시작 후 curl로 API 검증**

서버를 재시작하고(기존 프로세스 종료 후 `node backend/server.js &`):

```bash
curl -s -X POST http://localhost:5000/api/scan/adplace \
  -H "Content-Type: application/json" \
  -d '{"keywords":["강남 치과"],"identifiers":{"name":"테스트업체"}}' 
```
Expected: `{"success":true,"scanId":"adplace_..."}`

유효성 검증 테스트:
```bash
curl -s -X POST http://localhost:5000/api/scan/adplace \
  -H "Content-Type: application/json" \
  -d '{"keywords":[],"identifiers":{"name":""}}'
```
Expected: `{"error":"키워드 목록이 필요합니다."}`

- [ ] **Step 4: 커밋**

```
git add backend/routes/adplaceScan.js backend/server.js
git commit -m "feat: /api/scan/adplace 라우트 추가 및 progress SSE 핸들러 확장"
```

---

### Task 4: `AdPlaceScanPanel.jsx` — 프론트엔드 컴포넌트

**Files:**
- Create: `frontend/src/components/AdPlaceScanPanel.jsx`

- [ ] **Step 1: 컴포넌트 작성**

```jsx
// frontend/src/components/AdPlaceScanPanel.jsx
import React, { useState, useRef } from 'react';

function rankColor(rank) {
  if (rank === null) return '#9ca3af';
  if (rank <= 3) return '#16a34a';
  if (rank <= 10) return '#ca8a04';
  return '#6b7280';
}

function RankBadge({ exposed, rank, total }) {
  if (!exposed) return <span style={{ color: '#9ca3af' }}>미노출</span>;
  return (
    <span style={{ color: rankColor(rank), fontWeight: 'bold' }}>
      {rank}위{' '}
      <span style={{ color: '#6b7280', fontWeight: 'normal', fontSize: '0.8em' }}>
        (총 {total}개)
      </span>
    </span>
  );
}

export default function AdPlaceScanPanel() {
  const [keywordsText, setKeywordsText] = useState('');
  const [identifiers, setIdentifiers] = useState({ name: '', domain: '', placeId: '' });
  const [results, setResults] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentKeyword, setCurrentKeyword] = useState('');
  const [error, setError] = useState('');
  const esRef = useRef(null);
  const scanIdRef = useRef(null);

  const updateId = (field) => (e) => setIdentifiers((prev) => ({ ...prev, [field]: e.target.value }));

  const handleStart = async () => {
    const keywords = keywordsText.split('\n').map((k) => k.trim()).filter(Boolean);
    if (!keywords.length) return setError('키워드를 입력하세요.');
    if (!identifiers.name.trim()) return setError('업체명은 필수입니다.');
    setError('');
    setResults([]);
    setIsScanning(true);
    setProgress({ current: 0, total: keywords.length });

    try {
      const res = await fetch('/api/scan/adplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, identifiers }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || '스캔 시작 실패');
      }
      const { scanId } = await res.json();
      scanIdRef.current = scanId;

      const es = new EventSource(`/api/scan/progress?scanId=${scanId}`);
      esRef.current = es;

      es.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'progress') {
          setCurrentKeyword(data.keyword);
          setProgress({ current: data.current - 1, total: data.total });
        } else if (data.type === 'keyword_scanned') {
          setResults((prev) => [...prev, data.result]);
          setProgress({ current: data.current, total: data.total });
        } else if (data.type === 'keyword_error') {
          setResults((prev) => [...prev, {
            keyword: data.keyword,
            powerLink: { exposed: false, rank: null, totalAds: 0 },
            place: { exposed: false, rank: null, totalPlaces: 0 },
          }]);
          setProgress({ current: data.current, total: data.total });
        } else if (data.type === 'complete' || data.type === 'cancelled') {
          setIsScanning(false);
          es.close();
        } else if (data.type === 'error') {
          setIsScanning(false);
          es.close();
          setError(`스캔 오류: ${data.message}`);
        }
      };
      es.onerror = () => { setIsScanning(false); es.close(); };
    } catch (err) {
      setIsScanning(false);
      setError(err.message);
    }
  };

  const handleCancel = async () => {
    if (!scanIdRef.current) return;
    await fetch('/api/scan/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scanId: scanIdRef.current }),
    });
    if (esRef.current) esRef.current.close();
    setIsScanning(false);
  };

  return (
    <div className="app-grid">
      <aside className="sidebar">
        <div className="panel-section">
          <h2 className="panel-title">파워링크 · 플레이스 순위</h2>

          <div className="form-group">
            <label className="form-label">키워드 (줄바꿈으로 구분)</label>
            <textarea
              className="form-textarea"
              rows={6}
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder={"강남 치과\n임플란트 비용\n치아교정"}
              disabled={isScanning}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              업체명 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input className="form-input" type="text" value={identifiers.name}
              onChange={updateId('name')} placeholder="홍길동치과" disabled={isScanning} />
          </div>

          <div className="form-group">
            <label className="form-label">도메인 <span style={{ color: '#9ca3af', fontSize: '0.8em' }}>(선택 · 파워링크 정확도 향상)</span></label>
            <input className="form-input" type="text" value={identifiers.domain}
              onChange={updateId('domain')} placeholder="hgd-dental.com" disabled={isScanning} />
          </div>

          <div className="form-group">
            <label className="form-label">플레이스 ID <span style={{ color: '#9ca3af', fontSize: '0.8em' }}>(선택 · 지도 URL의 숫자)</span></label>
            <input className="form-input" type="text" value={identifiers.placeId}
              onChange={updateId('placeId')} placeholder="1234567890" disabled={isScanning} />
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '8px' }}>{error}</p>}

          {isScanning ? (
            <>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px' }}>
                {progress.current}/{progress.total} · {currentKeyword}
              </p>
              <button className="btn btn-danger" onClick={handleCancel}>스캔 중단</button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={handleStart}>스캔 시작</button>
          )}
        </div>
      </aside>

      <main className="content-area">
        {results.length > 0 ? (
          <div className="results-panel">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>키워드</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px' }}>파워링크</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px' }}>플레이스</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '500' }}>{r.keyword}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <RankBadge exposed={r.powerLink.exposed} rank={r.powerLink.rank} total={r.powerLink.totalAds} />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <RankBadge exposed={r.place.exposed} rank={r.place.rank} total={r.place.totalPlaces} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '6rem' }}>
            <p>키워드와 업체 정보를 입력하고 스캔을 시작하세요.</p>
            <p style={{ fontSize: '0.8em', marginTop: '8px' }}>
              플레이스 ID는 네이버 지도에서 매장 클릭 후 URL의 숫자를 복사하세요.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```
git add frontend/src/components/AdPlaceScanPanel.jsx
git commit -m "feat: AdPlaceScanPanel — 파워링크·플레이스 순위 스캔 UI 컴포넌트 추가"
```

---

### Task 5: `App.jsx` 탭 통합 + 빌드 + 검증

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: import 추가 및 탭 등록**

`App.jsx` 상단 import 목록에 추가:
```javascript
import AdPlaceScanPanel from './components/AdPlaceScanPanel';
```

`TABS` 배열에 항목 추가 (history 탭 앞에):
```javascript
{ key: 'adplace', label: '📍 광고·플레이스' },
```

결과:
```javascript
const TABS = [
  { key: 'company', label: '📢 업체명 체크' },
  { key: 'id', label: '📝 ID 순위' },
  { key: 'keywords', label: '🔑 키워드 리서치' },
  { key: 'trend', label: '📊 마케팅 대시보드' },
  { key: 'forbidden', label: '🛡️ 금칙어 검사' },
  { key: 'adplace', label: '📍 광고·플레이스' },
  { key: 'history', label: '📅 히스토리' },
];
```

- [ ] **Step 2: 탭 렌더링 추가**

`App.jsx`의 return 블록에서 `{activeTab === 'trend' && ...}` 와 동일한 패턴으로 추가:
```jsx
{activeTab === 'adplace' && <AdPlaceScanPanel />}
```

- [ ] **Step 3: 프론트엔드 빌드**

```
cd "C:\Users\jun92\Desktop\검색 순위 체크"
npm run build
```
Expected: `frontend/dist/` 재생성, 오류 없음

- [ ] **Step 4: 서버 재시작**

기존 서버 프로세스 종료 후:
```
node backend/server.js
```

- [ ] **Step 5: 브라우저 검증**

`http://localhost:5000` 접속 후:
1. "📍 광고·플레이스" 탭이 네비게이션에 표시되는지 확인
2. 탭 클릭 시 입력 폼이 나타나는지 확인
3. 업체명 없이 스캔 시작 → "업체명은 필수입니다." 에러 메시지 확인
4. 실제 키워드 1개 + 업체명 입력 후 스캔 → SSE 진행률 업데이트 → 결과 테이블 표시 확인
5. 기존 "📢 업체명 체크" / "📝 ID 순위" 탭이 정상 동작하는지 확인

- [ ] **Step 6: 커밋**

```
git add frontend/src/App.jsx frontend/dist
git commit -m "feat: 광고·플레이스 순위 탭 통합 — 파워링크·플레이스 스캔 기능 완성"
```

---

## 참고: 선택자 튜닝 가이드

Naver HTML은 수시로 변경된다. 스캔 결과가 계속 비어 있으면 아래 방법으로 실제 클래스명을 확인한다:

```javascript
// 임시 디버그 — scrapeFullPage 내부에서 호출
const $ = cheerio.load(html);
// PowerLink 관련 클래스 출력
$('[class]').each((_, el) => {
  const cls = $(el).attr('class') || '';
  if (/ad|power|link_ad/.test(cls)) console.log('PL:', cls);
  if (/splace|place/.test(cls)) console.log('Place:', cls);
});
```

브라우저 개발자도구 → Elements → 파워링크/플레이스 블록 우클릭 → "Copy selector"로도 확인 가능.
확인한 클래스명을 `fullPageScraper.js`의 `PL_CONTAINERS` / `PLACE_CONTAINERS` 배열에 추가한다.
