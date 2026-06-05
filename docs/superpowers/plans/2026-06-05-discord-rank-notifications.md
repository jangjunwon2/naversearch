# Discord 순위 알림 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자동 스캔 결과에서 순위 하락·이탈·목표 미달을 감지하고 매일 다이제스트를 Discord 웹훅으로 핸드폰에 푸시한다.

**Architecture:** 순위 비교 로직을 순수 함수 모듈(`rankDiff.js`)로 백엔드에 포팅하고, Discord 발송기(`notifier.js`)와 오케스트레이터(`notifyEngine.js`)를 둔다. 기존 1분 틱 스케줄러가 스캔 완료 시 조건부 알림을, 지정 시각에 다이제스트를 호출한다. 설정은 `store/notifications.json`(규칙)과 `.env`(웹훅 URL 시크릿)로 분리한다.

**Tech Stack:** Node 18(내장 `fetch`, `node:test`), Express, React 18 + Vite, lucide-react. 새 npm 의존성 없음.

**참조 스펙:** `docs/superpowers/specs/2026-06-05-discord-rank-notifications-design.md`

---

## 파일 구조

| 파일 | 책임 | 상태 |
|------|------|------|
| `backend/lib/rankDiff.js` | 순위 추출·비교·목표미달 판정(순수 함수) | 신규 |
| `backend/lib/__tests__/rankDiff.test.js` | rankDiff 단위 테스트 | 신규 |
| `backend/lib/notifier.js` | Discord 웹훅 발송 | 신규 |
| `backend/lib/notifyEngine.js` | 설정·알림·다이제스트 오케스트레이션 | 신규 |
| `backend/lib/store.js` | notifications.json 영속화 추가 | 수정 |
| `backend/lib/scheduler.js` | 스캔 완료/다이제스트 훅 연결 | 수정 |
| `backend/routes/notifications.js` | 설정 GET/PUT + 테스트 발송 | 신규 |
| `backend/server.js` | 알림 라우트 마운트 | 수정 |
| `frontend/src/components/NotificationSettings.jsx` | 알림 설정 UI | 신규 |
| `frontend/src/components/MarketingDashboard.jsx` | `🔔 알림` 탭 추가 | 수정 |
| `.env.example` | `DISCORD_WEBHOOK_URL` 안내 | 수정 |
| `PLANNING.md` | 로드맵·제약 갱신 | 수정 |
| `package.json` | `test` 스크립트 추가 | 수정 |

---

## Task 1: store.js — notifications.json 영속화

**Files:**
- Modify: `backend/lib/store.js`

- [ ] **Step 1: 파일 경로 상수 추가**

`backend/lib/store.js`의 `SCHEDULES_FILE` 선언 바로 아래에 추가:

```javascript
const NOTIFICATIONS_FILE = path.join(STORE_DIR, 'notifications.json');
```

- [ ] **Step 2: getter/setter 추가**

`saveSchedules` 함수 정의 바로 아래(`ensureStore();` 위)에 추가:

```javascript
// ---- 알림 설정 ----
function getNotifications() {
    return readJson(NOTIFICATIONS_FILE, {});
}

function saveNotifications(obj) {
    writeJson(NOTIFICATIONS_FILE, obj);
    return obj;
}
```

- [ ] **Step 3: export에 추가**

`module.exports = { ... }`의 `saveSchedules,` 다음 줄에 추가:

```javascript
    getNotifications,
    saveNotifications,
```

- [ ] **Step 4: 로드 확인**

Run: `node -e "const s=require('./backend/lib/store'); console.log(typeof s.getNotifications, JSON.stringify(s.getNotifications()))"`
Expected: `function {}`

- [ ] **Step 5: Commit**

```bash
git add backend/lib/store.js
git commit -m "feat: notifications.json 저장소 추가"
```

---

## Task 2: rankDiff.js — 순위 비교 순수 함수 (TDD)

