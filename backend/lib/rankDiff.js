// 순위 비교 순수 함수 — 통합검색 전체 순위(overallRank) 기준.
// MarketingDashboard.jsx의 비교 로직을 백엔드로 포팅(알림/다이제스트에서 재사용).

// 키워드의 통합검색 노출 순위 배열(낮을수록 상위). undefined=키워드 없음, []=미노출
function extractRanks(rec, keyword) {
    if (!rec) return undefined;
    const item = rec.results.find((r) => r.keyword === keyword);
    if (!item) return undefined;
    const isId = rec.scanType === 'id' || (!rec.scanType && (rec.userId || rec.blogId));
    const exposed = isId ? item.exposed : item.targetExposed;
    if (!exposed) return [];
    const matches = isId ? item.userBlogMatches || [] : item.targetMatches || [];
    let ranks = matches.map((m) => m.overallRank || m.rankInBlock).filter(Boolean);
    if (ranks.length === 0 && isId && item.rankDetail && item.rankDetail.overallRank) {
        ranks = [item.rankDetail.overallRank];
    }
    return [...new Set(ranks)].sort((a, b) => a - b);
}

function bestOf(ranks) {
    return Array.isArray(ranks) ? (ranks.length ? ranks[0] : null) : undefined;
}

function keywordsOf(rec) {
    if (!rec) return [];
    return [...new Set(rec.results.map((r) => r.keyword))];
}

// 직전 대비 변화: up(상승)/down(하락)/entered(신규)/lost(이탈)
function computeChanges(latest, prev) {
    const keywords = [
        ...new Set([
            ...latest.results.map((r) => r.keyword),
            ...(prev ? prev.results.map((r) => r.keyword) : []),
        ]),
    ];
    const up = [], down = [], entered = [], lost = [];
    // 순위 동일(c===p)·양쪽 미노출은 어느 배열에도 넣지 않음(변화만 수집)
    keywords.forEach((kw) => {
        const c = bestOf(extractRanks(latest, kw));
        const p = bestOf(extractRanks(prev, kw));
        if (typeof c === 'number' && typeof p === 'number') {
            if (c < p) up.push({ kw, from: p, to: c });
            else if (c > p) down.push({ kw, from: p, to: c });
        } else if (typeof c === 'number' && p == null) {
            // 신규: 이번 노출, 직전 미노출(null) 또는 직전 레코드에 키워드 없음(undefined)
            entered.push({ kw, to: c });
        } else if (c === null && typeof p === 'number') {
            lost.push({ kw, from: p });
        }
    });
    return { up, down, entered, lost };
}

// 목표 미달: 미노출(best==null)이거나 best > targetRank 인 키워드
function belowTarget(rec, targetRank) {
    return keywordsOf(rec)
        .map((kw) => ({ kw, best: bestOf(extractRanks(rec, kw)) }))
        .filter(({ best }) => best == null || best > targetRank);
}

module.exports = { extractRanks, bestOf, keywordsOf, computeChanges, belowTarget };
