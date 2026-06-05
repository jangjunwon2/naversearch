// 기능3: 금칙어 사전 CRUD + 본문 검사
//   GET    /api/forbidden/words          사전 전체 조회
//   POST   /api/forbidden/words          단어 추가
//   POST   /api/forbidden/words/bulk     여러 단어 일괄 추가
//   PUT    /api/forbidden/words/:id      단어 수정
//   DELETE /api/forbidden/words/:id      단어 삭제
//   POST   /api/forbidden/check          본문 검사
const express = require('express');
const router = express.Router();
const store = require('../lib/store');
const { checkForbiddenWords } = require('../lib/forbiddenMatcher');

function makeId() {
    return 'fw_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

router.get('/words', (req, res) => {
    res.json(store.getForbiddenWords());
});

router.post('/words', (req, res) => {
    const { word, category, severity } = req.body;
    if (!word || !word.trim()) {
        return res.status(400).json({ error: '금칙어를 입력하세요.' });
    }
    const list = store.getForbiddenWords();
    const trimmed = word.trim();
    if (list.some((w) => w.word === trimmed)) {
        return res.status(409).json({ error: '이미 존재하는 금칙어입니다.' });
    }
    const entry = { id: makeId(), word: trimmed, category: category || '', severity: severity || '' };
    list.push(entry);
    store.saveForbiddenWords(list);
    res.json({ success: true, word: entry, words: list });
});

// 줄바꿈/쉼표로 구분된 여러 단어를 한 번에 추가
router.post('/words/bulk', (req, res) => {
    const { words } = req.body;
    if (!words || (typeof words !== 'string' && !Array.isArray(words))) {
        return res.status(400).json({ error: '추가할 단어 목록이 필요합니다.' });
    }
    const incoming = (Array.isArray(words) ? words : words.split(/[\n,]/))
        .map((w) => String(w).trim())
        .filter((w) => w.length > 0);

    const list = store.getForbiddenWords();
    const existing = new Set(list.map((w) => w.word));
    let added = 0;
    incoming.forEach((w) => {
        if (!existing.has(w)) {
            list.push({ id: makeId(), word: w, category: '', severity: '' });
            existing.add(w);
            added++;
        }
    });
    store.saveForbiddenWords(list);
    res.json({ success: true, added, words: list });
});

router.put('/words/:id', (req, res) => {
    const list = store.getForbiddenWords();
    const idx = list.findIndex((w) => w.id === req.params.id);
    if (idx === -1) {
        return res.status(404).json({ error: '존재하지 않는 금칙어입니다.' });
    }
    list[idx] = { ...list[idx], ...req.body, id: list[idx].id };
    store.saveForbiddenWords(list);
    res.json({ success: true, words: list });
});

router.delete('/words/:id', (req, res) => {
    const list = store.getForbiddenWords().filter((w) => w.id !== req.params.id);
    store.saveForbiddenWords(list);
    res.json({ success: true, words: list });
});

router.post('/check', (req, res) => {
    const { text } = req.body;
    if (typeof text !== 'string') {
        return res.status(400).json({ error: '검사할 텍스트가 필요합니다.' });
    }
    const words = store.getForbiddenWords();
    res.json(checkForbiddenWords(text, words));
});

module.exports = router;
