import React, { useState } from 'react';
import { Play, Square, Info } from 'lucide-react';
import ScanProgress from './ScanProgress';
import KeywordListControls from './KeywordListControls';

// 기능1: 업체명 체크 입력 패널
function CompanyScanPanel({ onStartScan, onCancelScan, isScanning, progress, currentKeyword, statusText }) {
  const [keywordInput, setKeywordInput] = useState('광주 방탈출\n광주 방탈출 카페\n충장로 방탈출\n광주 데이트코스');
  const [companyName, setCompanyName] = useState('이스케이프탑');

  const handleSubmit = (e) => {
    e.preventDefault();
    const keywords = keywordInput
      .split('\n')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (keywords.length === 0) {
      alert('최소 하나 이상의 검색어를 입력해주세요.');
      return;
    }
    if (!companyName.trim()) {
      alert('업체명을 입력해주세요.');
      return;
    }

    onStartScan('company', { keywords, companyName: companyName.trim() });
  };

  return (
    <div className="glass-card">
      <h3 className="panel-title">📢 업체명 체크</h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
        키워드별 통합검색에서 업체명이 포함된 게시물의 순위와, 카페 댓글·지식인 답글 내 업체명 언급 수를 집계합니다.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="company-keywords">
            검색 키워드 리스트 <span>(한 줄에 하나씩 입력)</span>
          </label>
          <textarea
            id="company-keywords"
            className="form-input form-textarea"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            disabled={isScanning}
            placeholder="예:&#10;광주 방탈출&#10;광주 방탈출 카페"
          />
        </div>

        <KeywordListControls keywordText={keywordInput} onLoadText={setKeywordInput} disabled={isScanning} />

        <div className="form-group">
          <label htmlFor="companyName">업체명 / 브랜드명</label>
          <input
            id="companyName"
            type="text"
            className="form-input"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            disabled={isScanning}
            placeholder="예: 이스케이프탑"
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.1rem' }}>
            <Info size={12} style={{ color: 'var(--accent-rose)' }} /> 글 내용 하이라이트 + 카페 댓글/지식인 답글 언급 수 확인
          </span>
        </div>

        {!isScanning ? (
          <button type="submit" className="btn-primary">
            <Play size={18} /> 업체명 순위 조회
          </button>
        ) : (
          <button type="button" className="btn-danger" onClick={onCancelScan}>
            <Square size={16} /> 스캔 중단
          </button>
        )}
      </form>

      {isScanning && <ScanProgress progress={progress} currentKeyword={currentKeyword} statusText={statusText} />}
    </div>
  );
}

export default CompanyScanPanel;
