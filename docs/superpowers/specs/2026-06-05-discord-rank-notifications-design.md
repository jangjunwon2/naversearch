# 순위 알림(Discord 웹훅) — 설계 문서

> 작성일: 2026-06-05
> 상태: 승인됨 (구현 전)
> 관련 로드맵: PLANNING.md §4 "알림: 순위 급락/신규 진입/이탈 시 알림(이메일·웹훅 등)"

## 1. 목적

자동 주기 스캔 결과를 바탕으로 **순위 하락 / 이탈 / 목표 미달**을 감지해 운영자의 **핸드폰으로
Discord 웹훅 푸시**를 보낸다. 추가로 **매일 설정한 시각에 정기 다이제스트**를 보낼 수 있다.
모두 무료 채널(Discord 모바일 앱 푸시)로 동작하며 새 의존성은 추가하지 않는다(Node 18 내장 `fetch`).

## 2. 범위

### 포함
- Discord Incoming Webhook 발송기
- 자동 스캔 완료 시 조건부 알림(하락/이탈/목표 미달)
- 매일 지정 시각 정기 다이제스트
- 알림 설정 API + 마케팅 대시보드 내 설정 UI(`🔔 알림` 탭)
- 순위 비교 로직의 백엔드 포팅 + 단위 테스트

### 제외 (YAGNI)
- 이메일/SMS/기타 채널 (이번엔 Discord만)
- 스케줄별 개별 웹훅/설정 (전역 설정 1벌)
- 수동 UI 스캔에 대한 알림 (화면을 보는 중이므로 제외)
- 신규 진입/상승만을 위한 별도 알림 (조용한 알림 정책 — 다이제스트에 포함)

## 3. 핵심 결정

| 항목 | 결정 | 이유 |
|------|------|------|
| 채널 | Discord 웹훅 | 무료, 폰 푸시, 웹훅 URL 하나로 설정 가장 단순 |
| 순위 기준 | 통합검색 전체 순위(`overallRank`) | 사용자 요구: "통합 검색창 전체 기준" |
| 웹훅 URL 저장 | `.env`의 `DISCORD_WEBHOOK_URL` 전용 | 공개+공유 배포 — API로 시크릿 노출 금지 |
| 규칙 저장 | `store/notifications.json` | UI 편집 가능, 시크릿 아님 |
| 트리거 | 자동 스캔만 + 매일 다이제스트 | 수동 스캔은 화면 확인 중이라 불필요 |
| 스케줄링 | 기존 `scheduler.js` 1분 틱 재사용 | 타이머 추가 없이 다이제스트 시각 확인 |
| HTTP | Node 18 내장 `fetch` | 기존 코드 일관성(searchAdClient 등), 무의존 |

## 4. 데이터 모델

### `.env`
```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxx/yyy   # (선택) 미설정 시 알림 비활성
```

### `store/notifications.json`
```json
{
  "enabled": false,
  "targetRank": 10,
  "alertOnDrop": true,
  "alertOnBelowTarget": true,
  "digest": { "enabled": false, "hour": 9 },
  "_digestLastSent": "2026-06-05"
}
```
- `enabled`: 알림 마스터 스위치(웹훅 미설정이면 무조건 비활성처럼 동작)
- `targetRank`: 목표 상위 순위 N(통합검색 전체 순위). `bestOf > targetRank`거나 미노출이면 "미달"
- `alertOnDrop` / `alertOnBelowTarget`: 조건부 알림 항목 토글
- `digest.enabled` / `digest.hour`: 매일 정기 다이제스트 ON/OFF 및 시각(0–23, 서버 로컬)
- `_digestLastSent`: 내부 필드(같은 날 중복 발송 방지, `YYYY-MM-DD`)

## 5. 아키텍처 / 컴포넌트

### `backend/lib/rankDiff.js` (순수 함수 — 단위 테스트 대상)
`MarketingDashboard.jsx`의 비교 로직을 백엔드로 포팅.
- `extractRanks(record, keyword) → number[] | [] | undefined`
  - 통합검색 전체 순위 배열(낮을수록 상위). `[]`=미노출, `undefined`=해당 키워드 없음
  - `record.scanType`('company'|'id')에 따라 `targetMatches`/`userBlogMatches`에서 `overallRank` 우선 추출
- `bestOf(ranks) → number | null | undefined`
- `computeChanges(latest, prev) → { up, down, entered, lost }`
  - 각 키워드의 `bestOf` 비교: 하락(`c>p`)·상승(`c<p`)·신규(`p`없음→`c`있음)·이탈(`c`없음)
- `belowTarget(record, targetRank) → { keyword, best }[]`
  - `best == null`(미노출) 또는 `best > targetRank`인 키워드 목록

### `backend/lib/notifier.js`
- `isConfigured() → boolean` — `DISCORD_WEBHOOK_URL` 존재 여부
- `sendDiscord(text) → Promise<boolean>` — 웹훅에 `{ content: text }` POST.
  - 실패 시 `console.error`만, **throw 금지**(스캔/스케줄러 흐름 보호)
  - Discord 2000자 제한 → 초과 시 잘라냄

### `backend/lib/notifyEngine.js`
- `getSettings()` / `saveSettings(patch)` — `store`의 notifications.json 읽기/검증 후 병합 저장
- `onScanComplete(schedule, record)`:
  1. `settings.enabled && notifier.isConfigured()` 아니면 return
  2. 같은 대상(type+target)의 **직전 record**를 히스토리에서 탐색
  3. `alertOnDrop`이면 `computeChanges`의 `down`/`lost` 수집
  4. `alertOnBelowTarget`이면 `belowTarget(record, targetRank)` 수집
  5. 보고할 내용이 있으면 메시지 작성 후 `sendDiscord`
