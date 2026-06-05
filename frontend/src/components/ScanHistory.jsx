import React from 'react';
import { Calendar, Download, Trash2, ArrowRight, Layers } from 'lucide-react';

function ScanHistory({ history, onLoadHistory, onDeleteHistory }) {
  
  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  if (!history || history.length === 0) {
    return (
      <div className="glass-card empty-state">
        <div className="empty-icon">📅</div>
        <h2>저장된 검색 히스토리가 없습니다.</h2>
        <p>조회된 검색 기록은 로컬 데이터베이스에 저장되어 언제든 다시 확인하실 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="history-list-container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className="section-header">
        <h2>최근 검색 히스토리 (최대 50개 저장)</h2>
      </div>

      <div className="history-list">
        {history.map((record) => (
          <div key={record.id} className="glass-card history-item">
            <div className="history-meta">
              <span className="history-date" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                <Calendar size={14} style={{ color: 'var(--accent-violet)' }} />
                {formatDate(record.timestamp)}
              </span>
              
              <div className="history-tags">
                {record.scanType === 'company' ? (
                  <span className="badge badge-rose" style={{ fontSize: '0.7rem' }}>📢 업체명 체크</span>
                ) : record.scanType === 'id' ? (
                  <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>📝 ID 순위</span>
                ) : null}

                <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>
                  <Layers size={10} /> 키워드 {record.keywordsCount}개
                </span>

                {(record.companyName || record.targetKeyword) && (
                  <span className="badge badge-rose" style={{ fontSize: '0.7rem' }}>
                    업체명: {record.companyName || record.targetKeyword}
                  </span>
                )}

                {(record.userId || record.blogId) && (
                  <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                    ID: {record.userId || record.blogId}
                  </span>
                )}
              </div>
            </div>

            <div className="history-actions">
              <button 
                type="button" 
                className="btn-secondary"
                onClick={() => onLoadHistory(record)}
              >
                결과 불러오기 <ArrowRight size={14} />
              </button>
              
              <a 
                href={`/api/export/${record.id}`} 
                download
                className="btn-secondary"
                style={{ textDecoration: 'none' }}
              >
                <Download size={14} /> 엑셀 다운로드
              </a>
              
              <button 
                type="button" 
                className="btn-secondary"
                style={{ color: 'var(--accent-rose)', borderColor: 'rgba(244, 63, 94, 0.2)' }}
                onClick={() => onDeleteHistory(record.id)}
              >
                <Trash2 size={14} /> 삭제
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ScanHistory;
