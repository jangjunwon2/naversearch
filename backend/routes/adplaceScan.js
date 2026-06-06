// 파워링크·플레이스 스캔 — POST /api/scan/adplace
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
