import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ShieldAlert, ScanText, ListPlus } from 'lucide-react';

// 기능3: 금칙어 사전 관리 + 본문 검사 (띄어쓰기 무시)
function ForbiddenWordPanel() {
  const [words, setWords] = useState([]);
  const [newWord, setNewWord] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);

  const [text, setText] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    fetchWords();
  }, []);

  const fetchWords = async () => {
    try {
      const res = await fetch('/api/forbidden/words');
      if (res.ok) setWords(await res.json());
    } catch (e) {
      console.error('금칙어 목록 조회 실패:', e);
    }
  };

  const handleAddWord = async (e) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    try {
      const res = await fetch('/api/forbidden/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: newWord.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setWords(data.words);
        setNewWord('');
      } else {
        alert(data.error || '추가 실패');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkText.trim()) return;
    try {
      const res = await fetch('/api/forbidden/words/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: bulkText }),
      });
      const data = await res.json();
      if (res.ok) {
        setWords(data.words);
        setBulkText('');
        setShowBulk(false);
        alert(`${data.added}개의 금칙어가 추가되었습니다.`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteWord = async (id) => {
    try {
      const res = await fetch(`/api/forbidden/words/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) setWords(data.words);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCheck = async () => {
    if (!text.trim()) {
      alert('검사할 본문을 입력해주세요.');
      return;
    }
    setIsChecking(true);
    try {
      const res = await fetch('/api/forbidden/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) setCheckResult(await res.json());
    } catch (e) {
      console.error(e);
      alert('검사 중 오류가 발생했습니다.');
    } finally {
      setIsChecking(false);
    }
  };

  // 모든 매칭 위치를 병합하여 본문 하이라이트 세그먼트 생성
  const renderHighlightedText = () => {
    if (!checkResult || checkResult.results.length === 0) return text;

    const intervals = [];
    checkResult.results.forEach((r) => {
      r.positions.forEach((p) => intervals.push({ start: p.start, end: p.end }));
    });
    intervals.sort((a, b) => a.start - b.start);

    // 겹치는 구간 병합
    const merged = [];
    intervals.forEach((iv) => {
      const last = merged[merged.length - 1];
      if (last && iv.start <= last.end) {
        last.end = Math.max(last.end, iv.end);
      } else {
        merged.push({ ...iv });
      }
    });

    const segments = [];
    let cursor = 0;
    merged.forEach((iv, i) => {
      if (cursor < iv.start) segments.push(<span key={`t${i}`}>{text.slice(cursor, iv.start)}</span>);
      segments.push(
        <mark key={`m${i}`} className="highlight-word">
          {text.slice(iv.start, iv.end)}
        </mark>
      );
      cursor = iv.end;
    });
    if (cursor < text.length) segments.push(<span key="t-end">{text.slice(cursor)}</span>);
    return segments;
  };

  return (
    <div className="forbidden-grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', alignItems: 'start' }}>
      {/* 좌: 금칙어 사전 */}
      <div className="glass-card">
        <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ShieldAlert size={18} style={{ color: 'var(--accent-rose)' }} /> 금칙어 사전 ({words.length})
        </h3>

        <form onSubmit={handleAddWord} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            type="text"
            className="form-input"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            placeholder="금칙어 입력"
          />
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0 0.9rem', flexShrink: 0 }}>
            <Plus size={16} />
          </button>
        </form>

        <button
          type="button"
          className="btn-secondary"
          style={{ width: '100%', marginBottom: '0.75rem' }}
          onClick={() => setShowBulk((v) => !v)}
        >
          <ListPlus size={14} /> 여러 개 한 번에 추가
        </button>

        {showBulk && (
          <div style={{ marginBottom: '0.75rem' }}>
            <textarea
              className="form-input form-textarea"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="줄바꿈 또는 쉼표로 구분&#10;예:&#10;도박&#10;광고, 스팸"
              style={{ minHeight: '80px' }}
            />
            <button type="button" className="btn-primary" style={{ marginTop: '0.5rem' }} onClick={handleBulkAdd}>
              일괄 추가
            </button>
          </div>
        )}

        <div className="forbidden-word-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '480px', overflowY: 'auto' }}>
          {words.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '1rem 0' }}>
              등록된 금칙어가 없습니다.
            </p>
          ) : (
            words.map((w) => (
              <div
                key={w.id}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.5)', padding: '0.45rem 0.7rem', borderRadius: '0.4rem' }}
              >
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{w.word}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteWord(w.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-rose)', display: 'flex' }}
                  title="삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 우: 본문 검사 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="glass-card">
          <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ScanText size={18} style={{ color: 'var(--accent-cyan)' }} /> 게시글 본문 검사
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
            띄어쓰기를 무시하고 검사합니다. (예: "도 박" → "도박"으로 검출)
          </p>
          <textarea
            className="form-input form-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="검사할 게시글 본문을 붙여넣으세요."
            style={{ minHeight: '160px' }}
          />
          <button type="button" className="btn-primary" style={{ marginTop: '0.75rem' }} onClick={handleCheck} disabled={isChecking}>
            <ScanText size={16} /> {isChecking ? '검사 중...' : '금칙어 분석'}
          </button>
        </div>

        {checkResult && (
          <>
            <div className="glass-card">
              <div className="section-header" style={{ marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.1rem' }}>
                  검출 결과: 금칙어 {checkResult.totalWordsMatched}종 / 총 {checkResult.totalViolations}회
                </h2>
              </div>

              {checkResult.results.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-green)' }}>
                  <span style={{ fontSize: '1.2rem' }}>✅</span>
                  <span>검출된 금칙어가 없습니다.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                  {checkResult.results.map((r, i) => (
                    <div
                      key={i}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '0.45rem 0.8rem', borderRadius: '0.5rem' }}
                    >
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
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '0.9rem', background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: '0.5rem' }}>
                  {renderHighlightedText()}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ForbiddenWordPanel;
