import React from 'react';

// 스캔 진행률 표시 (업체명/ID 패널 공용)
function ScanProgress({ progress, currentKeyword, statusText }) {
  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="progress-panel">
      <div className="progress-header">
        <span>{statusText === 'deep_searching' ? '블로그 탭 딥 서치 중...' : '검색결과 수집 중...'}</span>
        <span>{progress.current} / {progress.total} ({progressPercent}%)</span>
      </div>

      <div className="progress-bar-bg">
        <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="progress-keyword-status pulse">
        {currentKeyword ? `키워드: "${currentKeyword}"` : '준비 중...'}
      </div>
    </div>
  );
}

export default ScanProgress;
