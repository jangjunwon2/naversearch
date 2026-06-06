import React, { useState, useRef, useEffect } from 'react';

const PRESETS_KEY = 'adplace_kw_presets';

function loadPresets() {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]'); } catch { return []; }
}
function savePresets(presets) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

function rankColor(rank) {
  if (!rank) return '#9ca3af';
  if (rank <= 3) return '#16a34a';
  if (rank <= 10) return '#ca8a04';
  return '#6b7280';
}

function PowerLinkCell({ pl }) {
  if (!pl.exposed) return <span style={{ color: '#9ca3af', fontSize: '0.85em' }}>미노출</span>;
  return (
    <span style={{ color: rankColor(pl.rank), fontWeight: 'bold' }}>
      {pl.rank}위
      <span style={{ color: '#9ca3af', fontWeight: 'normal', fontSize: '0.78em', marginLeft: 4 }}>
        (총 {pl.totalAds}개)
      </span>
    </span>
  );
}

function PlaceCell({ pl }) {
  if (pl.exposed) {
    return (
      <div>
        <span style={{ color: rankColor(pl.rank), fontWeight: 'bold' }}>{pl.rank}위</span>
        <span style={{
          marginLeft: 6, fontSize: '0.75em', padding: '1px 5px', borderRadius: 3,
          background: pl.isAd ? '#fef3c7' : '#e0f2fe',
          color: pl.isAd ? '#92400e' : '#0369a1', fontWeight: 600,
        }}>
          {pl.isAd ? '광고' : '일반'}
        </span>
        <span style={{ color: '#9ca3af', fontWeight: 'normal', fontSize: '0.78em', marginLeft: 4 }}>
          (총 {pl.totalPlaces}개)
        </span>
      </div>
    );
  }
  const tab = pl.tabSearch;
  if (!tab) return <span style={{ color: '#9ca3af', fontSize: '0.85em' }}>미노출</span>;
  if (tab.found) {
    return (
      <div>
        <span style={{ color: '#9ca3af', fontSize: '0.85em' }}>미노출 (통합검색)</span>
        <div style={{ fontSize: '0.82em', marginTop: 2, color: '#6b7280' }}>
          탭 {tab.page}페이지 {tab.position}번째
          <span style={{ color: '#9ca3af', marginLeft: 4 }}>(전체 {tab.overallRank}위)</span>
        </div>
      </div>
    );
  }
  return (
    <div>
      <span style={{ color: '#9ca3af', fontSize: '0.85em' }}>미노출 (통합검색)</span>
      <div style={{ fontSize: '0.82em', marginTop: 2, color: '#9ca3af' }}>탭 5페이지 이내 미발견</div>
    </div>
  );
}

// 프리셋 저장 모달
function SavePresetModal({ onSave, onCancel }) {
  const [name, setName] = useState('');
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 10, padding: '24px 28px',
        minWidth: 280, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <p style={{ fontWeight: 600, marginBottom: 12 }}>프리셋 이름</p>
        <input
          className="form-input"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onSave(name.trim()); }}
          placeholder="예: 광주 방탈출 키워드"
          style={{ marginBottom: 16 }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onCancel} style={{ padding: '6px 14px' }}>취소</button>
          <button className="btn btn-primary" onClick={() => name.trim() && onSave(name.trim())} style={{ padding: '6px 14px' }}>저장</button>
        </div>
      </div>
    </div>
  );
}

