// 플레이스 탭 딥서치 — 통합검색 미노출 시 Naver 플레이스 탭 내 페이지·순위 탐색
// Naver 플레이스 탭은 Apollo GraphQL 캐시를 script 태그에 임베딩하므로 JSON 파싱으로 추출
const { defaultHeaders, sleep } = require('./naverClient');

const NAVER_SEARCH = 'https://search.naver.com/search.naver';
const ITEMS_PER_PAGE = 15;

function normalize(str) { return (str || '').replace(/\s/g, '').toLowerCase(); }

/**
 * HTML에서 AttractionListItem 배열을 순서대로 추출
 * - "items":[{"__ref":"AttractionListItem:ID"},...] → 표시 순서
 * - "AttractionListItem:ID":{..."name":"NAME"...} → 이름 매핑
 */
function extractAttractionItems(html) {
  // 1. "items" 배열에서 ID 순서 추출 (AttractionListItem __ref 포함된 것만)
  const itemsMatch = html.match(/"items"\s*:\s*\[([^\]]*AttractionListItem[^\]]*)\]/);
  if (!itemsMatch) return [];

  const idOrder = [];
  const refPattern = /"__ref"\s*:\s*"AttractionListItem:(\d+)"/g;
  let m;
  while ((m = refPattern.exec(itemsMatch[1])) !== null) {
    idOrder.push(m[1]);
  }
  if (idOrder.length === 0) return [];

  // 2. 각 ID의 이름 추출 ("AttractionListItem:ID":{..."name":"NAME"...})
  return idOrder.map((id, i) => {
    const prefix = `"AttractionListItem:${id}":`;
    const start = html.indexOf(prefix);
    let name = null;
    if (start >= 0) {
      const segment = html.slice(start, start + 600);
      const nm = segment.match(/"name"\s*:\s*"([^"]+)"/);
      if (nm) name = nm[1];
    }
    return name ? { rank: i + 1, placeId: id, name } : null;
  }).filter(Boolean);
}

function matchItem(item, identifiers) {
  if (identifiers.placeId && item.placeId === identifiers.placeId) return true;
  if (identifiers.name) {
    const normTarget = normalize(identifiers.name);
    const normName = normalize(item.name);
    // 양방향 부분 일치: 어느 쪽이 다른 쪽에 포함되면 매칭
    if (normName.includes(normTarget) || normTarget.includes(normName)) return true;
  }
  return false;
}

async function scrapePlaceTab(keyword, identifiers, maxPages = 5) {
  for (let page = 1; page <= maxPages; page++) {
    const start = (page - 1) * ITEMS_PER_PAGE + 1;
    const url = `${NAVER_SEARCH}?where=place&query=${encodeURIComponent(keyword)}&start=${start}`;

    try {
      const res = await fetch(url, { headers: defaultHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();

      const items = extractAttractionItems(html);
      console.log(`[placeTab] "${keyword}" 페이지 ${page}: ${items.length}개 항목`);

      if (items.length === 0) break; // 더 이상 결과 없음

      for (let i = 0; i < items.length; i++) {
        if (matchItem(items[i], identifiers)) {
          const position = i + 1;
          console.log(`[placeTab] 매칭: "${items[i].name}" → 페이지 ${page}, ${position}번째`);
          return {
            found: true,
            page,
            position,
            overallRank: (page - 1) * ITEMS_PER_PAGE + position,
          };
        }
      }
    } catch (err) {
      console.error(`[placeTab] 오류 (페이지 ${page}):`, err.message);
    }

    if (page < maxPages) await sleep(1000 + Math.random() * 1000);
  }

  return { found: false, page: null, position: null, overallRank: null };
}

module.exports = { scrapePlaceTab, extractAttractionItems };
