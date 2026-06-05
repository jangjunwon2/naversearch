// 네이버 통합검색(스마트블록) 파싱 — 구조 변경에 강한(resilient) 감지
//
// 설계 원칙:
//  1) 게시물 감지는 "전체 페이지 앵커 + 안정적인 URL 스킴" 기준으로 한다.
//     네이버가 블록 클래스/레이아웃을 바꿔도 blog/cafe/kin/influencer/post URL은
//     거의 바뀌지 않으므로 매칭과 순위는 살아남는다.
//  2) 스마트블록 묶음/제목은 "best-effort 메타데이터"로만 쓴다. 제목이 신뢰 불가하면
//     글 종류명으로 대체하고, 같은 이름 블록은 병합해 과분할을 막는다.
//  3) overallRank(통합검색 전체 노출 순서)을 부여해 "몇 위"를 명확히 한다.
const cheerio = require('cheerio');
const { defaultHeaders } = require('./naverClient');
const { scrapeCafeComments } = require('./cafeComments');
const { scrapeKinAnswers } = require('./kinAnswers');

// 블록 제목 추출에 시도할 셀렉터 (네이버 변경 시 이 목록만 갱신하면 됨)
const TITLE_SELECTORS = [
    'h2',
    'h3',
    'h4',
    '.sds-comps-header-left span',
    '[class*="header-left"] span',
    '[class*="header"] [class*="title"]',
    '[class*="title"]',
];

// 게시물이 위치하는 스마트블록 컨테이너 후보
const SECTION_SELECTORS = '.api_subject_bx, .sc_new, .sp_nview, .sp_nblog, .sp_ncafe';

// 광고/지도 영역(수집 제외)
const AD_BLOCK_TITLES = new Set(['플레이스', '네이버 지도', '파워링크', '비즈사이트']);
const AD_ANCESTOR_SELECTOR = '[class*="splace"], [class*="power_link"], [class*="link_ad"], [class*="ad_area"]';

// 제목이 신뢰 불가함을 알리는 잡음 마커 (인플루언서 카드/Keep UI/메타)
const NOISE_MARKERS = ['Keep에 저장', 'Keep에 바로가기', '인용', '주 전', '시간 전', '일 전'];
const DATE_RE = /\d{4}\.\d{1,2}\.\d{1,2}\.?/;
const VIEW_RE = /\d+(\.\d+)?\s*만/;

