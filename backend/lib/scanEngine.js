// 공용 스캔 엔진 — 기능1(업체명)·기능2(ID) 공통 SSE 진행률 루프
// mode === 'company': 업체명 매칭 + 카페/지식인 댓글 집계
// mode === 'id'     : 통합검색 작성자 ID 매칭 + 블로그 탭 폴백
const { sleep } = require('./naverClient');
const { scrapeIntegratedSearch } = require('./integratedSearch');
const { scrapeBlogTab } = require('./blogTab');
const store = require('./store');

// 키워드 간 요청 간격 (네이버 차단 방지)
const MIN_DELAY = 1500;
const RAND_DELAY = 1500;

// 진행 중인 스캔 관리 (취소/SSE 클라이언트 보관)
const activeScans = new Map();

function createScan(total) {
    const scanId = 'scan_' + Date.now();
    activeScans.set(scanId, { cancelled: false, total, client: null });
    return scanId;
}

function hasScan(scanId) {
    return activeScans.has(scanId);
}

function getScan(scanId) {
    return activeScans.get(scanId);
}

function attachClient(scanId, res) {
    const s = activeScans.get(scanId);
    if (s) s.client = res;
}

function detachClient(scanId) {
    const s = activeScans.get(scanId);
    if (s) s.client = null;
}

function cancelScan(scanId) {
    const s = activeScans.get(scanId);
    if (!s) return false;
    s.cancelled = true;
    return true;
}

// 한 키워드의 결과 객체를 생성 (에러 시 errorResult 사용)
function buildKeywordResult(keyword, integrated, exposed, rankDetail, userBlogMatches, maxPages) {
    const targetMatches = integrated.targetMatches;

    let cafeCommentMatchesCount = 0;
    let kinAnswerMatchesCount = 0;
    targetMatches.forEach((m) => {
        if (m.type === 'cafe') cafeCommentMatchesCount += m.commentMatchesCount || 0;
        if (m.type === 'kin') kinAnswerMatchesCount += m.kinMatchesCount || 0;
    });

    return {
        keyword,
        smartBlocks: integrated.smartBlocks,
        exposed,
        targetExposed: targetMatches.length > 0,
        rankDetail: rankDetail || { type: 'not_found' },
        userBlogMatches,
        targetMatches,
        targetMatchesCount: targetMatches.length,
        cafeCommentMatchesCount,
        kinAnswerMatchesCount,
        maxPages,
    };
}

function errorResult(keyword, message) {
    return {
        keyword,
        smartBlocks: [],
        exposed: false,
        targetExposed: false,
        rankDetail: { type: 'error', message },
        userBlogMatches: [],
        targetMatches: [],
        targetMatchesCount: 0,
        cafeCommentMatchesCount: 0,
        kinAnswerMatchesCount: 0,
    };
}

// 메인 스캔 실행 (백그라운드)
async function runScan(scanId, params) {
    const { mode, keywords, companyName = '', userId = '', maxPages = 5 } = params;
    const scanObj = activeScans.get(scanId);
    if (!scanObj) return;

    const results = [];
    const sendSSE = (data) => {
        if (scanObj.client) scanObj.client.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // 통합검색 호출 인자: company 모드는 업체명, id 모드는 작성자 ID
    const targetKeyword = mode === 'company' ? companyName : '';
    const blogId = mode === 'id' ? userId : '';

    try {
        for (let i = 0; i < keywords.length; i++) {
            if (scanObj.cancelled) {
                sendSSE({ type: 'cancelled', message: '스캔이 중단되었습니다.' });
                activeScans.delete(scanId);
                return;
            }

            const keyword = keywords[i];
            sendSSE({ type: 'progress', current: i + 1, total: keywords.length, keyword, status: 'scanning' });

            try {
                const integrated = await scrapeIntegratedSearch(keyword, targetKeyword, blogId);

                let userBlogMatches = integrated.userBlogMatches;
                let exposed = userBlogMatches.length > 0;
                let rankDetail = exposed ? { type: 'integrated', matches: userBlogMatches } : null;

                // ID 모드: 통합검색 미노출 시 블로그 탭 딥서치
                if (mode === 'id' && blogId && !exposed) {
                    sendSSE({
                        type: 'progress',
                        current: i + 1,
                        total: keywords.length,
                        keyword,
                        status: 'deep_searching',
                    });

                    const blogTab = await scrapeBlogTab(keyword, blogId, maxPages);
                    if (blogTab.blogTabMatches.length > 0) {
                        exposed = true;
                        userBlogMatches = blogTab.blogTabMatches;
                        rankDetail = blogTab.blogTabMatches[0];
                    }
                }

                const keywordResult = buildKeywordResult(
                    keyword,
                    integrated,
                    exposed,
                    rankDetail,
                    userBlogMatches,
                    maxPages
                );
                results.push(keywordResult);

                sendSSE({
                    type: 'keyword_scanned',
                    current: i + 1,
                    total: keywords.length,
                    keyword,
                    result: keywordResult,
                });
            } catch (err) {
                console.error(`키워드 "${keyword}" 스캔 오류:`, err.message);
                results.push(errorResult(keyword, err.message));
                sendSSE({
                    type: 'keyword_error',
                    current: i + 1,
                    total: keywords.length,
                    keyword,
                    error: err.message,
                });
            }

            if (i < keywords.length - 1) {
                await sleep(MIN_DELAY + Math.random() * RAND_DELAY);
            }
        }

        const record = {
            id: scanId,
            scanType: mode, // 'company' | 'id'
            timestamp: new Date().toISOString(),
            companyName,
            userId,
            // CSV/구버전 호환을 위한 별칭 필드
            targetKeyword: companyName,
            blogId: userId,
            maxPages,
            keywordsCount: keywords.length,
            results,
        };

        store.addRecord(record);
        sendSSE({ type: 'complete', record });
    } catch (error) {
        console.error('스캔 프로세스 치명적 오류:', error);
        sendSSE({ type: 'error', message: error.message });
    } finally {
        if (scanObj.client) scanObj.client.end();
        activeScans.delete(scanId);
    }
}

module.exports = {
    createScan,
    hasScan,
    getScan,
    attachClient,
    detachClient,
    cancelScan,
    runScan,
};
