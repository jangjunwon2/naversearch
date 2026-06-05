// 키워드 리서치 — POST /api/keywords
//   검색광고 키워드도구(검색량/연관키워드) + 블로그 오픈API(총 문서수/월 발행량/콘텐츠 포화지수)
const express = require('express');
const router = express.Router();
const { getKeywordStats } = require('../lib/searchAdClient');
const { getBlogStats, hasCredentials: hasBlogApi } = require('../lib/blogSearchApi');

// 블랙키위식 콘텐츠 포화지수 라벨 (월간 발행량 ÷ 월간 검색량 × 100)
function saturationLabel(pct) {
    if (pct == null) return null;
    if (pct >= 50) return '매우 높음';
    if (pct >= 30) return '높음';
    if (pct >= 10) return '보통';
    if (pct >= 5) return '낮음';
    return '매우 낮음';
}

// 동시 요청 수 제한 (오픈API 부하/레이트리밋 보호)
async function mapWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let idx = 0;
    async function run() {
        while (idx < items.length) {
            const cur = idx++;
            try {
                results[cur] = { status: 'fulfilled', value: await worker(items[cur]) };
            } catch (e) {
                results[cur] = { status: 'rejected', reason: e };
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return results;
}

// 각 키워드 행을 블로그 통계 + 포화지수로 보강
async function enrichWithBlogStats(rows) {
    const stats = await mapWithConcurrency(rows, 2, (r) => getBlogStats(r.keyword));
    return rows.map((r, i) => {
        const s = stats[i];
        if (!s || s.status !== 'fulfilled') {
            return { ...r, blogTotal: null, monthlyPosts: null, monthlySaturated: false, saturationPct: null, saturationLabel: null };
        }
        const { total, monthlyPosts, monthlySaturated } = s.value;
        const volume = r.monthlyTotal || 0;
        // 포화지수(%) = 월간 발행량 ÷ 월간 검색량 × 100 (낮을수록 기회)
        const pct = volume > 0 ? Number(((monthlyPosts / volume) * 100).toFixed(1)) : null;
        return {
            ...r,
            blogTotal: total,
            monthlyPosts,
            monthlySaturated,
            saturationPct: pct,
            saturationLabel: saturationLabel(pct),
        };
    });
}

router.post('/', async (req, res) => {
    const { keywords } = req.body;
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({ error: '키워드가 필요합니다.' });
    }

    try {
        let rows = await getKeywordStats(keywords);

        let blogStatsAvailable = false;
        if (hasBlogApi()) {
            try {
                rows = await enrichWithBlogStats(rows);
                blogStatsAvailable = true;
            } catch (e) {
                console.error('블로그 통계 보강 실패:', e.message);
            }
        }

        rows.sort((a, b) => b.monthlyTotal - a.monthlyTotal);
        res.json({ success: true, count: rows.length, blogStatsAvailable, keywords: rows });
    } catch (e) {
        const status = e.code === 'NO_CREDENTIALS' ? 503 : 502;
        res.status(status).json({ error: e.message, code: e.code });
    }
});

module.exports = router;
