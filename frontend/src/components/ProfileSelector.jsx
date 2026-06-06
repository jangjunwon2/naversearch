import React, { useState, useEffect, useRef } from 'react';
import { Plus, Settings, Check, X, ChevronDown } from 'lucide-react';

/**
 * 모든 스캔 탭에서 공유하는 대상 프로필 선택기.
 * - 드롭다운으로 기존 프로필 선택 → onSelect(profile) 콜백
 * - "+" 버튼으로 인라인 빠른 생성
 * - "관리" 버튼으로 ProfileManager 모달 열기
 */
function ProfileSelector({ value, onSelect, onManage, disabled }) {
  const [profiles, setProfiles] = useState([]);
  const [open, setOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [creatingQuick, setCreatingQuick] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const fetchProfiles = async () => {
    try {
      const r = await fetch('/api/profiles');
      if (r.ok) setProfiles(await r.json());
    } catch {}
  };

  const handleQuickCreate = async () => {
    const name = quickName.trim();
    if (!name) return;
    try {
      const r = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name }),
      });
      const d = await r.json();
      if (r.ok) {
        setProfiles(d.profiles);
        onSelect(d.profile);
        setQuickName('');
        setCreatingQuick(false);
        setOpen(false);
      }
    } catch {}
  };

  const selected = value ? profiles.find((p) => p.id === value) : null;

  return (
    <div ref={ref} style={{ position: 'relative', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        {/* 선택 버튼 */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => { setOpen((v) => !v); fetchProfiles(); }}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 10px', borderRadius: '0.45rem',
            border: '1px solid rgba(255,255,255,0.15)',
            background: selected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.05)',
            color: selected ? '#a5b4fc' : 'var(--color-text-muted)',
            cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.85em',
            transition: 'background 0.15s',
          }}
        >
          <span>{selected ? selected.displayName : '프로필 선택...'}</span>
          <ChevronDown size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
        </button>

        {/* 관리 버튼 */}
        <button
          type="button"
          onClick={onManage}
          disabled={disabled}
          style={{ padding: '6px 8px', borderRadius: '0.45rem', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78em', whiteSpace: 'nowrap' }}
          title="프로필 관리"
        >
          <Settings size={13} /> 관리
        </button>
      </div>

      {/* 드롭다운 */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 1000,
          backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '0.5rem', boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
          overflow: 'hidden', isolation: 'isolate',
        }}>
          {/* 빠른 생성 */}
          {creatingQuick ? (
            <div style={{ padding: '8px', display: 'flex', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <input
                autoFocus
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleQuickCreate(); if (e.key === 'Escape') setCreatingQuick(false); }}
                placeholder="새 프로필 이름"
                style={{ flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.08)', color: 'inherit', fontSize: '0.85em' }}
              />
              <button onClick={handleQuickCreate} style={{ background: 'none', border: 'none', color: '#6ee7b7', cursor: 'pointer' }}><Check size={14} /></button>
              <button onClick={() => setCreatingQuick(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><X size={14} /></button>
            </div>
          ) : (
            <button
              onClick={() => setCreatingQuick(true)}
              style={{ width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82em' }}
            >
              <Plus size={13} /> 새 프로필 추가
            </button>
          )}

          {/* 프로필 목록 */}
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {profiles.length === 0 ? (
              <p style={{ padding: '12px', fontSize: '0.8em', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                프로필이 없습니다. 위에서 추가하세요.
              </p>
            ) : (
              profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onSelect(p); setOpen(false); }}
                  style={{
                    width: '100%', padding: '8px 12px', background: value === p.id ? 'rgba(99,102,241,0.15)' : 'none',
                    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                    color: value === p.id ? '#a5b4fc' : 'var(--color-text-primary)',
                    cursor: 'pointer', textAlign: 'left', fontSize: '0.85em',
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{p.displayName}</span>
                  <span style={{ fontSize: '0.78em', color: 'var(--color-text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {p.businessName && <span>업체: {p.businessName}</span>}
                    {p.userId && <span>ID: {p.userId}</span>}
                    {p.placeId && <span>PlaceID: {p.placeId}</span>}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfileSelector;
