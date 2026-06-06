import React, { useState, useEffect } from 'react';
import { Play, Square, Info, Save } from 'lucide-react';
import ScanProgress from './ScanProgress';
import KeywordListControls from './KeywordListControls';
import ProfileSelector from './ProfileSelector';
import ProfileManager from './ProfileManager';
import QuickSaveProfileModal from './QuickSaveProfileModal';

const FIELD_LABELS = { businessName: '업체명' };

function CompanyScanPanel({ onStartScan, onCancelScan, isScanning, progress, currentKeyword, statusText, inject }) {
  const [keywordInput, setKeywordInput] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [profileId, setProfileId] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [showManager, setShowManager] = useState(false);
  const [showSave, setShowSave] = useState(false);

  useEffect(() => {
    if (inject?.text) setKeywordInput(inject.text);
  }, [inject?.key]);

  const handleProfileSelect = (profile) => {
    setProfileId(profile.id);
    setProfileName(profile.displayName);
    if (profile.businessName) setCompanyName(profile.businessName);
  };

  const handleSaved = (profile) => {
    if (profile) {
      setProfileId(profile.id);
      setProfileName(profile.displayName);
    }
    setShowSave(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const keywords = keywordInput.split('\n').map((k) => k.trim()).filter(Boolean);
    if (!keywords.length) return alert('최소 하나 이상의 검색어를 입력해주세요.');
    if (!companyName.trim()) return alert('업체명을 입력해주세요.');
    onStartScan('company', { keywords, companyName: companyName.trim() });
  };

  return (
    <>
      {showManager && <ProfileManager onClose={() => setShowManager(false)} />}
      {showSave && (
        <QuickSaveProfileModal
          profileId={profileId}
          profileName={profileName}
          values={{ businessName: companyName.trim() }}
          fieldLabels={FIELD_LABELS}
          onSaved={handleSaved}
          onClose={() => setShowSave(false)}
        />
      )}
      <div className="glass-card">
        <h3 className="panel-title">📢 업체명 체크</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          키워드별 통합검색에서 업체명이 포함된 게시물의 순위와, 카페 댓글·지식인 답글 내 업체명 언급 수를 집계합니다.
        </p>

        {/* 프로필 선택 */}
        <ProfileSelector
          value={profileId}
          onSelect={handleProfileSelect}
          onManage={() => setShowManager(true)}
          disabled={isScanning}
        />

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <label htmlFor="companyName" style={{ marginBottom: 0 }}>업체명 / 브랜드명</label>
              <button
                type="button"
                onClick={() => setShowSave(true)}
                disabled={isScanning || !companyName.trim()}
                style={{
                  fontSize: '0.75em', padding: '2px 8px', borderRadius: 4,
                  border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.1)',
                  color: '#a5b4fc', cursor: companyName.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
                }}
              >
                <Save size={11} /> 프로필 저장
              </button>
            </div>
            <input
              id="companyName"
              type="text"
              className="form-input"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={isScanning}
              placeholder="예: 이스케이프탑"
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.4rem' }}>
              <Info size={12} style={{ color: 'var(--accent-rose)' }} /> 글 내용 하이라이트 + 카페 댓글/지식인 답글 언급 수 확인
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
    </>
  );
}

export default CompanyScanPanel;
