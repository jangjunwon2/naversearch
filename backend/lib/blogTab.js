// 블로그 탭 검색 — ID의 글을 페이지/순번/전체순위로 추적
// 핵심 원칙:
//   1. seenUrls·globalRank를 루프 밖에 두어 크로스 페이지 중복 방지 및 정확한 누적 순위 유지
//   2. 각 anchor의 최상위 li를 기준으로 "결과 항목 하나"를 식별 → 같은 li 안의 연관 링크 중복 카운트 방지
const cheerio = require('cheerio');
const { defaultHeaders, sleep } = require('./naverClient');

const ITEMS_PER_PAGE = 30;

/**
 * anchor의 조상 li 중 "결과 항목" 레벨을 찾아 반환.
 * 같은 li에서 나온 두 번째 blog URL은 중복으로 처리하기 위한 키.
 */
function resultItemKey($, el) {
    let cur = el.parent;
    while (cur && cur.type === 'tag') {
        if (cur.name === 'li') return cur;
        cur = cur.parent;
    }
    return null;
}

async function scrapeBlogTab(keyword, userBlogId, maxPages) {
    const blogTabMatches = [];
    const seenUrls = new Set();       // 전 페이지 공유 — 크로스 페이지 중복 방지
    const seenItems = new Set();      // 같은 결과 li의 두 번째 URL 방지
    let globalRank = 0;               // 전 페이지 누적 고유 순위

    for (let page = 1; page <= maxPages; page++) {
        const start = 1 + (page - 1) * ITEMS_PER_PAGE;
        const url = `https://search.naver.com/search.naver?ssc=tab.blog.all&query=${encodeURIComponent(keyword)}&start=${start}`;

        const response = await fetch(url, { headers: defaultHeaders() });
        if (!response.ok) {
            console.error(`블로그 탭 ${page}페이지 요청 실패: 상태 ${response.status}`);
            break;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // main_pack 내로 스코프 → 사이드바·연관검색 오염 방지
        const mainEl = $('#main_pack');
        const scope = mainEl.length ? mainEl : $('body');

        // 주목할만한글·스마트블록 등 특집 섹션 건너뛰기:
        // blog.naver.com 링크를 포함한 li가 가장 많은 ul을 메인 결과로 선택
        let mainList = null;
        let maxLiCount = 0;
        scope.find('ul').each((_, ul) => {
            const count = $(ul).children('li').filter((_, li) =>
                $(li).find('a[href*="blog.naver.com"]').length > 0
            ).length;
            if (count > maxLiCount) { maxLiCount = count; mainList = $(ul); }
        });
        const target = (mainList && maxLiCount >= 5) ? mainList : scope;

        let pageItemIndex = 0;

        target.find('a').each((_, aEl) => {
            const href = $(aEl).attr('href') || '';
            const m = href.match(/https?:\/\/(?:m\.)?blog\.naver\.com\/([^/?#]+)\/(\d+)/);
            if (!m) return;

            const id = m[1];
            const postNo = m[2];
            const normalized = `https://blog.naver.com/${id.toLowerCase()}/${postNo}`;

            // 이미 본 URL이면 패스
            if (seenUrls.has(normalized)) return;

            // 같은 결과 li에서 이미 URL을 뽑은 항목이면 패스 (같은 카드 내 연관 링크 방지)
            const liNode = resultItemKey($, aEl);
            if (liNode) {
                if (seenItems.has(liNode)) return;
                seenItems.add(liNode);
            }

            seenUrls.add(normalized);
            globalRank++;
            pageItemIndex++;

            if (userBlogId && id.toLowerCase() === userBlogId.toLowerCase()) {
                // 같은 글의 여러 링크 중 가장 긴 텍스트를 제목으로
                let title = $(aEl).text().trim().replace(/\s+/g, ' ');
                target.find(`a[href*="${id}/${postNo}"]`).each((_, a2) => {
                    const t = $(a2).text().trim().replace(/\s+/g, ' ');
                    if (t.length > title.length) title = t;
                });

                blogTabMatches.push({
                    type: 'blog_tab',
                    page,
                    position: pageItemIndex,
                    overallRank: globalRank,
                    url: normalized,
                    title: title || '제목 없음',
                });
            }
        });

        console.log(`[blogTab] "${keyword}" 페이지 ${page}: 이번 페이지 ${pageItemIndex}개, 누적 ${globalRank}위 (메인리스트 ${maxLiCount}개 li)`);

        if (blogTabMatches.length > 0) break;
        if (pageItemIndex === 0) break; // 결과 없으면 더 탐색하지 않음

        if (page < maxPages) await sleep(1000 + Math.random() * 1000);
    }

    return { blogTabMatches };
}

module.exports = { scrapeBlogTab };
