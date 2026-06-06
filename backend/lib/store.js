// 도메인별 JSON 파일 저장소 (히스토리 / 금칙어 사전)
const fs = require('fs');
const path = require('path');

const STORE_DIR = path.join(__dirname, '..', 'store');
const HISTORY_FILE = path.join(STORE_DIR, 'history.json');
const FORBIDDEN_FILE = path.join(STORE_DIR, 'forbidden-words.json');
const KEYWORD_LISTS_FILE = path.join(STORE_DIR, 'keyword-lists.json');
const SCHEDULES_FILE = path.join(STORE_DIR, 'schedules.json');
const NOTIFICATIONS_FILE = path.join(STORE_DIR, 'notifications.json');
const PROFILES_FILE = path.join(STORE_DIR, 'profiles.json');
const LEGACY_HISTORY = path.join(__dirname, '..', '..', 'scan_history.json');

const MAX_HISTORY = 50;

function ensureStore() {
    if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
    // 기존 루트의 scan_history.json을 1회 마이그레이션
    if (!fs.existsSync(HISTORY_FILE) && fs.existsSync(LEGACY_HISTORY)) {
        try {
            fs.copyFileSync(LEGACY_HISTORY, HISTORY_FILE);
        } catch (e) {
            console.error('히스토리 마이그레이션 실패:', e.message);
        }
    }
}

function readJson(file, fallback) {
    try {
        if (!fs.existsSync(file)) return fallback;
        const data = fs.readFileSync(file, 'utf-8');
        const parsed = JSON.parse(data || 'null');
        return parsed == null ? fallback : parsed;
    } catch (e) {
        console.error('저장소 읽기 오류', file, e.message);
        return fallback;
    }
}

function writeJson(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error('저장소 쓰기 오류', file, e.message);
        return false;
    }
}

// ---- 히스토리 ----
function getHistory() {
    return readJson(HISTORY_FILE, []);
}

function addRecord(record) {
    const history = getHistory();
    history.unshift(record); // 최신 항목이 먼저 보이도록
    if (history.length > MAX_HISTORY) history.pop();
    writeJson(HISTORY_FILE, history);
    return history;
}

function deleteRecord(id) {
    const filtered = getHistory().filter((item) => item.id !== id);
    writeJson(HISTORY_FILE, filtered);
    return filtered;
}

// ---- 금칙어 사전 ----
function getForbiddenWords() {
    return readJson(FORBIDDEN_FILE, []);
}

function saveForbiddenWords(list) {
    writeJson(FORBIDDEN_FILE, list);
    return list;
}

// ---- 검색어 목록(세트) ----
function getKeywordLists() {
    return readJson(KEYWORD_LISTS_FILE, []);
}

function saveKeywordLists(lists) {
    writeJson(KEYWORD_LISTS_FILE, lists);
    return lists;
}

// ---- 자동 스캔 스케줄 ----
function getSchedules() {
    return readJson(SCHEDULES_FILE, []);
}

function saveSchedules(list) {
    writeJson(SCHEDULES_FILE, list);
    return list;
}

// ---- 알림 설정 ----
function getNotifications() {
    return readJson(NOTIFICATIONS_FILE, {});
}

function saveNotifications(obj) {
    writeJson(NOTIFICATIONS_FILE, obj);
    return obj;
}

// ---- 대상 프로필 ----
function getProfiles() {
    return readJson(PROFILES_FILE, []);
}

function saveProfiles(list) {
    writeJson(PROFILES_FILE, list);
    return list;
}

ensureStore();

module.exports = {
    getHistory,
    addRecord,
    deleteRecord,
    getForbiddenWords,
    saveForbiddenWords,
    getKeywordLists,
    saveKeywordLists,
    getSchedules,
    saveSchedules,
    getNotifications,
    saveNotifications,
    getProfiles,
    saveProfiles,
};
