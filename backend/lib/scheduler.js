// 자동 주기 스캔 스케줄러 — 주기마다 스캔을 실행해 히스토리를 누적(추이 형성)
// PM2 등으로 서버가 상시 떠 있으면 동작. 네이버 부하/차단 방지를 위해 최소 주기 제한.
const engine = require('./scanEngine');
const store = require('./store');
const notifyEngine = require('./notifyEngine');

const MIN_INTERVAL_HOURS = 6; // 최소 주기(과도한 스크래핑 방지)
const TICK_MS = 60 * 1000; // 1분마다 due 확인

let timer = null;
const running = new Set();

function updateLastRun(id) {
    const list = store.getSchedules().map((s) => (s.id === id ? { ...s, lastRun: new Date().toISOString() } : s));
    store.saveSchedules(list);
}

// 스케줄 1건 즉시 실행 (SSE 클라이언트 없이 백그라운드 스캔 → 히스토리 저장)
async function runSchedule(s) {
    if (running.has(s.id)) return;
    running.add(s.id);
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
        console.error('스케줄 스캔 오류', s.id, e.message);
    } finally {
        running.delete(s.id);
        updateLastRun(s.id);
    }
}

async function tick() {
    const now = Date.now();
    for (const s of store.getSchedules()) {
        if (!s.enabled || running.has(s.id)) continue;
        const intervalMs = Math.max(s.intervalHours || 24, MIN_INTERVAL_HOURS) * 3600 * 1000;
        const last = s.lastRun ? new Date(s.lastRun).getTime() : 0;
        if (now - last >= intervalMs) {
            console.log(`[스케줄러] 자동 스캔 실행: ${s.name || s.id}`);
            runSchedule(s); // await 안 함 — 여러 스케줄 병렬 허용
        }
    }
    try {
        await notifyEngine.maybeSendDigest();
    } catch (e) {
        console.error('다이제스트 발송 오류:', e.message);
    }
}

function start() {
    if (timer) return;
    timer = setInterval(() => tick().catch((e) => console.error('스케줄러 tick 오류:', e.message)), TICK_MS);
    if (timer.unref) timer.unref();
    console.log('[스케줄러] 시작됨 (1분 간격 확인)');
}

module.exports = { start, runSchedule, MIN_INTERVAL_HOURS };
