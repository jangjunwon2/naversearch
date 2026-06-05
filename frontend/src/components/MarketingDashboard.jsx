import React, { useState, useEffect, useMemo } from 'react';
import { Target, ArrowUp, ArrowDown, Minus, Sparkles, RefreshCw, Clock, Play, Trash2, Plus } from 'lucide-react';

// 마케팅 대시보드 — 검색량+포화지수+내 순위를 합쳐 "공략 우선순위 / 변화 / 추이 / 자동스캔"
function MarketingDashboard() {
  const [history, setHistory] = useState([]);
  const [groupKey, setGroupKey] = useState('');
  const [view, setView] = useState('priority'); // priority | change | trend | schedule
  const [kwData, setKwData] = useState(null); // 키워드 검색량/포화 (target별)
  const [kwLoading, setKwLoading] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [intervalHours, setIntervalHours] = useState(24);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/history');
        if (r.ok) setHistory(await r.json());
      } catch (e) {
        console.error(e);
      }
      try {
        const r2 = await fetch('/api/schedules');
        if (r2.ok) setSchedules(await r2.json());
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const groups = useMemo(() => {
    const map = new Map();
    history.forEach((rec) => {
      const target = rec.companyName || rec.targetKeyword || rec.userId || rec.blogId || '';
      const type = rec.scanType || (rec.companyName || rec.targetKeyword ? 'company' : 'id');
      if (!target) return;
      const key = `${type}|${target}`;
      if (!map.has(key)) map.set(key, { key, type, target, records: [] });
      map.get(key).records.push(rec);
    });
    for (const g of map.values()) g.records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return [...map.values()];
  }, [history]);

  const selected = groups.find((g) => g.key === groupKey) || groups[0];
  const latest = selected?.records[selected.records.length - 1];
  const prev = selected?.records[selected.records.length - 2];

  // 키워드의 통합검색 노출 순위 배열(낮을수록 상위). undefined=없음, []=미노출
  const extractRanks = (rec, keyword) => {
    if (!rec) return undefined;
    const item = rec.results.find((r) => r.keyword === keyword);
    if (!item) return undefined;
    const isId = rec.scanType === 'id' || (!rec.scanType && (rec.userId || rec.blogId));
    const exposed = isId ? item.exposed : item.targetExposed;
    if (!exposed) return [];
    const matches = isId ? item.userBlogMatches || [] : item.targetMatches || [];
    let ranks = matches.map((m) => m.overallRank || m.rankInBlock).filter(Boolean);
    if (ranks.length === 0 && isId && item.rankDetail?.overallRank) ranks = [item.rankDetail.overallRank];
    return [...new Set(ranks)].sort((a, b) => a - b);
  };
  const bestOf = (ranks) => (Array.isArray(ranks) ? (ranks.length ? ranks[0] : null) : undefined);

  // target 바뀌면 그 키워드들의 검색량/포화 로드
  useEffect(() => {
    if (!latest) return;
    const keywords = [...new Set(latest.results.map((r) => r.keyword))];
    if (keywords.length === 0) return;
    setKwLoading(true);
    setKwData(null);
    (async () => {
      try {
        const res = await fetch('/api/keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywords }),
        });
        if (res.ok) {
          const d = await res.json();
          const map = {};
          (d.keywords || []).forEach((k) => {
            map[k.keyword.replace(/\s+/g, '').toLowerCase()] = k;
          });
          setKwData(map);
        } else {
          setKwData({});
        }
      } catch {
        setKwData({});
      } finally {
        setKwLoading(false);
      }
    })();
  }, [groupKey, latest?.id]);

  const kwOf = (keyword) => (kwData ? kwData[keyword.replace(/\s+/g, '').toLowerCase()] : null);

  // ----- 공략 우선순위 계산 -----
  const exposureScore = (rank) => (rank == null ? 0 : rank <= 5 ? 1 : rank <= 15 ? 0.6 : rank <= 30 ? 0.3 : 0.1);
  const satFactor = (label) => ({ '매우 낮음': 1, 낮음: 0.8, 보통: 0.5, 높음: 0.3, '매우 높음': 0.15 }[label] ?? 0.5);
  const demandWeight = (v) => Math.log10((v || 0) + 1);

  const priorityRows = useMemo(() => {
    if (!latest) return [];
    const keywords = [...new Set(latest.results.map((r) => r.keyword))];
    return keywords
      .map((kw) => {
        const ranks = extractRanks(latest, kw);
        const best = bestOf(ranks);
        const k = kwOf(kw);
        const demand = k?.monthlyTotal ?? null;
        const satLabel = k?.saturationLabel ?? null;
        const score = Math.round(demandWeight(demand) * (1 - exposureScore(best)) * satFactor(satLabel) * 100);
        let action;
        if (best == null) {
          action = demand != null && demand >= 1000 && (satLabel === '매우 낮음' || satLabel === '낮음') ? '🔥 최우선 공략' : '✍️ 공략 추천';
        } else if (best > 15) action = '📈 개선 여지';
        else action = '🛡️ 유지/방어';
        return { keyword: kw, best, exposures: Array.isArray(ranks) ? ranks.length : 0, demand, satLabel, satPct: k?.saturationPct ?? null, score, action };
      })
      .sort((a, b) => b.score - a.score);
  }, [latest, kwData]);

  // ----- 변화 하이라이트 -----
  const changes = useMemo(() => {
    if (!latest || !prev) return null;
    const keywords = [...new Set([...latest.results.map((r) => r.keyword), ...prev.results.map((r) => r.keyword)])];
    const up = [], down = [], entered = [], lost = [];
    keywords.forEach((kw) => {
      const c = bestOf(extractRanks(latest, kw));
      const p = bestOf(extractRanks(prev, kw));
      if (typeof c === 'number' && typeof p === 'number') {
        if (c < p) up.push({ kw, from: p, to: c });
        else if (c > p) down.push({ kw, from: p, to: c });
      } else if (typeof c === 'number' && (p === null || p === undefined)) entered.push({ kw, to: c });
      else if (c === null && typeof p === 'number') lost.push({ kw, from: p });
    });
    return { up, down, entered, lost };
  }, [latest, prev]);

  // ----- 자동 스캔 스케줄 -----
  const addSchedule = async () => {
    if (!latest) return;
    const keywords = [...new Set(latest.results.map((r) => r.keyword))];
    const body = { mode: selected.type, keywords, intervalHours, maxPages: 5 };
    if (selected.type === 'company') body.companyName = selected.target;
    else body.userId = selected.target;
    try {
      const r = await fetch('/api/schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (r.ok) {
        setSchedules(d.schedules);
        alert('자동 스캔을 등록했습니다.');
      } else alert(d.error || '등록 실패');
    } catch (e) {
      console.error(e);
    }
  };
  const toggleSchedule = async (s) => {
    const r = await fetch(`/api/schedules/${s.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !s.enabled }) });
    if (r.ok) setSchedules((await r.json()).schedules);
  };
  const runNow = async (s) => {
    const r = await fetch(`/api/schedules/${s.id}/run`, { method: 'POST' });
    const d = await r.json();
    alert(d.message || d.error || '실행');
  };
  const deleteSchedule = async (s) => {
    if (!confirm('이 자동 스캔을 삭제할까요?')) return;
    const r = await fetch(`/api/schedules/${s.id}`, { method: 'DELETE' });
    if (r.ok) setSchedules((await r.json()).schedules);
  };

  const actionColor = (a) =>
    a.startsWith('🔥') ? 'var(--accent-rose)' : a.startsWith('✍️') ? '#f59e0b' : a.startsWith('📈') ? 'var(--accent-cyan)' : 'var(--accent-green)';

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  if (groups.length === 0) {
    return (
      <div className="glass-card empty-state">
        <div className="empty-icon">📊</div>
        <h2>분석할 스캔 결과가 없습니다.</h2>
        <p>업체명 또는 ID 스캔을 먼저 실행하면, 검색량·포화지수와 합쳐 공략 우선순위를 보여드립니다.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-card">
        <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Target size={18} style={{ color: 'var(--accent-violet)' }} /> 마케팅 대시보드
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
          최근 스캔 결과에 <strong>검색량(수요)</strong> 와 <strong>포화지수(경쟁)</strong> 를 합쳐, 지금 <strong>뭘 공략해야 하는지</strong>를 알려줍니다.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="form-input" value={selected.key} onChange={(e) => setGroupKey(e.target.value)} style={{ maxWidth: '320px' }}>
            {groups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.type === 'company' ? '📢 업체명' : '📝 ID'}: {g.target} (스캔 {g.records.length}회)
              </option>
            ))}
          </select>
          {latest && <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>최신 스캔: {fmtDate(latest.timestamp)}</span>}
          {kwLoading && <span style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><RefreshCw size={12} className="spin" /> 검색량 불러오는 중…</span>}
        </div>

        <div className="navigation-tabs" style={{ display: 'inline-flex', marginTop: '1rem', background: 'rgba(15,23,42,0.4)' }}>
          {[['priority', '🎯 공략 우선순위'], ['change', '🔀 변화'], ['trend', '📈 추이'], ['schedule', '⏰ 자동 스캔']].map(([k, label]) => (
            <button key={k} type="button" className={`tab-button ${view === k ? 'active' : ''}`} onClick={() => setView(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'priority' && (
        <div className="glass-card">
          <h3 className="detail-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.5rem' }}>
            <Sparkles size={16} style={{ color: '#f59e0b' }} /> 공략 우선순위 (기회 점수 높은 순)
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            기회점수 = 검색량(수요) × 미노출/하위일수록 ↑ × 포화 낮을수록 ↑. 🔥 최우선 = 수요 크고 경쟁 낮은데 아직 미노출.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.5rem' }}>키워드</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>검색량</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>포화지수</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>내 순위</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>기회점수</th>
                  <th style={{ padding: '0.5rem' }}>추천</th>
                </tr>
              </thead>
              <tbody>
                {priorityRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '0.5rem', fontWeight: 600 }}>{r.keyword}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{r.demand == null ? '—' : r.demand.toLocaleString()}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.78rem' }}>{r.satLabel || '—'}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      {r.best == null ? <span style={{ color: 'var(--color-text-muted)' }}>미노출</span> : <strong>{r.best}위{r.exposures > 1 ? ` 외${r.exposures - 1}` : ''}</strong>}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--accent-violet)' }}>{r.score}</td>
                    <td style={{ padding: '0.5rem', fontWeight: 700, color: actionColor(r.action), whiteSpace: 'nowrap' }}>{r.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'change' && (
        <div className="glass-card">
          <h3 className="detail-panel-title" style={{ marginBottom: '0.75rem' }}>🔀 직전 스캔 대비 변화</h3>
          {!changes ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>비교하려면 같은 대상으로 <strong>2회 이상</strong> 스캔하세요. (현재 {selected.records.length}회)</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <ChangeCard title="상승" icon={<ArrowUp size={16} />} color="var(--accent-green)" items={changes.up} render={(c) => `${c.kw}  ${c.from}→${c.to}위`} />
              <ChangeCard title="하락" icon={<ArrowDown size={16} />} color="var(--accent-rose)" items={changes.down} render={(c) => `${c.kw}  ${c.from}→${c.to}위`} />
              <ChangeCard title="신규 진입" icon={<Sparkles size={16} />} color="var(--accent-cyan)" items={changes.entered} render={(c) => `${c.kw}  →${c.to}위`} />
              <ChangeCard title="이탈" icon={<Minus size={16} />} color="var(--color-text-muted)" items={changes.lost} render={(c) => `${c.kw}  (이전 ${c.from}위)`} />
            </div>
          )}
        </div>
      )}

      {view === 'trend' && <TrendTable selected={selected} extractRanks={extractRanks} bestOf={bestOf} fmtDate={fmtDate} />}

      {view === 'schedule' && (
        <div className="glass-card">
          <h3 className="detail-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.4rem' }}>
            <Clock size={16} style={{ color: 'var(--accent-violet)' }} /> 자동 주기 스캔
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
            설정한 주기마다 자동 스캔해 <strong>추이를 자동으로 쌓습니다</strong>. 서버가 켜져 있어야 동작하며, 네이버 보호를 위해 최소 6시간 간격입니다.
          </p>

          {/* 현재 대상 자동 스캔 추가 */}
          <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: '0.5rem', padding: '0.85rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem' }}>
              <strong>{selected.type === 'company' ? '📢 ' : '📝 '}{selected.target}</strong>{' '}
              <span style={{ color: 'var(--color-text-muted)' }}>(키워드 {latest ? new Set(latest.results.map((r) => r.keyword)).size : 0}개)</span> 를
            </span>
            <select className="form-input" value={intervalHours} onChange={(e) => setIntervalHours(Number(e.target.value))} style={{ width: 'auto' }}>
              <option value={6}>6시간마다</option>
              <option value={12}>12시간마다</option>
              <option value={24}>매일</option>
              <option value={48}>2일마다</option>
              <option value={168}>주 1회</option>
            </select>
            <button type="button" className="btn-primary" style={{ width: 'auto', padding: '0 1rem' }} onClick={addSchedule}>
              <Plus size={14} /> 자동 스캔 추가
            </button>
          </div>

          {/* 스케줄 목록 */}
          {schedules.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>등록된 자동 스캔이 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {schedules.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', background: 'rgba(15,23,42,0.5)', padding: '0.6rem 0.85rem', borderRadius: '0.45rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                      {s.mode === 'company' ? '📢 ' : '📝 '}{s.companyName || s.userId} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>· 키워드 {s.keywords.length}개 · 매 {s.intervalHours}시간</span>
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                      마지막 실행: {s.lastRun ? new Date(s.lastRun).toLocaleString('ko-KR') : '없음'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button type="button" className="btn-secondary" onClick={() => toggleSchedule(s)} style={{ color: s.enabled ? 'var(--accent-green)' : 'var(--color-text-muted)' }}>
                      {s.enabled ? 'ON' : 'OFF'}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => runNow(s)} title="지금 실행">
                      <Play size={13} /> 지금
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => deleteSchedule(s)} style={{ color: 'var(--accent-rose)' }} title="삭제">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChangeCard({ title, icon, color, items, render }) {
  return (
    <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: '0.5rem', padding: '0.85rem', borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color, fontWeight: 700, marginBottom: '0.5rem' }}>
        {icon} {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>없음</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {items.map((c, i) => (
            <span key={i} style={{ fontSize: '0.78rem' }}>{render(c)}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function TrendTable({ selected, extractRanks, bestOf, fmtDate }) {
  const records = selected.records.slice(-8);
  const keywords = [...new Set(selected.records.flatMap((r) => r.results.map((x) => x.keyword)))];
  const delta = (cur, prev) => {
    const c = bestOf(cur), p = bestOf(prev);
    if (typeof c === 'number' && typeof p === 'number') {
      if (c < p) return <ArrowUp size={12} style={{ color: 'var(--accent-green)' }} />;
      if (c > p) return <ArrowDown size={12} style={{ color: 'var(--accent-rose)' }} />;
      return <Minus size={12} style={{ color: 'var(--color-text-muted)' }} />;
    }
    if (typeof c === 'number' && p === null) return <ArrowUp size={12} style={{ color: 'var(--accent-green)' }} />;
    if (c === null && typeof p === 'number') return <ArrowDown size={12} style={{ color: 'var(--accent-rose)' }} />;
    return null;
  };
  const cell = (ranks) => {
    if (ranks === undefined) return <span style={{ color: 'var(--color-text-muted)' }}>·</span>;
    if (ranks.length === 0) return <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>미노출</span>;
    return <span style={{ fontWeight: 700 }} title={ranks.map((r) => `${r}위`).join(', ')}>{ranks[0]}위{ranks.length > 1 ? <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 400 }}> 외{ranks.length - 1}</span> : null}</span>;
  };
  if (records.length < 2) {
    return (
      <div className="glass-card">
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>추이를 보려면 같은 대상으로 <strong>2회 이상</strong> 스캔하세요. (자동 주기 스캔을 켜면 자동으로 쌓입니다)</p>
      </div>
    );
  }
  return (
    <div className="glass-card">
      <h3 className="detail-panel-title" style={{ marginBottom: '0.5rem' }}>📈 통합검색 노출 순위 추이</h3>
      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>숫자=통합검색 노출 순위(낮을수록 상위) · ▲상승 ▼하락 · 미노출=없음</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '0.5rem' }}>키워드</th>
              {records.map((rec, i) => (
                <th key={i} style={{ padding: '0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>{fmtDate(rec.timestamp)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keywords.map((kw, ki) => (
              <tr key={ki} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '0.5rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{kw}</td>
                {records.map((rec, i) => {
                  const ranks = extractRanks(rec, kw);
                  const prev = i > 0 ? extractRanks(records[i - 1], kw) : undefined;
                  return (
                    <td key={i} style={{ padding: '0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>{cell(ranks)}{i > 0 && delta(ranks, prev)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MarketingDashboard;
