import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, Check, X, User, Search } from 'lucide-react';

const EMPTY = { displayName: '', businessName: '', userId: '', placeId: '', domain: '', maxPages: 5 };

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ fontSize: '0.72em', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'inherit', fontSize: '0.85em' }}
      />
    </div>
  );
}

function ProfileForm({ initial, onSave, onCancel, saveLabel = '저장' }) {
  const [form, setForm] = useState(initial || EMPTY);
  const set = (k) => (v) => setForm((prev) => ({ ...prev, [k]: v }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ gridColumn: '1/-1' }}>
          <Field label="프로필 이름 *" value={form.displayName} onChange={set('displayName')} placeholder="예: 이스케이프탑 (광주)" />
        </div>
        <Field label="업체명" value={form.businessName} onChange={set('businessName')} placeholder="예: 이스케이프탑" />
        <Field label="작성자 ID" value={form.userId} onChange={set('userId')} placeholder="예: cjh2748" />
        <Field label="플레이스 ID" value={form.placeId} onChange={set('placeId')} placeholder="예: 37695692" />
        <Field label="도메인" value={form.domain} onChange={set('domain')} placeholder="예: escapetop.com" />
        <div style={{ gridColumn: '1/-1' }}>
          <Field label="블로그 탭 최대 페이지" value={form.maxPages} onChange={set('maxPages')} type="number" placeholder="5" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
        {onCancel && (
          <button onClick={onCancel} style={{ padding: '5px 12px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.82em' }}>취소</button>
        )}
        <button
          onClick={() => { if (!form.displayName.trim()) return; onSave(form); }}
          disabled={!form.displayName.trim()}
          style={{ padding: '5px 14px', borderRadius: 5, border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.82em' }}
        >{saveLabel}</button>
      </div>
    </div>
  );
}

function ProfileManager({ onClose }) {
  const [profiles, setProfiles] = useState([]);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => { fetchProfiles(); }, []);

  const fetchProfiles = async () => {
    try {
      const r = await fetch('/api/profiles');
      if (r.ok) setProfiles(await r.json());
    } catch {}
  };

  const handleAdd = async (form) => {
    try {
      const r = await fetch('/api/profiles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (r.ok) { setProfiles(d.profiles); setAdding(false); }
    } catch {}
  };

  const handleEdit = async (id, form) => {
    try {
      const r = await fetch(`/api/profiles/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (r.ok) { setProfiles(d.profiles); setEditingId(null); }
    } catch {}
  };

  const handleDelete = async (id) => {
    if (!confirm('이 프로필을 삭제할까요?')) return;
    try {
      const r = await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
      const d = await r.json();
      if (r.ok) setProfiles(d.profiles);
    } catch {}
  };

  const filtered = search
    ? profiles.filter((p) =>
        [p.displayName, p.businessName, p.userId, p.placeId, p.domain]
          .some((v) => v && v.toLowerCase().includes(search.toLowerCase()))
      )
    : profiles;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{
        background: 'var(--bg-card, #1e293b)', borderRadius: 12, width: '100%', maxWidth: 560,
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
      }}>
        {/* 헤더 */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={16} style={{ color: '#a5b4fc' }} />
            <span style={{ fontWeight: 700, fontSize: '0.95em' }}>대상 프로필 관리</span>
            <span style={{ fontSize: '0.78em', color: 'var(--color-text-muted)', background: 'rgba(255,255,255,0.07)', padding: '1px 7px', borderRadius: 10 }}>{profiles.length}개</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {/* 검색 + 추가 */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름·업체명·ID 검색..."
              style={{ width: '100%', paddingLeft: 26, padding: '5px 8px 5px 26px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'inherit', fontSize: '0.85em' }}
            />
          </div>
          <button
            onClick={() => setAdding(true)}
            style={{ padding: '5px 12px', borderRadius: 5, border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.82em', whiteSpace: 'nowrap' }}
          >
            <Plus size={14} /> 새 프로필
          </button>
        </div>

        {/* 새 프로필 폼 */}
        {adding && (
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.05)' }}>
            <p style={{ fontSize: '0.78em', fontWeight: 700, color: '#a5b4fc', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>새 프로필</p>
            <ProfileForm onSave={handleAdd} onCancel={() => setAdding(false)} saveLabel="추가" />
          </div>
        )}

        {/* 프로필 목록 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {filtered.length === 0 && (
            <p style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85em' }}>
              {search ? '검색 결과 없음' : '프로필이 없습니다. 새 프로필을 추가하세요.'}
            </p>
          )}
          {filtered.map((p) => (
            <div key={p.id} style={{ padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              {editingId === p.id ? (
                <div>
                  <p style={{ fontSize: '0.78em', fontWeight: 700, color: '#fcd34d', marginBottom: 8 }}>수정 중: {p.displayName}</p>
                  <ProfileForm initial={p} onSave={(form) => handleEdit(p.id, form)} onCancel={() => setEditingId(null)} />
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9em', marginBottom: 3 }}>{p.displayName}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: '0.76em', color: 'var(--color-text-muted)' }}>
                      {p.businessName && <span>🏢 {p.businessName}</span>}
                      {p.userId && <span>📝 {p.userId}</span>}
                      {p.placeId && <span>📍 {p.placeId}</span>}
                      {p.domain && <span>🌐 {p.domain}</span>}
                      {p.maxPages && <span>📄 {p.maxPages}p</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => setEditingId(p.id)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4 }} title="수정"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(p.id)} style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', padding: 4 }} title="삭제"><Trash2 size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProfileManager;
