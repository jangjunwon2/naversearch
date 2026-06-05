// 키워드 리서치 — POST /api/keywords
//   입력 키워드 전체(배치 처리) + 검색량/연관키워드 + 블로그(총문서/월발행/포화지수/누적경쟁)
const express = require('express');
const router = express.Router();
const { getKeywordStats } = require('../lib/searchAdClient');
const { getBlogStats, hasCredentials: hasBlogApi } = require('../lib/blogSearchApi');

const MAX_KEYWORDS = 100; // 1회 요청 입력 상한
const HINT_CHUNK = 5; // 검색광고 keywordstool은 한 번에 최대 5개 힌트
const RELATED_ENRICH_CAP = 30; // 연관키워드 블로그 보강 상한(호출 수 보호)

const norm = (s) => String(s).replace(/\s+/g, '').toLowerCase();

function chunk(arr, n) {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
}

// 동시 실행 제한
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

function saturationLabel(pct) {
    if (pct == null) return null;
    if (pct >= 50) return '매우 높음';
    if (pct >= 30) return '높음';
    if (pct >= 10) return '보통';
    if (pct >= 5) return '낮음';
    return '매우 낮음';
}

// 행 배열에 블로그 통계 + 포화지수/누적경쟁 보강
async function enrichRows(rows) {
    const stats = await mapWithConcurrency(rows, 2, (r) => getBlogStats(r.keyword));
    rows.forEach((r, i) => {
        const s = stats[i];
        if (!s || s.status !== 'fulfilled') {
            Object.assign(r, { blogTotal: null, monthlyPosts: null, monthlySaturated: false, saturationPct: null, saturationLabel: null, blogPerSearch: null });
            return;
        }
        const { total, monthlyPosts, monthlySaturated } = s.value;
        const volume = r.monthlyTotal || 0;
        const pct = volume > 0 ? Number(((monthlyPosts / volume) * 100).toFixed(1)) : null;
        const blogPerSearch = volume > 0 ? Number((total / volume).toFixed(1)) : null;
        Object.assign(r, {
            blogTotal: total,
            monthlyPosts,
            monthlySaturated,
            saturationPct: pct,
            saturationLabel: saturationLabel(pct),
            blogPerSearch,
        });
    });
    return rows;
}

router.post('/', async (req, res) => {
    let { keywords } = req.body;
    if (!keywords || !Array.isArray(keywords)) {
        return res.status(400).json({ error: '키워드 목록이 필요합니다.' });
    }
    keywords = keywords.map((k) => String(k).trim()).filter((k) => k.length > 0).slice(0, MAX_KEYWORDS);
    if (keywords.length === 0) return res.status(400).json({ error: '유효한 키워드가 없습니다.' });

    // 입력 중복 제거(공백/대소문자 무시), 원본 표기 유지
    const inputMap = new Map(); // norm -> original
    keywords.forEach((k) => {
        const n = norm(k);
        if (!inputMap.has(n)) inputMap.set(n, k);
    });

    try {
        // 5개씩 배치로 keywordstool 호출
        const chunks = chunk([...inputMap.values()], HINT_CHUNK);
        const statsByNorm = new Map();
        const chunkResults = await mapWithConcurrency(chunks, 2, (c) => getKeywordStats(c));
        chunkResults.forEach((cr) => {
            if (cr.status !== 'fulfilled') return;
            cr.value.forEach((r) => {
                const n = norm(r.keyword);
                if (!statsByNorm.has(n)) statsByNorm.set(n, r);
            });
        });

        // 입력 키워드 행(입력 순서) — 통계 있으면 채우고, 없으면 데이터 없음 표시
        const inputRows = [...inputMap.entries()].map(([n, original]) => {
            const s = statsByNorm.get(n);
            if (s) return { ...s, keyword: original, isInput: true };
            return { keyword: original, monthlyPc: 0, monthlyMobile: 0, monthlyTotal: 0, compIdx: '', isInput: true, noData: true };
        });

        // 연관 키워드(입력에 없던 것)
        const relatedRows = [...statsByNorm.entries()]
            .filter(([n]) => !inputMap.has(n))
            .map(([, r]) => ({ ...r, isInput: false }));

        // 블로그 보강: 입력 키워드 전체 + 연관 상위 일부
        let blogStatsAvailable = false;
        if (hasBlogApi()) {
            try {
                await enrichRows(inputRows);
                relatedRows.sort((a, b) => b.monthlyTotal - a.monthlyTotal);
                await enrichRows(relatedRows.slice(0, RELATED_ENRICH_CAP));
                blogStatsAvailable = true;
            } catch (e) {
                console.error('블로그 통계 보강 실패:', e.message);
            }
        }

        res.json({
            success: true,
            blogStatsAvailable,
            count: inputRows.length,
            keywords: inputRows,
            related: relatedRows,
        });
    } catch (e) {
        const status = e.code === 'NO_CREDENTIALS' ? 503 : 502;
        res.status(status).json({ error: e.message, code: e.code });
    }
});

module.exports = router;
