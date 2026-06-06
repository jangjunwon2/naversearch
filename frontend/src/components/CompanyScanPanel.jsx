import React, { useState, useEffect } from 'react';
import { Play, Square, Info } from 'lucide-react';
import ScanProgress from './ScanProgress';
import KeywordListControls from './KeywordListControls';

const COMPANY_NAMES_KEY = 'company_names';

function loadCompanyNames() {
  try { return JSON.parse(localStorage.getItem(COMPANY_NAMES_KEY) || '[]'); } catch { return []; }
}

function CompanyScanPanel({ onStartScan, onCancelScan, isScanning, progress, currentKeyword, statusText, inject }) {
  const [keywordInput, setKeywordInput] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [savedNames, setSavedNames] = useState(loadCompanyNames);

  useEffect(() => {
    if (inject?.text) setKeywordInput(inject.text);
  }, [inject?.key]);

  const persistNames = (list) => {
    setSavedNames(list);
    localStorage.setItem(COMPANY_NAMES_KEY, JSON.stringify(list));
  };

  const handleSelectName = (name) => {
    if (name) setCompanyName(name);
  };

  const handleDeleteName = (name, e) => {
    e.stopPropagation();
    persistNames(savedNames.filter((n) => n !== name));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const keywords = keywordInput.split('\n').map((k) => k.trim()).filter(Boolean);
    if (!keywords.length) return alert('최소 하나 이상의 검색어를 입력해주세요.');
    if (!companyName.trim()) return alert('업체명을 입력해주세요.');

    const name = companyName.trim();
    if (!savedNames.includes(name)) persistNames([name, ...savedNames].slice(0, 30));

    onStartScan('company', { keywords, companyName: name });
  };

  return (
    <div className="glass-card">
      <h3 className="panel-title">📢 업체명 체크</h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
        키워드별 통합검색에서 업체명이 포함된 게시물의 순위와, 카페 댓글·지식인 답글 내 업체명 언급 수를 집계합니다.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="company-keywords">검색 키워드 리스트 <span>(한 줄에 하나씩 입력)</span></label>
          <textarea
            id="company-keywords"
            className="form-input form-textarea"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            disabled={isScanning}
            placeholder={'예:\n광주 방탈출\n광주 방탈출 카페'}
          />
        </div>

        <KeywordListControls keywordText={keywordInput} onLoadText={setKeywordInput} disabled={isScanning} />

        <div className="form-group">
          <label htmlFor="companyName">업체명 / 브랜드명</label>

          {savedNames.length > 0 && (
            <select
              onChange={(e) => { handleSelectName(e.target.value); e.target.value = ''; }}
              defaultValue=""
              disabled={isScanning}
              className="form-input"
              style={{ marginBottom: 6 }}
            >
              <option value="">-- 저장된 업체명 선택 --</option>
              {savedNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          )}

          <input
            id="companyName"
            type="text"
            className="form-input"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            disabled={isScanning}
            placeholder="예: 이스케이프탑"
          />

          {savedNames.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {savedNames.map((n) => (
                <span key={n} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '2px 7px', borderRadius: 12, fontSize: '0.72em',
                  background: companyName === n ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${companyName === n ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.12)'}`,
                  color: companyName === n ? '#a5b4fc' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                }} onClick={() => setCompanyName(n)}>
                  {n}
                  <button onClick={(e) => handleDeleteName(n, e)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-muted)', fontSize: '1em', padding: 0, lineHeight: 1,
                  }} title="삭제">×</button>
                </span>
              ))}
            </div>
          )}

          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.4rem' }}>
            <Info size={12} style={{ color: 'var(--accent-rose)' }} /> 글 내용 하이라이트 + 카페 댓글/지식인 답글 언급 수 확인 · 스캔 시 자동 저장
          </span>
        </div>

        {!isScanning ? (
          <button type="submit" className="btn-primary"><Play size={18} /> 업체명 순위 조회</button>
        ) : (
          <button type="button" className="btn-danger" onClick={onCancelScan}><Square size={16} /> 스캔 중단</button>
        )}
      </form>

      {isScanning && <ScanProgress progress={progress} currentKeyword={currentKeyword} statusText={statusText} />}
    </div>
  );
}

export default CompanyScanPanel;
