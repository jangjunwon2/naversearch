// 실제 키워드로 통합검색 스크래퍼를 직접 호출해 지식인 감지/집계를 상세 점검
const { scrapeIntegratedSearch } = require('./lib/integratedSearch');

const KEYWORDS = ['광주 방탈출', '광주 방탈출 카페', '충장로 방탈출', '광주 데이트코스', '광주 데이트'];
const COMPANY = '이스케이프탑';
const USER_ID = 'dldhswjdtnrl';

async function main() {
    for (const keyword of KEYWORDS) {
        console.log('\n==================================================');
        console.log(`[키워드] ${keyword}`);
        try {
            const r = await scrapeIntegratedSearch(keyword, COMPANY, USER_ID);

            console.log(`스마트블록 ${r.smartBlocks.length}개:`);
            r.smartBlocks.forEach((b, i) => {
                const types = b.posts.map((p) => p.type);
                console.log(
                    `  #${i + 1} ${b.blockName} | 블로그 ${b.blogCount} 카페 ${b.cafeCount} 지식인 ${b.kinCount} | types=[${types.join(',')}]`
                );
            });

            // 지식인 게시물 상세
            const kinPosts = [];
            r.smartBlocks.forEach((b) => b.posts.forEach((p) => { if (p.type === 'kin') kinPosts.push({ block: b.blockName, ...p }); }));
            if (kinPosts.length) {
                console.log(`  ▶ 지식인 게시물 ${kinPosts.length}개:`);
                kinPosts.forEach((p) => console.log(`     - ${p.url} | 업체명포함=${p.containsTarget} | 답글매칭=${p.kinMatchesCount} | "${p.title.slice(0, 40)}"`));
            }

            console.log(`업체명("${COMPANY}") 매칭 ${r.targetMatches.length}건:`);
            r.targetMatches.forEach((m) =>
                console.log(`   [${m.type}] ${m.blockName}(${m.rankInBlock}위) 카페댓글=${m.commentMatchesCount || 0} 지식인답글=${m.kinMatchesCount || 0} | ${m.url}`)
            );

            console.log(`작성자ID("${USER_ID}") 매칭 ${r.userBlogMatches.length}건:`);
            r.userBlogMatches.forEach((m) => console.log(`   [${m.type}] ${m.blockName}(${m.rankInBlock}위) | ${m.url}`));
        } catch (e) {
            console.log('  ❌ 오류:', e.message);
        }
        await new Promise((res) => setTimeout(res, 1500));
    }
    process.exit(0);
}

main();
