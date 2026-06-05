import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';

// 접근 비밀번호 게이트. 서버가 APP_PASSWORD를 설정한 경우에만 로그인 화면을 띄운다.
function AuthGate({ children }) {
  const [loading, setLoading] = useState(true);
  const [required, setRequired] = useState(false);
  const [authed, setAuthed] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/auth/status');
        const d = await r.json();
        setRequired(d.required);
        setAuthed(d.authed);
      } catch {
        setRequired(false);
        setAuthed(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (r.ok) {
        setAuthed(true);
      } else {
        const d = await r.json().catch(() => ({}));
        setError(d.error || '로그인 실패');
      }
    } catch (e) {
      setError('서버 연결 실패');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  if (!required || authed) return children;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="glass-card" style={{ maxWidth: '360px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.25rem' }}>네이버 검색 순위 체크</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
          <Lock size={14} /> 접근하려면 비밀번호를 입력하세요
        </p>
        <form onSubmit={submit}>
          <input
            type="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoFocus
            style={{ textAlign: 'center', marginBottom: '0.75rem' }}
          />
          {error && <p style={{ color: 'var(--accent-rose)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{error}</p>}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? '확인 중...' : '입장'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AuthGate;
