// 플레이스 탭 딥서치 — 광고 포함 실제 표시 순서 기준 페이지·위치 탐색
//
// Naver 플레이스 탭(isNxPc) 레이아웃 상수 (JS 번들 place.9782 기준):
//   유기 결과 페이지당: [5, 5, 6, 6, 6, ...]
//   광고 페이지당:      [3, 3, 2, 2, 2, ...]
//   결합 순서: 각 페이지마다 [광고들, 유기들] 순서로 배치
const { defaultHeaders, sleep } = require('./naverClient');

const NAVER_SEARCH = 'https://search.naver.com/search.naver';
const PCMAP_GRAPHQL = 'https://pcmap-api.place.naver.com/graphql';

// 네이버 플레이스 탭 NxPc 레이아웃 상수 (JS 번들에서 추출)
const ORGANICS_PER_PAGE = [5, 5, 6, 6, 6]; // ie
const ADS_PER_PAGE     = [3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]; // F

const ATTRACTION_LIST_QUERY = `
  query attractionList($input: AttractionsInput, $businessesInput: AttractionsBusinessesInput) {
    attractions(input: $input) {
      businesses(input: $businessesInput) {
        total
        items { id name }
      }
    }
  }
`;

function normalize(str) { return (str || '').replace(/\s/g, '').toLowerCase(); }

function matchItem(item, identifiers) {
  if (identifiers.placeId && item.id === identifiers.placeId) return true;
  if (identifiers.name) {
    const normTarget = normalize(identifiers.name);
    const normName = normalize(item.name || '');
    if (normName.includes(normTarget) || normTarget.includes(normName)) return true;
  }
  return false;
}

/** attractions Apollo 쿼리 파라미터 추출 (역슬래시 이스케이프된 JSON 키) */
function extractAttractionsInput(html) {
  const m = html.match(/"attractions\((\{\\?"input\\?":\{[\s\S]{1,600}?\})\)"/);
  if (!m) return null;
  try {
    const raw = m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    return JSON.parse(raw).input || null;
  } catch { return null; }
}

/** AttractionAdSummary ID 목록을 표시 순서대로 추출 (HTML SSR 포함) */
function extractAdIds(html) {
  const match = html.match(/"items"\s*:\s*\[([^\]]*AttractionAdSummary[^\]]*)\]/);
  if (!match) return [];
  const ids = [];
  const pattern = /"__ref"\s*:\s*"AttractionAdSummary:(\d+)"/g;
  let m;
  while ((m = pattern.exec(match[1])) !== null) ids.push(m[1]);
  return ids;
}

/** 좌표 추출 */
function extractCoordinates(html) {
  const xm = html.match(/"x"\s*:\s*"(\d{3}\.\d+)"/);
  const ym = html.match(/"y"\s*:\s*"(\d{2}\.\d+)"/);
  return { x: xm?.[1], y: ym?.[1] };
}

/**
 * 배열을 pageSizes에 따라 페이지 단위로 분할.
 * pageSizes 범위를 초과하면 마지막 값을 계속 사용 (무한 확장).
 * VD([a,b,c,d,e,f,g], [3,4]) → [[a,b,c],[d,e,f,g]]
 */
function chunkByPageSizes(arr, pageSizes) {
  const lastSize = pageSizes[pageSizes.length - 1] ?? 2;
  const result = [];
  let idx = 0;
  let p = 0;
  while (idx < arr.length) {
    const size = p < pageSizes.length ? pageSizes[p] : lastSize;
    result.push(arr.slice(idx, idx + size));
    idx += size;
    p++;
  }
  return result;
}

/**
 * 결합 목록에서 위치 계산
 * adIds: 광고 ID 배열 (표시 순서)
 * organicItems: 유기 결과 배열 (표시 순서, { id, name })
 * 반환: { organicRank, adRank?, combinedPage, combinedPosition, adPage?, adPosition? }
 */
