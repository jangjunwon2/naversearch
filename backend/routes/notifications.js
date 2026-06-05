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
    // 내부 전용 필드(_digestLastSent)는 외부 입력으로 덮어쓰지 못하게 제외
    const { _digestLastSent, ...body } = req.body || {};
    const next = engine.saveSettings(body);
    res.json(publicView(next));
});

router.post('/test', async (req, res) => {
    const r = await engine.sendTest();
    if (!r.ok) return res.status(400).json({ error: r.error });
    res.json({ success: true });
});

module.exports = router;
