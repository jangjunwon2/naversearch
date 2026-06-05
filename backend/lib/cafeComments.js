// 카페 게시물 댓글 내 업체명(타겟 키워드) 언급 댓글 수 집계
const { defaultHeaders, normalizeUrl } = require('./naverClient');

// 카페 게시물 댓글에서 타겟 키워드가 포함된 댓글 개수 + 내용 샘플(최대 3개) 반환
// 반환: { count, samples[] }
async function scrapeCafeComments(cafeUrl, targetKeyword) {
    const empty = { count: 0, samples: [] };
    if (!targetKeyword || !cafeUrl) return empty;
    try {
        const cleanUrl = normalizeUrl(cafeUrl);
        const match = cleanUrl.match(/cafe\.naver\.com\/([^/]+)\/(\d+)/);
        if (!match) return empty;

        const cafeName = match[1];
        const articleId = match[2];
        const articlePageUrl = `https://cafe.naver.com/${cafeName}/${articleId}`;

        const response = await fetch(articlePageUrl, { headers: defaultHeaders() });
        if (!response.ok) return empty;
        const html = await response.text();

        // HTML에서 clubId 추출
        const clubMatch =
            html.match(/clubid=(\d+)/) ||
            html.match(/clubid["']?\s*:\s*["']?(\d+)/) ||
            html.match(/name="clubid"\s+value="(\d+)"/);
        if (!clubMatch) return empty;

        const clubId = clubMatch[1];

        // 공개 cafe-articleapi로 댓글 조회
        const commentsUrl = `https://apis.naver.com/cafe-web/cafe-articleapi/v2/cafes/${clubId}/articles/${articleId}/comments`;
        const commentsRes = await fetch(commentsUrl, {
            headers: defaultHeaders({
                Referer: `https://cafe.naver.com/ArticleRead.nhn?clubid=${clubId}&articleid=${articleId}`,
            }),
        });
        if (!commentsRes.ok) return empty;
        const json = await commentsRes.json();

        const items = json.result?.comments?.items || [];

        let count = 0;
        const samples = [];
        const targetLower = targetKeyword.toLowerCase();
        items.forEach((c) => {
            if (c.content && c.content.toLowerCase().includes(targetLower)) {
                count++;
                if (samples.length < 3) samples.push(c.content.replace(/\s+/g, ' ').trim().slice(0, 100));
            }
        });

        return { count, samples };
    } catch (err) {
        console.error(`카페 댓글 수집 오류 (${cafeUrl}):`, err.message);
        return empty;
    }
}

module.exports = { scrapeCafeComments };
