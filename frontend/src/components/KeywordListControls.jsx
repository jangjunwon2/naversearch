import React, { useState, useEffect, useRef } from 'react';
import { Save, Trash2, ListChecks, Pencil, Check, X } from 'lucide-react';

function KeywordListControls({ keywordText, onLoadText, disabled }) {
  const [lists, setLists] = useState([]);
  const [showManage, setShowManage] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const saveInputRef = useRef(null);
  const editInputRef = useRef(null);

  useEffect(() => { fetchLists(); }, []);
  useEffect(() => { if (showSaveModal) setTimeout(() => saveInputRef.current?.focus(), 50); }, [showSaveModal]);
  useEffect(() => { if (editingId) setTimeout(() => editInputRef.current?.focus(), 50); }, [editingId]);

  const fetchLists = async () => {
    try {
      const r = await fetch('/api/keyword-lists');
      if (r.ok) setLists(await r.json());
    } catch {}
  };

  const currentKeywords = () =>
    keywordText.split(/[\n,]/).map((k) => k.trim()).filter(Boolean);

  const handleLoad = (id) => {
    const l = lists.find((x) => x.id === id);
    if (l) onLoadText(l.keywords.join('\n'));
  };

  const handleSaveSubmit = async () => {
    const name = saveName.trim();
    if (!name) return;
    const kws = currentKeywords();
    if (!kws.length) return;
    try {
      const r = await fetch('/api/keyword-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, keywords: kws }),
      });
      const d = await r.json();
      if (r.ok) { setLists(d.lists); setShowSaveModal(false); setSaveName(''); }
    } catch {}
  };

  const handleDelete = async (id) => {
    if (!confirm('이 목록을 삭제할까요?')) return;
    try {
      const r = await fetch(`/api/keyword-lists/${id}`, { method: 'DELETE' });
      if (r.ok) setLists((await r.json()).lists);
    } catch {}
  };

  const handleRenameSubmit = async (id) => {
    const name = editingName.trim();
    if (!name) { setEditingId(null); return; }
    try {
      const r = await fetch(`/api/keyword-lists/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const d = await r.json();
      if (r.ok) setLists(d.lists);
    } catch {}
    setEditingId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
      {/* 저장 모달 */}
      {showSaveModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--bg-card, #1e293b)', borderRadius: 10, padding: '22px 24px',
            minWidth: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <p style={{ fontWeight: 600, marginBottom: 12, color: 'var(--color-text-primary, #f1f5f9)' }}>
              키워드 목록 이름
            </p>
            <input
              ref={saveInputRef}
              className="form-input"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveSubmit(); if (e.key === 'Escape') setShowSaveModal(false); }}
              placeholder="예: 광주 방탈출 키워드"
              style={{ marginBottom: 14 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowSaveModal(false); setSaveName(''); }}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}
              >취소</button>
              <button
                onClick={handleSaveSubmit}
                disabled={!saveName.trim() || !currentKeywords().length}
                style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
              >저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 드롭다운 + 저장 버튼 */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <select
          className="form-input"
          style={{ flex: 1 }}
          defaultValue=""
          disabled={disabled || lists.length === 0}
          onChange={(e) => { if (e.target.value) { handleLoad(e.target.value); e.target.value = ''; } }}
        >
          <option value="">{lists.length ? '📁 저장된 목록 불러오기...' : '저장된 목록 없음'}</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>{l.name} ({l.keywords.length}개)</option>
          ))}
        </select>
        <button
          type="button"
          className="btn-secondary"
          style={{ flexShrink: 0 }}
          onClick={() => setShowSaveModal(true)}
          disabled={disabled || !currentKeywords().length}
          title="현재 키워드를 목록으로 저장"
        >
          <Save size={14} /> 저장
        </button>
      </div>

      {/* 목록 관리 토글 */}
      {lists.length > 0 && (
        <button
          type="button"
          onClick={() => setShowManage((v) => !v)}
          style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', alignSelf: 'flex-start' }}
        >
          <ListChecks size={12} /> 목록 관리 ({lists.length}개) {showManage ? '▲' : '▼'}
        </button>
      )}

      {/* 목록 관리 패널 */}
      {showManage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', background: 'rgba(15,23,42,0.5)', padding: '0.6rem 0.7rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
          {lists.map((l) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
              {editingId === l.id ? (
                <>
                  <input
                    ref={editInputRef}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(l.id); if (e.key === 'Escape') setEditingId(null); }}
                    style={{ flex: 1, padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(99,102,241,0.5)', background: 'rgba(99,102,241,0.1)', color: 'inherit', fontSize: 'inherit' }}
                  />
                  <button type="button" onClick={() => handleRenameSubmit(l.id)} style={{ background: 'none', border: 'none', color: '#6ee7b7', cursor: 'pointer' }} title="확인"><Check size={13} /></button>
                  <button type="button" onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }} title="취소"><X size={13} /></button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleLoad(l.id)}
                    style={{ flex: 1, background: 'none', border: 'none', color: 'var(--color-text-primary)', cursor: 'pointer', textAlign: 'left', padding: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    title="불러오기"
                  >
                    {l.name}
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78em' }}>({l.keywords.length}개)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingId(l.id); setEditingName(l.name); }}
                    style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex' }}
                    title="이름 변경"
                  ><Pencil size={12} /></button>
                  <button
                    type="button"
                    onClick={() => handleDelete(l.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', display: 'flex' }}
                    title="삭제"
                  ><Trash2 size={12} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default KeywordListControls;
