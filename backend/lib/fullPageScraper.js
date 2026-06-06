// 네이버 통합검색 SERP 전체 파싱 — 파워링크(유료광고) + 플레이스(지역매장)
const cheerio = require('cheerio');
const { defaultHeaders } = require('./naverClient');

const NAVER_SEARCH = 'https://search.naver.com/search.naver';

// 파워링크 컨테이너 셀렉터 (순서대로 시도)
const PL_CONTAINERS = [
  '[class*="power_link"]',
  '[class*="ad_area"]',
  '[class*="lst_ad"]',
];

// 플레이스 컨테이너 셀렉터 (CSS 폴백용)
const PLACE_CONTAINERS = [
  '[class*="splace"]',
  '[class*="place_area"]',
  '[class*="place_section"]',
  '[class*="local"]',
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

/**
 * HTML에서 AttractionListItem 배열을 순서대로 추출
 * 통합검색·플레이스 탭 공통 — Naver Apollo GraphQL 캐시 파싱
 */
function extractAttractionItems(html) {
  const itemsMatch = html.match(/"items"\s*:\s*\[([^\]]*AttractionListItem[^\]]*)\]/);
  if (!itemsMatch) return [];

  const idOrder = [];
  const refPattern = /"__ref"\s*:\s*"AttractionListItem:(\d+)"/g;
  let m;
  while ((m = refPattern.exec(itemsMatch[1])) !== null) idOrder.push(m[1]);
  if (idOrder.length === 0) return [];

  return idOrder.map((id, i) => {
    const prefix = `"AttractionListItem:${id}":`;
    const start = html.indexOf(prefix);
    if (start < 0) return null;
    const segment = html.slice(start, start + 600);

    const nm = segment.match(/"name"\s*:\s*"([^"]+)"/);
    if (!nm) return null;
    const name = nm[1];

    // placeId 추출 (id 필드)
    const idM = segment.match(/"id"\s*:\s*"(\d+)"/);
    const placeId = idM ? idM[1] : id;

    // 광고 여부: adType 또는 isAd 필드
    const isAdM = segment.match(/"(?:adType|isAd|adFlag)"\s*:\s*(?:"([^"]*)"|(true))/);
    const isAd = !!(isAdM && (isAdM[1] || isAdM[2]));

    // 별점·리뷰
    const ratingM = segment.match(/"(?:avgRating|starScore|rating)"\s*:\s*"?([\d.]+)"?/);
    const rating = ratingM ? parseFloat(ratingM[1]) : null;

    const reviewM = segment.match(/"visitorReviewCount"\s*:\s*"([\d,]+)"/);
    const reviewCount = reviewM ? parseInt(reviewM[1].replace(/,/g, ''), 10) : null;

    return { rank: i + 1, name, placeId, isAd, rating, reviewCount };
  }).filter(Boolean);
}

function parsePlaces($, html) {
  // 1차: JSON 파싱 (신뢰도 높음)
  if (html) {
    const jsonItems = extractAttractionItems(html);
    if (jsonItems.length > 0) return jsonItems;
  }

  // 2차 폴백: CSS 셀렉터 (구형 호환)
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
      const m = ($(a).attr('href') || '').match(/\/(?:place|entry\/place)\/(\d+)/);
      if (m) { placeId = m[1]; return false; }
    });

    const ratingText = $el.find('[class*="star"], [class*="rating"], [class*="avg"]').first().text().trim();
    const rating = parseFloat(ratingText) || null;
    const reviewText = $el.find('[class*="review"], [class*="cnt"], [class*="count"]').first().text().trim();
    const reviewMatch = reviewText.match(/[\d,]+/);
    const reviewCount = reviewMatch ? parseInt(reviewMatch[0].replace(/,/g, ''), 10) : null;

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
  const html = await res.text();
  const $ = cheerio.load(html);
  return { powerLinkItems: parsePowerLinks($), placeItems: parsePlaces($, html) };
}

module.exports = { scrapeFullPage, parsePowerLinks, parsePlaces, extractDomain, extractAttractionItems };
