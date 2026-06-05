// 블로그 탭 검색 — 통합검색에 미노출된 작성자 ID의 글을 페이지/순번으로 추적
const cheerio = require('cheerio');
const { defaultHeaders, sleep } = require('./naverClient');

const ITEMS_PER_PAGE = 30;

// 블로그 탭을 maxPages까지 순회하며 userBlogId의 글 위치(페이지/순번/전체순위)를 수집
async function scrapeBlogTab(keyword, userBlogId, maxPages) {
    const blogTabMatches = [];

    for (let page = 1; page <= maxPages; page++) {
        const start = 1 + (page - 1) * ITEMS_PER_PAGE;
        const url = `https://search.naver.com/search.naver?ssc=tab.blog.all&query=${encodeURIComponent(
            keyword
        )}&start=${start}`;

        const response = await fetch(url, { headers: defaultHeaders() });
        if (!response.ok) {
            console.error(`블로그 탭 ${page}페이지 요청 실패: 상태 ${response.status}`);
            break;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const seenUrls = new Set();
        let pageItemIndex = 0;

        const anchors = $('a');
        for (let i = 0; i < anchors.length; i++) {
            const href = $(anchors[i]).attr('href') || '';
            const match = href.match(/https?:\/\/(?:m\.)?blog\.naver\.com\/([^/]+)\/(\d+)/);
            if (match) {
                const id = match[1];
                const postNo = match[2];
                const normalized = `https://blog.naver.com/${id}/${postNo}`;

                if (!seenUrls.has(normalized)) {
                    seenUrls.add(normalized);
                    pageItemIndex++;

                    const overallRank = (page - 1) * ITEMS_PER_PAGE + pageItemIndex;

                    if (userBlogId && id.toLowerCase() === userBlogId.toLowerCase()) {
                        let title = '';
                        $(`a[href*="${id}/${postNo}"]`).each((_, aEl) => {
                            const text = $(aEl).text().trim().replace(/\s+/g, ' ');
                            if (text.length > title.length) title = text;
                        });

                        blogTabMatches.push({
                            type: 'blog_tab',
                            page,
                            position: pageItemIndex,
                            overallRank,
                            url: normalized,
                            title: title || '제목 없음',
                        });
                    }
                }
            }
        }

        // 매치를 찾으면 더 깊게 탐색하지 않고 종료
        if (blogTabMatches.length > 0) break;

        if (page < maxPages) {
            await sleep(1000 + Math.random() * 1000);
        }
    }

    return { blogTabMatches };
}

module.exports = { scrapeBlogTab };
