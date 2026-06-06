import React, { useState, useRef, useEffect } from 'react';

const PRESETS_KEY      = 'adplace_kw_presets';
const IDENTIFIERS_KEY  = 'adplace_identifiers';

function loadPresets() {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]'); } catch { return []; }
}
function savePresets(presets) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

function loadSavedIdentifiers() {
  try { return JSON.parse(localStorage.getItem(IDENTIFIERS_KEY) || '[]'); } catch { return []; }
}
function persistIdentifiers(list) {
  localStorage.setItem(IDENTIFIERS_KEY, JSON.stringify(list));
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

function TabSearchResult({ tab }) {
  if (!tab) return null;
  if (!tab.found) return <div style={{ fontSize: '0.78em', color: '#9ca3af', marginTop: 3 }}>플레이스 탭 미발견</div>;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontWeight: 700, fontSize: '0.97em', color: '#1d4ed8', lineHeight: 1.3 }}>
        {tab.page}p {tab.position}번째
        <span style={{ fontWeight: 400, fontSize: '0.78em', color: '#6b7280', marginLeft: 5 }}>플레이스 탭</span>
      </div>
      {tab.adPage != null && (
        <div style={{ fontWeight: 700, fontSize: '0.97em', color: '#b45309', lineHeight: 1.3 }}>
          {tab.adPage}p {tab.adPosition}번째
          <span style={{ fontWeight: 400, fontSize: '0.78em', color: '#9ca3af', marginLeft: 5 }}>광고 탭</span>
        </div>
      )}
      <div style={{ fontSize: '0.72em', color: '#9ca3af', marginTop: 2 }}>
        유기 {tab.organicRank}위 · 전체 {tab.total ?? '?'}개
      </div>
    </div>
  );
}

function PlaceCell({ pl }) {
  const tab = pl.tabSearch;

  // 탭 딥서치 발견: 탭 순위만 표시 (주요 정보)
  if (tab?.found) return <TabSearchResult tab={tab} />;

  // 탭 미발견이지만 통합검색 노출
  if (pl.exposed) {
    return (
      <div>
        <span style={{ fontSize: '0.82em', color: '#6b7280' }}>통합검색 노출</span>
        <div style={{ fontSize: '0.75em', color: '#9ca3af', marginTop: 2 }}>플레이스 탭 미발견</div>
      </div>
    );
  }

  // 탭 미발견 + 통합검색 미노출
  return (
    <div>
      <span style={{ color: '#9ca3af', fontSize: '0.82em' }}>통합검색 미노출</span>
      <div style={{ fontSize: '0.75em', color: '#9ca3af', marginTop: 2 }}>플레이스 탭 미발견</div>
    </div>
  );
}

