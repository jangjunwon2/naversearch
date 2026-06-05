// 검색어 목록(세트) 관리 — 저장/불러오기/수정/삭제
//   GET    /api/keyword-lists          전체 조회
//   POST   /api/keyword-lists          저장 { name, keywords[] }
//   PUT    /api/keyword-lists/:id       수정 { name?, keywords? }
//   DELETE /api/keyword-lists/:id       삭제
const express = require('express');
const router = express.Router();
const store = require('../lib/store');

function makeId() {
    return 'kl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function cleanKeywords(keywords) {
    if (!Array.isArray(keywords)) return [];
    return [...new Set(keywords.map((k) => String(k).trim()).filter((k) => k.length > 0))];
}

router.get('/', (req, res) => {
    res.json(store.getKeywordLists());
});

router.post('/', (req, res) => {
    const { name, keywords } = req.body;
    const cleaned = cleanKeywords(keywords);
    if (!name || !name.trim()) return res.status(400).json({ error: '목록 이름이 필요합니다.' });
    if (cleaned.length === 0) return res.status(400).json({ error: '키워드가 하나 이상 필요합니다.' });

    const lists = store.getKeywordLists();
    const entry = { id: makeId(), name: name.trim(), keywords: cleaned, createdAt: new Date().toISOString() };
    lists.unshift(entry);
    store.saveKeywordLists(lists);
    res.json({ success: true, list: entry, lists });
});

router.put('/:id', (req, res) => {
    const lists = store.getKeywordLists();
    const idx = lists.findIndex((l) => l.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '존재하지 않는 목록입니다.' });

    const { name, keywords } = req.body;
    if (name !== undefined) lists[idx].name = String(name).trim() || lists[idx].name;
    if (keywords !== undefined) lists[idx].keywords = cleanKeywords(keywords);
    store.saveKeywordLists(lists);
    res.json({ success: true, lists });
});

router.delete('/:id', (req, res) => {
    const lists = store.getKeywordLists().filter((l) => l.id !== req.params.id);
    store.saveKeywordLists(lists);
    res.json({ success: true, lists });
});

module.exports = router;
