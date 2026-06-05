// 카페 게시물 댓글 내 업체명(타겟 키워드) 언급 댓글 수 집계
const { defaultHeaders, normalizeUrl } = require('./naverClient');

// 카페 게시물 댓글에서 타겟 키워드가 포함된 댓글 개수를 반환
async function scrapeCafeComments(cafeUrl, targetKeyword) {
    if (!targetKeyword || !cafeUrl) return 0;
    try {
        const cleanUrl = normalizeUrl(cafeUrl);
        const match = cleanUrl.match(/cafe\.naver\.com\/([^/]+)\/(\d+)/);
        if (!match) return 0;

        const cafeName = match[1];
        const articleId = match[2];
        const articlePageUrl = `https://cafe.naver.com/${cafeName}/${articleId}`;

        const response = await fetch(articlePageUrl, { headers: defaultHeaders() });
        if (!response.ok) return 0;
        const html = await response.text();

        // HTML에서 clubId 추출
        const clubMatch =
            html.match(/clubid=(\d+)/) ||
            html.match(/clubid["']?\s*:\s*["']?(\d+)/) ||
            html.match(/name="clubid"\s+value="(\d+)"/);
        if (!clubMatch) return 0;

        const clubId = clubMatch[1];

        // 공개 cafe-articleapi로 댓글 조회
        const commentsUrl = `https://apis.naver.com/cafe-web/cafe-articleapi/v2/cafes/${clubId}/articles/${articleId}/comments`;
        const commentsRes = await fetch(commentsUrl, {
            headers: defaultHeaders({
                Referer: `https://cafe.naver.com/ArticleRead.nhn?clubid=${clubId}&articleid=${articleId}`,
            }),
        });
        if (!commentsRes.ok) return 0;
        const json = await commentsRes.json();

        const items = json.result?.comments?.items || [];

        let matchCount = 0;
        const targetLower = targetKeyword.toLowerCase();
        items.forEach((c) => {
            if (c.content && c.content.toLowerCase().includes(targetLower)) {
                matchCount++;
            }
        });

        return matchCount;
    } catch (err) {
        console.error(`카페 댓글 수집 오류 (${cafeUrl}):`, err.message);
        return 0;
    }
}

module.exports = { scrapeCafeComments };