function kwCount(text) {
  return text ? text.split('\n').filter((l) => l.trim()).length : 0;
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
        <p style={{ fontWeight: 600, marginBottom: 12 }}>새 프리셋 이름</p>
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
  const [activePreset, setActivePreset] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [renamingPreset, setRenamingPreset] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [savedIdentifiers, setSavedIdentifiers] = useState(loadSavedIdentifiers);
  const [historyNames, setHistoryNames] = useState([]);
  const esRef = useRef(null);
  const scanIdRef = useRef(null);

  // 업체명 체크 히스토리에서 업체명 가져오기
  useEffect(() => {
    fetch('/api/history')
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.history || []);
        const names = [...new Set(
          list.filter((r) => r.companyName).map((r) => r.companyName)
        )];
        setHistoryNames(names);
      })
      .catch(() => {});
  }, []);

  const updateId = (field) => (e) => setIdentifiers((prev) => ({ ...prev, [field]: e.target.value }));

  // 드롭다운에서 업체 선택
  const handleSelectIdentifier = (name) => {
    if (!name) return;
    const saved = savedIdentifiers.find((s) => s.name === name);
    if (saved) {
      setIdentifiers({ name: saved.name, domain: saved.domain || '', placeId: saved.placeId || '' });
    } else {
      setIdentifiers((prev) => ({ ...prev, name }));
    }
  };

  // 저장된 식별자 삭제
  const handleDeleteIdentifier = (name, e) => {
    e.stopPropagation();
    const updated = savedIdentifiers.filter((s) => s.name !== name);
    setSavedIdentifiers(updated);
    persistIdentifiers(updated);
  };

  // 현재 식별자 명시적 저장
  const handleSaveIdentifier = () => {
    if (!identifiers.name.trim()) return;
    const entry = {
      name: identifiers.name.trim(),
      domain: identifiers.domain.trim(),
      placeId: identifiers.placeId.trim(),
    };
    const updated = [entry, ...savedIdentifiers.filter((s) => s.name !== entry.name)].slice(0, 30);
    setSavedIdentifiers(updated);
    persistIdentifiers(updated);
  };

  // 새 프리셋으로 저장
  const handleSavePreset = (presetName) => {
    const kws = keywordsText.trim();
    if (!kws) { setShowSaveModal(false); return; }
    const updated = [{ name: presetName, keywords: kws }, ...presets.filter(p => p.name !== presetName)];
    setPresets(updated);
    savePresets(updated);
    setActivePreset(presetName);
    setShowSaveModal(false);
  };

  // 현재 프리셋 덮어쓰기
  const handleUpdatePreset = () => {
    if (!activePreset || !keywordsText.trim()) return;
    const updated = presets.map(p => p.name === activePreset ? { ...p, keywords: keywordsText.trim() } : p);
    setPresets(updated);
    savePresets(updated);
  };

  // 드롭다운에서 선택 → 즉시 불러오기
  const handleSelectPreset = (presetName) => {
    if (!presetName) return;
    const preset = presets.find(p => p.name === presetName);
    if (preset) { setKeywordsText(preset.keywords); setActivePreset(presetName); }
  };

  // 현재 프리셋 이름 변경
  const handleRenamePreset = () => {
    const newName = renameValue.trim();
    if (!newName || !activePreset) { setRenamingPreset(false); return; }
    if (presets.some(p => p.name === newName && p.name !== activePreset)) {
      alert(`"${newName}" 이름의 프리셋이 이미 있습니다.`); return;
    }
    const updated = presets.map(p => p.name === activePreset ? { ...p, name: newName } : p);
    setPresets(updated);
    savePresets(updated);
    setActivePreset(newName);
    setRenamingPreset(false);
  };

  // 현재 프리셋 삭제
  const handleDeleteActivePreset = () => {
    if (!activePreset) return;
    if (!window.confirm(`"${activePreset}" 프리셋을 삭제할까요?`)) return;
    const updated = presets.filter(p => p.name !== activePreset);
    setPresets(updated);
    savePresets(updated);
    setActivePreset(null);
  };

  const handleStart = async () => {
    const keywords = keywordsText.split('\n').map((k) => k.trim()).filter(Boolean);
    if (!keywords.length) return setError('키워드를 입력하세요.');
    if (keywords.length > 500) return setError('키워드는 최대 500개까지 입력 가능합니다.');
    if (!identifiers.name.trim()) return setError('업체명은 필수입니다.');
    setError('');
    setResults([]);
    setIsScanning(true);
    setProgress({ current: 0, total: keywords.length });

    // 식별자 자동 저장
    if (identifiers.name.trim()) {
      const entry = { name: identifiers.name.trim(), domain: identifiers.domain.trim(), placeId: identifiers.placeId.trim() };
      const updated = [entry, ...savedIdentifiers.filter((s) => s.name !== entry.name)];
      setSavedIdentifiers(updated);
      persistIdentifiers(updated);
    }

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
              <span style={{
                fontSize: '0.75em',
                color: kwCount(keywordsText) > 500 ? '#ef4444' : '#9ca3af',
              }}>
                {kwCount(keywordsText)}/500개
              </span>
            </div>
            <textarea
              className="form-textarea"
              rows={6}
              value={keywordsText}
              onChange={(e) => { setKeywordsText(e.target.value); setActivePreset(null); }}
              placeholder={'광주 방탈출\n이스케이프탑\n방탈출 광주'}
              disabled={isScanning}
            />
          </div>

          {/* 프리셋 */}
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label" style={{ marginBottom: 5 }}>프리셋</label>
            <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
              <select
                value={activePreset || ''}
                onChange={(e) => handleSelectPreset(e.target.value)}
                disabled={isScanning}
                style={{
                  flex: 1, fontSize: '0.82em', padding: '4px 6px', borderRadius: 5,
                  border: '1px solid #d1d5db', background: '#fff', color: '#374151',
                  cursor: 'pointer',
                }}
              >
                <option value="">-- 불러오기 --</option>
                {presets.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({kwCount(p.keywords)}개)
                  </option>
                ))}
              </select>
              {activePreset && (
                <button
                  onClick={handleUpdatePreset}
                  disabled={isScanning || !keywordsText.trim()}
                  title={`"${activePreset}"에 현재 키워드로 덮어씀`}
                  style={{
                    fontSize: '0.75em', padding: '4px 8px', borderRadius: 5,
                    border: '1px solid #86efac', background: '#f0fdf4',
                    color: '#15803d', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >업데이트</button>
              )}
              <button
                onClick={() => setShowSaveModal(true)}
                disabled={isScanning || !keywordsText.trim()}
                style={{
                  fontSize: '0.75em', padding: '4px 8px', borderRadius: 5,
                  border: '1px solid #d1d5db', background: '#f9fafb',
                  color: '#374151', cursor: keywordsText.trim() ? 'pointer' : 'not-allowed',
                  whiteSpace: 'nowrap',
                }}
              >새 프리셋</button>
              {activePreset && (
                <button
                  onClick={handleDeleteActivePreset}
                  disabled={isScanning}
                  title={`"${activePreset}" 삭제`}
                  style={{
                    fontSize: '0.75em', padding: '4px 7px', borderRadius: 5,
                    border: '1px solid #fca5a5', background: '#fff5f5',
                    color: '#dc2626', cursor: 'pointer',
                  }}
                >×</button>
              )}
            </div>
            {activePreset && !renamingPreset && (
              <p style={{ fontSize: '0.75em', color: '#6b7280', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                현재: <strong>{activePreset}</strong>
                <button
                  onClick={() => { setRenameValue(activePreset); setRenamingPreset(true); }}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.85em', padding: 0 }}
                  title="프리셋 이름 변경"
                >✏️</button>
              </p>
            )}
            {activePreset && renamingPreset && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRenamePreset(); if (e.key === 'Escape') setRenamingPreset(false); }}
                  style={{ flex: 1, fontSize: '0.82em', padding: '3px 7px', borderRadius: 4, border: '1px solid #93c5fd', outline: 'none' }}
                />
                <button
                  onClick={handleRenamePreset}
                  style={{ fontSize: '0.75em', padding: '3px 8px', borderRadius: 4, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer' }}
                >확인</button>
                <button
                  onClick={() => setRenamingPreset(false)}
                  style={{ fontSize: '0.75em', padding: '3px 7px', borderRadius: 4, border: '1px solid #d1d5db', background: '#f9fafb', color: '#6b7280', cursor: 'pointer' }}
                >취소</button>
              </div>
            )}
          </div>

          {/* 식별자 입력 */}
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                업체명 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <button
                type="button"
                onClick={handleSaveIdentifier}
                disabled={isScanning || !identifiers.name.trim()}
                style={{
                  fontSize: '0.72em', padding: '2px 8px', borderRadius: 4,
                  border: '1px solid #d1d5db', background: '#f9fafb',
                  color: '#374151', cursor: identifiers.name.trim() ? 'pointer' : 'not-allowed',
                  whiteSpace: 'nowrap',
                }}
                title="업체명·도메인·ID를 저장"
              >💾 저장</button>
            </div>

            {/* 저장된 업체 드롭다운 */}
            {(savedIdentifiers.length > 0 || historyNames.length > 0) && (
              <select
                onChange={(e) => handleSelectIdentifier(e.target.value)}
                value=""
                disabled={isScanning}
                style={{
                  width: '100%', fontSize: '0.82em', padding: '5px 6px',
                  borderRadius: 5, border: '1px solid #d1d5db', background: '#fff',
                  color: '#374151', cursor: 'pointer', marginBottom: 6,
                }}
              >
                <option value="">-- 저장된 업체 선택 --</option>
                {savedIdentifiers.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}{s.placeId ? ` · ID: ${s.placeId}` : ''}{s.domain ? ` · ${s.domain}` : ''}
                  </option>
                ))}
                {historyNames
                  .filter((n) => !savedIdentifiers.find((s) => s.name === n))
                  .map((n) => (
                    <option key={n} value={n}>{n} (업체명 체크 이력)</option>
                  ))}
              </select>
            )}

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

            {/* 저장된 업체 칩 (삭제 가능) */}
            {savedIdentifiers.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 7 }}>
                {savedIdentifiers.map((s) => (
                  <span
                    key={s.name}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      padding: '2px 7px', borderRadius: 12, fontSize: '0.72em',
                      background: identifiers.name === s.name ? '#eff6ff' : '#f3f4f6',
                      border: `1px solid ${identifiers.name === s.name ? '#bfdbfe' : '#e5e7eb'}`,
                      color: identifiers.name === s.name ? '#1d4ed8' : '#6b7280',
                    }}
                  >
                    {s.name}
                    <button
                      onClick={(e) => handleDeleteIdentifier(s.name, e)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#9ca3af', fontSize: '1em', padding: 0, lineHeight: 1,
                      }}
                      title="삭제"
                    >×</button>
                  </span>
                ))}
              </div>
            )}
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
