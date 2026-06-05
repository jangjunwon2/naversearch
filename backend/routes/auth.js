// 접근 비밀번호 인증 — 상태 확인 / 로그인 / 로그아웃
const express = require('express');
const router = express.Router();
const { isAuthRequired, expectedToken, isAuthed } = require('../lib/auth');

router.get('/status', (req, res) => {
    res.json({ required: isAuthRequired(), authed: isAuthed(req) });
});

router.post('/login', (req, res) => {
    if (!isAuthRequired()) return res.json({ success: true });
    const { password } = req.body;
    if (password && String(password) === String(process.env.APP_PASSWORD)) {
        // 30일 유지 쿠키 (HttpOnly: JS 접근 차단)
        res.setHeader('Set-Cookie', `appauth=${expectedToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
        return res.json({ success: true });
    }
    res.status(401).json({ error: '비밀번호가 틀렸습니다.' });
});

router.post('/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'appauth=; Path=/; HttpOnly; Max-Age=0');
    res.json({ success: true });
});

module.exports = router;