**Files:**
- Test: `backend/lib/__tests__/rankDiff.test.js`
- Create: `backend/lib/rankDiff.js`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `backend/lib/__tests__/rankDiff.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { extractRanks, bestOf, computeChanges, belowTarget } = require('../rankDiff');

// company 모드 레코드 헬퍼: entries=[{keyword, ranks:[overallRank...]}], ranks 빈 배열=미노출
function companyRec(id, entries) {
    return {
        id,
        scanType: 'company',
        companyName: 'A',
        results: entries.map((e) => ({
            keyword: e.keyword,
            targetExposed: e.ranks.length > 0,
            targetMatches: e.ranks.map((r) => ({ overallRank: r })),
        })),
    };
}

test('extractRanks: 노출 시 overallRank 오름차순, 중복 제거', () => {
    const rec = companyRec('1', [{ keyword: 'k', ranks: [7, 3, 3] }]);
    assert.deepStrictEqual(extractRanks(rec, 'k'), [3, 7]);
});

test('extractRanks: 미노출이면 빈 배열', () => {
    const rec = companyRec('1', [{ keyword: 'k', ranks: [] }]);
    assert.deepStrictEqual(extractRanks(rec, 'k'), []);
});

test('extractRanks: 키워드 없으면 undefined', () => {
    const rec = companyRec('1', [{ keyword: 'k', ranks: [3] }]);
    assert.strictEqual(extractRanks(rec, 'other'), undefined);
});

test('bestOf: 최상위/미노출/없음', () => {
    assert.strictEqual(bestOf([3, 7]), 3);
    assert.strictEqual(bestOf([]), null);
    assert.strictEqual(bestOf(undefined), undefined);
});

test('computeChanges: 하락/상승/신규/이탈', () => {
    const prev = companyRec('p', [
        { keyword: 'down', ranks: [3] },
        { keyword: 'up', ranks: [9] },
        { keyword: 'lost', ranks: [5] },
    ]);
    const latest = companyRec('l', [
        { keyword: 'down', ranks: [8] },
        { keyword: 'up', ranks: [2] },
        { keyword: 'lost', ranks: [] },
        { keyword: 'new', ranks: [4] },
    ]);
    const c = computeChanges(latest, prev);
    assert.deepStrictEqual(c.down, [{ kw: 'down', from: 3, to: 8 }]);
    assert.deepStrictEqual(c.up, [{ kw: 'up', from: 9, to: 2 }]);
    assert.deepStrictEqual(c.entered, [{ kw: 'new', to: 4 }]);
    assert.deepStrictEqual(c.lost, [{ kw: 'lost', from: 5 }]);
});

test('belowTarget: 미노출 또는 목표 초과만', () => {
    const rec = companyRec('l', [
        { keyword: 'ok', ranks: [5] },
        { keyword: 'over', ranks: [15] },
        { keyword: 'miss', ranks: [] },
    ]);
    const miss = belowTarget(rec, 10);
    assert.deepStrictEqual(miss, [
        { kw: 'over', best: 15 },
        { kw: 'miss', best: null },
    ]);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test backend/lib/__tests__/rankDiff.test.js`
Expected: FAIL — `Cannot find module '../rankDiff'`

- [ ] **Step 3: 최소 구현 작성**

Create `backend/lib/rankDiff.js`:

