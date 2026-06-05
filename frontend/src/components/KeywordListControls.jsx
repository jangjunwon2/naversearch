import React, { useState, useEffect } from 'react';
import { Save, FolderOpen, Trash2, ListChecks } from 'lucide-react';

// 저장된 검색어 목록 불러오기 / 현재 키워드 저장 / 삭제 (업체명·ID 패널 공용)
function KeywordListControls({ keywordText, onLoadText, disabled }) {
  const [lists, setLists] = useState([]);
  const [showManage, setShowManage] = useState(false);

  useEffect(() => {
    fetchLists();
  }, []);

  const fetchLists = async () => {
    try {
      const r = await fetch('/api/keyword-lists');
      if (r.ok) setLists(await r.json());
    } catch (e) {
      console.error('목록 조회 실패:', e);
    }
  };

  const currentKeywords = () =>
    keywordText
      .split(/[\n,]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

  const handleLoad = (id) => {
    const l = lists.find((x) => x.id === id);
    if (l) onLoadText(l.keywords.join('\n'));
  };

  const handleSave = async () => {
    const kws = currentKeywords();
    if (kws.length === 0) {
      alert('저장할 키워드가 없습니다.');
      return;
    }
    const name = prompt(`이 ${kws.length}개 키워드를 어떤 이름으로 저장할까요?`);
    if (!name || !name.trim()) return;
    try {
      const r = await fetch('/api/keyword-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), keywords: kws }),
      });
      const d = await r.json();
      if (r.ok) {
        setLists(d.lists);
        alert('목록을 저장했습니다.');
      } else {
        alert(d.error || '저장 실패');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('이 목록을 삭제할까요?')) return;
    try {
      const r = await fetch(`/api/keyword-lists/${id}`, { method: 'DELETE' });
      if (r.ok) setLists((await r.json()).lists);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <select
          className="form-input"
          style={{ flex: 1 }}
          defaultValue=""
          disabled={disabled || lists.length === 0}
          onChange={(e) => {
            if (e.target.value) handleLoad(e.target.value);
            e.target.value = '';
          }}
        >
          <option value="">
            {lists.length ? '📁 저장된 목록 불러오기...' : '저장된 목록 없음'}
          </option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.keywords.length}개)
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-secondary"
          style={{ flexShrink: 0 }}
          onClick={handleSave}
          disabled={disabled}
          title="현재 키워드를 목록으로 저장"
        >
          <Save size={14} /> 저장
        </button>
      </div>

      {lists.length > 0 && (
        <button
          type="button"
          onClick={() => setShowManage((v) => !v)}
          style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', alignSelf: 'flex-start' }}
        >
          <ListChecks size={12} /> 목록 관리 ({lists.length}개)
        </button>
      )}

      {showManage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', background: 'rgba(15,23,42,0.4)', padding: '0.5rem', borderRadius: '0.4rem' }}>
          {lists.map((l) => (
            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
              <button
                type="button"
                onClick={() => handleLoad(l.id)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: 0 }}
                title="불러오기"
              >
                <FolderOpen size={12} /> {l.name} <span style={{ color: 'var(--color-text-muted)' }}>({l.keywords.length})</span>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(l.id)}
                style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', display: 'flex' }}
                title="삭제"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default KeywordListControls;
