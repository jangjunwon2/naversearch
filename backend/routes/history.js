// 히스토리 조회/삭제 + CSV export (/api/history, /api/history/:id, /api/export/:scanId)
const express = require('express');
const router = express.Router();
const store = require('../lib/store');

router.get('/history', (req, res) => {
    res.json(store.getHistory());
});

router.delete('/history/:id', (req, res) => {
    const updated = store.deleteRecord(req.params.id);
    res.json({ success: true, history: updated });
});

// 블로그ID 노출 위치 문자열화
function describeBlogRanks(resItem) {
    if (resItem.exposed && resItem.userBlogMatches && resItem.userBlogMatches.length > 0) {
        const ranks = resItem.userBlogMatches.map((m) =>
            m.type === 'blog_tab'
                ? `블로그탭 ${m.page}페이지 ${m.position}번째`
                : `${m.blockName}(${m.rankInBlock}위)`
        );
        return `"${ranks.join(' / ')}"`;
    }
    if (resItem.rankDetail && resItem.rankDetail.type === 'error') {
        return `"${(resItem.rankDetail.message || '').replace(/"/g, '""')}"`;
    }
    return '미노출';
}

router.get('/export/:scanId', (req, res) => {
    const record = store.getHistory().find((r) => r.id === req.params.scanId);
    if (!record) {
        return res.status(404).send('기록을 찾을 수 없습니다.');
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=naver_rank_${record.id}.csv`);

    let csv = '﻿'; // UTF-8 BOM
    csv +=
        '검색 키워드,업체명 노출 여부,업체명 노출 개수,카페 댓글 매칭 개수,지식인 답글 매칭 개수,작성자ID 노출 여부,작성자ID 노출 위치 리스트\n';

    record.results.forEach((resItem) => {
        const keyword = `"${resItem.keyword.replace(/"/g, '""')}"`;
        const targetExposed = resItem.targetExposed ? 'O' : 'X';
        const targetCount = resItem.targetMatchesCount || 0;
        const cafeComments = resItem.cafeCommentMatchesCount || 0;
        const kinAnswers = resItem.kinAnswerMatchesCount || 0;
        const blogExposed = resItem.exposed ? 'O' : 'X';
        const blogRanks = describeBlogRanks(resItem);

        csv += `${keyword},${targetExposed},${targetCount},${cafeComments},${kinAnswers},${blogExposed},${blogRanks}\n`;
    });

    res.send(csv);
});

module.exports = router;
