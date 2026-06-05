// 특정 지식인 페이지 DOM 구조 분석 — kinAnswers.js 셀렉터 보정용
const cheerio = require('cheerio');
const { defaultHeaders } = require('./lib/naverClient');

const URL =
    'https://kin.naver.com/qna/detail.naver?d1id=3&dirId=30505&docId=493494915&enc=utf8&kinsrch_src=pc_tab_kin&qb=6rSR7KO8IOuwqe2DiOy2nA%3D%3D';

const CANDIDATE_SELECTORS = [
    '.answer-content',
    '._answerContent',
    '.answerArea',
    '[id^="answer_"]',
    '.se-main-container',
    '._endContents',
    '.kin_answer',
    '.answerDetail',
    '.answer_view',
    '._endContentsText',
    '.c-heading-answer__content',
    '.endContentLeft',
    '.answerArea__content',
    '.title', // 질문 제목
];

async function main() {
    const res = await fetch(URL, { headers: defaultHeaders() });
    console.log('HTTP status:', res.status);
    const html = await res.text();
    console.log('HTML 길이:', html.length);

    const $ = cheerio.load(html);
    $('script, style').remove();

    console.log('\n=== 셀렉터별 매칭 개수/텍스트 길이 ===');
    CANDIDATE_SELECTORS.forEach((sel) => {
        const els = $(sel);
        let len = 0;
        els.each((_, el) => (len += $(el).text().trim().length));
        if (els.length > 0) console.log(`  ${sel}  → ${els.length}개, 텍스트 ${len}자`);
    });

    // 답변 영역으로 가장 그럴듯한 컨테이너 후보 자동 탐색: class에 answer 포함
    console.log('\n=== class에 "answer" 포함된 요소 상위 ===');
    const seen = new Set();
    $('[class*="answer"]').each((_, el) => {
        const cls = ($(el).attr('class') || '').trim();
        if (cls && !seen.has(cls)) {
            seen.add(cls);
            const t = $(el).text().trim().replace(/\s+/g, ' ');
            if (t.length > 30) console.log(`  .${cls.split(/\s+/).join('.')}  (${t.length}자) → ${t.slice(0, 60)}`);
        }
    });

    // 본문에 흔히 등장할 업체명 후보 카운트
    console.log('\n=== 업체명 후보 등장 횟수(전체 텍스트) ===');
    const bodyText = $('body').text();
    ['이스케이프탑', '방탈출', '광주'].forEach((w) => {
        const re = new RegExp(w, 'g');
        console.log(`  ${w}: ${(bodyText.match(re) || []).length}회`);
    });

    // 페이지에 등장하는 모든 한글 "OO" 업체스러운 단어 샘플 (답변 영역 텍스트 일부 출력)
    console.log('\n=== 답변 영역 추정 텍스트 미리보기 ===');
    const preview = ($('.se-main-container').text() || $('._endContents').text() || $('#content').text() || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 400);
    console.log(preview || '(추출 실패)');
}

main().catch((e) => console.error('실패:', e));
