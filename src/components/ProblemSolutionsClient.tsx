'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  TriangleIcon,
  MessageCircle,
  Bookmark,
  Plus,
  Rocket,
  ChevronDown,
  ExternalLink,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  Copy,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import SidebarLeft from '@/components/SidebarLeft';
import SidebarRight from '@/components/SidebarRight';
import ImageGallery from '@/components/ImageGallery';
import { supabase } from '@/lib/supabase';
import { decodeHTMLEntities } from '@/lib/htmlDecoder';
import SolutionModal from '@/components/SolutionModal';
import SolutionCommentsModal from '@/components/SolutionCommentsModal';
import Avatar from '@/components/Avatar';
import { useMicroAnimations } from '@/hooks/useMicroAnimations';

type SortType = 'hot' | 'top' | 'newest' | 'discussed';
type StatusFilter = '' | 'idea' | 'building' | 'mvp' | 'launched';

interface ProblemMeta {
  id: string;
  title: string;
  slug: string | null;
  body: string;
  type: string;
  category?: string | null;
  upvotes: number;
  downvotes: number;
  comments_count: number;
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    role: string | null;
    username: string | null;
  } | null;
}

interface SolutionItem {
  id: string;
  problem_id: string;
  user_id: string;
  title: string;
  body: string;
  image_url: string | null;
  external_link: string | null;
  link_name: string | null;
  upvotes: number;
  downvotes: number;
  comments_count: number;
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    role: string | null;
    username: string | null;
  } | null;
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

function SkeletonCard() {
  return (
    <div className="sol-page-card skeleton-card">
      <div className="skeleton-line" style={{ width: '60%', height: '18px', marginBottom: '12px' }} />
      <div className="skeleton-line" style={{ width: '100%', height: '14px', marginBottom: '6px' }} />
      <div className="skeleton-line" style={{ width: '80%', height: '14px', marginBottom: '20px' }} />
      <div style={{ display: 'flex', gap: '8px' }}>
        <div className="skeleton-line" style={{ width: '60px', height: '30px', borderRadius: '999px' }} />
        <div className="skeleton-line" style={{ width: '60px', height: '30px', borderRadius: '999px' }} />
        <div className="skeleton-line" style={{ width: '60px', height: '30px', borderRadius: '999px' }} />
      </div>
    </div>
  );
}

interface ProblemSolutionsClientProps {
  initialProblem: ProblemMeta;
  initialSolutions: SolutionItem[];
  initialTotal: number;
}

