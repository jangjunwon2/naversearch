// adplaceScanEngine 매칭 로직 단위 테스트
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { matchPowerLink, matchPlace } = require('../adplaceScanEngine');

const plItems = [
  { rank: 1, title: '경쟁사A', domain: 'competitor-a.com', url: 'https://competitor-a.com/' },
  { rank: 2, title: '홍길동치과 강남점', domain: 'hgd-dental.com', url: 'https://hgd-dental.com/' },
  { rank: 3, title: '다른업체', domain: 'other.com', url: 'https://other.com/' },
];

const placeItems = [
  { rank: 1, name: '경쟁매장', placeId: '11111', rating: 4.2, reviewCount: 100 },
  { rank: 2, name: '홍길동치과', placeId: '22222', rating: 4.8, reviewCount: 312 },
  { rank: 3, name: '다른매장', placeId: '33333', rating: 3.9, reviewCount: 50 },
];

describe('matchPowerLink', () => {
  test('도메인으로 매칭한다', () => {
    assert.equal(matchPowerLink(plItems, { name: '', domain: 'hgd-dental.com' }).rank, 2);
  });

  test('업체명 부분 일치로 매칭한다', () => {
    assert.equal(matchPowerLink(plItems, { name: '홍길동치과', domain: '' }).rank, 2);
  });

  test('도메인이 업체명보다 우선한다', () => {
    const conflict = [
      { rank: 1, title: '홍길동치과', domain: 'wrong.com' },
      { rank: 2, title: '다른업체', domain: 'hgd-dental.com' },
    ];
    assert.equal(matchPowerLink(conflict, { name: '홍길동치과', domain: 'hgd-dental.com' }).rank, 2);
  });

  test('공백 무시 매칭', () => {
    assert.equal(matchPowerLink(plItems, { name: '홍 길 동 치 과', domain: '' }).rank, 2);
  });

  test('매칭 없으면 null', () => {
    assert.equal(matchPowerLink(plItems, { name: '없는업체', domain: '' }), null);
  });
});

describe('matchPlace', () => {
  test('placeId로 정확히 매칭한다', () => {
    assert.equal(matchPlace(placeItems, { name: '', placeId: '22222' }).rank, 2);
  });

  test('업체명 부분 일치로 매칭한다', () => {
    assert.equal(matchPlace(placeItems, { name: '홍길동', placeId: '' }).rank, 2);
  });

  test('placeId가 업체명보다 우선한다', () => {
    const conflict = [
      { rank: 1, name: '홍길동치과', placeId: '11111' },
      { rank: 2, name: '다른매장', placeId: '22222' },
    ];
    assert.equal(matchPlace(conflict, { name: '홍길동치과', placeId: '22222' }).rank, 2);
  });

  test('매칭 없으면 null', () => {
    assert.equal(matchPlace(placeItems, { name: '없는매장', placeId: '' }), null);
  });
});
