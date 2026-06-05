import React, { useState } from 'react';
import { Search, BarChart3, Copy, TrendingUp, AlertCircle, Save, Download, ArrowRightCircle } from 'lucide-react';

// 기능4: 키워드 리서치 — 검색광고 키워드도구 API (연관키워드 + 월간검색량 + 그래프)
// onSendToScan(mode, keywords[]): 선택 키워드를 업체명/ID 스캔 탭으로 전달
function KeywordResearchPanel({ onSendToScan }) {
  const [seedInput, setSeedInput] = useState('광주 방탈출');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('monthlyTotal');
  const [selected, setSelected] = useState(() => new Set());
  const [blogStatsAvailable, setBlogStatsAvailable] = useState(true);

  const handleSearch = async (e) => {
    e.preventDefault();
    const keywords = seedInput
      .split(/[\n,]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
      .slice(0, 5);
    if (keywords.length === 0) {
      alert('키워드를 입력해주세요 (최대 5개).');
      return;
    }

    setLoading(true);
    setError(null);
    setRows([]);
    setSelected(new Set());
    try {
      const res = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords }),
      });
      const data = await res.json();
      if (res.ok) {
        setRows(data.keywords);
        setBlogStatsAvailable(data.blogStatsAvailable !== false);
      } else {
        setError({ code: data.code, message: data.error });
      }
    } catch (e) {
      setError({ message: '요청 실패: ' + e.message });
    } finally {
      setLoading(false);
    }
  };

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? -1;
    const bv = b[sortKey] ?? -1;
    return bv - av;
  });
  const chartRows = sorted.slice(0, 15);
  const maxTotal = chartRows.length ? Math.max(...chartRows.map((r) => r.monthlyTotal)) : 1;

  // 포화지수 색: 낮을수록 기회(초록), 높을수록 포화(빨강)
  const satColor = (label) => {
    if (!label) return 'var(--color-text-muted)';
    if (label === '매우 낮음' || label === '낮음') return 'var(--accent-green)';
    if (label === '보통') return '#f59e0b';
    return 'var(--accent-rose)'; // 높음 / 매우 높음
  };

  const copyKeywords = () => {
    navigator.clipboard.writeText(sorted.map((r) => r.keyword).join('\n'));
    alert(`${sorted.length}개 키워드를 복사했습니다.`);
  };

  const toggleSel = (kw) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(kw) ? n.delete(kw) : n.add(kw);
      return n;
    });

  const allSelected = sorted.length > 0 && sorted.every((r) => selected.has(r.keyword));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(sorted.map((r) => r.keyword)));

  const saveSelected = async () => {
    const kws = [...selected];
    if (kws.length === 0) {
      alert('선택된 키워드가 없습니다.');
      return;
    }
    const name = prompt(`선택한 ${kws.length}개 키워드를 어떤 이름의 목록으로 저장할까요?`);
    if (!name || !name.trim()) return;
    try {
      const r = await fetch('/api/keyword-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), keywords: kws }),
      });
      const d = await r.json();
      if (r.ok) alert(`"${name.trim()}" 목록을 저장했습니다. 업체명/ID 탭에서 불러와 스캔할 수 있어요.`);
      else alert(d.error || '저장 실패');
    } catch (e) {
      console.error(e);
    }
  };

  // 결과표 CSV 다운로드
  const exportCsv = () => {
    if (sorted.length === 0) return;
    const header = ['키워드', 'PC검색수', '모바일검색수', '합계검색수', '블로그총수', '월발행량', '포화지수(%)', '포화라벨', '누적경쟁'];
    const lines = [header.join(',')];
    sorted.forEach((r) => {
      lines.push(
        [
          '"' + r.keyword.replace(/"/g, '""') + '"',
          r.monthlyPc,
          r.monthlyMobile,
          r.monthlyTotal,
          r.blogTotal ?? '',
          r.monthlyPosts == null ? '' : r.monthlyPosts + (r.monthlySaturated ? '+' : ''),
          r.saturationPct ?? '',
          r.saturationLabel ?? '',
          r.blogPerSearch ?? '',
        ].join(',')
      );
    });
    const csv = '﻿' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '키워드리서치.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // 선택(없으면 전체) 키워드를 스캔 탭으로 전달
  const sendToScan = (mode) => {
    const kws = selected.size > 0 ? [...selected] : sorted.map((r) => r.keyword);
    if (kws.length === 0) {
      alert('보낼 키워드가 없습니다.');
      return;
    }
    if (onSendToScan) onSendToScan(mode, kws);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 입력 */}
      <div className="glass-card">
        <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <TrendingUp size={18} style={{ color: 'var(--accent-cyan)' }} /> 키워드 리서치 (검색광고)
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
          시드 키워드(최대 5개)를 넣으면 연관 키워드와 월간 검색수(PC/모바일), 경쟁정도를 가져옵니다.
        </p>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <textarea
            className="form-input form-textarea"
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            placeholder="예: 광주 방탈출 (줄바꿈/쉼표로 여러 개, 최대 5)"
            style={{ minHeight: '70px', flex: 1 }}
            disabled={loading}
          />
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0 1.2rem', alignSelf: 'stretch' }} disabled={loading}>
            <Search size={16} /> {loading ? '조회 중...' : '조회'}
          </button>
        </form>
      </div>

      {/* 에러 */}
      {error && (
        <div className="glass-card" style={{ borderColor: 'rgba(244, 63, 94, 0.4)' }}>
          <div style={{ display: 'flex', gap: '0.6rem', color: 'var(--accent-rose)', alignItems: 'flex-start' }}>
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <div>
              <strong>{error.code === 'NO_CREDENTIALS' ? 'API 키 설정 필요' : '조회 실패'}</strong>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.3rem' }}>{error.message}</p>
              {error.code === 'NO_CREDENTIALS' && (
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.4rem' }}>
                  프로젝트 루트 <code>.env</code> 에 고객 ID까지 입력 후 서버를 재시작하세요.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 결과: 그래프 */}
      {chartRows.length > 0 && (
        <div className="glass-card">
          <div className="section-header" style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <BarChart3 size={18} style={{ color: 'var(--accent-cyan)' }} /> 월간 검색수 그래프 (상위 {chartRows.length})
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {chartRows.map((r, i) => {
              const widthPct = Math.max(2, Math.round((r.monthlyTotal / maxTotal) * 100));
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ width: '140px', flexShrink: 0, fontSize: '0.8rem', textAlign: 'right', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.keyword}>
                    {r.keyword}
                  </span>
                  <div style={{ flex: 1, background: 'rgba(15, 23, 42, 0.5)', borderRadius: '0.3rem', overflow: 'hidden', height: '22px', position: 'relative' }}>
                    <div style={{ width: `${widthPct}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-violet))', borderRadius: '0.3rem', transition: 'width 0.4s ease' }} />
                    <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {r.monthlyTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 블로그 통계 키 미설정 안내 */}
      {sorted.length > 0 && !blogStatsAvailable && (
        <div className="glass-card" style={{ borderColor: 'rgba(245, 158, 11, 0.35)' }}>
          <div style={{ display: 'flex', gap: '0.5rem', color: '#f59e0b', alignItems: 'flex-start', fontSize: '0.85rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <span>
              <strong>블로그 발행량·경쟁률</strong>을 보려면 네이버 검색 오픈 API 키가 필요합니다. developers.naver.com에서 발급 후{' '}
              <code>.env</code>의 <code>NAVER_OPENAPI_CLIENT_ID</code> / <code>NAVER_OPENAPI_CLIENT_SECRET</code>에 입력하고 서버를 재시작하세요.
            </span>
          </div>
        </div>
      )}

      {/* 결과: 표 */}
      {sorted.length > 0 && (
        <div className="glass-card">
          <div className="section-header" style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem' }}>연관 키워드 ({sorted.length}개)</h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn-secondary" onClick={() => sendToScan('company')} title="선택(없으면 전체) 키워드로 업체명 스캔">
                <ArrowRightCircle size={14} /> 업체명 스캔
              </button>
              <button type="button" className="btn-secondary" onClick={() => sendToScan('id')} title="선택(없으면 전체) 키워드로 ID 스캔">
                <ArrowRightCircle size={14} /> ID 스캔
              </button>
              {selected.size > 0 && (
                <button type="button" className="btn-primary" style={{ width: 'auto', padding: '0 0.9rem' }} onClick={saveSelected}>
                  <Save size={14} /> 선택 {selected.size}개 저장
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={exportCsv}>
                <Download size={14} /> CSV
              </button>
              <button type="button" className="btn-secondary" onClick={copyKeywords}>
                <Copy size={14} /> 복사
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.5rem', width: '32px', textAlign: 'center' }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} title="전체 선택" />
                  </th>
                  <th style={{ padding: '0.5rem' }}>키워드</th>
                  <SortableTh label="합계 검색수" k="monthlyTotal" sortKey={sortKey} setSortKey={setSortKey} />
                  <SortableTh label="PC" k="monthlyPc" sortKey={sortKey} setSortKey={setSortKey} />
                  <SortableTh label="모바일" k="monthlyMobile" sortKey={sortKey} setSortKey={setSortKey} />
                  <SortableTh label="블로그 총수" k="blogTotal" sortKey={sortKey} setSortKey={setSortKey} />
                  <SortableTh label="월 발행량" k="monthlyPosts" sortKey={sortKey} setSortKey={setSortKey} />
                  <SortableTh label="포화지수" k="saturationPct" sortKey={sortKey} setSortKey={setSortKey} />
                  <SortableTh label="누적경쟁" k="blogPerSearch" sortKey={sortKey} setSortKey={setSortKey} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: selected.has(r.keyword) ? 'rgba(6,182,212,0.06)' : 'transparent' }}>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <input type="checkbox" checked={selected.has(r.keyword)} onChange={() => toggleSel(r.keyword)} />
                    </td>
                    <td style={{ padding: '0.5rem', fontWeight: 600 }}>{r.keyword}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--accent-cyan)' }}>{r.monthlyTotal.toLocaleString()}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--color-text-secondary)' }}>{r.monthlyPc.toLocaleString()}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--color-text-secondary)' }}>{r.monthlyMobile.toLocaleString()}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{r.blogTotal == null ? '—' : r.blogTotal.toLocaleString()}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                      {r.monthlyPosts == null ? '—' : `${r.monthlyPosts.toLocaleString()}${r.monthlySaturated ? '+' : ''}`}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {r.saturationPct == null ? (
                        '—'
                      ) : (
                        <span style={{ color: satColor(r.saturationLabel), fontWeight: 700 }}>
                          {r.saturationPct}% <span style={{ fontSize: '0.72rem' }}>({r.saturationLabel})</span>
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{r.blogPerSearch == null ? '—' : r.blogPerSearch.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableTh({ label, k, sortKey, setSortKey }) {
  const active = sortKey === k;
  return (
    <th
      style={{ padding: '0.5rem', textAlign: 'right', cursor: 'pointer', color: active ? 'var(--accent-cyan)' : 'var(--color-text-muted)' }}
      onClick={() => setSortKey(k)}
      title="정렬"
    >
      {label} {active ? '▼' : ''}
    </th>
  );
}

export default KeywordResearchPanel;