function calcCombinedPosition(adIds, organicItems, matchedOrganic) {
  const organicRank = organicItems.indexOf(matchedOrganic) + 1;
  const adRankIdx = adIds.indexOf(matchedOrganic.id); // 광고 목록에도 있는지
  const adRank = adRankIdx >= 0 ? adRankIdx + 1 : null;

  // 유기 결과 → 페이지/위치
  const organicPages = chunkByPageSizes(organicItems, ORGANICS_PER_PAGE);
  const adPages = chunkByPageSizes(adIds, ADS_PER_PAGE);

  let organicPageIdx = -1;
  let organicPosWithinPage = -1;
  {
    let cum = 0;
    for (let pi = 0; pi < organicPages.length; pi++) {
      const pg = organicPages[pi];
      if (organicRank <= cum + pg.length) {
        organicPageIdx = pi;
        organicPosWithinPage = organicRank - cum; // 1-based
        break;
      }
      cum += pg.length;
    }
  }

  const adsOnOrganicPage = (adPages[organicPageIdx] || []).length;
  const combinedPage = organicPageIdx + 1;
  const combinedPosition = adsOnOrganicPage + organicPosWithinPage;

  // 광고 결과 → 페이지/위치 (있을 경우)
  let adPage = null;
  let adPosition = null;
  if (adRank !== null) {
    let cum = 0;
    for (let pi = 0; pi < adPages.length; pi++) {
      const pg = adPages[pi];
      if (adRank <= cum + pg.length) {
        adPage = pi + 1;
        adPosition = adRank - cum; // 페이지 내 광고 위치
        break;
      }
      cum += pg.length;
    }
  }

  return { organicRank, adRank, combinedPage, combinedPosition, adPage, adPosition };
}

async function scrapePlaceTab(keyword, identifiers) {
  // 1. 초기 HTML로 attraction input, 광고 ID, 좌표 추출
  const initUrl = `${NAVER_SEARCH}?where=place&query=${encodeURIComponent(keyword)}`;
  const initRes = await fetch(initUrl, { headers: defaultHeaders() });
  if (!initRes.ok) throw new Error(`초기 HTML 요청 실패: ${initRes.status}`);
  const html = await initRes.text();

  const attractionsInput = extractAttractionsInput(html);
  const adIds = extractAdIds(html);
  const { x, y } = extractCoordinates(html);

  console.log(`[placeTab] "${keyword}" adIds(${adIds.length}):`, adIds);
  console.log(`[placeTab] attractionsInput:`, attractionsInput);

  await sleep(800 + Math.random() * 600);

  // 2. GraphQL로 전체 유기 결과 조회
  const payload = [{
    operationName: 'attractionList',
    variables: {
      input: attractionsInput || { query: keyword },
      businessesInput: { start: 1, display: 100, isNx: true, x, y },
    },
    query: ATTRACTION_LIST_QUERY,
  }];

  const gqlRes = await fetch(PCMAP_GRAPHQL, {
    method: 'POST',
    headers: {
      ...defaultHeaders(),
      'content-type': 'application/json',
      'referer': 'https://pcmap.place.naver.com/',
      'origin': 'https://pcmap.place.naver.com',
    },
    body: JSON.stringify(payload),
  });
  if (!gqlRes.ok) throw new Error(`GraphQL 요청 실패: ${gqlRes.status}`);
  const json = await gqlRes.json();
  const businesses = json[0]?.data?.attractions?.businesses;

  if (!businesses) {
    console.error('[placeTab] GraphQL 응답 이상:', JSON.stringify(json[0]).slice(0, 300));
    return { found: false };
  }

  const organicItems = businesses.items || [];
  const total = businesses.total || organicItems.length;
  console.log(`[placeTab] "${keyword}" 유기 ${total}개 / 광고 ${adIds.length}개`);

  // 3. 유기 결과에서 매칭 검색
  const matchedOrganic = organicItems.find(item => matchItem(item, identifiers));
  if (!matchedOrganic) {
    console.log(`[placeTab] "${keyword}" 미발견 (유기 ${total}개 / 광고 ${adIds.length}개)`);
    return { found: false, total };
  }

  // 4. 결합 위치 계산
  const pos = calcCombinedPosition(adIds, organicItems, matchedOrganic);

  console.log(
    `[placeTab] 매칭: "${matchedOrganic.name}" → 유기 ${pos.organicRank}위` +
    (pos.adRank ? ` / 광고 ${pos.adRank}위` : '') +
    ` → 결합 ${pos.combinedPage}페이지 ${pos.combinedPosition}번째` +
    (pos.adPage ? ` (광고: ${pos.adPage}페이지 ${pos.adPosition}번째)` : '')
  );

  return {
    found: true,
    organicRank: pos.organicRank,
    adRank: pos.adRank,
    page: pos.combinedPage,
    position: pos.combinedPosition,
    overallRank: pos.organicRank, // 하위호환
    adPage: pos.adPage,
    adPosition: pos.adPosition,
    total,
  };
}

module.exports = { scrapePlaceTab };