```javascript
// 순위 비교 순수 함수 — 통합검색 전체 순위(overallRank) 기준.
// MarketingDashboard.jsx의 비교 로직을 백엔드로 포팅(알림/다이제스트에서 재사용).

// 키워드의 통합검색 노출 순위 배열(낮을수록 상위). undefined=키워드 없음, []=미노출
function extractRanks(rec, keyword) {
    if (!rec) return undefined;
    const item = rec.results.find((r) => r.keyword === keyword);
    if (!item) return undefined;
    const isId = rec.scanType === 'id' || (!rec.scanType && (rec.userId || rec.blogId));
    const exposed = isId ? item.exposed : item.targetExposed;
    if (!exposed) return [];
    const matches = isId ? item.userBlogMatches || [] : item.targetMatches || [];
    let ranks = matches.map((m) => m.overallRank || m.rankInBlock).filter(Boolean);
    if (ranks.length === 0 && isId && item.rankDetail && item.rankDetail.overallRank) {
        ranks = [item.rankDetail.overallRank];
    }
    return [...new Set(ranks)].sort((a, b) => a - b);
}

function bestOf(ranks) {
    return Array.isArray(ranks) ? (ranks.length ? ranks[0] : null) : undefined;
}

function keywordsOf(rec) {
    return [...new Set(rec.results.map((r) => r.keyword))];
}

// 직전 대비 변화: up(상승)/down(하락)/entered(신규)/lost(이탈)
function computeChanges(latest, prev) {
    const keywords = [
        ...new Set([
            ...latest.results.map((r) => r.keyword),
            ...(prev ? prev.results.map((r) => r.keyword) : []),
        ]),
    ];
    const up = [], down = [], entered = [], lost = [];
    keywords.forEach((kw) => {
        const c = bestOf(extractRanks(latest, kw));
        const p = bestOf(extractRanks(prev, kw));
        if (typeof c === 'number' && typeof p === 'number') {
            if (c < p) up.push({ kw, from: p, to: c });
            else if (c > p) down.push({ kw, from: p, to: c });
        } else if (typeof c === 'number' && p == null) {
            entered.push({ kw, to: c });
        } else if (c === null && typeof p === 'number') {
            lost.push({ kw, from: p });
        }
    });
    return { up, down, entered, lost };
}

// 목표 미달: 미노출(best==null)이거나 best > targetRank 인 키워드
function belowTarget(rec, targetRank) {
    return keywordsOf(rec)
        .map((kw) => ({ kw, best: bestOf(extractRanks(rec, kw)) }))
        .filter(({ best }) => best == null || best > targetRank);
}

module.exports = { extractRanks, bestOf, keywordsOf, computeChanges, belowTarget };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test backend/lib/__tests__/rankDiff.test.js`
Expected: PASS — 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/lib/rankDiff.js backend/lib/__tests__/rankDiff.test.js
git commit -m "feat: 순위 비교 순수 함수 rankDiff + 단위 테스트"
```

---

## Task 3: notifier.js — Discord 웹훅 발송기

**Files:**
- Create: `backend/lib/notifier.js`

- [ ] **Step 1: 구현 작성**

Create `backend/lib/notifier.js`:

```javascript
// Discord Incoming Webhook 발송기.
// 웹훅 URL은 .env(DISCORD_WEBHOOK_URL) 전용 — API로 노출하지 않는다.
// 발송 실패는 로그만 남기고 throw 하지 않는다(스캔/스케줄러 흐름 보호).

const DISCORD_MAX = 1900; // 2000자 제한 여유

function webhookUrl() {
    return process.env.DISCORD_WEBHOOK_URL || '';
}

function isConfigured() {
    return Boolean(webhookUrl());
}

async function sendDiscord(text) {
    const url = webhookUrl();
    if (!url) return false;
    const content = String(text).slice(0, DISCORD_MAX);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
        });
        if (!res.ok) {
            console.error('Discord 웹훅 발송 실패:', res.status);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Discord 웹훅 오류:', e.message);
        return false;
    }
}

module.exports = { isConfigured, sendDiscord };
```

- [ ] **Step 2: 미설정 동작 확인**

Run: `node -e "const n=require('./backend/lib/notifier'); console.log(n.isConfigured()); n.sendDiscord('x').then(r=>console.log('sent',r))"`
Expected: `false` 그리고 `sent false` (DISCORD_WEBHOOK_URL 미설정 시 throw 없이 false)

- [ ] **Step 3: Commit**

```bash
git add backend/lib/notifier.js
git commit -m "feat: Discord 웹훅 발송기 notifier"
```

---

## Task 4: notifyEngine.js — 설정·알림·다이제스트 오케스트레이션

**Files:**
- Create: `backend/lib/notifyEngine.js`

- [ ] **Step 1: 구현 작성**

Create `backend/lib/notifyEngine.js`:

```javascript
// 알림 오케스트레이션 — 설정 로드/저장, 스캔 완료 조건부 알림, 매일 다이제스트.
const store = require('./store');
const notifier = require('./notifier');
const { computeChanges, belowTarget, bestOf, extractRanks, keywordsOf } = require('./rankDiff');

