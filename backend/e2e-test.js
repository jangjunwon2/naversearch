// 실행 중인 서버(localhost:5000)에 대한 UTF-8 안전 E2E 점검 스크립트
// 사용: node backend/e2e-test.js   (서버가 켜져 있어야 함)
const BASE = 'http://localhost:5000';

const j = (res) => res.json();
const post = (path, body) =>
    fetch(BASE + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

async function resetForbidden() {
    const words = await fetch(BASE + '/api/forbidden/words').then(j);
    for (const w of words) {
        await fetch(`${BASE}/api/forbidden/words/${w.id}`, { method: 'DELETE' });
    }
}

async function pollHistoryFor(scanId, timeoutMs = 60000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const history = await fetch(BASE + '/api/history').then(j);
        const rec = history.find((r) => r.id === scanId);
        if (rec) return rec;
        await new Promise((r) => setTimeout(r, 2000));
    }
    return null;
}

async function main() {
    console.log('=== [1] 금칙어 사전 초기화 후 추가 ===');
    await resetForbidden();
    await post('/api/forbidden/words', { word: '도박' });
    const bulk = await post('/api/forbidden/words/bulk', { words: '광고,스팸,홍보' }).then(j);
    console.log('현재 사전:', bulk.words.map((w) => w.word).join(', '));

    console.log('\n=== [2] 금칙어 검사 (띄어쓰기 무시) ===');
    const checkRes = await post('/api/forbidden/check', {
        text: '이 글은 도 박 광고이며 홍 보 도박입니다.',
    }).then(j);
    console.log(`총 ${checkRes.totalWordsMatched}종 / ${checkRes.totalViolations}회`);
    checkRes.results.forEach((r) => console.log(`  - ${r.word}: ${r.count}회`));
    console.log('기대: 도박 2회, 광고 1회, 홍보 1회');

    console.log('\n=== [3] 업체명 스캔 (live, 키워드 1개) ===');
    const companyStart = await post('/api/scan/company', {
        keywords: ['광주 방탈출'],
        companyName: '이스케이프탑',
    }).then(j);
    console.log('scanId:', companyStart.scanId, '- 완료 대기...');
    const companyRec = await pollHistoryFor(companyStart.scanId);
    if (companyRec) {
        const r = companyRec.results[0];
        console.log(`  scanType=${companyRec.scanType}, 업체명노출=${r.targetExposed}, 매칭=${r.targetMatchesCount}, 카페댓글=${r.cafeCommentMatchesCount}, 지식인답글=${r.kinAnswerMatchesCount}`);
    } else {
        console.log('  ❌ 업체명 스캔 기록을 찾지 못함');
    }

    console.log('\n=== [4] ID 스캔 (live, 키워드 1개) ===');
    const idStart = await post('/api/scan/id', {
        keywords: ['광주 방탈출'],
        userId: 'cjh2748',
        maxPages: 2,
    }).then(j);
    console.log('scanId:', idStart.scanId, '- 완료 대기...');
    const idRec = await pollHistoryFor(idStart.scanId);
    if (idRec) {
        const r = idRec.results[0];
        console.log(`  scanType=${idRec.scanType}, 노출=${r.exposed}, rankType=${r.rankDetail.type}, 위치수=${r.userBlogMatches.length}`);
    } else {
        console.log('  ❌ ID 스캔 기록을 찾지 못함');
    }

    console.log('\n=== [5] CSV export 헤더 확인 ===');
    if (companyRec) {
        const csv = await fetch(`${BASE}/api/export/${companyRec.id}`).then((r) => r.text());
        console.log('  ' + csv.split('\n')[0].replace(/^﻿/, ''));
        console.log('  ' + (csv.split('\n')[1] || ''));
    }

    console.log('\n✅ E2E 점검 완료');
    process.exit(0);
}

main().catch((e) => {
    console.error('E2E 실패:', e);
    process.exit(1);
});
