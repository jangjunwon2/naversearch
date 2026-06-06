// 네이버 통합검색 SERP 전체 파싱 — 파워링크(유료광고) + 플레이스(지역매장)
const cheerio = require('cheerio');
const { defaultHeaders } = require('./naverClient');

const NAVER_SEARCH = 'https://search.naver.com/search.naver';

// 파워링크 컨테이너 셀렉터 (순서대로 시도, 첫 매칭 사용)
const PL_CONTAINERS = [
  '[class*="power_link"]',
  '[class*="ad_area"]',
  '[class*="lst_ad"]',
];

// 플레이스 컨테이너 셀렉터
const PLACE_CONTAINERS = [
  '[class*="splace"]',
  '[class*="place_area"]',
  '[class*="place_section"]',
];

function extractDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function parsePowerLinks($) {
  const items = [];
  let container = null;
  for (const sel of PL_CONTAINERS) {
    const el = $(sel).first();
    if (el.length) { container = el; break; }
  }
  if (!container || !container.length) return items;

  container.find('li').each((_, el) => {
    const $el = $(el);
    const titleEl = $el.find('a[class*="tit"], a[class*="title"], strong a, a').first();
    const title = titleEl.text().trim();
    if (!title) return;
    let url = titleEl.attr('data-href') || titleEl.attr('href') || '';
    if (url.startsWith('/')) url = 'https://search.naver.com' + url;
    const desc = $el.find('[class*="desc"], [class*="dsc"], p').first().text().trim() || null;
    items.push({ rank: items.length + 1, title, description: desc, url: url || null, domain: extractDomain(url) });
  });
  return items;
}

function parsePlaces($) {
  const items = [];
  let container = null;
  for (const sel of PLACE_CONTAINERS) {
    const el = $(sel).first();
    if (el.length) { container = el; break; }
  }
  if (!container || !container.length) return items;

  container.find('li').each((_, el) => {
    const $el = $(el);
    const nameEl = $el.find('[class*="place_bluelink"], [class*="name"], a[class*="title"], a').first();
    const name = nameEl.text().trim();
    if (!name) return;

    let placeId = null;
    $el.find('a').each((__, a) => {
      const m = ($(a).attr('href') || '').match(/\/place\/(\d+)/);
      if (m) { placeId = m[1]; return false; }
    });

    const ratingText = $el.find('[class*="star"], [class*="rating"], [class*="avg"]').first().text().trim();
    const rating = parseFloat(ratingText) || null;
    const reviewText = $el.find('[class*="review"], [class*="cnt"], [class*="count"]').first().text().trim();
    const reviewMatch = reviewText.match(/[\d,]+/);
    const reviewCount = reviewMatch ? parseInt(reviewMatch[0].replace(/,/g, ''), 10) : null;

    // 광고 여부: 클래스에 ad 포함하는 뱃지 또는 텍스트 "광고" 감지
    const isAd = $el.find('[class*="ad_label"], [class*="badge_ad"], [class*="sp_ad"], [class*="ad_badge"]').length > 0
      || $el.find('em, span').filter((_, e) => $(e).text().trim() === '광고').length > 0;

    items.push({ rank: items.length + 1, name, placeId, rating, reviewCount, isAd });
  });
  return items;
}

async function scrapeFullPage(keyword) {
  const url = `${NAVER_SEARCH}?query=${encodeURIComponent(keyword)}`;
  const res = await fetch(url, { headers: defaultHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${keyword}`);
  const $ = cheerio.load(await res.text());
  return { powerLinkItems: parsePowerLinks($), placeItems: parsePlaces($) };
}

module.exports = { scrapeFullPage, parsePowerLinks, parsePlaces, extractDomain };
