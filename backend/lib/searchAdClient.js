// 네이버 검색광고(searchad.naver.com) 키워드도구 API 클라이언트
// 연관키워드 + 월간검색수(PC/모바일) + 경쟁정도 조회
//
// 인증: HMAC-SHA256 서명. message = `${timestamp}.${method}.${uri}`
// 헤더: X-Timestamp, X-API-KEY, X-Customer, X-Signature
const crypto = require('crypto');

const BASE_URL = 'https://api.searchad.naver.com';
const KEYWORDS_URI = '/keywordstool';
const MAX_HINTS = 5; // hintKeywords 최대 5개

function getCredentials() {
    return {
        apiKey: process.env.NAVER_SEARCHAD_API_KEY,
        secretKey: process.env.NAVER_SEARCHAD_SECRET_KEY,
        customerId: process.env.NAVER_SEARCHAD_CUSTOMER_ID,
    };
}

function sign(timestamp, method, uri, secretKey) {
    const message = `${timestamp}.${method}.${uri}`;
    return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
}

// "< 10" 같은 표기와 숫자/문자 혼용을 안전하게 정수로 변환
function toNumber(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
        if (v.includes('<')) return 9; // "< 10" → 10 미만, 9로 근사
        const n = parseInt(v.replace(/[^\d]/g, ''), 10);
        return Number.isNaN(n) ? 0 : n;
    }
    return 0;
}

function normalizeRow(r) {
    const pc = toNumber(r.monthlyPcQcCnt);
    const mobile = toNumber(r.monthlyMobileQcCnt);
    return {
        keyword: r.relKeyword,
        monthlyPc: pc,
        monthlyMobile: mobile,
        monthlyTotal: pc + mobile,
        compIdx: r.compIdx || '', // 높음 | 중간 | 낮음
        avePcClick: toNumber(r.monthlyAvePcClkCnt),
        aveMobileClick: toNumber(r.monthlyAveMobileClkCnt),
        plAvgDepth: toNumber(r.plAvgDepth),
    };
}

// hintKeywords로 연관 키워드 + 검색량 조회
async function getKeywordStats(hintKeywords) {
    const { apiKey, secretKey, customerId } = getCredentials();
    if (!apiKey || !secretKey || !customerId) {
        const err = new Error(
            '검색광고 API 자격증명이 없습니다. 프로젝트 루트 .env에 NAVER_SEARCHAD_API_KEY / NAVER_SEARCHAD_SECRET_KEY / NAVER_SEARCHAD_CUSTOMER_ID 를 설정하세요.'
        );
        err.code = 'NO_CREDENTIALS';
        throw err;
    }

    // 네이버는 hintKeywords의 공백 제거를 권장. 최대 5개.
    const hint = hintKeywords
        .slice(0, MAX_HINTS)
        .map((k) => String(k).replace(/\s+/g, ''))
        .filter((k) => k.length > 0)
        .join(',');

    const method = 'GET';
    const timestamp = Date.now().toString();
    const signature = sign(timestamp, method, KEYWORDS_URI, secretKey);

    const url = `${BASE_URL}${KEYWORDS_URI}?hintKeywords=${encodeURIComponent(hint)}&showDetail=1`;
    const res = await fetch(url, {
        method,
        headers: {
            'X-Timestamp': timestamp,
            'X-API-KEY': apiKey,
            'X-Customer': String(customerId),
            'X-Signature': signature,
            'Content-Type': 'application/json; charset=UTF-8',
        },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(`검색광고 API 오류 ${res.status}: ${text.slice(0, 300)}`);
        err.code = 'API_ERROR';
        err.status = res.status;
        throw err;
    }

    const json = await res.json();
    const list = json.keywordList || [];
    return list.map(normalizeRow);
}

module.exports = { getKeywordStats, sign };
