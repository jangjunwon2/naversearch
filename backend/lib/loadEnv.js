// 의존성 없는 .env 로더 (프로젝트 루트의 .env를 process.env로 적재)
const fs = require('fs');
const path = require('path');

function loadEnv() {
    const file = path.join(__dirname, '..', '..', '.env'); // 프로젝트 루트
    if (!fs.existsSync(file)) return;
    const content = fs.readFileSync(file, 'utf-8');
    content.split(/\r?\n/).forEach((line) => {
        if (!line || line.trim().startsWith('#')) return;
        const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!m) return;
        const key = m[1];
        let val = m[2].trim();
        if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
        ) {
            val = val.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = val;
    });
}

module.exports = { loadEnv };
