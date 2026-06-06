// 대상 프로필 관리 — 업체명·userId·placeId·도메인을 하나의 프로필로 통합
//   GET    /api/profiles          전체 조회
//   POST   /api/profiles          생성 { displayName, businessName, userId, placeId, domain, maxPages }
//   PUT    /api/profiles/:id      수정
//   DELETE /api/profiles/:id      삭제
//   DELETE /api/profiles          전체 삭제
const express = require('express');
const router = express.Router();
const store = require('../lib/store');

function makeId() {
    return 'prof_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function clean(obj) {
    return {
        displayName: (obj.displayName || '').trim(),
        businessName: (obj.businessName || '').trim(),
        userId: (obj.userId || '').trim(),
        placeId: (obj.placeId || '').trim(),
        domain: (obj.domain || '').trim(),
        maxPages: parseInt(obj.maxPages) || 5,
        tags: Array.isArray(obj.tags) ? obj.tags : [],
    };
}

router.get('/', (req, res) => {
    res.json(store.getProfiles());
});

router.post('/', (req, res) => {
    const fields = clean(req.body);
    if (!fields.displayName) return res.status(400).json({ error: '프로필 이름이 필요합니다.' });
    const entry = { id: makeId(), ...fields, createdAt: new Date().toISOString() };
    const list = store.getProfiles();
    list.unshift(entry);
    store.saveProfiles(list);
    res.json({ success: true, profile: entry, profiles: list });
});

router.put('/:id', (req, res) => {
    const list = store.getProfiles();
    const idx = list.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '존재하지 않는 프로필입니다.' });
    list[idx] = { ...list[idx], ...clean(req.body), id: list[idx].id };
    store.saveProfiles(list);
    res.json({ success: true, profiles: list });
});

router.delete('/:id', (req, res) => {
    const list = store.getProfiles().filter((p) => p.id !== req.params.id);
    store.saveProfiles(list);
    res.json({ success: true, profiles: list });
});

router.delete('/', (req, res) => {
    store.saveProfiles([]);
    res.json({ success: true, profiles: [] });
});

module.exports = router;
