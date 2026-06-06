import React, { useState } from 'react';
import { Save, X } from 'lucide-react';

/**
 * 현재 입력값을 프로필로 빠르게 저장하는 미니 모달.
 * - profileId 있음 → 해당 프로필에 병합 저장 (PUT)
 * - profileId 없음 → 새 프로필 이름 입력 후 생성 (POST)
 *
 * Props:
 *   profileId    string | null  — 선택된 프로필 ID
 *   profileName  string         — 선택된 프로필 표시명 (업데이트 모드 표시용)
 *   values       object         — 저장할 필드 { businessName?, userId?, maxPages?, domain?, placeId? }
 *   fieldLabels  object         — 필드별 한글 라벨 { businessName: '업체명', ... }
 *   onSaved      (profile) => void
 *   onClose      () => void
 */
function QuickSaveProfileModal({ profileId, profileName, values, fieldLabels, onSaved, onClose }) {
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isUpdate = !!profileId;

  const displayedFields = Object.entries(values).filter(([, v]) => v !== '' && v != null);

  const handleSave = async () => {
    if (!isUpdate && !newName.trim()) { setError('프로필 이름을 입력하세요.'); return; }
    setSaving(true);
    setError('');
    try {
      let r, d;
      if (isUpdate) {
        r = await fetch(`/api/profiles/${profileId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
        d = await r.json();
        if (r.ok) onSaved(d.profiles.find((p) => p.id === profileId) || null);
      } else {
        r = await fetch('/api/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: newName.trim(), ...values }),
        });
        d = await r.json();
        if (r.ok) onSaved(d.profile);
      }
      if (!r.ok) setError(d.error || '저장 실패');
    } catch {
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{
        background: '#1e293b', borderRadius: 10, padding: '20px 22px', width: '100%', maxWidth: 360,
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ fontWeight: 700, fontSize: '0.95em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Save size={15} style={{ color: '#a5b4fc' }} />
            {isUpdate ? '프로필 업데이트' : '새 프로필로 저장'}
          </p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        {/* 업데이트 대상 프로필명 */}
        {isUpdate && (
          <p style={{ fontSize: '0.82em', color: 'var(--color-text-muted)', marginBottom: 12 }}>
            <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{profileName}</span> 프로필에 아래 값을 저장합니다.
          </p>
        )}

        {/* 새 프로필 이름 입력 */}
        {!isUpdate && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.78em', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
              프로필 이름 *
            </label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose(); }}
              placeholder="예: 이스케이프탑 (광주)"
              style={{
                width: '100%', padding: '6px 10px', borderRadius: 5,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.05)', color: 'inherit', fontSize: '0.85em',
              }}
            />
          </div>
        )}

        {/* 저장될 필드 미리보기 */}
        <div style={{ background: 'rgba(15,23,42,0.5)', borderRadius: 6, padding: '10px 12px', marginBottom: 14 }}>
          {displayedFields.length === 0 ? (
            <p style={{ fontSize: '0.8em', color: 'var(--color-text-muted)' }}>저장할 값이 없습니다.</p>
          ) : (
            displayedFields.map(([key, val]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82em', padding: '2px 0' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{fieldLabels?.[key] || key}</span>
                <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{String(val)}</span>
              </div>
            ))
          )}
        </div>

        {error && <p style={{ fontSize: '0.78em', color: '#f43f5e', marginBottom: 8 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '6px 14px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.85em' }}
          >취소</button>
          <button
            onClick={handleSave}
            disabled={saving || displayedFields.length === 0}
            style={{ padding: '6px 16px', borderRadius: 5, border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.85em', opacity: saving ? 0.7 : 1 }}
          >{saving ? '저장 중...' : isUpdate ? '업데이트' : '저장'}</button>
        </div>
      </div>
    </div>
  );
}

export default QuickSaveProfileModal;
