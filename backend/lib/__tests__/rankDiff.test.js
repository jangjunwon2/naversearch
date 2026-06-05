const test = require('node:test');
const assert = require('node:assert');
const { extractRanks, bestOf, computeChanges, belowTarget } = require('../rankDiff');

// company 모드 레코드 헬퍼: entries=[{keyword, ranks:[overallRank...]}], ranks 빈 배열=미노출
function companyRec(id, entries) {
    return {
        id,
        scanType: 'company',
        companyName: 'A',
        results: entries.map((e) => ({
            keyword: e.keyword,
            targetExposed: e.ranks.length > 0,
            targetMatches: e.ranks.map((r) => ({ overallRank: r })),
        })),
    };
}

test('extractRanks: 노출 시 overallRank 오름차순, 중복 제거', () => {
    const rec = companyRec('1', [{ keyword: 'k', ranks: [7, 3, 3] }]);
    assert.deepStrictEqual(extractRanks(rec, 'k'), [3, 7]);
});

test('extractRanks: 미노출이면 빈 배열', () => {
    const rec = companyRec('1', [{ keyword: 'k', ranks: [] }]);
    assert.deepStrictEqual(extractRanks(rec, 'k'), []);
});

test('extractRanks: 키워드 없으면 undefined', () => {
    const rec = companyRec('1', [{ keyword: 'k', ranks: [3] }]);
    assert.strictEqual(extractRanks(rec, 'other'), undefined);
});

test('bestOf: 최상위/미노출/없음', () => {
    assert.strictEqual(bestOf([3, 7]), 3);
    assert.strictEqual(bestOf([]), null);
    assert.strictEqual(bestOf(undefined), undefined);
});

test('computeChanges: 하락/상승/신규/이탈', () => {
    const prev = companyRec('p', [
        { keyword: 'down', ranks: [3] },
        { keyword: 'up', ranks: [9] },
        { keyword: 'lost', ranks: [5] },
    ]);
    const latest = companyRec('l', [
        { keyword: 'down', ranks: [8] },
        { keyword: 'up', ranks: [2] },
        { keyword: 'lost', ranks: [] },
        { keyword: 'new', ranks: [4] },
    ]);
    const c = computeChanges(latest, prev);
    assert.deepStrictEqual(c.down, [{ kw: 'down', from: 3, to: 8 }]);
    assert.deepStrictEqual(c.up, [{ kw: 'up', from: 9, to: 2 }]);
    assert.deepStrictEqual(c.entered, [{ kw: 'new', to: 4 }]);
    assert.deepStrictEqual(c.lost, [{ kw: 'lost', from: 5 }]);
});

test('belowTarget: 미노출 또는 목표 초과만', () => {
    const rec = companyRec('l', [
        { keyword: 'ok', ranks: [5] },
        { keyword: 'over', ranks: [15] },
        { keyword: 'miss', ranks: [] },
    ]);
    const miss = belowTarget(rec, 10);
    assert.deepStrictEqual(miss, [
        { kw: 'over', best: 15 },
        { kw: 'miss', best: null },
    ]);
});
