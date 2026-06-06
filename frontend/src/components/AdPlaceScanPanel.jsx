import React, { useState, useRef } from 'react';
import { Save } from 'lucide-react';
import ProfileSelector from './ProfileSelector';
import ProfileManager from './ProfileManager';
import QuickSaveProfileModal from './QuickSaveProfileModal';

const PLACE_FIELD_LABELS = { businessName: '업체명', domain: '도메인', placeId: '플레이스 ID' };

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
  if (tab?.found) return <TabSearchResult tab={tab} />;
  if (pl.exposed) {
    return (
      <div>
        <span style={{ fontSize: '0.82em', color: '#6b7280' }}>통합검색 노출</span>
        <div style={{ fontSize: '0.75em', color: '#9ca3af', marginTop: 2 }}>플레이스 탭 미발견</div>
      </div>
    );
  }
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

function SavePresetModal({ onSave, onCancel }) {
  const [name, setName] = useState('');
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-card, #1e293b)', borderRadius: 10, padding: '24px 28px',
        minWidth: 280, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <p style={{ fontWeight: 600, marginBottom: 12 }}>새 키워드 프리셋 이름</p>
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
          <button onClick={onCancel} style={{ padding: '6px 14px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>취소</button>
          <button onClick={() => name.trim() && onSave(name.trim())} style={{ padding: '6px 14px', borderRadius: 5, border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>저장</button>
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
  const [profileId, setProfileId] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [showManager, setShowManager] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const esRef = useRef(null);
  const scanIdRef = useRef(null);

  const updateId = (field) => (e) => setIdentifiers((prev) => ({ ...prev, [field]: e.target.value }));

  const handleProfileSelect = (profile) => {
    setProfileId(profile.id);
    setProfileName(profile.displayName);
    setIdentifiers({
      name: profile.businessName || '',
      domain: profile.domain || '',
      placeId: profile.placeId || '',
    });
  };

  const handleSaved = (profile) => {
    if (profile) { setProfileId(profile.id); setProfileName(profile.displayName); }
    setShowSave(false);
  };

  // 프리셋
  const handleSavePreset = (presetName) => {
    const kws = keywordsText.trim();
    if (!kws) { setShowSaveModal(false); return; }
    const updated = [{ name: presetName, keywords: kws }, ...presets.filter(p => p.name !== presetName)];
    setPresets(updated);
    savePresets(updated);
    setActivePreset(presetName);
    setShowSaveModal(false);
  };

  const handleUpdatePreset = () => {
    if (!activePreset || !keywordsText.trim()) return;
    const updated = presets.map(p => p.name === activePreset ? { ...p, keywords: keywordsText.trim() } : p);
    setPresets(updated);
    savePresets(updated);
  };

  const handleSelectPreset = (presetName) => {
    if (!presetName) return;
    const preset = presets.find(p => p.name === presetName);
    if (preset) { setKeywordsText(preset.keywords); setActivePreset(presetName); }
  };

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
    <>
      {showManager && <ProfileManager onClose={() => setShowManager(false)} />}
      {showSaveModal && <SavePresetModal onSave={handleSavePreset} onCancel={() => setShowSaveModal(false)} />}
      {showSave && (
        <QuickSaveProfileModal
          profileId={profileId}
          profileName={profileName}
          values={{ businessName: identifiers.name.trim(), domain: identifiers.domain.trim(), placeId: identifiers.placeId.trim() }}
          fieldLabels={PLACE_FIELD_LABELS}
          onSaved={handleSaved}
          onClose={() => setShowSave(false)}
        />
      )}

      <div className="app-grid">
        <aside className="sidebar">
          <div className="panel-section">
            <h2 className="panel-title">파워링크 · 플레이스 순위</h2>

            {/* 업체 프로필 선택 */}
            <div style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ marginBottom: 5, display: 'block', fontSize: '0.8em', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>대상 업체</label>
              <ProfileSelector
                value={profileId}
                onSelect={handleProfileSelect}
                onManage={() => setShowManager(true)}
                disabled={isScanning}
              />
            </div>

            {/* 업체명 */}
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>
                  업체명 <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowSave(true)}
                  disabled={isScanning || !identifiers.name.trim()}
                  style={{
                    fontSize: '0.75em', padding: '2px 8px', borderRadius: 4,
                    border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.1)',
                    color: '#a5b4fc', cursor: identifiers.name.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
                  }}
                >
                  <Save size={11} /> 프로필 저장
                </button>
              </div>
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
                도메인 <span style={{ color: '#9ca3af', fontSize: '0.8em' }}>(선택 · 파워링크 정확도 향상)</span>
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
                플레이스 ID <span style={{ color: '#9ca3af', fontSize: '0.8em' }}>(선택 · 정확도 최고)</span>
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

            {/* 키워드 입력 */}
            <div className="form-group" style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>키워드 (줄바꿈으로 구분)</label>
                <span style={{ fontSize: '0.75em', color: kwCount(keywordsText) > 500 ? '#ef4444' : '#9ca3af' }}>
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

            {/* 키워드 프리셋 */}
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label" style={{ marginBottom: 5 }}>키워드 프리셋</label>
              <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
                <select
                  value={activePreset || ''}
                  onChange={(e) => handleSelectPreset(e.target.value)}
                  disabled={isScanning}
                  className="form-input"
                  style={{ flex: 1, fontSize: '0.82em', padding: '4px 6px' }}
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
                    style={{ fontSize: '0.75em', padding: '4px 8px', borderRadius: 5, border: '1px solid rgba(134,239,172,0.4)', background: 'rgba(134,239,172,0.1)', color: '#6ee7b7', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >업데이트</button>
                )}
                <button
                  onClick={() => setShowSaveModal(true)}
                  disabled={isScanning || !keywordsText.trim()}
                  style={{ fontSize: '0.75em', padding: '4px 8px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-secondary)', cursor: keywordsText.trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
                >새 프리셋</button>
                {activePreset && (
                  <button
                    onClick={handleDeleteActivePreset}
                    disabled={isScanning}
                    title={`"${activePreset}" 삭제`}
                    style={{ fontSize: '0.75em', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(252,165,165,0.3)', background: 'rgba(252,165,165,0.05)', color: '#ef4444', cursor: 'pointer' }}
                  >×</button>
                )}
              </div>
              {activePreset && !renamingPreset && (
                <p style={{ fontSize: '0.75em', color: '#9ca3af', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
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
                    className="form-input"
                    style={{ flex: 1, fontSize: '0.82em', padding: '3px 7px' }}
                  />
                  <button onClick={handleRenamePreset} style={{ fontSize: '0.75em', padding: '3px 8px', borderRadius: 4, border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer' }}>확인</button>
                  <button onClick={() => setRenamingPreset(false)} style={{ fontSize: '0.75em', padding: '3px 7px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>취소</button>
                </div>
              )}
            </div>

            {error && (
              <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '8px' }}>{error}</p>
            )}

            {isScanning ? (
              <>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  {progress.current}/{progress.total} · {currentKeyword}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                  미노출 시 플레이스 탭 딥서치로 추가 시간 소요
                </p>
                <button className="btn-danger" style={{ width: '100%', padding: '0.6rem', borderRadius: 6, border: 'none', cursor: 'pointer' }} onClick={handleCancel}>스캔 중단</button>
              </>
            ) : (
              <button className="btn-primary" onClick={handleStart}>스캔 시작</button>
            )}
          </div>
        </aside>

        <main className="content-area">
          {results.length > 0 ? (
            <div className="results-panel">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', width: '32%' }}>키워드</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', width: '22%' }}>파워링크</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', width: '46%' }}>플레이스</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
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
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '6rem' }}>
              <p>키워드와 업체 정보를 입력하고 스캔을 시작하세요.</p>
              <p style={{ fontSize: '0.82em', marginTop: '6px' }}>
                통합검색 플레이스 블록 + 미노출 시 플레이스 탭 딥서치
              </p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
