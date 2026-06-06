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

// 전체 매칭 항목 반환 — 광고·일반 모두 수집 (같은 업체가 두 번 나오는 경우 대응)
function matchAllPlaces(items, identifiers) {
  const normTarget = normalize(identifiers.name);

  if (identifiers.placeId) {
    const byId = items.filter((item) => item.placeId === identifiers.placeId);
    if (byId.length > 0) return byId;
  }
  if (normTarget) {
    return items.filter((item) => {
      if (!item.name) return false;
      const n = normalize(item.name);
      return n.includes(normTarget) || normTarget.includes(n);
    });
  }
  return [];
}

// 하위 호환 — 첫 번째 매칭 반환
function matchPlace(items, identifiers) {
  return matchAllPlaces(items, identifiers)[0] || null;
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
        const matchedPlaces = matchAllPlaces(placeItems, identifiers);
        const adPlace = matchedPlaces.find((p) => p.isAd) || null;
        const organicPlace = matchedPlaces.find((p) => !p.isAd) || null;
        const bestPlace = adPlace || organicPlace;

        // 플레이스 탭 딥서치 — 통합검색 노출 여부와 무관하게 항상 실행
        const tabSearch = await scrapePlaceTab(keyword, identifiers);

        keywordResult = {
          keyword,
          powerLink: matchedPL
            ? { exposed: true, rank: matchedPL.rank, totalAds: powerLinkItems.length, title: matchedPL.title, url: matchedPL.url }
            : { exposed: false, rank: null, totalAds: powerLinkItems.length, title: null, url: null },
          place: bestPlace
            ? {
                exposed: true,
                rank: bestPlace.rank,
                adRank: adPlace?.rank ?? null,
                organicRank: organicPlace?.rank ?? null,
                totalPlaces: placeItems.length,
                name: bestPlace.name,
                isAd: bestPlace.isAd,
                rating: bestPlace.rating,
                reviewCount: bestPlace.reviewCount,
                tabSearch,
              }
            : { exposed: false, rank: null, adRank: null, organicRank: null, totalPlaces: placeItems.length, name: null, isAd: false, rating: null, reviewCount: null, tabSearch },
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