export default function AdPlaceScanPanel() {
  const [keywordsText, setKeywordsText] = useState('');
  const [identifiers, setIdentifiers] = useState({ name: '', domain: '', placeId: '' });
  const [results, setResults] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentKeyword, setCurrentKeyword] = useState('');
  const [error, setError] = useState('');
  const [presets, setPresets] = useState(loadPresets);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const esRef = useRef(null);
  const scanIdRef = useRef(null);

  const updateId = (field) => (e) => setIdentifiers((prev) => ({ ...prev, [field]: e.target.value }));

  // 프리셋 저장
  const handleSavePreset = (presetName) => {
    const kws = keywordsText.trim();
    if (!kws) { setShowSaveModal(false); return; }
    const updated = [{ name: presetName, keywords: kws }, ...presets.filter(p => p.name !== presetName)];
    setPresets(updated);
    savePresets(updated);
    setShowSaveModal(false);
  };

  // 프리셋 불러오기
  const handleLoadPreset = (presetName) => {
    const preset = presets.find(p => p.name === presetName);
    if (preset) setKeywordsText(preset.keywords);
  };

  // 프리셋 삭제
  const handleDeletePreset = (presetName, e) => {
    e.stopPropagation();
    const updated = presets.filter(p => p.name !== presetName);
    setPresets(updated);
    savePresets(updated);
  };

  const handleStart = async () => {
    const keywords = keywordsText.split('\n').map((k) => k.trim()).filter(Boolean);
    if (!keywords.length) return setError('키워드를 입력하세요.');
    if (!identifiers.name.trim()) return setError('업체명은 필수입니다.');
    setError('');
    setResults([]);
    setIsScanning(true);
    setProgress({ current: 0, total: keywords.length });

    try {
      const res = await fetch('/api/scan/adplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, identifiers }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || '스캔 시작 실패');
      }
      const { scanId } = await res.json();
      scanIdRef.current = scanId;

      const es = new EventSource(`/api/scan/progress?scanId=${scanId}`);
      esRef.current = es;

      es.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'progress') {
          setCurrentKeyword(data.keyword);
          setProgress({ current: data.current - 1, total: data.total });
        } else if (data.type === 'keyword_scanned') {
          setResults((prev) => [...prev, data.result]);
          setProgress({ current: data.current, total: data.total });
        } else if (data.type === 'keyword_error') {
          setResults((prev) => [...prev, {
            keyword: data.keyword,
            powerLink: { exposed: false, rank: null, totalAds: 0 },
            place: { exposed: false, rank: null, totalPlaces: 0, isAd: false, tabSearch: null },
          }]);
          setProgress({ current: data.current, total: data.total });
        } else if (data.type === 'complete' || data.type === 'cancelled') {
          setIsScanning(false);
          es.close();
        } else if (data.type === 'error') {
          setIsScanning(false);
          es.close();
          setError(`스캔 오류: ${data.message}`);
        }
      };
      es.onerror = () => { setIsScanning(false); es.close(); };
    } catch (err) {
      setIsScanning(false);
      setError(err.message);
    }
  };

  const handleCancel = async () => {
    if (!scanIdRef.current) return;
    await fetch('/api/scan/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scanId: scanIdRef.current }),
    });
    if (esRef.current) esRef.current.close();
    setIsScanning(false);
  };

  return (
    <div className="app-grid">
      {showSaveModal && (
        <SavePresetModal
          onSave={handleSavePreset}
          onCancel={() => setShowSaveModal(false)}
        />
      )}

      <aside className="sidebar">
        <div className="panel-section">
          <h2 className="panel-title">파워링크 · 플레이스 순위</h2>

          {/* 키워드 입력 */}
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>키워드 (줄바꿈으로 구분)</label>
              <button
                onClick={() => setShowSaveModal(true)}
                disabled={isScanning || !keywordsText.trim()}
                style={{
                  fontSize: '0.75em', padding: '2px 8px', borderRadius: 4,
                  border: '1px solid #d1d5db', background: '#f9fafb',
                  cursor: keywordsText.trim() ? 'pointer' : 'not-allowed',
                  color: '#374151',
                }}
              >
                프리셋 저장
              </button>
            </div>
            <textarea
              className="form-textarea"
              rows={5}
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder={'광주 방탈출\n이스케이프탑\n방탈출 광주'}
              disabled={isScanning}
            />
          </div>

          {/* 저장된 프리셋 */}
          {presets.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: '0.78em', color: '#6b7280', marginBottom: 5 }}>저장된 프리셋</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {presets.map((p) => (
                  <div
                    key={p.name}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 3,
                      padding: '3px 8px', borderRadius: 14,
                      background: '#eff6ff', border: '1px solid #bfdbfe',
                      cursor: 'pointer', fontSize: '0.78em',
                    }}
                    onClick={() => handleLoadPreset(p.name)}
                  >
                    <span style={{ color: '#1d4ed8' }}>{p.name}</span>
                    <button
                      onClick={(e) => handleDeletePreset(p.name, e)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#93c5fd', fontSize: '0.9em', padding: '0 1px',
                        lineHeight: 1,
                      }}
                      title="삭제"
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 식별자 입력 */}
          <div className="form-group">
            <label className="form-label">
              업체명 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              className="form-input"
              type="text"
              value={identifiers.name}
              onChange={updateId('name')}
              placeholder="이스케이프탑"
              disabled={isScanning}
            />
            <p style={{ fontSize: '0.75em', color: '#9ca3af', marginTop: 3, marginBottom: 0 }}>
              이름 일부만 입력해도 포함 여부로 매칭됩니다
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">
              도메인{' '}
              <span style={{ color: '#9ca3af', fontSize: '0.8em' }}>(선택 · 파워링크 정확도 향상)</span>
            </label>
            <input
              className="form-input"
              type="text"
              value={identifiers.domain}
              onChange={updateId('domain')}
              placeholder="example.com"
              disabled={isScanning}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              플레이스 ID{' '}
              <span style={{ color: '#9ca3af', fontSize: '0.8em' }}>(선택 · 정확도 최고)</span>
            </label>
            <input
              className="form-input"
              type="text"
              value={identifiers.placeId}
              onChange={updateId('placeId')}
              placeholder="37695692"
              disabled={isScanning}
            />
            <p style={{ fontSize: '0.75em', color: '#9ca3af', marginTop: 3, marginBottom: 0 }}>
              네이버 지도 → 업체 클릭 → URL의 숫자
            </p>
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '8px' }}>{error}</p>
          )}

          {isScanning ? (
            <>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '6px' }}>
                {progress.current}/{progress.total} · {currentKeyword}
              </p>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '8px' }}>
                미노출 시 플레이스 탭 딥서치로 추가 시간 소요
              </p>
              <button className="btn btn-danger" onClick={handleCancel}>스캔 중단</button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={handleStart}>스캔 시작</button>
          )}
        </div>
      </aside>

      <main className="content-area">
        {results.length > 0 ? (
          <div className="results-panel">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', width: '32%' }}>키워드</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', width: '22%' }}>파워링크</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', width: '46%' }}>플레이스</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '500' }}>{r.keyword}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <PowerLinkCell pl={r.powerLink} />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <PlaceCell pl={r.place} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '6rem' }}>
            <p>키워드와 업체 정보를 입력하고 스캔을 시작하세요.</p>
            <p style={{ fontSize: '0.82em', marginTop: '6px' }}>
              통합검색 플레이스 블록 + 미노출 시 플레이스 탭 딥서치
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
