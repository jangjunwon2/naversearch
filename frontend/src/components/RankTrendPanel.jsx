import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, ArrowUp, ArrowDown, Minus } from 'lucide-react';

// 기능: 순위 변동 추적 — 히스토리의 같은 타겟 스캔들을 모아 키워드별 순위 추이 표시
function RankTrendPanel() {
  const [history, setHistory] = useState([]);
  const [groupKey, setGroupKey] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/history');
        if (r.ok) setHistory(await r.json());
      } catch (e) {
        console.error('히스토리 조회 실패:', e);
      }
    })();
  }, []);

  // (scanType + 타겟)별로 레코드를 묶음
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
    // 시간 오름차순 정렬
    for (const g of map.values()) g.records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return [...map.values()].filter((g) => g.records.length >= 1);
  }, [history]);

  const selected = groups.find((g) => g.key === groupKey) || groups[0];

  // 키워드 결과에서 대표 순위 추출 (낮을수록 상위). 미노출이면 null
  const extractRank = (rec, keyword) => {
    const item = rec.results.find((r) => r.keyword === keyword);
    if (!item) return undefined; // 그 회차엔 해당 키워드 없음
    if (rec.scanType === 'id' || (!rec.scanType && (rec.userId || rec.blogId))) {
      if (!item.exposed) return null;
      const ranks = (item.userBlogMatches || []).map((m) => m.overallRank || m.rankInBlock).filter(Boolean);
      if (ranks.length) return Math.min(...ranks);
      return item.rankDetail?.overallRank ?? null;
    }
    // company
    if (!item.targetExposed) return null;
    const ranks = (item.targetMatches || []).map((m) => m.overallRank || m.rankInBlock).filter(Boolean);
    return ranks.length ? Math.min(...ranks) : null;
  };

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const cell = (rank) => {
    if (rank === undefined) return <span style={{ color: 'var(--color-text-muted)' }}>·</span>;
    if (rank === null) return <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>미노출</span>;
    return <span style={{ fontWeight: 700 }}>{rank}위</span>;
  };

  // 직전 회차 대비 변동 아이콘 (순위는 낮을수록 좋음)
  const delta = (cur, prev) => {
    if (typeof cur !== 'number' || typeof prev !== 'number') {
      if (typeof cur === 'number' && (prev === null || prev === undefined)) return <ArrowUp size={12} style={{ color: 'var(--accent-green)' }} />; // 신규 진입
      if (cur === null && typeof prev === 'number') return <ArrowDown size={12} style={{ color: 'var(--accent-rose)' }} />; // 이탈
      return null;
    }
    if (cur < prev) return <ArrowUp size={12} style={{ color: 'var(--accent-green)' }} />;
    if (cur > prev) return <ArrowDown size={12} style={{ color: 'var(--accent-rose)' }} />;
    return <Minus size={12} style={{ color: 'var(--color-text-muted)' }} />;
  };

  if (groups.length === 0) {
    return (
      <div className="glass-card empty-state">
        <div className="empty-icon">📈</div>
        <h2>추적할 데이터가 없습니다.</h2>
        <p>업체명/ID 스캔을 같은 대상으로 여러 번 실행하면, 여기서 키워드별 순위 변동을 볼 수 있습니다.</p>
      </div>
    );
  }

  // 표시할 회차(최근 8개)와 키워드(최신 회차 기준 합집합)
  const records = selected.records.slice(-8);
  const keywords = [...new Set(selected.records.flatMap((r) => r.results.map((x) => x.keyword)))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-card">
        <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <TrendingUp size={18} style={{ color: 'var(--accent-violet)' }} /> 순위 변동 추적
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
          같은 대상으로 여러 번 스캔한 기록의 키워드별 순위 추이입니다. (▲ 상승 / ▼ 하락, 순위는 낮을수록 상위)
        </p>
        <select className="form-input" value={selected.key} onChange={(e) => setGroupKey(e.target.value)} style={{ maxWidth: '360px' }}>
          {groups.map((g) => (
            <option key={g.key} value={g.key}>
              {g.type === 'company' ? '📢 업체명' : '📝 ID'}: {g.target} (스캔 {g.records.length}회)
            </option>
          ))}
        </select>
      </div>

      <div className="glass-card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '0.5rem', position: 'sticky', left: 0 }}>키워드</th>
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
                    const rank = extractRank(rec, kw);
                    const prev = i > 0 ? extractRank(records[i - 1], kw) : undefined;
                    return (
                      <td key={i} style={{ padding: '0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                          {cell(rank)}
                          {i > 0 && delta(rank, prev)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default RankTrendPanel;
