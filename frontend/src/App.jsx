import React, { useState, useEffect, useRef } from 'react';
import CompanyScanPanel from './components/CompanyScanPanel';
import IdScanPanel from './components/IdScanPanel';
import ForbiddenWordPanel from './components/ForbiddenWordPanel';
import KeywordResearchPanel from './components/KeywordResearchPanel';
import RankTrendPanel from './components/RankTrendPanel';
import ResultsView from './components/ResultsView';
import KeywordDetail from './components/KeywordDetail';
import ScanHistory from './components/ScanHistory';

const TABS = [
  { key: 'company', label: '📢 업체명 체크' },
  { key: 'id', label: '📝 ID 순위' },
  { key: 'keywords', label: '🔑 키워드 리서치' },
  { key: 'trend', label: '📈 순위 변동' },
  { key: 'forbidden', label: '🛡️ 금칙어 검사' },
  { key: 'history', label: '📅 히스토리' },
];

function App() {
  const [activeTab, setActiveTab] = useState('company');

  // 스캔 결과 + 컨텍스트
  const [results, setResults] = useState([]);
  const [selectedKeywordIndex, setSelectedKeywordIndex] = useState(null);
  const [scanMode, setScanMode] = useState(null); // 'company' | 'id'
  const [scanCompanyName, setScanCompanyName] = useState('');
  const [scanUserId, setScanUserId] = useState('');

  // 리서치 → 스캔 키워드 주입 ({ text, key })
  const [injectCompany, setInjectCompany] = useState(null);
  const [injectId, setInjectId] = useState(null);

  // 스캔 진행 상태
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentKeyword, setCurrentKeyword] = useState('');
  const [statusText, setStatusText] = useState('scanning');

  const [history, setHistory] = useState([]);

  const eventSourceRef = useRef(null);
  const activeScanIdRef = useRef(null);

  useEffect(() => {
    fetchHistory();
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/history');
      if (response.ok) setHistory(await response.json());
    } catch (e) {
      console.error('히스토리 조회 실패:', e);
    }
  };

  const handleStartScan = async (mode, params) => {
    if (eventSourceRef.current) eventSourceRef.current.close();

    setScanMode(mode);
    setScanCompanyName(mode === 'company' ? params.companyName : '');
    setScanUserId(mode === 'id' ? params.userId : '');
    setResults([]);
    setSelectedKeywordIndex(null);
    setIsScanning(true);
    setProgress({ current: 0, total: params.keywords.length });
    setCurrentKeyword('');
    setStatusText('scanning');

    try {
      const endpoint = mode === 'company' ? '/api/scan/company' : '/api/scan/id';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || '스캔 시작 실패');
      }

      const { scanId } = await response.json();
      activeScanIdRef.current = scanId;

      const eventSource = new EventSource(`/api/scan/progress?scanId=${scanId}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'progress') {
          setProgress({ current: data.current - 1, total: data.total });
          setCurrentKeyword(data.keyword);
          setStatusText(data.status);
        } else if (data.type === 'keyword_scanned') {
          setResults((prev) => {
            const next = [...prev, data.result];
            if (next.length === 1) setSelectedKeywordIndex(0);
            return next;
          });
          setProgress({ current: data.current, total: data.total });
        } else if (data.type === 'keyword_error') {
          setResults((prev) => {
            const errResult = {
              keyword: data.keyword,
              smartBlocks: [],
              exposed: false,
              targetExposed: false,
              rankDetail: { type: 'error', message: data.error },
              userBlogMatches: [],
              targetMatches: [],
              targetMatchesCount: 0,
              cafeCommentMatchesCount: 0,
              kinAnswerMatchesCount: 0,
            };
            const next = [...prev, errResult];
            if (next.length === 1) setSelectedKeywordIndex(0);
            return next;
          });
          setProgress({ current: data.current, total: data.total });
        } else if (data.type === 'complete') {
          setIsScanning(false);
          eventSource.close();
          fetchHistory();
        } else if (data.type === 'cancelled') {
          setIsScanning(false);
          eventSource.close();
          alert('스캔이 중단되었습니다.');
        } else if (data.type === 'error') {
          setIsScanning(false);
          eventSource.close();
          alert(`스캔 중 치명적인 오류 발생: ${data.message}`);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE 연결 오류:', err);
        setIsScanning(false);
        eventSource.close();
      };
    } catch (err) {
      console.error(err);
      setIsScanning(false);
      alert(`스캔 시작에 실패했습니다: ${err.message}`);
    }
  };

  const handleCancelScan = async () => {
    if (!activeScanIdRef.current) return;
    try {
      const res = await fetch('/api/scan/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId: activeScanIdRef.current }),
      });
      if (res.ok) {
        if (eventSourceRef.current) eventSourceRef.current.close();
        setIsScanning(false);
      }
    } catch (e) {
      console.error('스캔 취소 실패:', e);
    }
  };

  const handleLoadHistory = (record) => {
    const mode = record.scanType || (record.companyName || record.targetKeyword ? 'company' : 'id');
    setScanMode(mode);
    setScanCompanyName(record.companyName || record.targetKeyword || '');
    setScanUserId(record.userId || record.blogId || '');
    setResults(record.results);
    setSelectedKeywordIndex(record.results.length > 0 ? 0 : null);
    setActiveTab(mode === 'id' ? 'id' : 'company');
  };

  // 리서치 탭에서 선택 키워드를 스캔 탭으로 주입 + 탭 전환
  const handleSendToScan = (mode, keywords) => {
    const text = keywords.join('\n');
    if (mode === 'company') {
      setInjectCompany({ text, key: Date.now() });
      setActiveTab('company');
    } else {
      setInjectId({ text, key: Date.now() });
      setActiveTab('id');
    }
  };

  const handleDeleteHistory = async (id) => {
    if (!confirm('정말 이 검색 기록을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history);
      }
    } catch (e) {
      console.error('기록 삭제 실패:', e);
    }
  };

  // 현재 탭에 해당하는 결과만 노출 (모드 불일치 시 빈 배열)
  const tabResults = (tab) => (scanMode === (tab === 'company' ? 'company' : 'id') ? results : []);

  const renderScanTab = (tab) => {
    const Panel = tab === 'company' ? CompanyScanPanel : IdScanPanel;
    const viewMode = tab === 'company' ? 'brand' : 'blog';
    const shown = tabResults(tab);
    const selected = scanMode === (tab === 'company' ? 'company' : 'id') ? selectedKeywordIndex : null;

    return (
      <div className="app-grid">
        <Panel
          onStartScan={handleStartScan}
          onCancelScan={handleCancelScan}
          isScanning={isScanning}
          progress={progress}
          currentKeyword={currentKeyword}
          statusText={statusText}
          inject={tab === 'company' ? injectCompany : injectId}
        />

        <main className="content-area">
          <ResultsView
            results={shown}
            onSelectKeyword={setSelectedKeywordIndex}
            selectedKeywordIndex={selected}
            mode={viewMode}
            companyName={scanCompanyName}
            userId={scanUserId}
          />
          {shown.length > 0 && selected !== null && (
            <KeywordDetail
              keywordData={shown[selected]}
              targetKeyword={tab === 'company' ? scanCompanyName : ''}
              blogId={tab === 'id' ? scanUserId : ''}
            />
          )}
        </main>
      </div>
    );
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo">🔍 NAVER</div>
          <div>
            <h1 className="brand-title-kr">네이버 검색 순위 파악 프로그램</h1>
            <p className="brand-subtitle">업체명 · ID 순위 · 금칙어 통합 관리</p>
          </div>
        </div>

        <div className="navigation-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`tab-button ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'company' && renderScanTab('company')}
      {activeTab === 'id' && renderScanTab('id')}
      {activeTab === 'keywords' && (
        <div className="content-area" style={{ marginTop: '0' }}>
          <KeywordResearchPanel onSendToScan={handleSendToScan} />
        </div>
      )}
      {activeTab === 'trend' && (
        <div className="content-area" style={{ marginTop: '0' }}>
          <RankTrendPanel />
        </div>
      )}
      {activeTab === 'forbidden' && (
        <div className="content-area" style={{ marginTop: '0' }}>
          <ForbiddenWordPanel />
        </div>
      )}
      {activeTab === 'history' && (
        <div className="content-area" style={{ marginTop: '0' }}>
          <ScanHistory history={history} onLoadHistory={handleLoadHistory} onDeleteHistory={handleDeleteHistory} />
        </div>
      )}
    </div>
  );
}

export default App;
