// 네이버 검색 순위 체크 — Express 진입점 (라우트 마운트 + SSE + 정적 서빙)
require('./lib/loadEnv').loadEnv(); // 루트 .env 적재 (검색광고 API 키 등)

const express = require('express');
const corsMiddleware = require('cors');
const path = require('path');

const engine = require('./lib/scanEngine');
const adplaceEngine = require('./lib/adplaceScanEngine');
const { createRateLimiter } = require('./lib/rateLimit');
const { authMiddleware } = require('./lib/auth');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', true); // 프록시(호스팅) 뒤에서 실제 IP 인식 (레이트리밋용)
app.use(corsMiddleware());
app.use(express.json({ limit: '4mb' }));

// 빌드된 프론트엔드 정적 서빙
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// 공개 배포 보호용 레이트리밋 (외부 API/스크래핑 남용 방지)
const scanLimiter = createRateLimiter({ windowMs: 60000, max: 15, message: '스캔 요청이 많습니다. 잠시 후 다시 시도하세요.' });
const keywordLimiter = createRateLimiter({ windowMs: 60000, max: 20, message: '키워드 조회가 많습니다. 잠시 후 다시 시도하세요.' });

// ---- 인증 (APP_PASSWORD 설정 시에만 게이트 동작) ----
app.use('/api/auth', require('./routes/auth')); // 인증 라우트는 게이트 이전(공개)
app.use('/api', authMiddleware); // 이하 모든 /api 보호

// ---- API 라우트 ----
app.use('/api/scan/company', scanLimiter, require('./routes/companyScan')); // 기능1
app.use('/api/scan/id', scanLimiter, require('./routes/idScan')); // 기능2
app.use('/api/scan/adplace', scanLimiter, require('./routes/adplaceScan')); // 기능3: 파워링크·플레이스
app.use('/api/forbidden', require('./routes/forbidden')); // 기능3
app.use('/api/keywords', keywordLimiter, require('./routes/keywords')); // 키워드 리서치(검색광고 API)
app.use('/api/keyword-lists', require('./routes/keywordLists')); // 검색어 목록 관리
app.use('/api/schedules', require('./routes/schedules')); // 자동 스캔 스케줄
app.use('/api/notifications', require('./routes/notifications')); // 알림 설정
app.use('/api/profiles', require('./routes/profiles')); // 대상 프로필 관리
app.use('/api', require('./routes/history')); // 히스토리/CSV export

// ---- 공용 스캔 SSE 진행률 (기능1·2·3 공통) ----
app.get('/api/scan/progress', (req, res) => {
    const scanId = req.query.scanId;
    const eng = engine.hasScan(scanId) ? engine
               : adplaceEngine.hasScan(scanId) ? adplaceEngine
               : null;
    if (!scanId || !eng) {
        return res.status(404).end();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    eng.attachClient(scanId, res);
    const scan = eng.getScan(scanId);
    res.write(`data: ${JSON.stringify({ type: 'init', total: scan.total })}\n\n`);

    req.on('close', () => eng.detachClient(scanId));
});

app.post('/api/scan/cancel', (req, res) => {
    const { scanId } = req.body;
    if (engine.cancelScan(scanId) || adplaceEngine.cancelScan(scanId)) {
        res.json({ success: true, message: '스캔이 중단되었습니다.' });
    } else {
        res.status(404).json({ error: 'Scan ID를 찾을 수 없습니다.' });
    }
});

// ---- CLI 검증 모드 ----
if (process.argv.includes('--test')) {
    runCliTests();
} else {
    // SPA fallback
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
    });

    require('./lib/scheduler').start(); // 자동 주기 스캔 스케줄러 가동

    app.listen(PORT, () => {
        console.log(`네이버 검색 순위 체크 서버 실행 중: http://localhost:${PORT}`);
    });
}

// 모듈 단위 빠른 회귀 테스트
async function runCliTests() {
    const { scrapeIntegratedSearch } = require('./lib/integratedSearch');
    const { checkForbiddenWords } = require('./lib/forbiddenMatcher');

    console.log('=== 금칙어 매칭 테스트 (공백 무시) ===');
    const fwResult = checkForbiddenWords('이 글에는 도 박 광고와 도박이 들어있어요. 광 고 광고!', [
        '도박',
        '광고',
    ]);
    console.log(JSON.stringify(fwResult, null, 2));
    console.log('기대: 도박 2회, 광고 3회\n');

    const keyword = process.env.TEST_KEYWORD || '광주 방탈출';
    const company = process.env.TEST_COMPANY || '이스케이프탑';
    const userId = process.env.TEST_ID || 'cjh2748';

    console.log(`=== 통합검색 테스트: "${keyword}" / 업체="${company}" / ID="${userId}" ===`);
    try {
        const r = await scrapeIntegratedSearch(keyword, company, userId);
        console.log('스마트블록 수:', r.smartBlocks.length);
        console.log('업체명 매칭:', r.targetMatches.length, '/ 작성자ID 매칭:', r.userBlogMatches.length);
        r.smartBlocks.forEach((b, i) => {
            console.log(
                `  #${i + 1} ${b.blockName} (블로그 ${b.blogCount}, 카페 ${b.cafeCount}, 지식인 ${b.kinCount})`
            );
        });
        const kinMatches = r.targetMatches.filter((m) => m.type === 'kin');
        if (kinMatches.length) {
            console.log('지식인 업체명 매칭:', JSON.stringify(kinMatches, null, 2));
        }
        process.exit(0);
    } catch (err) {
        console.error('통합검색 테스트 실패:', err.message);
        process.exit(1);
    }
}
