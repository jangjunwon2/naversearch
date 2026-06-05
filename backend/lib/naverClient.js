// 네이버 요청 공용 헬퍼 (User-Agent, sleep, URL 정규화)

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 실제 브라우저와 최대한 유사한 헤더 (네이버가 봇/브라우저에 다른 레이아웃을 줄 수 있어
// SERP 블록 순서를 사용자 화면과 더 가깝게 맞추기 위함)
function defaultHeaders(extra = {}) {
    return {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Ch-Ua': '"Chromium";v="120", "Not(A:Brand";v="24", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        Referer: 'https://www.naver.com/',
        ...extra,
    };
}

// 네이버 모바일/구버전 URL을 데스크톱 표준 형태로 정규화하고 쿼리스트링 제거
function normalizeUrl(url) {
    if (!url) return '';
    return url
        .replace('https://m.blog.naver.com', 'https://blog.naver.com')
        .replace('https://m.cafe.naver.com', 'https://cafe.naver.com')
        .replace('http://blog.naver.com', 'https://blog.naver.com')
        .replace('http://cafe.naver.com', 'https://cafe.naver.com')
        .split('?')[0]; // 쿼리 파라미터 제거
}

// 대소문자 무시 부분일치 발생 횟수 카운트
function countOccurrences(haystack, needle) {
    if (!haystack || !needle) return 0;
    const h = haystack.toLowerCase();
    const n = needle.toLowerCase();
    let count = 0;
    let from = 0;
    while (true) {
        const idx = h.indexOf(n, from);
        if (idx === -1) break;
        count++;
        from = idx + n.length;
    }
    return count;
}

module.exports = { USER_AGENT, sleep, defaultHeaders, normalizeUrl, countOccurrences };