export default function ProblemSolutionsClient({ initialProblem, initialSolutions, initialTotal }: ProblemSolutionsClientProps) {
  const router = useRouter();
  const params = useParams();
  const problemId = (params?.id || initialProblem.id) as string;
  const { animateCardHover, animateCardHoverOut, animateUpvote } = useMicroAnimations();

  const [session, setSession] = useState<any>(null);
  const [problem, setProblem] = useState<ProblemMeta | null>(initialProblem);
  const [solutions, setSolutions] = useState<SolutionItem[]>(initialSolutions);
  const [total, setTotal] = useState(initialTotal);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSolution, setEditingSolution] = useState<SolutionItem | null>(null);
  const [sort, setSort] = useState<SortType>('hot');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down'>>({});
  const [votingIds, setVotingIds] = useState<Record<string, boolean>>({});
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedShare, setCopiedShare] = useState(false);
  const [activeShareMenuPostId, setActiveShareMenuPostId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [commentsModalSolutionId, setCommentsModalSolutionId] = useState<string | null>(null);
  const [commentsModalSolutionTitle, setCommentsModalSolutionTitle] = useState<string>('');

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
      const { data } = await supabase.from('solution_votes').select('solution_id, vote_type').eq('user_id', userId);
      if (data?.length) {
        const map: Record<string, 'up' | 'down'> = {};
        data.forEach((v: any) => { map[v.solution_id] = v.vote_type as 'up' | 'down'; });
        setUserVotes(map);
      }
    } catch { }
  };

  const fetchData = useCallback(async () => {
    if (!problemId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ problemId, sort });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/solutions/by-problem?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProblem(data.problem);
      setSolutions(data.solutions || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [problemId, sort, statusFilter]);

  useEffect(() => {
    // Only call on updates, skip initial render
    if (sort !== 'hot' || statusFilter !== '') {
      fetchData();
    }
  }, [sort, statusFilter, fetchData]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setActiveShareMenuPostId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleVote = async (e: React.MouseEvent, solutionId: string, type: 'up' | 'down') => {
    e.stopPropagation();
    if (!session) { alert('Sign in to vote'); return; }
    if (votingIds[solutionId]) return;
    setVotingIds((p) => ({ ...p, [solutionId]: true }));
    const prev = userVotes[solutionId];
    setSolutions((cur) => cur.map((s) => {
      if (s.id !== solutionId) return s;
      let up = s.upvotes, down = s.downvotes;
      if (prev === type) { if (type === 'up') up = Math.max(0, up - 1); else down = Math.max(0, down - 1); }
      else {
        if (type === 'up') { up += 1; if (prev === 'down') down = Math.max(0, down - 1); }
        else { down += 1; if (prev === 'up') up = Math.max(0, up - 1); }
      }
      return { ...s, upvotes: up, downvotes: down };
    }));
    setUserVotes((p) => { const n = { ...p }; if (prev === type) delete n[solutionId]; else n[solutionId] = type; return n; });
    try {
      await fetch('/api/solutions/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ solution_id: solutionId, vote_type: type }),
      });
    } catch { fetchData(); } finally {
      setVotingIds((p) => ({ ...p, [solutionId]: false }));
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

  const handleDeleteSolution = async (solutionId: string) => {
    if (!session) return;
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
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error deleting solution');
    }
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

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    } catch {
      if (navigator.share) navigator.share({ url });
    }
  };

  const onSolutionSubmitted = () => {
    setIsModalOpen(false);
    setEditingSolution(null);
    fetchData();
  };

  if (!isLoading && !problem) {
    return (
      <div className="app-container">
        <Navbar />
        <div className="main-content">
          <SidebarLeft />
          <main className="center-feed" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Problem not found.</p>
              <button className="sol-page-btn-primary" onClick={() => router.back()}>Go Back</button>
            </div>
          </main>
          <SidebarRight />
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar />
      <div className="main-content">
        <SidebarLeft />
        <main className="center-feed sol-page-main">

          {/* Back nav */}
          <button
            className="sol-page-back-btn"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('top-loader:start'));
              router.push(problem?.slug ? `/post/${problem.slug}` : '/');
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Problem</span>
          </button>

          {/* Problem header card */}
          {problem && (
            <div className="sol-page-problem-header">
              <div className="sol-page-problem-header-top">
                <div className="sol-page-problem-meta">
                  {problem.type === 'problem' && (
                    <span className="sticker-tag problem" style={{ fontSize: '0.65rem' }}>Problem</span>
                  )}
                  {problem.category && (
                    <span className="sol-page-category-chip">{problem.category}</span>
                  )}
                </div>
                <div className="sol-page-problem-stats">
                  <span><TriangleIcon size={12} /> {problem.upvotes}</span>
                  <span><MessageCircle size={12} /> {problem.comments_count}</span>
                </div>
              </div>

              <h1 className="sol-page-problem-title">
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('top-loader:start'));
                    router.push(`/post/${problem.slug || problem.id}`);
                  }}
                  className="sol-page-problem-title-btn"
                >
                  {decodeHTMLEntities(problem.title)}
                </button>
              </h1>

              <div className="sol-page-problem-author">
                {problem.profiles?.avatar_url && (
                  <img
                    src={problem.profiles.avatar_url}
                    alt={problem.profiles.full_name || 'Author'}
                    className="sol-page-author-avatar"
                  />
                )}
                <span>
                  By <strong>{problem.profiles?.full_name || 'Anonymous'}</strong>
                  {problem.profiles?.role && <em> · {problem.profiles.role}</em>}
                </span>
                <span className="sol-page-author-dot">·</span>
                <span>{timeAgo(problem.created_at)}</span>
              </div>
            </div>
          )}

          {/* Controls row */}
          <div className="sol-page-controls">
            <div className="sol-page-count">
              <strong>{isLoading ? '...' : total}</strong>
              <span>Solutions Submitted</span>
            </div>

            <div className="sol-page-controls-right">
              {/* Segmented Sort Tabs */}
              <div className="sol-page-tabs">
                {(['hot', 'top', 'newest', 'discussed'] as SortType[]).map((s) => (
                  <button
                    key={s}
                    className={`sol-page-tab ${sort === s ? 'active' : ''}`}
                    onClick={() => setSort(s)}
                  >
                    {s === 'hot' ? 'Hot' : s === 'top' ? 'Top' : s === 'newest' ? 'Newest' : 'Discussed'}
                  </button>
                ))}
              </div>

              {/* Add solution CTA */}
              <button
                className="sol-page-btn-primary"
                onClick={() => {
                  if (!session) { alert('Sign in to submit a solution'); return; }
                  setIsModalOpen(true);
                }}
              >
                <Plus size={15} />
                <span>Add Solution</span>
              </button>
            </div>
          </div>

          {/* Solutions feed */}
          {isLoading ? (
            <div className="sol-page-list">
              {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : solutions.length === 0 ? (
            /* Empty state */
            <div className="sol-page-empty">
              <div className="sol-page-empty-icon">
                <Rocket size={40} strokeWidth={1.5} />
              </div>
              <h2 className="sol-page-empty-title">No Solutions Yet</h2>
              <p className="sol-page-empty-sub">Be the first person to solve this problem.</p>
              <button
                className="sol-page-empty-cta"
                onClick={() => {
                  if (!session) { alert('Sign in to submit a solution'); return; }
                  setIsModalOpen(true);
                }}
              >
                <Rocket size={16} />
                Submit First Solution
              </button>
            </div>
          ) : (
            <div className="sol-page-list">
              {solutions.map((solution) => {
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
                    data-post-id={solution.id}
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
                      {problem && (
                        <div
                          className="sol-page-card-problem-ref"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.dispatchEvent(new CustomEvent('top-loader:start'));
                            router.push(`/post/${problem.slug || problem.id}`);
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.stopPropagation();
                              window.dispatchEvent(new CustomEvent('top-loader:start'));
                              router.push(`/post/${problem.slug || problem.id}`);
                            }
                          }}
                          style={{ display: 'inline-flex', marginBottom: '0.5rem' }}
                        >
                          <span className="sol-page-card-problem-label">Solving:</span>
                          <span className="sol-page-card-problem-title">{decodeHTMLEntities(problem.title)}</span>
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
                          <button className="vote-btn" onClick={e => { animateUpvote(e.currentTarget); handleVote(e, solution.id, 'up'); }} style={{ color: userVotes[solution.id] === 'up' ? '#22c55e' : undefined }} aria-label="Upvote" disabled={votingIds[solution.id]}>
                            <TriangleIcon size={16} fill={userVotes[solution.id] === 'up' ? 'currentColor' : 'none'} />
                          </button>
                          <span className={`vote-label up ${userVotes[solution.id] === 'up' ? 'active' : ''}`} style={{ color: userVotes[solution.id] === 'up' ? '#22c55e' : undefined }}>+{solution.upvotes}</span>
                        </div>

                        {/* Downvote */}
                        <div className="vote-container" style={{ borderColor: userVotes[solution.id] === 'down' ? '#ef4444' : undefined, background: userVotes[solution.id] === 'down' ? 'rgba(239,68,68,0.08)' : undefined }}>
                          <button className="vote-btn" onClick={e => { handleVote(e, solution.id, 'down'); }} style={{ color: userVotes[solution.id] === 'down' ? '#ef4444' : undefined }} aria-label="Downvote" disabled={votingIds[solution.id]}>
                            <TriangleIcon size={16} style={{ transform: 'rotate(180deg)' }} fill={userVotes[solution.id] === 'down' ? 'currentColor' : 'none'} />
                          </button>
                          <span className={`vote-label down ${userVotes[solution.id] === 'down' ? 'active' : ''}`} style={{ color: userVotes[solution.id] === 'down' ? '#ef4444' : undefined }}>-{solution.downvotes}</span>
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
              })}
            </div>
          )}

        </main>
        <SidebarRight />
      </div>

      {/* Toast notifications */}
      {toastMessage && <div className="share-toast">{toastMessage}</div>}

      {/* Solution submission modal */}
      {isModalOpen && problem && session && (
        <SolutionModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingSolution(null);
          }}
          problemId={problem.id}
          problemTitle={problem.title}
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
