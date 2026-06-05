// 자동 스캔 스케줄 관리 — CRUD + 지금 실행
const express = require('express');
const router = express.Router();
const store = require('../lib/store');
const { runSchedule, MIN_INTERVAL_HOURS } = require('../lib/scheduler');

function makeId() {
    return 'sch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function validate(body) {
    const keywords = (Array.isArray(body.keywords) ? body.keywords : [])
        .map((k) => String(k).trim())
        .filter(Boolean);
    if (keywords.length === 0) return { error: '키워드가 필요합니다.' };
    const mode = body.mode === 'id' ? 'id' : 'company';
    if (mode === 'company' && !String(body.companyName || '').trim()) return { error: '업체명이 필요합니다.' };
    if (mode === 'id' && !String(body.userId || '').trim()) return { error: '작성자 ID가 필요합니다.' };
    const intervalHours = Math.max(parseInt(body.intervalHours) || 24, MIN_INTERVAL_HOURS);
    return {
        value: {
            mode,
            keywords,
            companyName: mode === 'company' ? String(body.companyName).trim() : '',
            userId: mode === 'id' ? String(body.userId).trim() : '',
            maxPages: parseInt(body.maxPages) || 5,
            intervalHours,
            name: String(body.name || '').trim() || `${mode === 'company' ? body.companyName : body.userId} (${keywords.length}개)`,
        },
    };
}

router.get('/', (req, res) => res.json(store.getSchedules()));

router.post('/', (req, res) => {
    const { error, value } = validate(req.body);
    if (error) return res.status(400).json({ error });
    const list = store.getSchedules();
    const entry = { id: makeId(), ...value, enabled: true, lastRun: null, createdAt: new Date().toISOString() };
    list.unshift(entry);
    store.saveSchedules(list);
    res.json({ success: true, schedule: entry, schedules: list });
});

router.put('/:id', (req, res) => {
    const list = store.getSchedules();
    const idx = list.findIndex((s) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '존재하지 않는 스케줄입니다.' });
    // enabled 토글 등 부분 수정 허용
    if (req.body.enabled !== undefined) list[idx].enabled = Boolean(req.body.enabled);
    if (req.body.intervalHours !== undefined) list[idx].intervalHours = Math.max(parseInt(req.body.intervalHours) || 24, MIN_INTERVAL_HOURS);
    store.saveSchedules(list);
    res.json({ success: true, schedules: list });
});

router.delete('/:id', (req, res) => {
    const list = store.getSchedules().filter((s) => s.id !== req.params.id);
    store.saveSchedules(list);
    res.json({ success: true, schedules: list });
});

// 지금 실행 (즉시 1회 스캔)
router.post('/:id/run', (req, res) => {
    const s = store.getSchedules().find((x) => x.id === req.params.id);
    if (!s) return res.status(404).json({ error: '존재하지 않는 스케줄입니다.' });
    runSchedule(s); // 백그라운드 실행
    res.json({ success: true, message: '스캔을 시작했습니다. 잠시 후 히스토리/추이에 반영됩니다.' });
});

module.exports = router;
