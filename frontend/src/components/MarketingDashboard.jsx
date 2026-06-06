import React, { useState, useEffect, useMemo } from 'react';
import { Target, ArrowUp, ArrowDown, Minus, Sparkles, RefreshCw, Clock, Play, Trash2, Plus } from 'lucide-react';
import NotificationSettings from './NotificationSettings';

// 마케팅 대시보드 — 검색량+포화지수+내 순위 합산: 공략 우선순위 / 변화 / 스마트블록 / 자동스캔 / 알림
function MarketingDashboard() {
  const [history, setHistory] = useState([]);
  const [groupKey, setGroupKey] = useState('');
  const [view, setView] = useState('priority');
  const [kwData, setKwData] = useState(null);
  const [kwLoading, setKwLoading] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [intervalHours, setIntervalHours] = useState(24);
  const [dailyHour, setDailyHour] = useState(9);

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

  // target 바뀌면 키워드 검색량/포화 로드
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
        const ranksArr = Array.isArray(ranks) ? ranks : [];
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
        return {
          keyword: kw, ranks: ranksArr, best, exposures: ranksArr.length,
          demand, satLabel, satPct: k?.saturationPct ?? null,
          monthlyPosts: k?.monthlyPosts ?? null, blogTotal: k?.blogTotal ?? null,
          score, action,
        };
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
    if (intervalHours >= 24) body.dailyHour = dailyHour;
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
          {[['priority', '🎯 공략 우선순위'], ['change', '🔀 변화'], ['smart', '🧩 스마트블록'], ['schedule', '⏰ 자동 스캔'], ['notify', '🔔 알림']].map(([k, label]) => (
            <button key={k} type="button" className={`tab-button ${view === k ? 'active' : ''}`} onClick={() => setView(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== 공략 우선순위 ===== */}
      {view === 'priority' && (
        <div className="glass-card">
          <h3 className="detail-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.5rem' }}>
            <Sparkles size={16} style={{ color: '#f59e0b' }} /> 공략 우선순위 (기회 점수 높은 순)
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            기회점수 = 검색량(수요) × 미노출/하위일수록 ↑ × 포화 낮을수록 ↑. 🔥 최우선 = 수요 크고 경쟁 낮은데 아직 미노출.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.5rem' }}>키워드</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>검색량</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>신규발행</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>총발행량</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>포화%</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>포화등급</th>
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
                    <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--accent-cyan)' }}>{r.monthlyPosts == null ? '—' : r.monthlyPosts.toLocaleString()}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{r.blogTotal == null ? '—' : r.blogTotal.toLocaleString()}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{r.satPct == null ? '—' : `${r.satPct}%`}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.78rem' }}>{r.satLabel || '—'}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      {r.best == null
                        ? <span style={{ color: 'var(--color-text-muted)' }}>미노출</span>
                        : <strong>{r.ranks.map((rk) => `${rk}위`).join(', ')}</strong>}
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

      {/* ===== 변화 ===== */}
      {view === 'change' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
          {/* 게시물별 순위 이력 (ID 스캔) */}
          <PostHistory selected={selected} fmtDate={fmtDate} />
        </div>
      )}

      {/* ===== 스마트블록 모니터 ===== */}
      {view === 'smart' && <SmartBlockMonitor selected={selected} fmtDate={fmtDate} />}

      {/* ===== 자동 스캔 ===== */}
      {view === 'schedule' && (
        <div className="glass-card">
          <h3 className="detail-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.4rem' }}>
            <Clock size={16} style={{ color: 'var(--accent-violet)' }} /> 자동 주기 스캔
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
            설정한 주기마다 자동 스캔해 <strong>추이를 자동으로 쌓습니다</strong>. 서버가 켜져 있어야 동작하며, 네이버 보호를 위해 최소 6시간 간격입니다.
          </p>

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
            {intervalHours >= 24 && (
              <>
                <span style={{ fontSize: '0.85rem' }}>오전/오후</span>
                <select className="form-input" value={dailyHour} onChange={(e) => setDailyHour(Number(e.target.value))} style={{ width: 'auto' }}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>에</span>
              </>
            )}
            <button type="button" className="btn-primary" style={{ width: 'auto', padding: '0 1rem' }} onClick={addSchedule}>
              <Plus size={14} /> 자동 스캔 추가
            </button>
          </div>

          {schedules.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>등록된 자동 스캔이 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {schedules.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', background: 'rgba(15,23,42,0.5)', padding: '0.6rem 0.85rem', borderRadius: '0.45rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                      {s.mode === 'company' ? '📢 ' : '📝 '}{s.companyName || s.userId}{' '}
                      <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>
                        · 키워드 {s.keywords.length}개 · {s.dailyHour !== undefined ? `매일 ${String(s.dailyHour).padStart(2, '0')}:00` : `매 ${s.intervalHours}시간`}
                      </span>
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

      {/* ===== 알림 ===== */}
      {view === 'notify' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <ScanStatusSummary latest={latest} extractRanks={extractRanks} />
          <NotificationSettings />
        </div>
      )}
    </div>
  );
}

// ===== 서브 컴포넌트들 =====

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

// 게시물별 순위 이력 — ID 스캔 시 각 글의 순위 변동 추적
function PostHistory({ selected, fmtDate }) {
  const postMap = useMemo(() => {
    if (!selected || selected.type !== 'id') return null;
    const map = new Map();
    selected.records.forEach((rec) => {
      const ts = rec.timestamp;
      (rec.results || []).forEach((r) => {
        (r.userBlogMatches || []).forEach((m) => {
          const url = m.url || m.href;
          if (!url) return;
          if (!map.has(url)) map.set(url, { url, title: m.title || url, entries: [] });
          map.get(url).entries.push({ ts, rank: m.overallRank, keyword: r.keyword });
        });
      });
    });
    return [...map.values()].sort((a, b) => {
      const aLast = a.entries[a.entries.length - 1]?.rank ?? 9999;
      const bLast = b.entries[b.entries.length - 1]?.rank ?? 9999;
      return aLast - bLast;
    });
  }, [selected]);

  if (!postMap) return null;
  if (postMap.length === 0) return (
    <div className="glass-card">
      <h3 className="detail-panel-title" style={{ marginBottom: '0.5rem' }}>📄 내 글 순위 이력</h3>
      <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>아직 글이 순위에서 발견되지 않았습니다.</p>
    </div>
  );

  // 최근 5회 스캔 타임스탬프 (전체 기록 기준)
  const allTs = selected.records.map((r) => r.timestamp).slice(-5);

  return (
    <div className="glass-card">
      <h3 className="detail-panel-title" style={{ marginBottom: '0.5rem' }}>📄 내 글 순위 이력</h3>
      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>각 글이 통합검색에서 몇 위였는지 기록합니다.</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '0.4rem 0.5rem' }}>게시물</th>
              {allTs.map((ts, i) => (
                <th key={i} style={{ padding: '0.4rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>{fmtDate(ts)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {postMap.map((post, pi) => {
              const entryByTs = Object.fromEntries(post.entries.map((e) => [e.ts, e.rank]));
              return (
                <tr key={pi} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.4rem 0.5rem', maxWidth: '220px' }}>
                    <a href={post.url} target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontSize: '0.78rem' }}
                      title={post.url}>
                      {post.title.length > 30 ? post.title.slice(0, 28) + '…' : post.title}
                    </a>
                  </td>
                  {allTs.map((ts, ti) => {
                    const rank = entryByTs[ts];
                    const prev = ti > 0 ? entryByTs[allTs[ti - 1]] : undefined;
                    const up = rank != null && prev != null && rank < prev;
                    const down = rank != null && prev != null && rank > prev;
                    return (
                      <td key={ti} style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                        {rank == null
                          ? <span style={{ color: 'var(--color-text-muted)' }}>·</span>
                          : <span style={{ fontWeight: 700, color: up ? 'var(--accent-green)' : down ? 'var(--accent-rose)' : undefined }}>
                            {rank}위{up ? ' ▲' : down ? ' ▼' : ''}
                          </span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 스마트블록 모니터 — 키워드별 통합검색 스마트블록 현황
function SmartBlockMonitor({ selected, fmtDate }) {
  const latest = selected?.records[selected.records.length - 1];

  if (!latest) {
    return (
      <div className="glass-card">
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>스캔 결과가 없습니다.</p>
      </div>
    );
  }

  const results = latest.results || [];

  return (
    <div className="glass-card">
      <h3 className="detail-panel-title" style={{ marginBottom: '0.75rem' }}>🧩 스마트블록 현황</h3>
      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
        최신 스캔({fmtDate(latest.timestamp)}) 기준 · 각 키워드 통합검색에서 노출되는 스마트블록 구성
      </p>
      {results.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>결과가 없습니다.</p>
      )}
      {results.map((r, i) => {
        const blocks = r.smartBlocks || [];
        return (
          <div key={i} style={{ marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.88rem' }}>{r.keyword}</div>
            {blocks.length === 0 ? (
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>스마트블록 정보 없음 (스캔 재실행 시 수집)</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {blocks.map((b, j) => (
                  <div key={j} style={{
                    background: 'rgba(15,23,42,0.5)', borderRadius: '0.4rem',
                    padding: '0.4rem 0.85rem', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <strong>{b.blockName}</strong>
                    {b.blogCount > 0 && <span style={{ color: 'var(--accent-green)', marginLeft: 6 }}>블로그 {b.blogCount}</span>}
                    {b.cafeCount > 0 && <span style={{ color: 'var(--accent-cyan)', marginLeft: 6 }}>카페 {b.cafeCount}</span>}
                    {b.kinCount > 0 && <span style={{ color: 'var(--accent-violet)', marginLeft: 6 }}>지식iN {b.kinCount}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 최신 스캔 노출 현황 요약 — 알림 탭 상단
function ScanStatusSummary({ latest, extractRanks }) {
  const [targetRank, setTargetRank] = useState(10);
  useEffect(() => {
    fetch('/api/notifications').then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.targetRank) setTargetRank(d.targetRank);
    }).catch(() => {});
  }, []);

  if (!latest) return null;

  const results = latest.results || [];
  const isId = latest.scanType === 'id' || (!latest.scanType && (latest.userId || latest.blogId));

  return (
    <div className="glass-card">
      <h3 className="detail-panel-title" style={{ marginBottom: '0.5rem' }}>📊 최신 스캔 노출 현황</h3>
      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
        통합검색 기준 · 탭별 노출 상태. 목표: 상위 <strong>{targetRank}위</strong> 이내 노출
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '0.45rem 0.5rem' }}>키워드</th>
              <th style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>{isId ? '블로그 탭 순위' : '블로그/지식iN'}</th>
              {!isId && <th style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>플레이스</th>}
              {!isId && <th style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>파워링크</th>}
              <th style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>목표 달성</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => {
              const ranks = extractRanks(latest, r.keyword);
              const exposed = Array.isArray(ranks) && ranks.length > 0;
              const placeMatch = !isId && (r.targetMatches || []).find((m) => m.type === 'place');
              const plinkMatch = !isId && (r.targetMatches || []).find((m) => m.type === 'power_link');
              const goalAchieved = Array.isArray(ranks) && ranks.some((rk) => rk <= targetRank);
              const goalHint = isId
                ? (goalAchieved ? `블로그 ${ranks.filter((rk) => rk <= targetRank).map((rk) => `${rk}위`).join('·')} 달성` : '미달성')
                : [goalAchieved && '블로그', placeMatch && '플레이스', plinkMatch && '파워링크'].filter(Boolean).join(' · ') || '미달성';

              return (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.45rem 0.5rem', fontWeight: 600 }}>{r.keyword}</td>
                  <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>
                    {Array.isArray(ranks) && ranks.length > 0
                      ? <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{ranks.map((rk) => `${rk}위`).join(', ')}</span>
                      : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>미노출</span>}
                  </td>
                  {!isId && (
                    <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>
                      {placeMatch
                        ? <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>노출{placeMatch.overallRank ? ` ${placeMatch.overallRank}위` : ''}</span>
                        : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>미노출</span>}
                    </td>
                  )}
                  {!isId && (
                    <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>
                      {plinkMatch
                        ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>노출{plinkMatch.overallRank ? ` ${plinkMatch.overallRank}위` : ''}</span>
                        : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>미노출</span>}
                    </td>
                  )}
                  <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>
                    {goalAchieved || (!isId && (placeMatch || plinkMatch))
                      ? <span style={{ color: 'var(--accent-green)', fontWeight: 700, fontSize: '0.8rem' }}>✅ {goalHint}</span>
                      : <span style={{ color: 'var(--accent-rose)', fontSize: '0.78rem' }}>❌ {goalHint}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MarketingDashboard;
