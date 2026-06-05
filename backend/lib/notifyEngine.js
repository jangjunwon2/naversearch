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
        const key = `${sch.mode}|${sch.companyName || sch.userId || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const rec = store.getHistory().find((r) => targetKeyOfRecord(r).key === key);
        if (rec) blocks.push(buildDigestBlock(rec, s.targetRank));
    }
    if (blocks.length > 0) {
        await notifier.sendDiscord(blocks.join('\n\n'));
        saveSettings({ _digestLastSent: today });
    }
}

async function sendTest() {
    if (!notifier.isConfigured()) return { ok: false, error: '웹훅이 설정되지 않았습니다(.env DISCORD_WEBHOOK_URL).' };
    const ok = await notifier.sendDiscord('🔔 테스트 알림입니다. 순위 알림이 정상 연결되었습니다.');
    return ok ? { ok: true } : { ok: false, error: '발송에 실패했습니다.' };
}

module.exports = { getSettings, saveSettings, onScanComplete, maybeSendDigest, sendTest };
