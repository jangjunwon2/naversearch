// 기능1: 업체명 체크 — POST /api/scan/company
const express = require('express');
const router = express.Router();
const engine = require('../lib/scanEngine');

router.post('/', (req, res) => {
    const { keywords, companyName } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({ error: '키워드 목록이 필요합니다.' });
    }
    if (!companyName || !companyName.trim()) {
        return res.status(400).json({ error: '업체명이 필요합니다.' });
    }

    const scanId = engine.createScan(keywords.length);
    engine.runScan(scanId, { mode: 'company', keywords, companyName: companyName.trim() });
    res.json({ success: true, scanId });
});

module.exports = router;
