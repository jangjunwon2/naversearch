// fullPageScraper 파싱 함수 단위 테스트
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const cheerio = require('cheerio');
const { parsePowerLinks, parsePlaces, extractDomain } = require('../fullPageScraper');

describe('extractDomain', () => {
  test('www를 제거하고 hostname 반환', () => {
    assert.equal(extractDomain('https://www.example.com/page'), 'example.com');
  });
  test('잘못된 URL이면 빈 문자열 반환', () => {
    assert.equal(extractDomain('not-a-url'), '');
  });
});

describe('parsePowerLinks', () => {
  test('순위·제목·도메인을 추출한다', () => {
    const html = `
      <div class="ad_area">
        <ul>
          <li><a class="link_tit" href="https://bizA.com/page">업체A</a><p class="desc">설명A</p></li>
          <li><a class="link_tit" href="https://bizB.com/">업체B</a></li>
        </ul>
      </div>`;
    const $ = cheerio.load(html);
    const items = parsePowerLinks($);
    assert.equal(items.length, 2);
    assert.equal(items[0].rank, 1);
    assert.equal(items[0].title, '업체A');
    assert.equal(items[0].domain, 'biza.com');
    assert.equal(items[0].description, '설명A');
    assert.equal(items[1].rank, 2);
    assert.equal(items[1].title, '업체B');
  });

  test('광고 블록 없으면 빈 배열 반환', () => {
    const $ = cheerio.load('<div class="organic">내용</div>');
    assert.deepEqual(parsePowerLinks($), []);
  });

  test('제목 없는 li는 건너뛴다', () => {
    const html = `
      <div class="power_link">
        <ul>
          <li><a></a></li>
          <li><a href="https://x.com">실제업체</a></li>
        </ul>
      </div>`;
    const $ = cheerio.load(html);
    const items = parsePowerLinks($);
    assert.equal(items.length, 1);
    assert.equal(items[0].title, '실제업체');
  });
});

describe('parsePlaces', () => {
  test('순위·업체명·placeId를 추출한다', () => {
    const html = `
      <div class="splace_section">
        <ul>
          <li><a class="place_bluelink" href="https://map.naver.com/v5/entry/place/12345">매장A</a></li>
          <li><a class="place_bluelink" href="https://map.naver.com/v5/entry/place/67890">매장B</a></li>
        </ul>
      </div>`;
    const $ = cheerio.load(html);
    const items = parsePlaces($);
    assert.equal(items.length, 2);
    assert.equal(items[0].rank, 1);
    assert.equal(items[0].name, '매장A');
    assert.equal(items[0].placeId, '12345');
    assert.equal(items[1].rank, 2);
    assert.equal(items[1].placeId, '67890');
  });

  test('플레이스 블록 없으면 빈 배열 반환', () => {
    const $ = cheerio.load('<div class="blog">내용</div>');
    assert.deepEqual(parsePlaces($), []);
  });

  test('별점과 리뷰 수를 파싱한다', () => {
    const html = `
      <div class="splace_section">
        <ul><li>
          <a class="place_bluelink" href="/place/111">카페X</a>
          <span class="star_score">4.5</span>
          <span class="review_cnt">리뷰 1,234</span>
        </li></ul>
      </div>`;
    const $ = cheerio.load(html);
    const [item] = parsePlaces($);
    assert.equal(item.rating, 4.5);
    assert.equal(item.reviewCount, 1234);
  });

  test('광고 뱃지가 있으면 isAd=true', () => {
    const html = `
      <div class="splace_section">
        <ul>
          <li><a class="place_bluelink" href="/place/111">광고업체</a><span class="ad_label">광고</span></li>
          <li><a class="place_bluelink" href="/place/222">일반업체</a></li>
        </ul>
      </div>`;
    const $ = cheerio.load(html);
    const items = parsePlaces($);
    assert.equal(items[0].isAd, true);
    assert.equal(items[1].isAd, false);
  });
});
