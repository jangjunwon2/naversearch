// 네이버 검색 오픈 API(블로그) — 총 문서수 + 최근 30일 제목매치 발행량
// 자격증명: developers.naver.com 애플리케이션의 Client ID / Secret (검색광고 키와 별개)
//   .env: NAVER_OPENAPI_CLIENT_ID, NAVER_OPENAPI_CLIENT_SECRET
//
// 참고: 카페글 검색 API(cafearticle.json)는 발행일자를 주지 않아 "월간 발행량"을
// 날짜 기준으로 셀 수 없다. 따라서 월간 발행량/포화지수는 블로그 기준으로 산출한다.
const BLOG_API = 'https://openapi.naver.com/v1/search/blog.json';
const DISPLAY = 100; // 페이지당 글 수 (단일 호출 표본)
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getCredentials() {
    return {
        clientId: process.env.NAVER_OPENAPI_CLIENT_ID,
        clientSecret: process.env.NAVER_OPENAPI_CLIENT_SECRET,
    };
}

function hasCredentials() {
    const { clientId, clientSecret } = getCredentials();
    return Boolean(clientId && clientSecret);
}

function stripSpaces(s) {
    return (s || '').replace(/\s+/g, '').toLowerCase();
}

function parsePostDate(yyyymmdd) {
    if (!yyyymmdd || yyyymmdd.length < 8) return null;
    const y = +yyyymmdd.slice(0, 4);
    const m = +yyyymmdd.slice(4, 6) - 1;
    const d = +yyyymmdd.slice(6, 8);
    return new Date(y, m, d);
}

// 키워드 1개의 블로그 통계: { total, monthlyPosts, monthlySaturated }
//   total          : 블로그 누적 총 문서수
//   monthlyPosts   : 최근 30일 + 제목에 키워드 포함(공백 무시) 발행 글 수
//   monthlySaturated: 표본 한계로 더 있을 수 있음(+) 여부
async function getBlogStats(keyword) {
    const { clientId, clientSecret } = getCredentials();
    if (!clientId || !clientSecret) {
        const err = new Error('네이버 검색 오픈 API 키가 없습니다.');
        err.code = 'NO_OPENAPI';
        throw err;
    }

    const headers = { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret };
    const cutoff = Date.now() - MONTH_MS;
    const normKeyword = stripSpaces(keyword);

    // 단일 호출(최근 100건) + 429/5xx 재시도. 다중 사용자 대비 호출 수 최소화.
    const url = `${BLOG_API}?query=${encodeURIComponent(keyword)}&display=${DISPLAY}&start=1&sort=date`;
    let json = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(url, { headers });
        if (res.ok) {
            json = await res.json();
            break;
        }
        if (res.status === 429 || res.status >= 500) {
            await sleep(300 * (attempt + 1)); // 백오프 후 재시도
            continue;
        }
        const text = await res.text().catch(() => '');
        const err = new Error(`블로그 검색 API 오류 ${res.status}: ${text.slice(0, 200)}`);
        err.code = 'OPENAPI_ERROR';
        throw err;
    }
    if (!json) {
        const err = new Error('블로그 검색 API 재시도 실패(레이트리밋).');
        err.code = 'OPENAPI_RATE_LIMIT';
        throw err;
    }

    const total = json.total || 0;
    const items = json.items || [];
    let monthlyPosts = 0;
    let reachedOld = false;
    for (const it of items) {
        const date = parsePostDate(it.postdate);
        if (!date || date.getTime() < cutoff) {
            reachedOld = true; // 날짜순이므로 이후는 모두 더 과거
            break;
        }
        const title = (it.title || '').replace(/<[^>]+>/g, '');
        if (stripSpaces(title).includes(normKeyword)) monthlyPosts += 1;
    }

    // 표본(100건)이 모두 30일 이내면 실제 발행량이 더 많을 수 있음(+)
    return { total, monthlyPosts, monthlySaturated: items.length >= DISPLAY && !reachedOld };
}

module.exports = { getBlogStats, hasCredentials };
