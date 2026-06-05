// 접근 비밀번호 게이트 (opt-in): .env에 APP_PASSWORD 가 있을 때만 활성화
// 쿠키 기반이라 기존 fetch는 수정 불필요(같은 출처라 쿠키 자동 전송).
const crypto = require('crypto');

function isAuthRequired() {
    return Boolean(process.env.APP_PASSWORD);
}

// 비밀번호 해시(쿠키에 평문 대신 저장)
function expectedToken() {
    return crypto.createHash('sha256').update(String(process.env.APP_PASSWORD || '')).digest('hex');
}

function parseCookies(req) {
    const header = req.headers.cookie || '';
    const out = {};
    header.split(';').forEach((pair) => {
        const i = pair.indexOf('=');
        if (i > 0) out[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim());
    });
    return out;
}

function isAuthed(req) {
    if (!isAuthRequired()) return true;
    return parseCookies(req).appauth === expectedToken();
}

function authMiddleware(req, res, next) {
    if (isAuthed(req)) return next();
    res.status(401).json({ error: '접근하려면 로그인하세요.', code: 'AUTH_REQUIRED' });
}

module.exports = { isAuthRequired, expectedToken, isAuthed, authMiddleware };
