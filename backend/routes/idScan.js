// 기능2: ID별 순위 체크 — POST /api/scan/id
const express = require('express');
const router = express.Router();
const engine = require('../lib/scanEngine');

router.post('/', (req, res) => {
    const { keywords, userId, maxPages = 5 } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({ error: '키워드 목록이 필요합니다.' });
    }
    if (!userId || !userId.trim()) {
        return res.status(400).json({ error: '작성자 ID가 필요합니다.' });
    }

    const scanId = engine.createScan(keywords.length);
    engine.runScan(scanId, {
        mode: 'id',
        keywords,
        userId: userId.trim(),
        maxPages: parseInt(maxPages) || 5,
    });
    res.json({ success: true, scanId });
});

module.exports = router;
