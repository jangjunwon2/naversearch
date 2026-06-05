import React, { useState } from 'react';
import { Play, Square, Info } from 'lucide-react';
import ScanProgress from './ScanProgress';
import KeywordListControls from './KeywordListControls';

// 기능2: ID별 순위 체크 입력 패널
function IdScanPanel({ onStartScan, onCancelScan, isScanning, progress, currentKeyword, statusText }) {
  const [keywordInput, setKeywordInput] = useState('광주 방탈출\n광주 방탈출 카페\n충장로 방탈출\n광주 데이트코스');
  const [userId, setUserId] = useState('cjh2748');
  const [maxPages, setMaxPages] = useState(5);

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
    if (!userId.trim()) {
      alert('작성자 ID를 입력해주세요.');
      return;
    }

    onStartScan('id', { keywords, userId: userId.trim(), maxPages: parseInt(maxPages) || 5 });
  };

  return (
    <div className="glass-card">
      <h3 className="panel-title">📝 ID별 순위 체크</h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
        특정 작성자 ID의 글이 통합검색에서 몇 위인지, 미노출이면 블로그 탭 몇 페이지 몇 번째인지 추적합니다.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="id-keywords">
            검색 키워드 리스트 <span>(한 줄에 하나씩 입력)</span>
          </label>
          <textarea
            id="id-keywords"
            className="form-input form-textarea"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            disabled={isScanning}
            placeholder="예:&#10;광주 방탈출&#10;광주 방탈출 카페"
          />
        </div>

        <KeywordListControls keywordText={keywordInput} onLoadText={setKeywordInput} disabled={isScanning} />

        <div className="form-group">
          <label htmlFor="userId">작성자 ID</label>
          <input
            id="userId"
            type="text"
            className="form-input"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={isScanning}
            placeholder="예: cjh2748"
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.1rem' }}>
            <Info size={12} style={{ color: 'var(--accent-green)' }} /> 스마트블록 + 블로그 탭 다중 노출 위치 추적
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="maxPages">
            블로그 탭 최대 검색 페이지 수 <span>(기본: 5페이지, 최대 300위)</span>
          </label>
          <input
            id="maxPages"
            type="number"
            min="1"
            max="10"
            className="form-input"
            value={maxPages}
            onChange={(e) => setMaxPages(e.target.value)}
            disabled={isScanning}
          />
        </div>

        {!isScanning ? (
          <button type="submit" className="btn-primary">
            <Play size={18} /> ID 순위 조회
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

export default IdScanPanel;
