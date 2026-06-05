import React from 'react';
import { ExternalLink, Award, CheckCircle, ShieldAlert, MessageSquare } from 'lucide-react';

// 게시물 종류 → 라벨/배지 클래스
function typeLabel(type) {
  if (type === 'blog') return '블로그';
  if (type === 'influencer') return '인플루언서';
  if (type === 'cafe') return '카페';
  if (type === 'kin') return '지식인';
  if (type === 'naver_post') return '포스트';
  return type;
}
function typeBadgeClass(type) {
  if (type === 'blog' || type === 'influencer') return 'post-badge-blog';
  if (type === 'kin') return 'post-badge-kin';
  return 'post-badge-cafe';
}

// 키워드별 상세 분석 (스마트블록 구조 + 노출 위치). 업체명/작성자ID 모드 공용.
function KeywordDetail({ keywordData, targetKeyword, blogId }) {
  if (!keywordData) {
    return (
      <div className="glass-card empty-state" style={{ marginTop: '2rem' }}>
        <div className="empty-icon">🔍</div>
        <h3>키워드를 선택해 주세요</h3>
        <p>위의 카드 중 하나를 클릭하면 상세 노출 내역(스마트 블록 및 게시글 분포)이 여기에 표시됩니다.</p>
      </div>
    );
  }

  const {
    keyword,
    smartBlocks,
    exposed,
    targetExposed,
    userBlogMatches,
    targetMatches,
    cafeCommentMatchesCount,
    kinAnswerMatchesCount,
  } = keywordData;

  const renderHighlightedText = (text, target) => {
    if (!target || !text) return text;
    const parts = text.split(new RegExp(`(${target})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === target.toLowerCase() ? (
        <span key={index} className="highlight-word">{part}</span>
      ) : (
        part
      )
    );
  };

  return (
    <div className="glass-card" style={{ marginTop: '2rem', animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <span className="color-text-muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>상세 분석 리포트</span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '0.2rem' }}>
            "{keyword}" 검색 결과 상세
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {targetKeyword && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
              {targetExposed ? (
                <span className="badge badge-rose" style={{ fontSize: '0.85rem' }}>📢 업체명 ({targetKeyword}) 노출 중</span>
              ) : (
                <span className="badge badge-red" style={{ fontSize: '0.85rem' }}>📢 업체명 미노출</span>
              )}
              {targetExposed && (
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-rose)', fontWeight: 600 }}>
                  상위 글 {targetMatches.length}개 / 카페댓글 {cafeCommentMatchesCount}개 / 지식인답글 {kinAnswerMatchesCount || 0}개
                </span>
              )}
            </div>
          )}

          {blogId && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
              {exposed ? (
                <span className="badge badge-green" style={{ fontSize: '0.85rem' }}>
                  <CheckCircle size={14} /> 작성자 ID ({blogId}) 노출 중
                </span>
              ) : (
                <span className="badge badge-red" style={{ fontSize: '0.85rem' }}>
                  <ShieldAlert size={14} /> 작성자 ID 미노출
                </span>
              )}
              {exposed && (
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-green)', fontWeight: 600 }}>
                  총 {userBlogMatches.length}개 위치에서 발견
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="detail-grid">
        {/* 좌: 스마트 블록 파싱 */}
        <div className="detail-panel">
          <h3 className="detail-panel-title">통합검색 스마트 블록 및 섹션 ({smartBlocks.length}개)</h3>

          {smartBlocks.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <p>분석 대상 블록이 없습니다.</p>
            </div>
          ) : (
            <div className="smart-blocks-list">
              {smartBlocks.map((block, bIdx) => (
                <div key={bIdx} className="block-container">
                  <div className="block-header">
                    <span className="block-title" style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>
                      #{bIdx + 1} {block.blockName}
                    </span>
                    <div className="block-distribution">
                      <span className="post-badge post-badge-blog">블로그 {block.blogCount}</span>
                      <span className="post-badge post-badge-cafe">카페 {block.cafeCount}</span>
                      {block.kinCount > 0 && <span className="post-badge post-badge-kin">지식인 {block.kinCount}</span>}
                    </div>
                  </div>

                  <div className="post-items-list">
                    {block.posts.map((post, pIdx) => {
                      const classes = ['post-card'];
                      if (post.isUserBlog) classes.push('highlight-user');
                      else if (post.containsTarget) classes.push('highlight-target');

                      return (
                        <div key={pIdx} className={classes.join(' ')}>
                          <div className="post-card-top">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)' }}>{post.rank}위</span>
                              <span className={`post-badge ${typeBadgeClass(post.type)}`}>{typeLabel(post.type)}</span>
                            </div>

                            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                              {post.isUserBlog && <span className="badge badge-green" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>내 글</span>}
                              {post.containsTarget && <span className="badge badge-rose" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>업체명 매칭</span>}
                              {post.type === 'cafe' && post.commentMatchesCount > 0 && (
                                <span className="badge badge-cyan" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                                  <MessageSquare size={10} /> 댓글: {post.commentMatchesCount}개
                                </span>
                              )}
                              {post.type === 'kin' && post.kinMatchesCount > 0 && (
                                <span className="badge badge-cyan" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                                  <MessageSquare size={10} /> 답글: {post.kinMatchesCount}개
                                </span>
                              )}
                            </div>
                          </div>

                          <a href={post.url} target="_blank" rel="noopener noreferrer" className="post-title-link">
                            {renderHighlightedText(post.title, targetKeyword)}
                            <ExternalLink size={12} style={{ flexShrink: 0 }} />
                          </a>

                          <div className="post-snippet">{renderHighlightedText(post.snippet, targetKeyword)}</div>

                          <div className="post-card-top" style={{ marginTop: '0.2rem' }}>
                            <span className="post-author">작성자: {post.authorName} ({post.id})</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 우: 노출 위치 상세 */}
        <div className="detail-panel">
          {blogId && (
            <>
              <h3 className="detail-panel-title">작성자 ID 노출 상세 ({userBlogMatches?.length || 0}개 노출)</h3>

              <div className="glass-card" style={{ background: 'rgba(15, 23, 42, 0.4)', borderStyle: 'dashed', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {exposed && userBlogMatches && userBlogMatches.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent-green)' }}>
                      <CheckCircle size={32} />
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>노출 상세 목록</h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>상위 노출된 모든 글의 순위와 위치입니다.</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {userBlogMatches.map((m, mIdx) => (
                        <div key={mIdx} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem 1rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', borderLeft: '3px solid var(--accent-green)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--accent-green)', fontWeight: 600 }}>
                            <span>{m.blockName || '블로그 탭'}</span>
                            <strong>
                              {m.type === 'blog_tab' ? `블로그탭 ${m.page}페이지 ${m.position}번째 (전체 ${m.overallRank}위)` : `통합검색 ${m.overallRank}위`}
                            </strong>
                          </div>
                          <a href={m.url} target="_blank" rel="noopener noreferrer" className="post-title-link" style={{ color: 'var(--color-text-primary)', fontSize: '0.85rem' }}>
                            {m.title} <ExternalLink size={12} style={{ flexShrink: 0 }} />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--accent-rose)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <ShieldAlert size={32} />
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>어느 영역에서도 찾을 수 없음</h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                          통합검색 및 블로그 탭 {keywordData.maxPages || 5}페이지 내에 작성자 ID({blogId}) 글이 발견되지 않았습니다.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {targetKeyword && (
            <div style={{ marginTop: blogId ? '2rem' : 0 }}>
              <h3 className="detail-panel-title">업체명 "{targetKeyword}" 노출 게시글 ({targetMatches?.length || 0}개 노출)</h3>

              <div className="glass-card" style={{ background: 'rgba(15, 23, 42, 0.4)', borderStyle: 'dashed', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {targetExposed && targetMatches && targetMatches.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent-rose)' }}>
                      <Award size={32} style={{ color: 'var(--accent-rose)' }} />
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>업체명 상위 노출 게시글 목록</h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>각 카페글/지식인글의 댓글·답글 내 업체명 언급 빈도입니다.</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {targetMatches.map((m, mIdx) => (
                        <div key={mIdx} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem 1rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', borderLeft: '3px solid var(--accent-rose)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--accent-rose)', fontWeight: 600 }}>
                            <span>통합검색 {m.overallRank}위 · {typeLabel(m.type)} · {m.blockName}</span>
                            {m.type === 'cafe' && <span style={{ color: 'var(--accent-cyan)' }}>💬 댓글 매칭: {m.commentMatchesCount}개</span>}
                            {m.type === 'kin' && <span style={{ color: 'var(--accent-cyan)' }}>💬 답글 매칭: {m.kinMatchesCount}개</span>}
                          </div>
                          <a href={m.url} target="_blank" rel="noopener noreferrer" className="post-title-link" style={{ color: 'var(--color-text-primary)', fontSize: '0.85rem' }}>
                            {m.title} <ExternalLink size={12} style={{ flexShrink: 0 }} />
                          </a>
                          {(() => {
                            const samples = m.type === 'cafe' ? m.commentSamples : m.type === 'kin' ? m.kinSamples : null;
                            if (!samples || samples.length === 0) return null;
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.2rem' }}>
                                {samples.map((s, si) => (
                                  <div key={si} style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', background: 'rgba(6,182,212,0.08)', padding: '0.25rem 0.5rem', borderRadius: '0.3rem' }}>
                                    💬 {s}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--color-text-muted)' }}>
                    <p>업체명이 상위 검색결과 글에 노출되지 않았습니다.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default KeywordDetail;
