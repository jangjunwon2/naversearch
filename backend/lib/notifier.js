// Discord Incoming Webhook 발송기.
// 웹훅 URL은 .env(DISCORD_WEBHOOK_URL) 전용 — API로 노출하지 않는다.
// 발송 실패는 로그만 남기고 throw 하지 않는다(스캔/스케줄러 흐름 보호).

const DISCORD_MAX = 1900; // 2000자 제한 여유

function webhookUrl() {
    return process.env.DISCORD_WEBHOOK_URL || '';
}

function isConfigured() {
    return Boolean(webhookUrl());
}

async function sendDiscord(text) {
    const url = webhookUrl();
    if (!url) return false;
    const content = String(text).slice(0, DISCORD_MAX);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
        });
        if (!res.ok) {
            console.error('Discord 웹훅 발송 실패:', res.status);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Discord 웹훅 오류:', e.message);
        return false;
    }
}

module.exports = { isConfigured, sendDiscord };