// href에서 게시물 종류와 식별자를 추출. 게시물이 아니면 null
function detectPost(href) {
    const blogMatch = href.match(/https?:\/\/(?:m\.)?blog\.naver\.com\/([^/]+)\/(\d+)/);
    if (blogMatch) return { type: 'blog', id: blogMatch[1], postNo: blogMatch[2] };

    const cafeMatch = href.match(/https?:\/\/(?:m\.)?cafe\.naver\.com\/([^/]+)\/(\d+)/);
    if (cafeMatch) return { type: 'cafe', id: cafeMatch[1], postNo: cafeMatch[2] };

    if (href.includes('cafe.naver.com') && href.includes('articleid=')) {
        const articleMatch = href.match(/articleid=(\d+)/);
        const clubMatch = href.match(/clubid=(\d+)/) || href.match(/cafe\.naver\.com\/([^/?]+)/);
        if (articleMatch) {
            return { type: 'cafe', id: clubMatch ? clubMatch[1] : 'unknown', postNo: articleMatch[1] };
        }
    }

    if (/(?:^|\/\/|\.)kin\.naver\.com/.test(href) && /docId=(\d+)/i.test(href)) {
        const docMatch = href.match(/docId=(\d+)/i);
        return { type: 'kin', id: 'kin', postNo: docMatch[1] };
    }

    const infMatch = href.match(/https?:\/\/in\.naver\.com\/([^/?#\s]+)/);
    if (infMatch) {
        return { type: 'influencer', id: infMatch[1], postNo: href.split('/').pop() || 'profile' };
    }

    if (href.includes('post.naver.com/')) {
        const volumeMatch = href.match(/volumeNo=(\d+)/);
        const memberMatch = href.match(/memberNo=(\d+)/);
        return {
            type: 'naver_post',
            id: memberMatch ? memberMatch[1] : 'post',
            postNo: volumeMatch ? volumeMatch[1] : 'post',
        };
    }

    return null;
}

function buildNormalizedUrl(type, id, postNo, rawHref) {
    if (type === 'blog') return `https://blog.naver.com/${id}/${postNo}`;
    if (type === 'cafe') return `https://cafe.naver.com/${id}/${postNo}`;
    if (type === 'influencer') return `https://in.naver.com/${id}`;
    if (type === 'kin') return `https://kin.naver.com/qna/detail.naver?docId=${postNo}`;
    return (rawHref || '').split('?')[0];
}

// 종류 → 한글 라벨
function typeKoLabel(type) {
    return (
        { blog: '블로그', cafe: '카페', kin: '지식인', influencer: '인플루언서 콘텐츠', naver_post: '네이버 포스트' }[
            type
        ] || '통합검색'
    );
}

// 원시 블록 제목 추출
function rawBlockTitle($, blockEl) {
    for (const sel of TITLE_SELECTORS) {
        const t = $(blockEl).find(sel).first().text().trim();
        if (t) return t;
    }
    return '';
}

// 제목 정화: Keep/날짜/조회수 등 잡음이면 신뢰 불가로 판단해 빈 문자열 반환
function sanitizeBlockTitle(raw) {
    if (!raw) return '';
    let title = raw.replace(/\s+/g, ' ').trim();
    if (NOISE_MARKERS.some((m) => title.includes(m)) || DATE_RE.test(title) || VIEW_RE.test(title)) {
        return ''; // 신뢰 불가 → 호출측에서 타입 기반 이름으로 대체
    }
    return title;
}

// 광고 컨텍스트 여부 (앵커 조상에 광고성 컨테이너가 있는지)
function isAdAnchor($, anchorEl) {
    return $(anchorEl).closest(AD_ANCESTOR_SELECTOR).length > 0;
}

// 한 앵커에서 제목/스니펫/작성자 추출 (scope 내 동일 글 앵커들을 탐색)
function extractText($, scopeEl, anchorEl, detected) {
    const { type, id, postNo } = detected;
    const matchKey = type === 'kin' ? postNo : id;

    let title = '';
    let snippet = '';
    let authorName = '';

    $(scopeEl)
        .find('a')
        .each((_, innerA) => {
            const innerHref = $(innerA).attr('href') || '';
            const matchesDetail =
                innerHref.includes(matchKey) &&
                (innerHref.includes(postNo) ||
                    innerHref.includes('art=') ||
                    innerHref.includes('/contents/') ||
                    type === 'kin');

            if (matchesDetail) {
                const text = $(innerA).text().trim().replace(/\s+/g, ' ');
                const childHeadline = $(innerA).find('[class*="headline1"], [class*="title"]').text().trim();
                const childBody = $(innerA).find('[class*="body1"], [class*="dsc"], [class*="desc"]').text().trim();
                if (childHeadline) title = childHeadline;
                if (childBody) snippet = childBody;
                if (text.length > 0) {
                    if (!title && text.length < 100) title = text;
                    else if (text.length > snippet.length) snippet = text;
                }
            }

            const isProfile =
                innerHref.includes(id) &&
                !innerHref.includes(postNo) &&
                !innerHref.includes('art=') &&
                !innerHref.includes('/contents/');
            if (isProfile && type !== 'kin') {
                const text = $(innerA).text().trim().replace(/\s+/g, ' ');
                if (text.length > 0 && text.length < 30 && text !== '블로그' && text !== '카페') {
                    authorName = text;
                }
            }
        });

    if (!title) {
        const fallback = $(anchorEl).text().trim().replace(/\s+/g, ' ');
        if (fallback) title = fallback.substring(0, 100);
    }
    if (title && snippet && snippet.startsWith(title)) snippet = snippet.substring(title.length).trim();
    if (!title && snippet) title = snippet.substring(0, 50) + '...';

    return { title, snippet, authorName };
}

// 통합검색 스크래핑. targetKeyword(업체명)/userBlogId(작성자ID) 둘 다 선택적.
async function scrapeIntegratedSearch(keyword, targetKeyword, userBlogId) {
    const url = 'https://search.naver.com/search.naver?query=' + encodeURIComponent(keyword);
    const response = await fetch(url, { headers: defaultHeaders() });
    if (!response.ok) throw new Error(`네이버 HTTP 오류! 상태: ${response.status}`);
    const html = await response.text();
    const $ = cheerio.load(html);

    // 순위(overallRank)는 마지막에 "블록 순서(=사람이 보는 위→아래)" 그대로 부여한다.
    const targetLower = (targetKeyword || '').toLowerCase();
    const globalSeenUrls = new Set();
    const userBlogMatches = [];
    const targetMatches = [];
    const rawBlocks = []; // { blockName, posts: [] }

    // 게시물 1건을 처리해 post 객체 생성 + 매칭 기록 (PASS2/PASS3 공용)
    async function processAnchor(scopeEl, anchorEl, detected, blockName) {
        const { type, id, postNo } = detected;
        const href = $(anchorEl).attr('href') || '';
        const normalized = buildNormalizedUrl(type, id, postNo, href);
        if (globalSeenUrls.has(normalized)) return null;
        globalSeenUrls.add(normalized);

        const { title, snippet, authorName } = extractText($, scopeEl, anchorEl, detected);

        const lowerTitle = (title || '').toLowerCase();
        const lowerSnippet = (snippet || '').toLowerCase();
        const containsTarget = targetLower
            ? lowerTitle.includes(targetLower) || lowerSnippet.includes(targetLower)
            : false;
        const isUserBlog = userBlogId ? id.toLowerCase() === userBlogId.toLowerCase() : false;

        let commentMatchesCount = 0;
        let kinMatchesCount = 0;
        let commentSamples = [];
        let kinSamples = [];
        if (targetKeyword && type === 'cafe') {
            const c = await scrapeCafeComments(normalized, targetKeyword);
            commentMatchesCount = c.count;
            commentSamples = c.samples;
        }
        if (targetKeyword && type === 'kin') {
            const k = await scrapeKinAnswers(normalized, targetKeyword);
            kinMatchesCount = k.count;
            kinSamples = k.samples;
        }

        // overallRank/rankInBlock은 최종 블록 순서 패스에서 부여 (여기선 placeholder)
        const post = {
            type,
            id,
            postNo,
            url: normalized,
            overallRank: 0,
            title: title || '제목 없음',
            snippet: snippet || '설명 없음',
            authorName: authorName || (type === 'kin' ? '지식인' : id),
            containsTarget,
            isUserBlog,
            commentMatchesCount,
            kinMatchesCount,
            commentSamples,
            kinSamples,
        };

        if (containsTarget) {
            targetMatches.push({
                blockName,
                overallRank: 0,
                type,
                url: normalized,
                title: post.title,
                commentMatchesCount,
                kinMatchesCount,
                commentSamples,
                kinSamples,
            });
        }
        if (isUserBlog) {
            userBlogMatches.push({ blockName, overallRank: 0, type, url: normalized, title: post.title });
        }
        return post;
    }

    // ── PASS 2: 알려진 스마트블록 단위로 묶어 best-effort 블록/제목 생성
    const sections = $(SECTION_SELECTORS);
    const processedBlocks = new Set();
    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
        const blockEl = sections[sIdx];
        if (processedBlocks.has(blockEl)) continue;
        processedBlocks.add(blockEl);

        const raw = rawBlockTitle($, blockEl);
        if (AD_BLOCK_TITLES.has(raw) || raw.includes('광고')) continue;

        const anchors = $(blockEl).find('a');
        const posts = [];
        for (let aIdx = 0; aIdx < anchors.length; aIdx++) {
            const aEl = anchors[aIdx];
            const detected = detectPost($(aEl).attr('href') || '');
            if (!detected) continue;
            if (isAdAnchor($, aEl)) continue;

            // 블록명: 정화 제목이 신뢰 가능하면 사용, 아니면 종류명으로 대체
            const clean = sanitizeBlockTitle(raw);
            const blockName = clean || typeKoLabel(detected.type);

            const post = await processAnchor(blockEl, aEl, detected, blockName);
            if (post) posts.push({ ...post, _blockName: blockName });
        }
        if (posts.length > 0) rawBlocks.push(posts);
    }

    // ── PASS 3: 어떤 블록에도 안 잡힌 게시물(레이아웃 변경분) 폴백 수집
    const fallbackPosts = [];
    const fallbackAnchors = $('a');
    for (let i = 0; i < fallbackAnchors.length; i++) {
        const aEl = fallbackAnchors[i];
        const href = $(aEl).attr('href') || '';
        const detected = detectPost(href);
        if (!detected) continue;
        if (isAdAnchor($, aEl)) continue;
        const normalized = buildNormalizedUrl(detected.type, detected.id, detected.postNo, href);
        if (globalSeenUrls.has(normalized)) continue;

        const scope = $(aEl).closest('li, div').get(0) || aEl;
        const post = await processAnchor(scope, aEl, detected, '기타 검색결과');
        if (post) fallbackPosts.push({ ...post, _blockName: '기타 검색결과' });
    }
    if (fallbackPosts.length > 0) rawBlocks.push(fallbackPosts);

    // ── 동일 이름 블록 병합 + overallRank 기준 정렬/순번 부여 (과분할 제거)
    const mergedMap = new Map(); // blockName -> posts[]
    const order = [];
    rawBlocks.flat().forEach((p) => {
        const name = p._blockName;
        if (!mergedMap.has(name)) {
            mergedMap.set(name, []);
            order.push(name);
        }
        mergedMap.get(name).push(p);
    });

    // 블록 순서대로(=사람이 보는 위→아래) 순회하며 전체 순위(overallRank)와
    // 블록 내 순위(rank)를 부여한다. 블록 내 글 순서는 DOM 등장 순서(=시각 순서) 유지.
    let globalRank = 0;
    const urlRank = new Map(); // url -> { rankInBlock, overallRank }
    const smartBlocks = order.map((name) => {
        const posts = mergedMap.get(name).map((p, idx) => {
            globalRank += 1;
            const { _blockName, ...rest } = p;
            urlRank.set(rest.url, { rankInBlock: idx + 1, overallRank: globalRank });
            return { ...rest, rank: idx + 1, overallRank: globalRank };
        });
        return {
            blockName: name,
            blogCount: posts.filter((p) => p.type === 'blog' || p.type === 'influencer').length,
            cafeCount: posts.filter((p) => p.type === 'cafe').length,
            kinCount: posts.filter((p) => p.type === 'kin').length,
            posts,
        };
    });

    // 매칭 목록에 최종 순위(블록 순서 기준) 반영
    const patchRank = (m) => {
        const r = urlRank.get(m.url);
        if (r) {
            m.rankInBlock = r.rankInBlock;
            m.overallRank = r.overallRank;
        }
    };
    targetMatches.forEach(patchRank);
    userBlogMatches.forEach(patchRank);

    return { smartBlocks, userBlogMatches, targetMatches };
}

module.exports = { scrapeIntegratedSearch, detectPost, sanitizeBlockTitle };