const DEFAULTS = {
    enabled: false,
    targetRank: 10,
    alertOnDrop: true,
    alertOnBelowTarget: true,
    digest: { enabled: false, hour: 9 },
    _digestLastSent: null,
};

function getSettings() {
    const raw = store.getNotifications() || {};
    return {
        ...DEFAULTS,
        ...raw,
        digest: { ...DEFAULTS.digest, ...(raw.digest || {}) },
    };
}

function clampInt(v, min, max, fallback) {
    const n = parseInt(v, 10);
    return Math.min(Math.max(Number.isFinite(n) ? n : fallback, min), max);
}

function saveSettings(patch = {}) {
    const cur = getSettings();
    const next = { ...cur };
    if (patch.enabled !== undefined) next.enabled = Boolean(patch.enabled);
    if (patch.targetRank !== undefined) next.targetRank = clampInt(patch.targetRank, 1, 100, 10);
    if (patch.alertOnDrop !== undefined) next.alertOnDrop = Boolean(patch.alertOnDrop);
    if (patch.alertOnBelowTarget !== undefined) next.alertOnBelowTarget = Boolean(patch.alertOnBelowTarget);
    if (patch.digest !== undefined) {
        const d = patch.digest || {};
        next.digest = {
            enabled: d.enabled !== undefined ? Boolean(d.enabled) : cur.digest.enabled,
            hour: d.hour !== undefined ? clampInt(d.hour, 0, 23, 9) : cur.digest.hour,
        };
    }
    if (patch._digestLastSent !== undefined) next._digestLastSent = patch._digestLastSent;
    store.saveNotifications(next);
    return next;
}

// 대상 식별(type|target) — record 또는 schedule 모두 처리
function targetKeyOfRecord(rec) {
    const type = rec.scanType || (rec.companyName || rec.targetKeyword ? 'company' : 'id');
    const target = rec.companyName || rec.targetKeyword || rec.userId || rec.blogId || '';
    return { type, target, key: `${type}|${target}` };
}

function findPrevRecord(record) {
    const { key } = targetKeyOfRecord(record);
    return store.getHistory().find((r) => r.id !== record.id && targetKeyOfRecord(r).key === key) || null;
}