- `maybeSendDigest()`:
  1. `settings.digest.enabled && notifier.isConfigured()` 확인
  2. 현재 로컬 hour === `digest.hour` && `_digestLastSent !== 오늘` 이면
  3. enabled 스케줄별 대상의 최신 record를 요약(키워드별 현재 순위 + 미달 표시) → 발송
  4. `_digestLastSent = 오늘` 저장
- `sendTest()` — 테스트 메시지 발송(API용)

### `backend/lib/scheduler.js` (수정)
- `runSchedule`: `await engine.runScan(...)` 뒤 `store.getHistory().find(r => r.id === scanId)`로 record 조회 → `notifyEngine.onScanComplete(s, record)` (try/catch로 보호)
- `tick`: 스케줄 루프 종료 후 `notifyEngine.maybeSendDigest()` 호출(예외 무시)

### `backend/lib/store.js` (수정)
- `NOTIFICATIONS_FILE` 추가, `getNotifications()` / `saveNotifications(obj)` (기본값 포함 readJson)

### `backend/routes/notifications.js` (신규)
- `GET /api/notifications` → `{ ...settings(웹훅URL 제외), webhookConfigured }`
- `PUT /api/notifications` → 설정 검증·저장 후 반환(웹훅URL 제외)
- `POST /api/notifications/test` → `notifyEngine.sendTest()`; 웹훅 미설정 시 400

### `backend/server.js` (수정)
- `app.use('/api/notifications', require('./routes/notifications'))` (auth 게이트 뒤에 마운트)

### `frontend/src/components/MarketingDashboard.jsx` (수정)
- 탭 배열에 `['notify', '🔔 알림']` 추가
- `view === 'notify'`일 때 설정 폼 렌더:
  - 마스터 ON/OFF, 목표 순위 N(number), 하락 알림 토글, 목표 미달 알림 토글
  - 다이제스트 ON/OFF + 시각 select(0–23)
  - 웹훅 상태 표시(설정됨/안됨) + "테스트 발송" 버튼
  - 마운트 시 `GET /api/notifications`, 변경 시 `PUT`
- 비교/순위 로직은 프론트 표시는 그대로 두고 백엔드 `rankDiff.js`로 별도 포팅(중복이지만 프론트 리팩터는 범위 외 — YAGNI)

## 6. 데이터 흐름

```
[1분 틱] scheduler.tick
   ├─ due 스케줄 → runSchedule → engine.runScan → store.addRecord
   │                                   └─ onScanComplete(schedule, record)
   │                                        └─ rankDiff(직전 vs 최신) + belowTarget
   │                                             └─ notifier.sendDiscord  → 📱 Discord 푸시
   └─ maybeSendDigest (hour 일치 & 오늘 미발송)
        └─ 스케줄별 최신 record 요약 → notifier.sendDiscord → 📱 Discord 푸시
```

## 7. 메시지 형식 (Discord 마크다운)

조건부 알림 예시:
```
🔔 **이스케이프탑** 순위 알림  (06/05 09:00)
📉 하락
• 광주 방탈출  3→7위
• 방탈출 추천  5→12위
🚪 이탈
• 홍대 방탈출  (이전 8위)
🎯 목표(10위) 미달
• 강남 방탈출  미노출
```

다이제스트 예시:
```
📊 **이스케이프탑** 일일 리포트  (06/05 09:00 · 키워드 5개)
✅ 목표(10위) 달성 3 / 미달 2
• 광주 방탈출  3위
• 방탈출 추천  6위
• 강남 방탈출  미노출 ⚠️
```

## 8. 에러 처리
- `notifier.sendDiscord` 실패: 로그만 남기고 흐름 계속(스캔·스케줄러 영향 없음)
- 웹훅 미설정인데 `enabled=true`: 발송 스킵, UI는 `webhookConfigured:false`로 안내
- `PUT /api/notifications` 입력 검증: `targetRank`(1–100 정수), `digest.hour`(0–23 정수), boolean 강제

## 9. 테스트
- `backend/lib/__tests__/rankDiff.test.js` — Node 내장 `node:test`
  - `extractRanks`: company/id 모드, 미노출, 다중 순위
  - `computeChanges`: 하락/상승/신규/이탈 각 케이스
  - `belowTarget`: 미노출·임계 초과·달성 경계값
- 메시지 빌더(있으면)도 스냅샷 수준 단위 테스트
- `package.json`에 `"test": "node --test backend/lib/__tests__/"` 추가

## 10. 문서/배포
- `.env.example`에 `DISCORD_WEBHOOK_URL` 라인 + 주석 추가
- `PLANNING.md` §4 알림 항목 갱신, §알려진 제약에 다이제스트 시각 = 서버 로컬(TZ) 명시
- 오라클 한국 VPS: `TZ=Asia/Seoul` 환경변수 권장(다이제스트 시각 정확도)

## 11. 알려진 제약
- 다이제스트는 서버 로컬 시각 기준(분 단위 아님, hour 단위)
- 조건부 알림은 "직전 동일 대상 record"가 있어야 하락/이탈 비교 가능(첫 스캔은 목표 미달만)
- 프론트/백엔드에 순위 비교 로직이 중복 존재(프론트 통합 리팩터는 후속 과제)
