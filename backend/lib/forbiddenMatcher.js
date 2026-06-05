// 금칙어 매칭 — 띄어쓰기(공백)만 무시하고 본문에서 금칙어 검출
//
// 확정 사항: 공백만 제거하여 매칭한다. 특수문자/자모분리는 적용하지 않는다.
// 원문 하이라이트를 위해 (공백 제거된 인덱스 → 원문 인덱스) 매핑을 만든다.

const CONTEXT_RADIUS = 15; // 문맥 미리보기 좌우 글자 수

// 공백만 제거
function stripSpaces(s) {
    return (s || '').replace(/\s+/g, '');
}

// 원문에서 공백을 제거한 normText와, normText의 각 글자가 원문 몇 번째였는지의 map 생성
function buildNormalized(text) {
    let norm = '';
    const map = [];
    for (let i = 0; i < text.length; i++) {
        if (!/\s/.test(text[i])) {
            norm += text[i];
            map.push(i);
        }
    }
    return { norm, map };
}

// text 본문에서 words(사전)의 금칙어를 검출. 공백 무시 기준.
// words 항목은 문자열 또는 { word, category, severity } 객체 모두 허용.
function checkForbiddenWords(text, words) {
    const safeText = typeof text === 'string' ? text : '';
    const { norm, map } = buildNormalized(safeText);
    const lowerNorm = norm.toLowerCase();

    const results = [];
    let totalViolations = 0;

    for (const entry of words || []) {
        const word = typeof entry === 'string' ? entry : entry.word;
        if (!word) continue;
        const nw = stripSpaces(word).toLowerCase();
        if (!nw) continue;

        const positions = [];
        let from = 0;
        while (true) {
            const idx = lowerNorm.indexOf(nw, from);
            if (idx === -1) break;

            const origStart = map[idx];
            const origEnd = map[idx + nw.length - 1] + 1; // 원문 기준 끝(exclusive)
            const ctxStart = Math.max(0, origStart - CONTEXT_RADIUS);
            const ctxEnd = Math.min(safeText.length, origEnd + CONTEXT_RADIUS);

            positions.push({
                start: origStart,
                end: origEnd,
                matched: safeText.slice(origStart, origEnd),
                context: safeText.slice(ctxStart, ctxEnd),
            });

            from = idx + nw.length; // 비중첩 매칭
        }

        if (positions.length > 0) {
            results.push({
                word,
                category: (typeof entry === 'object' && entry.category) || '',
                severity: (typeof entry === 'object' && entry.severity) || '',
                count: positions.length,
                positions,
            });
            totalViolations += positions.length;
        }
    }

    results.sort((a, b) => b.count - a.count);
    return {
        totalViolations,
        totalWordsMatched: results.length,
        results,
    };
}

module.exports = { checkForbiddenWords, buildNormalized, stripSpaces };
