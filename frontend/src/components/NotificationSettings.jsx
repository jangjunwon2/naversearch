import React, { useState, useEffect } from 'react';
import { Bell, Send, AlertTriangle } from 'lucide-react';

// 알림 설정 — Discord 웹훅 기반. 웹훅 URL은 서버 .env 전용이라 여기선 설정 여부만 표시.
function NotificationSettings() {
  const [s, setS] = useState(null);
  const [testMsg, setTestMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/notifications');
        if (r.ok) setS(await r.json());
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const save = async (patch) => {
    setSaving(true);
    try {
      const r = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (r.ok) setS(await r.json());
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTestMsg('');
    try {
      const r = await fetch('/api/notifications/test', { method: 'POST' });
      const d = await r.json();
      setTestMsg(r.ok ? '✅ 테스트 메시지를 보냈습니다. Discord를 확인하세요.' : d.error || '발송 실패');
    } catch {
      setTestMsg('발송 오류');
    }
  };

  if (!s) {
    return <div className="glass-card"><p style={{ color: 'var(--color-text-muted)' }}>설정을 불러오는 중…</p></div>;
  }

  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.6rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' };

  return (
    <div className="glass-card">
      <h3 className="detail-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.4rem' }}>
        <Bell size={16} style={{ color: 'var(--accent-violet)' }} /> Discord 순위 알림
      </h3>
      <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
        자동 주기 스캔에서 <strong>순위 하락·이탈·목표 미달</strong>을 감지해 Discord로 푸시합니다. 통합검색 전체 순위 기준.
      </p>

      {!s.webhookConfigured && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', background: 'rgba(244,63,94,0.12)', color: 'var(--accent-rose)', padding: '0.6rem 0.85rem', borderRadius: '0.45rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
          <AlertTriangle size={15} /> 서버 <code>.env</code>에 <code>DISCORD_WEBHOOK_URL</code>이 설정되지 않아 알림이 발송되지 않습니다.
        </div>
      )}

      <div style={row}>
        <span><strong>알림 켜기</strong> <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>(전체 마스터 스위치)</span></span>
        <input type="checkbox" checked={s.enabled} onChange={(e) => save({ enabled: e.target.checked })} />
      </div>

      <div style={row}>
        <span>목표 상위 순위 <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>(이보다 낮으면 미달)</span></span>
        <span>상위 <input type="number" min={1} max={100} value={s.targetRank} onChange={(e) => save({ targetRank: Number(e.target.value) })} className="form-input" style={{ width: '70px', display: 'inline-block' }} /> 위</span>
      </div>

      <div style={row}>
        <span>순위 하락·이탈 시 알림</span>
        <input type="checkbox" checked={s.alertOnDrop} onChange={(e) => save({ alertOnDrop: e.target.checked })} />
      </div>

      <div style={row}>
        <span>목표 미달 시 알림</span>
        <input type="checkbox" checked={s.alertOnBelowTarget} onChange={(e) => save({ alertOnBelowTarget: e.target.checked })} />
      </div>

      <div style={row}>
        <span>매일 정기 리포트(다이제스트)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={s.digest.enabled} onChange={(e) => save({ digest: { ...s.digest, enabled: e.target.checked } })} />
          <select className="form-input" value={s.digest.hour} onChange={(e) => save({ digest: { ...s.digest, hour: Number(e.target.value) } })} style={{ width: 'auto' }} disabled={!s.digest.enabled}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
          </select>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
        <button type="button" className="btn-secondary" onClick={sendTest} disabled={!s.webhookConfigured} style={{ width: 'auto', padding: '0 1rem' }}>
          <Send size={13} /> 테스트 발송
        </button>
        {saving && <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>저장 중…</span>}
        {testMsg && <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>{testMsg}</span>}
      </div>

      <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '1rem' }}>
        ※ 다이제스트 시각은 서버 로컬 시간 기준입니다(한국 서버 권장: <code>TZ=Asia/Seoul</code>). 알림은 자동 주기 스캔에서만 발송됩니다.
      </p>
    </div>
  );
}

export default NotificationSettings;
