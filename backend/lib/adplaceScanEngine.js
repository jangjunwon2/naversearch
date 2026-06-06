// 파워링크·플레이스 스캔 엔진 — SSE 진행률 + 매칭 로직
// scanEngine.js 와 동일한 인터페이스를 구현해 /api/scan/progress SSE 핸들러를 공유한다.
const { scrapeFullPage } = require('./fullPageScraper');
const { scrapePlaceTab } = require('./placeTabScraper');
const { sleep } = require('./naverClient');
const store = require('./store');

const MIN_DELAY = 1500;
const RAND_DELAY = 1500;

// 진행 중인 스캔 관리 (취소·SSE 클라이언트 보관)
const activeScans = new Map();

function createScan(total) {
  const scanId = 'adplace_' + Date.now();
  activeScans.set(scanId, { cancelled: false, total, client: null });
  return scanId;
}

function hasScan(scanId) { return activeScans.has(scanId); }
function getScan(scanId) { return activeScans.get(scanId); }
function attachClient(scanId, res) { const s = activeScans.get(scanId); if (s) s.client = res; }
function detachClient(scanId) { const s = activeScans.get(scanId); if (s) s.client = null; }
function cancelScan(scanId) {
  const s = activeScans.get(scanId);
  if (!s) return false;
  s.cancelled = true;
  return true;
}

function normalize(str) { return (str || '').replace(/\s/g, '').toLowerCase(); }

function matchPowerLink(items, identifiers) {
  const cleanDomain = (identifiers.domain || '').replace(/^www\./, '');
  // 1패스: 도메인 일치 (최우선)
  if (cleanDomain) {
    for (const item of items) {
      if (item.domain && item.domain.includes(cleanDomain)) return item;
    }
  }
  // 2패스: 업체명 부분 일치
  if (identifiers.name) {
    const normName = normalize(identifiers.name);
    for (const item of items) {
      if (item.title && normalize(item.title).includes(normName)) return item;
    }
  }
  return null;
}

function matchPlace(items, identifiers) {
  // 1패스: placeId 완전 일치 (최우선)
  if (identifiers.placeId) {
    for (const item of items) {
      if (item.placeId === identifiers.placeId) return item;
    }
  }
  // 2패스: 업체명 부분 일치
  if (identifiers.name) {
    const normName = normalize(identifiers.name);
    for (const item of items) {
      if (item.name && normalize(item.name).includes(normName)) return item;
    }
  }
  return null;
}

async function runScan(scanId, { keywords, identifiers }) {
  const scanObj = activeScans.get(scanId);
  if (!scanObj) return;
  const results = [];
  const sendSSE = (data) => { if (scanObj.client) scanObj.client.write(`data: ${JSON.stringify(data)}\n\n`); };

  try {
    for (let i = 0; i < keywords.length; i++) {
      if (scanObj.cancelled) {
        sendSSE({ type: 'cancelled', message: '스캔이 중단되었습니다.' });
        activeScans.delete(scanId);
        return;
      }
      const keyword = keywords[i];
      sendSSE({ type: 'progress', current: i + 1, total: keywords.length, keyword, status: 'scanning' });

      let keywordResult;
      try {
        const { powerLinkItems, placeItems } = await scrapeFullPage(keyword);
        const matchedPL = matchPowerLink(powerLinkItems, identifiers);
        const matchedPlace = matchPlace(placeItems, identifiers);

        // 플레이스 미노출 시 탭 딥서치
        let tabSearch = null;
        if (!matchedPlace) {
          tabSearch = await scrapePlaceTab(keyword, identifiers, 3);
        }

        keywordResult = {
          keyword,
          powerLink: matchedPL
            ? { exposed: true, rank: matchedPL.rank, totalAds: powerLinkItems.length, title: matchedPL.title, url: matchedPL.url }
            : { exposed: false, rank: null, totalAds: powerLinkItems.length, title: null, url: null },
          place: matchedPlace
            ? { exposed: true, rank: matchedPlace.rank, totalPlaces: placeItems.length, name: matchedPlace.name, isAd: matchedPlace.isAd, rating: matchedPlace.rating, reviewCount: matchedPlace.reviewCount, tabSearch: null }
            : { exposed: false, rank: null, totalPlaces: placeItems.length, name: null, isAd: false, rating: null, reviewCount: null, tabSearch },
        };
        sendSSE({ type: 'keyword_scanned', current: i + 1, total: keywords.length, keyword, result: keywordResult });
      } catch (err) {
        console.error(`파워링크/플레이스 스캔 오류 "${keyword}":`, err.message);
        keywordResult = {
          keyword,
          powerLink: { exposed: false, rank: null, totalAds: 0, title: null, url: null },
          place: { exposed: false, rank: null, totalPlaces: 0, name: null, rating: null, reviewCount: null },
        };
        sendSSE({ type: 'keyword_error', current: i + 1, total: keywords.length, keyword, error: err.message });
      }
      results.push(keywordResult);
      if (i < keywords.length - 1) await sleep(MIN_DELAY + Math.random() * RAND_DELAY);
    }

    const record = {
      id: scanId,
      scanType: 'adplace',
      timestamp: new Date().toISOString(),
      identifiers,
      keywordsCount: keywords.length,
      results,
    };
    store.addRecord(record);
    sendSSE({ type: 'complete', record });
  } catch (error) {
    console.error('광고/플레이스 스캔 치명적 오류:', error);
    sendSSE({ type: 'error', message: error.message });
  } finally {
    if (scanObj.client) scanObj.client.end();
    activeScans.delete(scanId);
  }
}

module.exports = { createScan, hasScan, getScan, attachClient, detachClient, cancelScan, runScan, matchPowerLink, matchPlace };