const pad = (n) => String(n).padStart(2, '0');
const fmtNow = () => {
    const d = new Date();
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// 자동 스캔 1건 완료 시 호출 — 조건 충족 시 알림 발송
async function onScanComplete(schedule, record) {
    const s = getSettings();
    if (!s.enabled || !notifier.isConfigured() || !record) return;

    const lines = [];
    if (s.alertOnDrop) {
        const prev = findPrevRecord(record);
        if (prev) {
            const { down, lost } = computeChanges(record, prev);
            if (down.length) {
                lines.push('📉 하락');
                down.forEach((c) => lines.push(`• ${c.kw}  ${c.from}→${c.to}위`));
            }
            if (lost.length) {
                lines.push('🚪 이탈');
                lost.forEach((c) => lines.push(`• ${c.kw}  (이전 ${c.from}위)`));
            }
        }
    }
    if (s.alertOnBelowTarget) {
        const miss = belowTarget(record, s.targetRank);
        if (miss.length) {
            lines.push(`🎯 목표(${s.targetRank}위) 미달`);
            miss.forEach((m) => lines.push(`• ${m.kw}  ${m.best == null ? '미노출' : m.best + '위'}`));
        }
    }
    if (lines.length === 0) return;

    const { target } = targetKeyOfRecord(record);
    await notifier.sendDiscord([`🔔 **${target}** 순위 알림  (${fmtNow()})`, ...lines].join('\n'));
}

function buildDigestBlock(rec, targetRank) {
    const rows = keywordsOf(rec).map((kw) => ({ kw, best: bestOf(extractRanks(rec, kw)) }));
    const achieved = rows.filter((r) => r.best != null && r.best <= targetRank).length;
    const { target } = targetKeyOfRecord(rec);
    const head = `📊 **${target}** 일일 리포트  (${fmtNow()} · 키워드 ${rows.length}개)`;
    const summary = `✅ 목표(${targetRank}위) 달성 ${achieved} / 미달 ${rows.length - achieved}`;
    const body = rows.map((r) => {
        if (r.best == null) return `• ${r.kw}  미노출 ⚠️`;
        return `• ${r.kw}  ${r.best}위${r.best > targetRank ? ' ⚠️' : ''}`;
    });
    return [head, summary, ...body].join('\n');
}

// 매 틱 호출 — 지정 시각이고 오늘 미발송이면 다이제스트 발송
async function maybeSendDigest() {
    const s = getSettings();
    if (!s.digest.enabled || !notifier.isConfigured()) return;
    const now = new Date();
    const today = fmtDay(now);
    if (now.getHours() !== s.digest.hour || s._digestLastSent === today) return;

    const seen = new Set();
    const blocks = [];
    for (const sch of store.getSchedules().filter((x) => x.enabled)) {
        const key = `${sch.mode}|${sch.companyName || sch.userId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const rec = store.getHistory().find((r) => targetKeyOfRecord(r).key === key);
        if (rec) blocks.push(buildDigestBlock(rec, s.targetRank));
    }
    if (blocks.length > 0) await notifier.sendDiscord(blocks.join('\n\n'));
    saveSettings({ _digestLastSent: today });
}

async function sendTest() {
    if (!notifier.isConfigured()) return { ok: false, error: '웹훅이 설정되지 않았습니다(.env DISCORD_WEBHOOK_URL).' };
    const ok = await notifier.sendDiscord('🔔 테스트 알림입니다. 순위 알림이 정상 연결되었습니다.');
    return ok ? { ok: true } : { ok: false, error: '발송에 실패했습니다.' };
}

module.exports = { getSettings, saveSettings, onScanComplete, maybeSendDigest, sendTest };
```

- [ ] **Step 2: 로드 및 기본값 확인**

Run: `node -e "const e=require('./backend/lib/notifyEngine'); console.log(JSON.stringify(e.getSettings()))"`
Expected: 기본값 JSON 출력 (`"enabled":false ... "digest":{"enabled":false,"hour":9}`)

- [ ] **Step 3: 설정 저장/검증 확인**

Run: `node -e "const e=require('./backend/lib/notifyEngine'); console.log(JSON.stringify(e.saveSettings({targetRank:999, digest:{enabled:true,hour:50}})))"`
Expected: `targetRank` 100으로, `digest.hour` 23으로 클램프된 JSON. (확인 후 `git checkout backend/store/notifications.json 2>/dev/null` 불필요 — store는 git 제외)

- [ ] **Step 4: notifications.json 정리**

Run: `rm -f backend/store/notifications.json`
(테스트로 생성된 파일 제거 — 런타임 기본값으로 재생성됨)

- [ ] **Step 5: Commit**

```bash
git add backend/lib/notifyEngine.js
git commit -m "feat: 알림 오케스트레이터 notifyEngine(조건부 알림+다이제스트)"
```

---

## Task 5: scheduler.js — 스캔 완료/다이제스트 훅 연결

**Files:**
- Modify: `backend/lib/scheduler.js`

- [ ] **Step 1: notifyEngine import 추가**

`backend/lib/scheduler.js` 상단의 `const store = require('./store');` 다음 줄에 추가:

```javascript
const notifyEngine = require('./notifyEngine');
```

- [ ] **Step 2: runSchedule에 스캔 완료 알림 연결**

`runSchedule` 함수의 `await engine.runScan({...});` 호출 직후(같은 try 블록 안, 닫는 `}` 전)에 추가:

```javascript
        const record = store.getHistory().find((r) => r.id === scanId);
        if (record) {
            try {
                await notifyEngine.onScanComplete(s, record);
            } catch (e) {
                console.error('스캔 완료 알림 오류', s.id, e.message);
            }
        }
```

수정 후 `runSchedule`의 try 블록은 다음 형태가 된다:

```javascript
    try {
        const scanId = engine.createScan(s.keywords.length);
        await engine.runScan(scanId, {
            mode: s.mode,
            keywords: s.keywords,
            companyName: s.companyName || '',
            userId: s.userId || '',
            maxPages: s.maxPages || 5,
        });
        const record = store.getHistory().find((r) => r.id === scanId);
        if (record) {
            try {
                await notifyEngine.onScanComplete(s, record);
            } catch (e) {
                console.error('스캔 완료 알림 오류', s.id, e.message);
            }
        }
    } catch (e) {
```

- [ ] **Step 3: tick에 다이제스트 확인 추가**

`tick` 함수의 `for (const s of store.getSchedules())` 루프가 끝난 직후(함수 닫는 `}` 전)에 추가:

```javascript
    try {
        await notifyEngine.maybeSendDigest();
    } catch (e) {
        console.error('다이제스트 발송 오류:', e.message);
    }
```

- [ ] **Step 4: 구문/로드 확인**

Run: `node -e "require('./backend/lib/scheduler'); console.log('ok')"`
Expected: `ok` (순환 의존 없이 로드)

- [ ] **Step 5: Commit**

```bash
git add backend/lib/scheduler.js
git commit -m "feat: 스케줄러에 스캔완료 알림·다이제스트 훅 연결"
```

---

## Task 6: routes/notifications.js + server 마운트

**Files:**
- Create: `backend/routes/notifications.js`
- Modify: `backend/server.js`

- [ ] **Step 1: 라우트 작성**

Create `backend/routes/notifications.js`:

```javascript
// 알림 설정 — GET/PUT + 테스트 발송. 웹훅 URL(.env)은 절대 반환하지 않는다.
const express = require('express');
const router = express.Router();
const engine = require('../lib/notifyEngine');
const notifier = require('../lib/notifier');

// 내부 필드(_digestLastSent) 제거 + 웹훅 설정 여부만 노출
function publicView(s) {
    const { _digestLastSent, ...rest } = s;
    return { ...rest, webhookConfigured: notifier.isConfigured() };
}

router.get('/', (req, res) => res.json(publicView(engine.getSettings())));

router.put('/', (req, res) => {
    const next = engine.saveSettings(req.body || {});
    res.json(publicView(next));
});

router.post('/test', async (req, res) => {
    const r = await engine.sendTest();
    if (!r.ok) return res.status(400).json({ error: r.error });
    res.json({ success: true });
});

module.exports = router;
```

- [ ] **Step 2: server.js에 마운트**

`backend/server.js`의 스케줄 라우트 줄 다음에 추가:

```javascript
app.use('/api/notifications', require('./routes/notifications')); // 알림 설정
```

위치: `app.use('/api/schedules', require('./routes/schedules')); // 자동 스캔 스케줄` 바로 아래.

- [ ] **Step 3: 엔드포인트 동작 확인**

Run (서버 기동 후 별도 터미널, 또는 임시):
```bash
node backend/server.js &
sleep 2
curl -s localhost:5000/api/notifications
curl -s -X POST localhost:5000/api/notifications/test
kill %1
```
Expected: GET은 설정 JSON + `"webhookConfigured":false`. test는 `{"error":"웹훅이 설정되지 않았습니다..."}` (400). 응답에 `DISCORD_WEBHOOK_URL` 값이 절대 없어야 함.

- [ ] **Step 4: Commit**

```bash
git add backend/routes/notifications.js backend/server.js
git commit -m "feat: 알림 설정 API + 라우트 마운트"
```

---

## Task 7: 프론트엔드 — 🔔 알림 탭

**Files:**
- Create: `frontend/src/components/NotificationSettings.jsx`
- Modify: `frontend/src/components/MarketingDashboard.jsx`

- [ ] **Step 1: 설정 컴포넌트 작성**

Create `frontend/src/components/NotificationSettings.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import { Bell, Send, AlertTriangle } from 'lucide-react';

// 알림 설정 — Discord 웹훅 기반. 웹훅 URL은 서버 .env 전용이라 여기선 설정 여부만 표시.
function NotificationSettings() {
  const [s, setS] = useState(null);
  const [testMsg, setTestMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/notifications');
        if (r.ok) setS(await r.json());
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const save = async (patch) => {
    setSaving(true);
    try {
      const r = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (r.ok) setS(await r.json());
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTestMsg('');
    try {
      const r = await fetch('/api/notifications/test', { method: 'POST' });
      const d = await r.json();
      setTestMsg(r.ok ? '✅ 테스트 메시지를 보냈습니다. Discord를 확인하세요.' : d.error || '발송 실패');
    } catch {
      setTestMsg('발송 오류');
    }
  };

  if (!s) {
    return <div className="glass-card"><p style={{ color: 'var(--color-text-muted)' }}>설정을 불러오는 중…</p></div>;
  }

  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.6rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' };

  return (
    <div className="glass-card">
      <h3 className="detail-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.4rem' }}>
        <Bell size={16} style={{ color: 'var(--accent-violet)' }} /> Discord 순위 알림
      </h3>
      <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
        자동 주기 스캔에서 <strong>순위 하락·이탈·목표 미달</strong>을 감지해 Discord로 푸시합니다. 통합검색 전체 순위 기준.
      </p>

      {!s.webhookConfigured && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', background: 'rgba(244,63,94,0.12)', color: 'var(--accent-rose)', padding: '0.6rem 0.85rem', borderRadius: '0.45rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
          <AlertTriangle size={15} /> 서버 <code>.env</code>에 <code>DISCORD_WEBHOOK_URL</code>이 설정되지 않아 알림이 발송되지 않습니다.
        </div>
      )}

      <div style={row}>
        <span><strong>알림 켜기</strong> <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>(전체 마스터 스위치)</span></span>
        <input type="checkbox" checked={s.enabled} onChange={(e) => save({ enabled: e.target.checked })} />
      </div>

      <div style={row}>
        <span>목표 상위 순위 <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>(이보다 낮으면 미달)</span></span>
        <span>상위 <input type="number" min={1} max={100} value={s.targetRank} onChange={(e) => save({ targetRank: Number(e.target.value) })} className="form-input" style={{ width: '70px', display: 'inline-block' }} /> 위</span>
      </div>

      <div style={row}>
        <span>순위 하락·이탈 시 알림</span>
        <input type="checkbox" checked={s.alertOnDrop} onChange={(e) => save({ alertOnDrop: e.target.checked })} />
      </div>

      <div style={row}>
        <span>목표 미달 시 알림</span>
        <input type="checkbox" checked={s.alertOnBelowTarget} onChange={(e) => save({ alertOnBelowTarget: e.target.checked })} />
      </div>

      <div style={row}>
        <span>매일 정기 리포트(다이제스트)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={s.digest.enabled} onChange={(e) => save({ digest: { ...s.digest, enabled: e.target.checked } })} />
          <select className="form-input" value={s.digest.hour} onChange={(e) => save({ digest: { ...s.digest, hour: Number(e.target.value) } })} style={{ width: 'auto' }} disabled={!s.digest.enabled}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
          </select>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
        <button type="button" className="btn-secondary" onClick={sendTest} disabled={!s.webhookConfigured} style={{ width: 'auto', padding: '0 1rem' }}>
          <Send size={13} /> 테스트 발송
        </button>
        {saving && <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>저장 중…</span>}
        {testMsg && <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>{testMsg}</span>}
      </div>

      <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '1rem' }}>
        ※ 다이제스트 시각은 서버 로컬 시간 기준입니다(한국 서버 권장: <code>TZ=Asia/Seoul</code>). 알림은 자동 주기 스캔에서만 발송됩니다.
      </p>
    </div>
  );
}

export default NotificationSettings;
```

- [ ] **Step 2: MarketingDashboard에 import 추가**

`frontend/src/components/MarketingDashboard.jsx` 최상단 import 블록에 추가:

```jsx
import NotificationSettings from './NotificationSettings';
```

- [ ] **Step 3: 탭 배열에 알림 추가**

`MarketingDashboard.jsx`의 탭 정의(약 214행)를 다음으로 교체:

```jsx
          {[['priority', '🎯 공략 우선순위'], ['change', '🔀 변화'], ['trend', '📈 추이'], ['schedule', '⏰ 자동 스캔'], ['notify', '🔔 알림']].map(([k, label]) => (
```

- [ ] **Step 4: notify 뷰 렌더 추가**

`MarketingDashboard.jsx`에서 `{view === 'schedule' && (` 블록 전체가 끝나는 `)}` 다음 줄(컴포넌트 최상위 `</div>` 직전)에 추가:

```jsx
      {view === 'notify' && <NotificationSettings />}
```

- [ ] **Step 5: 빌드 확인**

Run: `cd frontend && npm run build`
Expected: 빌드 성공(에러 없음). 끝나면 `cd ..`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/NotificationSettings.jsx frontend/src/components/MarketingDashboard.jsx
git commit -m "feat: 마케팅 대시보드 알림 설정 탭 UI"
```

---

## Task 8: 문서 · 테스트 스크립트 마무리

**Files:**
- Modify: `.env.example`
- Modify: `package.json`
- Modify: `PLANNING.md`

- [ ] **Step 1: .env.example에 웹훅 안내 추가**

`.env.example` 끝에 추가:

```
# (선택) Discord 순위 알림 — 채널 설정 → 연동 → 웹훅 → URL 복사
# 미설정 시 알림은 발송되지 않음. 공개 배포 시 이 값은 절대 외부에 노출 금지.
DISCORD_WEBHOOK_URL=
```

- [ ] **Step 2: package.json에 test 스크립트 추가**

`package.json`의 `"scripts"` 블록에서 `"dev"` 줄 다음에 추가:

```json
    "test": "node --test backend/lib/__tests__/",
```

(직전 줄 `"dev": "node backend/server.js"` 끝에 콤마 추가 잊지 말 것)

- [ ] **Step 3: 테스트 스크립트 동작 확인**

Run: `npm test`
Expected: rankDiff 테스트 6개 통과(`# pass 6`)

- [ ] **Step 4: PLANNING.md 갱신**

`PLANNING.md` §4 "기능 고도화"의 알림 항목을 다음으로 교체:

```markdown
- [x] **알림**: 순위 하락·이탈·목표 미달 시 + 매일 정기 다이제스트 → Discord 웹훅 푸시 (설정: 🔔 알림 탭, 웹훅은 `DISCORD_WEBHOOK_URL`)
```

그리고 §5 "알려진 제약" 끝에 추가:

```markdown
- 다이제스트 발송 시각은 서버 로컬 시간(hour) 기준 → 한국 서버는 `TZ=Asia/Seoul` 권장
```

또한 §1 "부가 기능"에 한 줄 추가:

```markdown
- **Discord 알림**: 자동 스캔의 순위 하락·이탈·목표 미달 + 매일 정기 리포트를 웹훅으로 푸시
```

- [ ] **Step 5: Commit**

```bash
git add .env.example package.json PLANNING.md
git commit -m "docs: Discord 알림 .env.example·test 스크립트·PLANNING 갱신"
```

---

## 검증 체크리스트 (전체 완료 후)

- [ ] `npm test` 통과 (rankDiff 6개)
- [ ] `node backend/server.js` 기동 → `GET /api/notifications` 응답에 웹훅 URL 없음, `webhookConfigured` 포함
- [ ] 실제 Discord 웹훅 URL을 `.env`에 넣고 `🔔 알림` 탭 → "테스트 발송" → Discord에 메시지 수신
- [ ] 알림 ON + 자동 스캔 2회 실행 시 하락/미달 메시지 수신(직전 대비)
- [ ] 다이제스트 ON + `digest.hour`를 현재 시각으로 설정 → 1분 내 요약 1회 수신, 같은 날 재발송 없음
