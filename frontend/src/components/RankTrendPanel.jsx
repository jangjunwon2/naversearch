import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, ArrowUp, ArrowDown, Minus } from 'lucide-react';

// 순위 변동 추적 — 히스토리의 같은 타겟 스캔들을 모아 키워드별 "통합검색 노출 순위" 추이 표시
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
    return [...map.values()].filter((g) => g.records.length >= 1);
  }, [history]);

  const selected = groups.find((g) => g.key === groupKey) || groups[0];

  // 키워드의 통합검색 노출 순위 배열(낮을수록 상위). undefined=그 회차에 없음, []=미노출
  const extractRanks = (rec, keyword) => {
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

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const cell = (ranks) => {
    if (ranks === undefined) return <span style={{ color: 'var(--color-text-muted)' }}>·</span>;
    if (ranks.length === 0) return <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>미노출</span>;
    const title = ranks.map((r) => `${r}위`).join(', ');
    return (
      <span style={{ fontWeight: 700 }} title={`노출 순위: ${title}`}>
        {ranks[0]}위{ranks.length > 1 ? <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 400 }}> 외{ranks.length - 1}</span> : null}
      </span>
    );
  };

  // 직전 회차 best 순위 대비 변동 (순위는 낮을수록 좋음)
  const delta = (cur, prev) => {
    const c = bestOf(cur);
    const p = bestOf(prev);
    if (typeof c === 'number' && typeof p === 'number') {
      if (c < p) return <ArrowUp size={12} style={{ color: 'var(--accent-green)' }} />;
      if (c > p) return <ArrowDown size={12} style={{ color: 'var(--accent-rose)' }} />;
      return <Minus size={12} style={{ color: 'var(--color-text-muted)' }} />;
    }
    if (typeof c === 'number' && (p === null)) return <ArrowUp size={12} style={{ color: 'var(--accent-green)' }} />; // 신규 진입
    if (c === null && typeof p === 'number') return <ArrowDown size={12} style={{ color: 'var(--accent-rose)' }} />; // 이탈
    return null;
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

  const records = selected.records.slice(-8);
  const keywords = [...new Set(selected.records.flatMap((r) => r.results.map((x) => x.keyword)))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-card">
        <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <TrendingUp size={18} style={{ color: 'var(--accent-violet)' }} /> 순위 변동 추적
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
          숫자 = <strong>통합검색 노출 순위</strong>(전체에서 위→아래 몇 번째, 낮을수록 상위). 한 키워드에서 여러 번 노출되면 <em>가장 높은 순위 + 외N</em>으로 표시(셀에 마우스 올리면 전체 순위).
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          <ArrowUp size={11} style={{ color: 'var(--accent-green)', verticalAlign: 'middle' }} /> 상승 ·
          <ArrowDown size={11} style={{ color: 'var(--accent-rose)', verticalAlign: 'middle' }} /> 하락 ·
          <Minus size={11} style={{ color: 'var(--color-text-muted)', verticalAlign: 'middle' }} /> 동일 · 미노출 = 통합검색에 없음
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
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                          {cell(ranks)}
                          {i > 0 && delta(ranks, prev)}
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
