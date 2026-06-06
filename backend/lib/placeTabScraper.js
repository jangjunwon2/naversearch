// 플레이스 탭 딥서치 — 통합검색 플레이스 블록 미노출 시 탭 내 페이지·순위 탐색
// blogTab.js 와 동일한 구조, 플레이스 탭(where=place) 대상
const cheerio = require('cheerio');
const { defaultHeaders, sleep } = require('./naverClient');

const NAVER_SEARCH = 'https://search.naver.com/search.naver';
const ITEMS_PER_PAGE = 15; // 플레이스 탭 페이지당 기본 항목 수

// 플레이스 탭 아이템 셀렉터 (순서대로 시도, 첫 매칭 사용)
const ITEM_SELECTORS = [
  '[class*="place_item"]',
  '[class*="place_unit"]',
  '.place_list li',
  'li[class*="item"]',
];

// 업체명/placeId 정규화 함수
function normalize(str) { return (str || '').replace(/\s/g, '').toLowerCase(); }

function extractPlaceId($el, $) {
  let placeId = null;
  $el.find('a').each((_, a) => {
    const m = ($(a).attr('href') || '').match(/\/place\/(\d+)/);
    if (m) { placeId = m[1]; return false; }
  });
  return placeId;
}

function matchItem($el, $, identifiers) {
  const name = $el.find('[class*="place_bluelink"], [class*="name"], a').first().text().trim();
  const placeId = extractPlaceId($el, $);

  if (identifiers.placeId && placeId === identifiers.placeId) return true;
  if (identifiers.name && normalize(name).includes(normalize(identifiers.name))) return true;
  return false;
}

async function scrapePlaceTab(keyword, identifiers, maxPages = 3) {
  for (let page = 1; page <= maxPages; page++) {
    const start = (page - 1) * ITEMS_PER_PAGE + 1;
    const url = `${NAVER_SEARCH}?where=place&query=${encodeURIComponent(keyword)}&start=${start}`;

    try {
      const res = await fetch(url, { headers: defaultHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const $ = cheerio.load(await res.text());

      for (const sel of ITEM_SELECTORS) {
        const items = $(sel);
        if (!items.length) continue;

        let found = null;
        items.each((i, el) => {
          if (found) return false;
          if (matchItem($(el), $, identifiers)) {
            const position = i + 1;
            found = {
              found: true,
              page,
              position,
              overallRank: (page - 1) * ITEMS_PER_PAGE + position,
            };
          }
        });

        if (found) return found;
        break; // 첫 매칭 셀렉터에서 결과 없으면 다음 페이지로
      }
    } catch (err) {
      console.error(`플레이스 탭 검색 오류 (페이지 ${page}):`, err.message);
    }

    if (page < maxPages) await sleep(1000 + Math.random() * 1000);
  }

  return { found: false, page: null, position: null, overallRank: null };
}

module.exports = { scrapePlaceTab };
