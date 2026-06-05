// 지식인(Knowledge-iN) 게시물의 답변/댓글 내 업체명 언급 수 집계
//
// 실제 지식인 상세 페이지 분석 결과(2026):
//  - 페이지는 서버 렌더링 (답변 본문이 초기 HTML에 포함됨)
//  - 답변 단위 컨테이너: `.answerArea` (= `[id^="answer_"]`), 내부 본문 `._endContents`
//  - 주의: 위 셀렉터들은 서로 "겹친다". 모두 이어붙이면 같은 답변을 중복 카운트하므로
//    우선순위 그룹 중 "첫 번째로 매칭되는 그룹"만 사용한다.
const cheerio = require('cheerio');
const { defaultHeaders, countOccurrences } = require('./naverClient');

// 통합검색에서 넘어온 지식인 URL에서 docId 추출 후 데스크톱 상세 URL로 정규화
function normalizeKinUrl(url) {
    if (!url) return '';
    const docMatch = url.match(/docId=(\d+)/i);
    const dirMatch = url.match(/dirId=(\d+)/i);
    const d1Match = url.match(/d1id=(\d+)/i);
    if (!docMatch) return url.split('#')[0];
    let normalized = `https://kin.naver.com/qna/detail.naver?docId=${docMatch[1]}`;
    if (dirMatch) normalized += `&dirId=${dirMatch[1]}`;
    if (d1Match) normalized += `&d1id=${d1Match[1]}`;
    return normalized;
}

// 답변 영역 컨테이너 후보 (우선순위 순). 같은 그룹 내 요소는 서로 형제(비중첩)라 합산해도 안전.
// 네이버 변경 시 이 목록만 갱신하면 됨.
const ANSWER_CONTAINER_GROUPS = [
    ['.answerArea'], // 답변 단위 컨테이너(가장 완전)
    ['[id^="answer_"]'],
    ['.answerDetail', '._endContentsText', '._endContents'], // 답변 본문
    ['.se-main-container'],
    ['#content'], // 최후 폴백
];

// 별도 댓글 컨테이너(답변 영역 밖일 수 있는 댓글) — 있으면 추가 합산
const COMMENT_SELECTORS = ['[class*="comment_area"]', '[class*="commentList"]', '.u_cbox_text'];

// 키워드 주변 문맥 스니펫 추출 (최대 3개)
function extractSnippets(text, keyword, max = 3, radius = 40) {
    const snippets = [];
    const lower = text.toLowerCase();
    const k = keyword.toLowerCase();
    let from = 0;
    while (snippets.length < max) {
        const idx = lower.indexOf(k, from);
        if (idx === -1) break;
        const s = Math.max(0, idx - radius);
        const e = Math.min(text.length, idx + k.length + radius);
        snippets.push((s > 0 ? '…' : '') + text.slice(s, e).replace(/\s+/g, ' ').trim() + (e < text.length ? '…' : ''));
        from = idx + k.length;
    }
    return snippets;
}

// 지식인 답변/댓글 내 targetKeyword 출현 수 + 문맥 샘플 반환: { count, samples[] }
async function scrapeKinAnswers(kinUrl, targetKeyword) {
    const empty = { count: 0, samples: [] };
    if (!targetKeyword || !kinUrl) return empty;
    try {
        const detailUrl = normalizeKinUrl(kinUrl);
        const response = await fetch(detailUrl, { headers: defaultHeaders() });
        if (!response.ok) return empty;
        const html = await response.text();

        const $ = cheerio.load(html);
        $('script, style').remove();

        // 1) 답변 영역: 우선순위 그룹 중 첫 매칭 그룹만 사용 (중복 카운트 방지)
        let answerText = '';
        for (const group of ANSWER_CONTAINER_GROUPS) {
            let groupText = '';
            group.forEach((sel) => {
                $(sel).each((_, el) => {
                    groupText += ' ' + $(el).text();
                });
            });
            if (groupText.trim()) {
                answerText = groupText;
                break;
            }
        }

        // 2) 댓글 영역(있으면): 답변 영역 안에 포함되지 않은 댓글만 별도 합산
        const seenComment = new Set();
        let commentText = '';
        COMMENT_SELECTORS.forEach((sel) => {
            $(sel).each((_, el) => {
                const key = $.html(el);
                if (seenComment.has(key)) return;
                seenComment.add(key);
                commentText += ' ' + $(el).text();
            });
        });

        const combined = answerText + ' ' + commentText;
        return { count: countOccurrences(combined, targetKeyword), samples: extractSnippets(combined, targetKeyword) };
    } catch (err) {
        console.error(`지식인 답글 수집 오류 (${kinUrl}):`, err.message);
        return empty;
    }
}

module.exports = { scrapeKinAnswers, normalizeKinUrl };
