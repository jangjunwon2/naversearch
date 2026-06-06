import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, ShieldAlert, ScanText, Upload, Download, Search, Pencil, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 100;

function ForbiddenWordPanel() {
  const [totalCount, setTotalCount] = useState(0);
  const [items, setItems] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [newWord, setNewWord] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingWord, setEditingWord] = useState('');

  // 검사
  const [text, setText] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const fileInputRef = useRef(null);

  const fetchPage = useCallback(async (pg, q) => {
    try {
      const params = new URLSearchParams({ page: pg, limit: PAGE_SIZE });
      if (q) params.set('q', q);
      const r = await fetch(`/api/forbidden/words/page?${params}`);
      if (r.ok) {
        const d = await r.json();
        setItems(d.items);
        setTotalCount(d.total);
        setTotalPages(d.pages || 1);
        setPage(d.page);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchPage(1, ''); }, [fetchPage]);

  const refresh = (pg = page, q = search) => fetchPage(pg, q);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    fetchPage(1, searchInput);
  };

  const handleClearSearch = () => { setSearchInput(''); setSearch(''); fetchPage(1, ''); };

  // 단어 추가
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    try {
      const r = await fetch('/api/forbidden/words', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: newWord.trim() }),
      });
      const d = await r.json();
      if (r.ok) { setNewWord(''); refresh(1, search); }
      else alert(d.error || '추가 실패');
    } catch {}
  };

  // 파일 업로드
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await bulkAdd(text);
    e.target.value = '';
  };

  // 붙여넣기 bulk
  const bulkAdd = async (rawText) => {
    if (!rawText.trim()) return;
    try {
      const r = await fetch('/api/forbidden/words/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: rawText }),
      });
      const d = await r.json();
      if (r.ok) { alert(`${d.added}개 추가됨 (중복 제외)`); refresh(1, search); }
    } catch {}
  };

  // 인라인 수정
  const handleEditSave = async (id) => {
    if (!editingWord.trim()) return;
    try {
      const r = await fetch(`/api/forbidden/words/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: editingWord.trim() }),
      });
      if (r.ok) { setEditingId(null); refresh(); }
    } catch {}
  };

  // 단어 삭제
  const handleDelete = async (id) => {
    try {
      const r = await fetch(`/api/forbidden/words/${id}`, { method: 'DELETE' });
      if (r.ok) refresh();
    } catch {}
  };

  // 전체 삭제
  const handleDeleteAll = async () => {
    if (!confirm(`금칙어 ${totalCount}개를 모두 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try {
      const r = await fetch('/api/forbidden/words', { method: 'DELETE' });
      if (r.ok) { setItems([]); setTotalCount(0); setTotalPages(1); setPage(1); }
    } catch {}
  };

  // 내보내기
  const handleExport = async () => {
    try {
      // 전체 단어 fetch (검색 없이 전체)
      const r = await fetch(`/api/forbidden/words/page?page=1&limit=99999`);
      const d = await r.json();
      const content = d.items.map((w) => w.word).join('\n');
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `forbidden-words-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  // 본문 검사
  const handleCheck = async () => {
    if (!text.trim()) return;
    setIsChecking(true);
    try {
      const r = await fetch('/api/forbidden/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (r.ok) setCheckResult(await r.json());
    } catch {} finally { setIsChecking(false); }
  };

  const renderHighlight = () => {
    if (!checkResult || checkResult.results.length === 0) return text;
    const intervals = [];
    checkResult.results.forEach((r) => r.positions.forEach((p) => intervals.push({ start: p.start, end: p.end })));
    intervals.sort((a, b) => a.start - b.start);
    const merged = [];
    intervals.forEach((iv) => {
      const last = merged[merged.length - 1];
      if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
      else merged.push({ ...iv });
    });
    const segs = [];
    let cur = 0;
    merged.forEach((iv, i) => {
      if (cur < iv.start) segs.push(<span key={`t${i}`}>{text.slice(cur, iv.start)}</span>);
      segs.push(<mark key={`m${i}`} className="highlight-word">{text.slice(iv.start, iv.end)}</mark>);
      cur = iv.end;
    });
    if (cur < text.length) segs.push(<span key="tend">{text.slice(cur)}</span>);
    return segs;
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '1.5rem', alignItems: 'start' }}>

      {/* 좌: 금칙어 사전 */}
      <div className="glass-card">
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: 0 }}>
            <ShieldAlert size={16} style={{ color: 'var(--accent-rose)' }} />
            금칙어 사전
            <span style={{ fontSize: '0.75em', color: 'var(--color-text-muted)', background: 'rgba(255,255,255,0.07)', padding: '1px 7px', borderRadius: 10, fontWeight: 400 }}>
              {totalCount.toLocaleString()}개
            </span>
          </h3>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={handleExport}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 5, padding: '3px 7px', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72em' }}
              title="TXT로 내보내기"
            ><Download size={12} /> 내보내기</button>
            {totalCount > 0 && (
              <button
                onClick={handleDeleteAll}
                style={{ background: 'none', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 5, padding: '3px 7px', color: 'var(--accent-rose)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72em' }}
                title="전체 삭제"
              ><Trash2 size={12} /> 전체삭제</button>
            )}
          </div>
        </div>

        {/* 단어 추가 */}
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
          <input
            type="text" className="form-input" value={newWord}
            onChange={(e) => setNewWord(e.target.value)} placeholder="금칙어 하나 입력 후 Enter"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0 0.8rem', flexShrink: 0 }}>
            <Plus size={15} />
          </button>
        </form>

        {/* 파일 업로드 + 붙여넣기 bulk */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
          <input ref={fileInputRef} type="file" accept=".txt,.csv" style={{ display: 'none' }} onChange={handleFile} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ flex: 1, padding: '5px 8px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: '0.8em' }}
          >
            <Upload size={13} /> TXT/CSV 파일 업로드
          </button>
          <BulkPasteButton onBulk={bulkAdd} />
        </div>

        {/* 검색 */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text" value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="단어 검색..."
              style={{ width: '100%', paddingLeft: 24, padding: '5px 8px 5px 24px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'inherit', fontSize: '0.82em' }}
            />
          </div>
          <button type="submit" style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '0.8em' }}>검색</button>
          {search && <button type="button" onClick={handleClearSearch} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><X size={14} /></button>}
        </form>

        {search && (
          <p style={{ fontSize: '0.75em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
            "{search}" 검색 결과: {totalCount}개
          </p>
        )}

        {/* 목록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 380, overflowY: 'auto' }}>
          {items.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
              {search ? '검색 결과 없음' : '등록된 금칙어가 없습니다.'}
            </p>
          ) : (
            items.map((w) => (
              <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(15,23,42,0.45)', padding: '4px 8px', borderRadius: 5 }}>
                {editingId === w.id ? (
                  <>
                    <input
                      autoFocus
                      value={editingWord}
                      onChange={(e) => setEditingWord(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(w.id); if (e.key === 'Escape') setEditingId(null); }}
                      style={{ flex: 1, padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(99,102,241,0.5)', background: 'rgba(99,102,241,0.1)', color: 'inherit', fontSize: '0.85em' }}
                    />
                    <button onClick={() => handleEditSave(w.id)} style={{ background: 'none', border: 'none', color: '#6ee7b7', cursor: 'pointer' }}><Check size={13} /></button>
                    <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><X size={13} /></button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: '0.87em', fontWeight: 600 }}>{w.word}</span>
                    <button onClick={() => { setEditingId(w.id); setEditingWord(w.word); }} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 2 }}><Pencil size={12} /></button>
                    <button onClick={() => handleDelete(w.id)} style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', padding: 2 }}><Trash2 size={12} /></button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, fontSize: '0.8em', color: 'var(--color-text-muted)' }}>
            <button onClick={() => refresh(page - 1, search)} disabled={page <= 1} style={{ background: 'none', border: 'none', color: 'inherit', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.3 : 1 }}><ChevronLeft size={14} /></button>
            <span>{page} / {totalPages}</span>
            <button onClick={() => refresh(page + 1, search)} disabled={page >= totalPages} style={{ background: 'none', border: 'none', color: 'inherit', cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? 0.3 : 1 }}><ChevronRight size={14} /></button>
          </div>
        )}
      </div>

      {/* 우: 본문 검사 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="glass-card">
          <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ScanText size={16} style={{ color: 'var(--accent-cyan)' }} /> 게시글 본문 검사
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
            띄어쓰기를 무시하고 검사합니다. (예: "도 박" → "도박" 검출)
          </p>
          <textarea
            className="form-input form-textarea"
            value={text} onChange={(e) => setText(e.target.value)}
            placeholder="검사할 게시글 본문을 붙여넣으세요."
            style={{ minHeight: 160 }}
          />
          <button type="button" className="btn-primary" style={{ marginTop: '0.75rem' }} onClick={handleCheck} disabled={isChecking}>
            <ScanText size={15} /> {isChecking ? '검사 중...' : '금칙어 분석'}
          </button>
        </div>

        {checkResult && (
          <>
            <div className="glass-card">
              <div style={{ marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.05rem' }}>
                  검출 결과: 금칙어 {checkResult.totalWordsMatched}종 / 총 {checkResult.totalViolations}회
                </h2>
              </div>
              {checkResult.results.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-green)' }}>
                  <span style={{ fontSize: '1.2rem' }}>✅</span>
                  <span>검출된 금칙어가 없습니다.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {checkResult.results.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', padding: '0.4rem 0.75rem', borderRadius: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--accent-rose)' }}>{r.word}</span>
                      <span className="badge badge-rose" style={{ fontSize: '0.7rem' }}>{r.count}회</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {checkResult.results.length > 0 && (
              <div className="glass-card">
                <h3 className="panel-title">본문 하이라이트</h3>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '0.9rem', background: 'rgba(15,23,42,0.4)', padding: '1rem', borderRadius: '0.5rem' }}>
                  {renderHighlight()}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// 붙여넣기 bulk 팝업 버튼
function BulkPasteButton({ onBulk }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const lines = text.split(/[\n,]/).filter((l) => l.trim()).length;
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '0.8em', whiteSpace: 'nowrap' }}
      >📋 붙여넣기</button>
    );
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card, #1e293b)', borderRadius: 10, padding: '20px 22px', width: '100%', maxWidth: 440, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <p style={{ fontWeight: 700, marginBottom: 10 }}>금칙어 일괄 추가</p>
        <p style={{ fontSize: '0.78em', color: 'var(--color-text-muted)', marginBottom: 10 }}>
          줄바꿈 또는 쉼표로 구분하여 붙여넣으세요. 중복 단어는 자동으로 제외됩니다.
        </p>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'도박\n불법대출\n스팸, 광고'}
          style={{ width: '100%', minHeight: 160, padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'inherit', fontSize: '0.85em', resize: 'vertical' }}
        />
        <p style={{ fontSize: '0.75em', color: 'var(--color-text-muted)', marginTop: 5 }}>
          {lines > 0 ? `${lines.toLocaleString()}개 단어` : '단어 없음'}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={() => { setOpen(false); setText(''); }} style={{ padding: '6px 14px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>취소</button>
          <button
            onClick={async () => { await onBulk(text); setOpen(false); setText(''); }}
            disabled={!lines}
            style={{ padding: '6px 16px', borderRadius: 5, border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
          >추가 ({lines.toLocaleString()}개)</button>
        </div>
      </div>
    </div>
  );
}

export default ForbiddenWordPanel;
