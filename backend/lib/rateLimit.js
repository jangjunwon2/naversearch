// 간단한 인메모리 IP 레이트리밋 (단일 인스턴스 가정)
// 공개 배포 + 공유 API 키 환경에서 할당량 남용/네이버 차단을 완화한다.
function createRateLimiter({ windowMs, max, message }) {
    const hits = new Map(); // ip -> number[] (요청 타임스탬프)

    // 메모리 누수 방지: 주기적으로 오래된 IP 정리
    setInterval(() => {
        const now = Date.now();
        for (const [ip, arr] of hits) {
            const recent = arr.filter((t) => now - t < windowMs);
            if (recent.length === 0) hits.delete(ip);
            else hits.set(ip, recent);
        }
    }, windowMs).unref();

    return (req, res, next) => {
        const fwd = req.headers['x-forwarded-for'];
        const ip = (fwd ? String(fwd).split(',')[0].trim() : req.socket.remoteAddress) || 'unknown';
        const now = Date.now();
        const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);

        if (arr.length >= max) {
            const retry = Math.ceil((windowMs - (now - arr[0])) / 1000);
            res.setHeader('Retry-After', String(retry));
            return res.status(429).json({ error: message || `요청이 많습니다. ${retry}초 후 다시 시도하세요.` });
        }

        arr.push(now);
        hits.set(ip, arr);
        next();
    };
}

module.exports = { createRateLimiter };
