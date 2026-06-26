'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ExternalLink,
  MessageCircle,
  Search,
  TriangleIcon,
  CheckCircle,
  X,
  MoreVertical,
  Bookmark,
  Copy,
  Pencil,
  Trash2,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import SidebarLeft from '@/components/SidebarLeft';
import SidebarRight from '@/components/SidebarRight';
import ImageGallery from '@/components/ImageGallery';
import Avatar from '@/components/Avatar';
import SolutionModal from '@/components/SolutionModal';
import SolutionCommentsModal from '@/components/SolutionCommentsModal';
import { supabase } from '@/lib/supabase';
import { Post, Solution } from '@/lib/types';
import { decodeHTMLEntities } from '@/lib/htmlDecoder';
import { useMicroAnimations } from '@/hooks/useMicroAnimations';

type SolutionFilter = 'all' | 'solved' | 'unsolved' | 'mine';
type AuthSession = { access_token: string; user?: any } | null;

interface SolutionStats {
  totalSolutions: number;
  problemsSolved: number;
  unsolvedProblems: number;
  topTags: { name: string; count: number }[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function SolutionsPageClient() {
  const router = useRouter();
  const { animateCardHover, animateCardHoverOut, animateUpvote } = useMicroAnimations();

  const [session, setSession] = useState<AuthSession>(null);
  const [filter, setFilter] = useState<SolutionFilter>('all');
  const [search, setSearch] = useState('');
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [unsolvedProblems, setUnsolvedProblems] = useState<Post[]>([]);
  const [stats, setStats] = useState<SolutionStats>({
    totalSolutions: 0,
    problemsSolved: 0,
    unsolvedProblems: 0,
    topTags: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [votingSolutionIds, setVotingSolutionIds] = useState<Record<string, boolean>>({});
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down'>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeShareMenuPostId, setActiveShareMenuPostId] = useState<string | null>(null);
  const [editingSolution, setEditingSolution] = useState<Solution | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const [commentsModalSolutionId, setCommentsModalSolutionId] = useState<string | null>(null);
  const [commentsModalSolutionTitle, setCommentsModalSolutionTitle] = useState<string>('');

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const viewedSolutionsRef = useRef<Set<string>>(new Set());
  const shareMenuRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2500);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) fetchUserVotes(s.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) fetchUserVotes(s.user.id);
    });
    try {
      const saved = localStorage.getItem('paoblem_saved_solutions');
      if (saved) setSavedIds(JSON.parse(saved));
    } catch { }
    return () => subscription.unsubscribe();
  }, []);

  const fetchUserVotes = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('solution_votes')
        .select('solution_id, vote_type')
        .eq('user_id', userId);
      if (data && data.length > 0) {
        const map: Record<string, 'up' | 'down'> = {};
        data.forEach((v: any) => { map[v.solution_id] = v.vote_type as 'up' | 'down'; });
        setUserVotes(map);
      }
    } catch (err) {
      console.error(err);
    }
  };

  async function fetchSolutions(cursor?: string | null, append = false) {
    if (append) {
      setIsFetchingMore(true);
    } else {
      setIsLoading(true);
    }
    try {
      const params = new URLSearchParams();
      params.set('filter', filter);
      if (search.trim()) params.set('search', search.trim());
      if (cursor) params.set('cursor', cursor);
      const headers: Record<string, string> = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch(`/api/solutions?${params.toString()}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load solutions');
      setSolutions((current) => append ? [...current, ...(data.solutions || [])] : (data.solutions || []));
      setUnsolvedProblems((current) => append ? [...current, ...(data.unsolvedProblems || [])] : (data.unsolvedProblems || []));
      setStats(data.stats || stats);
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      console.error(err);
      if (!append) {
        setSolutions([]);
        setUnsolvedProblems([]);
      }
    } finally {
      if (append) {
        setIsFetchingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSolutions(null, false);
    }, 200);
    return () => clearTimeout(timer);
  }, [filter, search, session?.access_token]);

  useEffect(() => {
    if (!loadMoreRef.current || filter === 'unsolved') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && nextCursor && !isFetchingMore && !isLoading) {
        fetchSolutions(nextCursor, true);
      }
    }, { threshold: 0.8 });
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, nextCursor, isFetchingMore, isLoading, filter]);

  const trackSolutionEvent = async (solutionId: string, eventType: 'SOLUTION_VIEW' | 'SOLUTION_SAVE') => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      await fetch('/api/solutions/track', {
        method: 'POST',
        headers,
        body: JSON.stringify({ solution_id: solutionId, event_type: eventType }),
      });
    } catch (err) {
      console.warn('[solutions] Failed to track solution event', err);
    }
  };

  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-solution-id]'));
    if (cards.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const solutionId = (entry.target as HTMLElement).dataset.solutionId;
        if (!solutionId || !entry.isIntersecting || viewedSolutionsRef.current.has(solutionId)) return;
        viewedSolutionsRef.current.add(solutionId);
        trackSolutionEvent(solutionId, 'SOLUTION_VIEW');
      });
    }, { threshold: 0.55 });
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [solutions.map((solution) => solution.id).join(','), session?.access_token]);

  const handleVote = async (e: React.MouseEvent, solutionId: string, type: 'up' | 'down') => {
    e.stopPropagation();
    if (!session?.access_token) return alert('Please sign in to vote');
    if (votingSolutionIds[solutionId]) return;

    setVotingSolutionIds((prev) => ({ ...prev, [solutionId]: true }));
    const previousVote = userVotes[solutionId];

    setSolutions((current) =>
      current.map((sol) => {
        if (sol.id === solutionId) {
          let nextUpvotes = sol.upvotes || 0;
          let nextDownvotes = sol.downvotes || 0;

          if (previousVote === type) {
            if (type === 'up') nextUpvotes = Math.max(0, nextUpvotes - 1);
            if (type === 'down') nextDownvotes = Math.max(0, nextDownvotes - 1);
          } else {
            if (type === 'up') {
              nextUpvotes += 1;
              if (previousVote === 'down') nextDownvotes = Math.max(0, nextDownvotes - 1);
            } else {
              nextDownvotes += 1;
              if (previousVote === 'up') nextUpvotes = Math.max(0, nextUpvotes - 1);
            }
          }

          return { ...sol, upvotes: nextUpvotes, downvotes: nextDownvotes };
        }
        return sol;
      })
    );

    setUserVotes((prev) => {
      const next = { ...prev };
      if (previousVote === type) delete next[solutionId];
      else next[solutionId] = type;
      return next;
    });

    try {
      const res = await fetch('/api/solutions/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ solution_id: solutionId, vote_type: type }),
      });
      if (!res.ok) throw new Error('Failed to vote');

      const data = await res.json();
      if (data.action === 'removed') {
        setSolutions((current) =>
          current.map((sol) => {
            if (sol.id === solutionId) {
              return {
                ...sol,
                upvotes: type === 'up' ? Math.max(0, (sol.upvotes || 0) - 1) : sol.upvotes,
                downvotes: type === 'down' ? Math.max(0, (sol.downvotes || 0) - 1) : sol.downvotes,
              };
            }
            return sol;
          })
        );
        setUserVotes((prev) => {
          const next = { ...prev };
          delete next[solutionId];
          return next;
        });
      }
    } catch (err) {
      console.error(err);
      setSolutions((current) =>
        current.map((sol) => {
          if (sol.id === solutionId) {
            let nextUpvotes = sol.upvotes || 0;
            let nextDownvotes = sol.downvotes || 0;
            if (previousVote === type) {
              if (type === 'up') nextUpvotes += 1;
              if (type === 'down') nextDownvotes += 1;
            } else {
              if (type === 'up') {
                nextUpvotes = Math.max(0, nextUpvotes - 1);
                if (previousVote === 'down') nextDownvotes += 1;
              } else {
                nextDownvotes = Math.max(0, nextDownvotes - 1);
                if (previousVote === 'up') nextUpvotes += 1;
              }
            }
            return { ...sol, upvotes: nextUpvotes, downvotes: nextDownvotes };
          }
          return sol;
        })
      );
      setUserVotes((prev) => {
        const next = { ...prev };
        if (previousVote) next[solutionId] = previousVote;
        else delete next[solutionId];
        return next;
      });
    } finally {
      setVotingSolutionIds((prev) => ({ ...prev, [solutionId]: false }));
    }
  };

  const toggleSave = (e: React.MouseEvent, solutionId: string) => {
    e.stopPropagation();
    let next: string[];
    if (savedIds.includes(solutionId)) {
      next = savedIds.filter((id) => id !== solutionId);
      showToast('Solution removed from Saved.');
    } else {
      next = [...savedIds, solutionId];
      showToast('Solution saved successfully.');
    }
    setSavedIds(next);
    localStorage.setItem('paoblem_saved_solutions', JSON.stringify(next));
  };

  const toggleExpand = (e: React.MouseEvent, solutionId: string) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(solutionId)) next.delete(solutionId);
      else next.add(solutionId);
      return next;
    });
  };

  const handleDeleteSolution = async (solutionId: string) => {
    if (!session?.access_token) return;
    if (!window.confirm('Are you sure you want to delete this solution?')) return;
    try {
      const res = await fetch('/api/solutions', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: solutionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete solution');
      showToast('Solution deleted successfully.');
      fetchSolutions(null, false);
    } catch (err: any) {
      showToast(err.message || 'Error deleting solution');
    }
  };

  const onSolutionSubmitted = () => {
    setIsModalOpen(false);
    setEditingSolution(null);
    fetchSolutions(null, false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setActiveShareMenuPostId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredSolutions = useMemo(() => {
    if (filter !== 'solved') return solutions;
    return solutions.filter((solution) => solution.problem?.type === 'problem');
  }, [filter, solutions]);

  const filterLabels: Record<SolutionFilter, string> = {
    all: 'All Solutions',
    solved: 'Solved Problems',
    unsolved: 'Unsolved Problems',
    mine: 'My Solutions',
  };

  const filterOptions: { id: SolutionFilter; label: string }[] = [
    { id: 'all', label: 'All Solutions' },
    { id: 'solved', label: 'Solved' },
    { id: 'unsolved', label: 'Unsolved' },
    { id: 'mine', label: 'My Solutions' },
  ];

  return (
    <div className="app-container">
      <Navbar />
      <div className="main-content">
        <SidebarLeft />
        <main className="center-feed solutions-page">
          <section className="solutions-controls">
            <div className="solutions-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search solutions..."
              />
              {search && (
                <button type="button" className="solutions-clear-search" onClick={() => setSearch('')} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="solutions-filter-chips" role="group" aria-label="Filter solutions">
              {filterOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`solutions-filter-chip${filter === opt.id ? ' active' : ''}`}
                  onClick={() => setFilter(opt.id)}
                  aria-pressed={filter === opt.id}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          <div className="solutions-active-row">
            <span>{filterLabels[filter]}</span>
            <small>{filter === 'unsolved' ? `${unsolvedProblems.length} open problems` : `${filteredSolutions.length} solutions shown`}</small>
          </div>

          {isLoading && <div className="solutions-loading">Loading solutions...</div>}

          {!isLoading && filter === 'unsolved' && (
            <div className="solutions-list">
              {unsolvedProblems.length === 0 ? (
                <div className="solutions-empty">
                  <CheckCircle size={22} />
                  <div>
                    <strong>No unsolved problems found.</strong>
                    <p>Every visible problem in this view already has a submitted solution.</p>
                  </div>
                </div>
              ) : (
                unsolvedProblems.map((problem) => (
                  <article key={problem.id} className="solution-card solution-card--problem">
                    <div className="solution-card-header">
                      <div>
                        <h3>{decodeHTMLEntities(problem.title)}</h3>
                      </div>
                    </div>
                    <p className="solution-card-body">{decodeHTMLEntities(problem.body).slice(0, 240)}</p>
                    <button className="solution-open-problem" onClick={() => router.push(`/post/${problem.slug || problem.id}#solutions`)}>
                      Open problem
                    </button>
                  </article>
                ))
              )}
            </div>
          )}

          {!isLoading && filter !== 'unsolved' && (
            <div className="solutions-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredSolutions.length === 0 ? (
                <p className="solutions-empty-text">No solutions yet. Open a problem and become the first developer to solve it.</p>
              ) : (
                filteredSolutions.map((solution) => {
                  const isExpanded = expandedIds.has(solution.id);
                  const body = decodeHTMLEntities(solution.body);
                  const CLAMP = 280;
                  const needsClamp = body.length > CLAMP;
                  const displayBody = isExpanded || !needsClamp ? body : body.slice(0, CLAMP) + '…';

                  let imageUrls: string[] = [];
                  try {
                    if (solution.image_url) {
                      const parsed = JSON.parse(solution.image_url);
                      imageUrls = Array.isArray(parsed) ? parsed : [parsed];
                    }
                  } catch {
                    if (solution.image_url) imageUrls = [solution.image_url];
                  }

                  const isOwner = session?.user?.id === solution.user_id;

                  return (
                    <article
                      key={solution.id}
                      className="card post-card-animate"
                      data-solution-id={solution.id}
                      onMouseEnter={animateCardHover}
                      onMouseLeave={animateCardHoverOut}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('top-loader:start'));
                        router.push(`/solutions/${solution.id}`);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          window.dispatchEvent(new CustomEvent('top-loader:start'));
                          router.push(`/solutions/${solution.id}`);
                        }
                      }}
                      style={{ position: 'relative', overflow: 'visible' }}
                    >
                      {/* Post header (author, options menu) */}
                      <div className="post-header">
                        <div className="post-user">
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              window.dispatchEvent(new CustomEvent('top-loader:start'));
                              router.push(solution.profiles?.username ? `/user/${solution.profiles.username}` : `/profile?userId=${solution.user_id}`);
                            }}
                            style={{ cursor: 'pointer', flexShrink: 0 }}
                          >
                            <Avatar
                              src={solution.profiles?.avatar_url}
                              name={solution.profiles?.full_name || 'Anonymous'}
                              size={42}
                            />
                          </div>
                          <div className="post-user-info">
                            <h4 className="post-author-name-container" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span className="post-author-name"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.dispatchEvent(new CustomEvent('top-loader:start'));
                                  router.push(solution.profiles?.username ? `/user/${solution.profiles.username}` : `/profile?userId=${solution.user_id}`);
                                }}>
                                {solution.profiles?.full_name || 'Anonymous'}
                              </span>
                              <span className="post-type-badge solution">
                                Solution
                              </span>
                            </h4>
                            {solution.profiles?.username && (
                              <p className="post-author-username" onClick={(e) => {
                                e.stopPropagation();
                                window.dispatchEvent(new CustomEvent('top-loader:start'));
                                router.push(`/user/${solution.profiles!.username!}`);
                              }}>
                                @{solution.profiles.username}
                              </p>
                            )}
                            <p className="post-author-meta">
                              <span>{timeAgo(solution.created_at)}</span>
                            </p>
                          </div>
                        </div>

                        {/* Dropdown Options Menu */}
                        <div className="post-menu-shell flex items-center gap-1" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--text-muted)', position: 'relative', flexShrink: 0, alignSelf: 'flex-start', zIndex: 10 }}>
                          <button
                            className="post-header-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveShareMenuPostId(activeShareMenuPostId === solution.id ? null : solution.id);
                            }}
                            title="More options"
                            aria-expanded={activeShareMenuPostId === solution.id}
                            aria-haspopup="menu"
                          >
                            <MoreVertical size={18} />
                          </button>

                          {activeShareMenuPostId === solution.id && (
                            <div className="post-overflow-menu" role="menu" ref={shareMenuRef}>
                              <button
                                role="menuitem"
                                onClick={() => {
                                  setActiveShareMenuPostId(null);
                                  const shareUrl = `${window.location.origin}/solutions/${solution.id}`;
                                  navigator.clipboard.writeText(shareUrl);
                                  showToast('Solution link copied.');
                                }}
                              >
                                <Copy size={15} /> Copy Solution Link
                              </button>
                              <button
                                role="menuitem"
                                onClick={(e) => {
                                  setActiveShareMenuPostId(null);
                                  toggleSave(e, solution.id);
                                }}
                              >
                                <Bookmark size={15} fill={savedIds.includes(solution.id) ? 'currentColor' : 'none'} />
                                {savedIds.includes(solution.id) ? 'Unsave' : 'Save'}
                              </button>
                              {isOwner && (
                                <>
                                  <button
                                    role="menuitem"
                                    onClick={() => {
                                      setActiveShareMenuPostId(null);
                                      setEditingSolution(solution);
                                      setIsModalOpen(true);
                                    }}
                                  >
                                    <Pencil size={15} /> Edit Solution
                                  </button>
                                  <button
                                    role="menuitem"
                                    className="danger"
                                    onClick={() => {
                                      setActiveShareMenuPostId(null);
                                      handleDeleteSolution(solution.id);
                                    }}
                                  >
                                    <Trash2 size={15} /> Delete
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Post content */}
                      <div className="post-content" style={{ marginTop: '0.5rem' }}>
                        {solution.problem && (
                          <div
                            className="sol-page-card-problem-ref"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.dispatchEvent(new CustomEvent('top-loader:start'));
                              router.push(`/post/${solution.problem?.slug || solution.problem_id}`);
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.stopPropagation();
                                window.dispatchEvent(new CustomEvent('top-loader:start'));
                                router.push(`/post/${solution.problem?.slug || solution.problem_id}`);
                              }
                            }}
                            style={{ display: 'inline-flex', marginBottom: '0.5rem' }}
                          >
                            <span className="sol-page-card-problem-label">Solving:</span>
                            <span className="sol-page-card-problem-title">{decodeHTMLEntities(solution.problem.title)}</span>
                          </div>
                        )}

                        {solution.external_link && (
                          <a
                            href={solution.external_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1"
                            style={{ color: 'var(--accent-blue)', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.5rem', textDecoration: 'none', display: 'inline-flex' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink size={12} />
                            <span>{solution.link_name || solution.external_link}</span>
                          </a>
                        )}

                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.015em', lineHeight: '1.3', marginBottom: '0.6rem', color: 'var(--text-main)', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                          {decodeHTMLEntities(solution.title)}
                        </h3>

                        <p className="post-body-text">{displayBody}</p>
                        {needsClamp && (
                          <button
                            style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', padding: '4px 0', marginTop: '4px', display: 'inline-flex', alignItems: 'center' }}
                            onClick={(e) => { e.stopPropagation(); toggleExpand(e, solution.id); }}
                          >
                            {isExpanded ? 'See less' : 'See more'}
                          </button>
                        )}
                      </div>

                      {/* Media gallery */}
                      {imageUrls.length > 0 && (
                        <div onClick={(e) => e.stopPropagation()} style={{ marginBottom: '1rem' }}>
                          <ImageGallery imageUrlsString={solution.image_url} />
                        </div>
                      )}

                      {/* Footer - votes, comments */}
                      <div className="post-footer" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 0 }}>
                        <div className="flex items-center gap-2 post-footer-actions" onClick={(e) => e.stopPropagation()}>

                          {/* Upvote */}
                          <div className="vote-container" style={{ borderColor: userVotes[solution.id] === 'up' ? '#22c55e' : undefined, background: userVotes[solution.id] === 'up' ? 'rgba(34,197,94,0.08)' : undefined }}>
                            <button className="vote-btn" onClick={e => { animateUpvote(e.currentTarget); handleVote(e, solution.id, 'up'); }} style={{ color: userVotes[solution.id] === 'up' ? '#22c55e' : undefined }} aria-label="Upvote" disabled={votingSolutionIds[solution.id]}>
                              <TriangleIcon size={16} fill={userVotes[solution.id] === 'up' ? 'currentColor' : 'none'} />
                            </button>
                            <span className={`vote-label up ${userVotes[solution.id] === 'up' ? 'active' : ''}`} style={{ color: userVotes[solution.id] === 'up' ? '#22c55e' : undefined }}>+{solution.upvotes || 0}</span>
                          </div>

                          {/* Downvote */}
                          <div className="vote-container" style={{ borderColor: userVotes[solution.id] === 'down' ? '#ef4444' : undefined, background: userVotes[solution.id] === 'down' ? 'rgba(239,68,68,0.08)' : undefined }}>
                            <button className="vote-btn" onClick={e => { handleVote(e, solution.id, 'down'); }} style={{ color: userVotes[solution.id] === 'down' ? '#ef4444' : undefined }} aria-label="Downvote" disabled={votingSolutionIds[solution.id]}>
                              <TriangleIcon size={16} style={{ transform: 'rotate(180deg)' }} fill={userVotes[solution.id] === 'down' ? 'currentColor' : 'none'} />
                            </button>
                            <span className={`vote-label down ${userVotes[solution.id] === 'down' ? 'active' : ''}`} style={{ color: userVotes[solution.id] === 'down' ? '#ef4444' : undefined }}>-{solution.downvotes || 0}</span>
                          </div>

                          {/* Comments Count */}
                          <button
                            type="button"
                            className="post-comment-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCommentsModalSolutionId(solution.id);
                              setCommentsModalSolutionTitle(solution.title);
                            }}
                            aria-label="View comments"
                          >
                            <MessageCircle size={19} />
                            <span className="post-comment-count">{solution.comments_count}</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
              <div ref={loadMoreRef} />
              {isFetchingMore && <div className="solutions-loading">Loading more solutions...</div>}
            </div>
          )}
        </main>
        <SidebarRight />
      </div>

      {/* Toast notifications */}
      {toastMessage && <div className="share-toast">{toastMessage}</div>}

      {/* Solution submission modal */}
      {isModalOpen && session && (
        <SolutionModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingSolution(null);
          }}
          problemId={editingSolution?.problem_id || ''}
          problemTitle={editingSolution?.problem?.title || ''}
          session={session}
          onSubmitted={onSolutionSubmitted}
          editingSolution={editingSolution}
        />
      )}

      {/* Solution comments modal */}
      {commentsModalSolutionId && (
        <SolutionCommentsModal
          solutionId={commentsModalSolutionId}
          solutionTitle={commentsModalSolutionTitle}
          session={session}
          isOpen={!!commentsModalSolutionId}
          onClose={() => {
            setCommentsModalSolutionId(null);
            setCommentsModalSolutionTitle('');
          }}
          onAuthRequired={() => {
            alert('Please sign in to view or post comments');
          }}
          onCommentCountChange={(solId, newCount) => {
            setSolutions((current) =>
              current.map((s) => (s.id === solId ? { ...s, comments_count: newCount } : s))
            );
          }}
        />
      )}
    </div>
  );
}
