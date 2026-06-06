import React, { useState, useEffect } from 'react';
import { Play, Square, Info } from 'lucide-react';
import ScanProgress from './ScanProgress';
import KeywordListControls from './KeywordListControls';

const BLOG_IDS_KEY = 'blog_ids';

function loadBlogIds() {
  try { return JSON.parse(localStorage.getItem(BLOG_IDS_KEY) || '[]'); } catch { return []; }
}

function IdScanPanel({ onStartScan, onCancelScan, isScanning, progress, currentKeyword, statusText, inject }) {
  const [keywordInput, setKeywordInput] = useState('');
  const [userId, setUserId] = useState('');
  const [maxPages, setMaxPages] = useState(5);
  const [savedIds, setSavedIds] = useState(loadBlogIds);

  useEffect(() => {
    if (inject?.text) setKeywordInput(inject.text);
  }, [inject?.key]);

  const persistIds = (list) => {
    setSavedIds(list);
    localStorage.setItem(BLOG_IDS_KEY, JSON.stringify(list));
  };

  const handleSelectId = (uid) => {
    if (!uid) return;
    const entry = savedIds.find((i) => i.userId === uid);
    if (entry) { setUserId(entry.userId); setMaxPages(entry.maxPages); }
  };

  const handleDeleteId = (uid, e) => {
    e.stopPropagation();
    persistIds(savedIds.filter((i) => i.userId !== uid));
  };

  const handleSaveId = () => {
    const uid = userId.trim();
    if (!uid) return;
    const pages = parseInt(maxPages) || 5;
    const entry = { userId: uid, maxPages: pages };
    persistIds([entry, ...savedIds.filter((i) => i.userId !== uid)].slice(0, 30));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const keywords = keywordInput.split('\n').map((k) => k.trim()).filter(Boolean);
    if (!keywords.length) return alert('최소 하나 이상의 검색어를 입력해주세요.');
    if (!userId.trim()) return alert('작성자 ID를 입력해주세요.');

    const uid = userId.trim();
    const pages = parseInt(maxPages) || 5;
    const entry = { userId: uid, maxPages: pages };
    persistIds([entry, ...savedIds.filter((i) => i.userId !== uid)].slice(0, 30));

    onStartScan('id', { keywords, userId: uid, maxPages: pages });
  };

  return (
    <div className="glass-card">
      <h3 className="panel-title">📝 ID별 순위 체크</h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
        특정 작성자 ID의 글이 통합검색에서 몇 위인지, 미노출이면 블로그 탭 몇 페이지 몇 번째인지 추적합니다.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="id-keywords">검색 키워드 리스트 <span>(한 줄에 하나씩 입력)</span></label>
          <textarea
            id="id-keywords"
            className="form-input form-textarea"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            disabled={isScanning}
            placeholder={'예:\n광주 방탈출\n광주 방탈출 카페'}
          />
        </div>

        <KeywordListControls keywordText={keywordInput} onLoadText={setKeywordInput} disabled={isScanning} />

        <div className="form-group">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label htmlFor="userId" style={{ marginBottom: 0 }}>작성자 ID</label>
            <button
              type="button"
              onClick={handleSaveId}
              disabled={isScanning || !userId.trim()}
              style={{ fontSize: '0.75em', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)', color: 'var(--color-text-muted)', cursor: userId.trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
              title="작성자 ID 저장"
            >💾 저장</button>
          </div>

          {savedIds.length > 0 && (
            <select
              onChange={(e) => { handleSelectId(e.target.value); e.target.value = ''; }}
              defaultValue=""
              disabled={isScanning}
              className="form-input"
              style={{ marginBottom: 6 }}
            >
              <option value="">-- 저장된 ID 선택 --</option>
              {savedIds.map((i) => (
                <option key={i.userId} value={i.userId}>
                  {i.userId} (최대 {i.maxPages}페이지)
                </option>
              ))}
            </select>
          )}

          <input
            id="userId"
            type="text"
            className="form-input"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={isScanning}
            placeholder="예: cjh2748"
          />

          {savedIds.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {savedIds.map((i) => (
                <span key={i.userId} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '2px 7px', borderRadius: 12, fontSize: '0.72em',
                  background: userId === i.userId ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${userId === i.userId ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.12)'}`,
                  color: userId === i.userId ? '#6ee7b7' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                }} onClick={() => handleSelectId(i.userId)}>
                  {i.userId}
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9em' }}>·{i.maxPages}p</span>
                  <button onClick={(e) => handleDeleteId(i.userId, e)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-muted)', fontSize: '1em', padding: 0, lineHeight: 1,
                  }} title="삭제">×</button>
                </span>
              ))}
            </div>
          )}

          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.4rem' }}>
            <Info size={12} style={{ color: 'var(--accent-green)' }} /> 스마트블록 + 블로그 탭 다중 노출 위치 추적 · 스캔 시 자동 저장
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="maxPages">블로그 탭 최대 검색 페이지 수 <span>(기본: 5페이지, 최대 300위)</span></label>
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
          <button type="submit" className="btn-primary"><Play size={18} /> ID 순위 조회</button>
        ) : (
          <button type="button" className="btn-danger" onClick={onCancelScan}><Square size={16} /> 스캔 중단</button>
        )}
      </form>

      {isScanning && <ScanProgress progress={progress} currentKeyword={currentKeyword} statusText={statusText} />}
    </div>
  );
}

export default IdScanPanel;
