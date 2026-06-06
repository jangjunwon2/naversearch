import React, { useState, useRef } from 'react';

function rankColor(rank) {
  if (rank === null) return '#9ca3af';
  if (rank <= 3) return '#16a34a';
  if (rank <= 10) return '#ca8a04';
  return '#6b7280';
}

function RankBadge({ exposed, rank, total }) {
  if (!exposed) return <span style={{ color: '#9ca3af' }}>미노출</span>;
  return (
    <span style={{ color: rankColor(rank), fontWeight: 'bold' }}>
      {rank}위{' '}
      <span style={{ color: '#6b7280', fontWeight: 'normal', fontSize: '0.8em' }}>
        (총 {total}개)
      </span>
    </span>
  );
}

export default function AdPlaceScanPanel() {
  const [keywordsText, setKeywordsText] = useState('');
  const [identifiers, setIdentifiers] = useState({ name: '', domain: '', placeId: '' });
  const [results, setResults] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentKeyword, setCurrentKeyword] = useState('');
  const [error, setError] = useState('');
  const esRef = useRef(null);
  const scanIdRef = useRef(null);

  const updateId = (field) => (e) => setIdentifiers((prev) => ({ ...prev, [field]: e.target.value }));

  const handleStart = async () => {
    const keywords = keywordsText.split('\n').map((k) => k.trim()).filter(Boolean);
    if (!keywords.length) return setError('키워드를 입력하세요.');
    if (!identifiers.name.trim()) return setError('업체명은 필수입니다.');
    setError('');
    setResults([]);
    setIsScanning(true);
    setProgress({ current: 0, total: keywords.length });

    try {
      const res = await fetch('/api/scan/adplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, identifiers }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || '스캔 시작 실패');
      }
      const { scanId } = await res.json();
      scanIdRef.current = scanId;

      const es = new EventSource(`/api/scan/progress?scanId=${scanId}`);
      esRef.current = es;

      es.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'progress') {
          setCurrentKeyword(data.keyword);
          setProgress({ current: data.current - 1, total: data.total });
        } else if (data.type === 'keyword_scanned') {
          setResults((prev) => [...prev, data.result]);
          setProgress({ current: data.current, total: data.total });
        } else if (data.type === 'keyword_error') {
          setResults((prev) => [
            ...prev,
            {
              keyword: data.keyword,
              powerLink: { exposed: false, rank: null, totalAds: 0 },
              place: { exposed: false, rank: null, totalPlaces: 0 },
            },
          ]);
          setProgress({ current: data.current, total: data.total });
        } else if (data.type === 'complete' || data.type === 'cancelled') {
          setIsScanning(false);
          es.close();
        } else if (data.type === 'error') {
          setIsScanning(false);
          es.close();
          setError(`스캔 오류: ${data.message}`);
        }
      };
      es.onerror = () => {
        setIsScanning(false);
        es.close();
      };
    } catch (err) {
      setIsScanning(false);
      setError(err.message);
    }
  };

  const handleCancel = async () => {
    if (!scanIdRef.current) return;
    await fetch('/api/scan/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scanId: scanIdRef.current }),
    });
    if (esRef.current) esRef.current.close();
    setIsScanning(false);
  };

  return (
    <div className="app-grid">
      <aside className="sidebar">
        <div className="panel-section">
          <h2 className="panel-title">파워링크 · 플레이스 순위</h2>

          <div className="form-group">
            <label className="form-label">키워드 (줄바꿈으로 구분)</label>
            <textarea
              className="form-textarea"
              rows={6}
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder={'강남 치과\n임플란트 비용\n치아교정'}
              disabled={isScanning}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              업체명 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              className="form-input"
              type="text"
              value={identifiers.name}
              onChange={updateId('name')}
              placeholder="홍길동치과"
              disabled={isScanning}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              도메인{' '}
              <span style={{ color: '#9ca3af', fontSize: '0.8em' }}>(선택 · 파워링크 정확도 향상)</span>
            </label>
            <input
              className="form-input"
              type="text"
              value={identifiers.domain}
              onChange={updateId('domain')}
              placeholder="hgd-dental.com"
              disabled={isScanning}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              플레이스 ID{' '}
              <span style={{ color: '#9ca3af', fontSize: '0.8em' }}>(선택 · 지도 URL의 숫자)</span>
            </label>
            <input
              className="form-input"
              type="text"
              value={identifiers.placeId}
              onChange={updateId('placeId')}
              placeholder="1234567890"
              disabled={isScanning}
            />
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '8px' }}>{error}</p>
          )}

          {isScanning ? (
            <>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px' }}>
                {progress.current}/{progress.total} · {currentKeyword}
              </p>
              <button className="btn btn-danger" onClick={handleCancel}>
                스캔 중단
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={handleStart}>
              스캔 시작
            </button>
          )}
        </div>
      </aside>

      <main className="content-area">
        {results.length > 0 ? (
          <div className="results-panel">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>키워드</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px' }}>파워링크</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px' }}>플레이스</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '500' }}>{r.keyword}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <RankBadge
                        exposed={r.powerLink.exposed}
                        rank={r.powerLink.rank}
                        total={r.powerLink.totalAds}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <RankBadge
                        exposed={r.place.exposed}
                        rank={r.place.rank}
                        total={r.place.totalPlaces}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '6rem' }}>
            <p>키워드와 업체 정보를 입력하고 스캔을 시작하세요.</p>
            <p style={{ fontSize: '0.8em', marginTop: '8px' }}>
              플레이스 ID는 네이버 지도에서 매장 클릭 후 URL의 숫자를 복사하세요.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
