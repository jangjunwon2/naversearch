import React, { useState } from 'react';
import { Search, Compass, Layers, CheckCircle2, AlertTriangle, ArrowRight, MessageSquare } from 'lucide-react';

// 업체명(brand) / 작성자ID(blog) 결과 카드 + 통계 뷰
// mode: 'brand' | 'blog'
function ResultsView({ results, onSelectKeyword, selectedKeywordIndex, mode, companyName, userId }) {
  const [searchTerm, setSearchTerm] = useState('');

  if (!results || results.length === 0) {
    return (
      <div className="glass-card empty-state">
        <div className="empty-icon">📊</div>
        <h2>조회된 결과가 없습니다.</h2>
        <p>왼쪽 패널에서 키워드 목록과 {mode === 'brand' ? '업체명' : '작성자 ID'}을(를) 입력하고 조회를 시작하세요.</p>
      </div>
    );
  }

  const totalKeywords = results.length;

  // 업체명(brand) 통계
  const brandExposedCount = results.filter((r) => r.targetExposed).length;
  const brandExposureRate = Math.round((brandExposedCount / totalKeywords) * 100) || 0;
  const totalBrandPosts = results.reduce((acc, r) => acc + (r.targetMatchesCount || 0), 0);
  const totalComments = results.reduce(
    (acc, r) => acc + (r.cafeCommentMatchesCount || 0) + (r.kinAnswerMatchesCount || 0),
    0
  );

  // 작성자ID(blog) 통계
  const blogExposedCount = results.filter((r) => r.exposed).length;
  const blogExposureRate = Math.round((blogExposedCount / totalKeywords) * 100) || 0;
  const blogIntegratedCount = results.filter((r) => r.exposed && r.rankDetail.type === 'integrated').length;
  const blogTabCount = results.filter((r) => r.exposed && r.rankDetail.type === 'blog_tab').length;

  const filteredResults = results.filter((r) => r.keyword.toLowerCase().includes(searchTerm.toLowerCase()));

  const accentColor = mode === 'brand' ? 'var(--accent-rose)' : 'var(--accent-green)';

  return (
    <div className="dashboard-container">
      {/* 통계 행 */}
      {mode === 'brand' ? (
        <div className="stats-row">
          <StatCard icon={<Layers size={24} />} bg="rgba(139, 92, 246, 0.15)" color="#8b5cf6" value={totalKeywords} label="분석 키워드 수" />
          <StatCard icon={<CheckCircle2 size={24} />} bg="rgba(244, 63, 94, 0.15)" color="#f43f5e" value={`${brandExposureRate}%`} label={`업체명 노출 비율 (${brandExposedCount}개)`} />
          <StatCard icon={<Compass size={24} />} bg="rgba(6, 182, 212, 0.15)" color="#06b6d4" value={totalBrandPosts} label="노출된 상위 게시글 수" />
          <StatCard icon={<MessageSquare size={24} />} bg="rgba(245, 158, 11, 0.15)" color="#f59e0b" value={totalComments} label="댓글·답글 내 업체명 언급 수" />
        </div>
      ) : (
        <div className="stats-row">
          <StatCard icon={<Layers size={24} />} bg="rgba(139, 92, 246, 0.15)" color="#8b5cf6" value={totalKeywords} label="분석 키워드 수" />
          <StatCard icon={<CheckCircle2 size={24} />} bg="rgba(16, 185, 129, 0.15)" color="#10b981" value={`${blogExposureRate}%`} label={`작성자 ID 노출 비율 (${blogExposedCount}개)`} />
          <StatCard icon={<Compass size={24} />} bg="rgba(6, 182, 212, 0.15)" color="#06b6d4" value={blogIntegratedCount} label="통합검색 노출" />
          <StatCard icon={<AlertTriangle size={24} />} bg="rgba(245, 158, 11, 0.15)" color="#f59e0b" value={blogTabCount} label="블로그 탭 노출" />
        </div>
      )}

      {/* 업체명 종합 노출 순위 표 (brand 모드) */}
      {mode === 'brand' && (
        <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
          <h3 className="detail-panel-title" style={{ marginBottom: '0.25rem' }}>
            📍 키워드별 "{companyName}" 통합검색 노출 순위 종합
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            숫자 = 통합검색 전체에서 위→아래 몇 번째 노출인지(낮을수록 상위). 한 키워드에서 여러 번 노출되면 모두 표시.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.5rem' }}>키워드</th>
                  <th style={{ padding: '0.5rem' }}>통합검색 노출 순위</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>노출 수</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>카페댓글</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>지식인답글</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item, idx) => {
                  const ranks = (item.targetMatches || [])
                    .map((m) => m.overallRank || m.rankInBlock)
                    .filter(Boolean)
                    .sort((a, b) => a - b);
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '0.5rem', fontWeight: 600 }}>{item.keyword}</td>
                      <td style={{ padding: '0.5rem' }}>
                        {ranks.length ? (
                          <span style={{ color: 'var(--accent-rose)', fontWeight: 700 }}>{ranks.map((r) => `${r}위`).join(', ')}</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>미노출</span>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>{ranks.length || '-'}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>{item.cafeCommentMatchesCount || 0}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>{item.kinAnswerMatchesCount || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 검색 + 카드 목록 */}
      <div className="section-header">
        <h2>{mode === 'brand' ? `업체명 "${companyName}" 노출 상세` : `작성자 ID "${userId}" 순위 상세`}</h2>
        <div className="form-group" style={{ margin: 0, position: 'relative', width: '250px' }}>
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.25rem' }}
            placeholder="키워드 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search size={16} className="color-text-muted" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
        </div>
      </div>

      <div className="cards-grid">
        {filteredResults.map((item, idx) => {
          const originalIndex = results.findIndex((r) => r.keyword === item.keyword);
          const isSelected = selectedKeywordIndex === originalIndex;

          let statusBadge = null;
          let mainDetailValue = '';
          let isHighlighted = false;

          if (mode === 'brand') {
            isHighlighted = item.targetExposed;
            if (item.targetExposed) {
              statusBadge = <span className="badge badge-rose">노출 중 ({item.targetMatchesCount}개)</span>;
              mainDetailValue = `상위 노출 ${item.targetMatchesCount}개 / 카페댓글 ${item.cafeCommentMatchesCount}개 / 지식인답글 ${item.kinAnswerMatchesCount || 0}개`;
            } else {
              statusBadge = <span className="badge badge-red">미노출</span>;
              mainDetailValue = '상위 검색결과에 업체명 없음';
            }
          } else {
            isHighlighted = item.exposed;
            if (item.exposed) {
              const matchesCount = item.userBlogMatches?.length || 0;
              if (item.rankDetail.type === 'integrated') {
                statusBadge = <span className="badge badge-green">통합검색 노출 ({matchesCount}개)</span>;
                const blockNames = item.userBlogMatches.map((m) => m.blockName);
                mainDetailValue = blockNames.length > 1 ? `${blockNames[0]} 외 ${blockNames.length - 1}개 블록` : `${blockNames[0]}`;
              } else if (item.rankDetail.type === 'blog_tab') {
                statusBadge = <span className="badge badge-yellow">블로그 탭 노출</span>;
                mainDetailValue = `블로그 탭 ${item.rankDetail.page}페이지 ${item.rankDetail.position}번째 (전체 ${item.rankDetail.overallRank}위)`;
              }
            } else if (item.rankDetail.type === 'error') {
              statusBadge = <span className="badge badge-red">에러 발생</span>;
              mainDetailValue = item.rankDetail.message || '오류 발생';
            } else {
              statusBadge = <span className="badge badge-red">미노출</span>;
              mainDetailValue = '통합검색 및 블로그 탭에 없음';
            }
          }

          return (
            <div
              key={idx}
              className={`glass-card keyword-card ${isSelected ? 'selected' : ''}`}
              style={isSelected ? { borderColor: accentColor, boxShadow: `0 0 15px ${mode === 'brand' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)'}` } : {}}
              onClick={() => onSelectKeyword(originalIndex)}
            >
              <div className="card-top">
                <span className="keyword-name" title={item.keyword}>{item.keyword}</span>
                {statusBadge}
              </div>

              <div className="card-details">
                <div className="card-detail-item" style={{ flexDirection: 'column', gap: '0.2rem' }}>
                  <span className="label" style={{ fontSize: '0.75rem' }}>상세 현황</span>
                  <span className={`value ${isHighlighted ? (mode === 'brand' ? 'highlight-rose' : 'highlight-green') : 'highlight-rose'}`} style={{ fontSize: '0.85rem' }}>
                    {mainDetailValue}
                  </span>
                </div>

                {mode === 'blog' && item.exposed && item.userBlogMatches && item.userBlogMatches.length > 0 && (
                  <div className="card-detail-item" style={{ marginTop: '0.2rem' }}>
                    <span className="label">노출 순위 리스트</span>
                    <span className="value" style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                      {item.userBlogMatches.map((m) => `${m.overallRank || m.rankInBlock}위`).join(', ')}
                    </span>
                  </div>
                )}

                <div className="card-detail-item" style={{ marginTop: '0.4rem', justifyContent: 'flex-end', color: accentColor, fontSize: '0.75rem', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    스마트블록 구조 보기 <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ icon, bg, color, value, label }) {
  return (
    <div className="glass-card stat-card">
      <div className="stat-icon-wrapper" style={{ background: bg, color }}>
        {icon}
      </div>
      <div className="stat-info">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  );
}

export default ResultsView;
