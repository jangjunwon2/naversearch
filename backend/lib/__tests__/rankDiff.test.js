const test = require('node:test');
const assert = require('node:assert');
const { extractRanks, bestOf, keywordsOf, computeChanges, belowTarget } = require('../rankDiff');

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

// id 모드 레코드 헬퍼: entries=[{keyword, ranks:[overallRank...]}], ranks 빈 배열=미노출
function idRec(id, entries) {
    return {
        id,
        scanType: 'id',
        userId: 'u',
        results: entries.map((e) => ({
            keyword: e.keyword,
            exposed: e.ranks.length > 0,
            userBlogMatches: e.ranks.map((r) => ({ overallRank: r })),
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

test('extractRanks: id 모드는 userBlogMatches 기준', () => {
    const rec = idRec('1', [{ keyword: 'k', ranks: [4, 2] }]);
    assert.deepStrictEqual(extractRanks(rec, 'k'), [2, 4]);
});

test('extractRanks: id 모드 rankDetail 폴백', () => {
    const rec = {
        id: '1',
        scanType: 'id',
        userId: 'u',
        results: [{ keyword: 'k', exposed: true, userBlogMatches: [], rankDetail: { overallRank: 12 } }],
    };
    assert.deepStrictEqual(extractRanks(rec, 'k'), [12]);
});

test('keywordsOf: 중복 제거 / falsy 레코드는 빈 배열', () => {
    const rec = companyRec('1', [{ keyword: 'a', ranks: [1] }, { keyword: 'a', ranks: [2] }, { keyword: 'b', ranks: [] }]);
    assert.deepStrictEqual(keywordsOf(rec), ['a', 'b']);
    assert.deepStrictEqual(keywordsOf(null), []);
});

test('computeChanges: 순위 동일하면 어느 배열에도 없음', () => {
    const prev = companyRec('p', [{ keyword: 'same', ranks: [5] }]);
    const latest = companyRec('l', [{ keyword: 'same', ranks: [5] }]);
    const c = computeChanges(latest, prev);
    assert.deepStrictEqual(c, { up: [], down: [], entered: [], lost: [] });
});
