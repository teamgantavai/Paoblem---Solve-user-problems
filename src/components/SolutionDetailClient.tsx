'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  TriangleIcon,
  MessageCircle,
  Bookmark,
  Share2,
  ExternalLink,
  Code2,
  Globe,
  Clock,
  User,
  Loader2,
  Check,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import SidebarLeft from '@/components/SidebarLeft';
import SidebarRight from '@/components/SidebarRight';
import ImageGallery from '@/components/ImageGallery';
import { supabase } from '@/lib/supabase';
import { decodeHTMLEntities } from '@/lib/htmlDecoder';
import Avatar from '@/components/Avatar';
import { useMicroAnimations } from '@/hooks/useMicroAnimations';

interface SolutionDetail {
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
  updated_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    role: string | null;
    username: string | null;
  } | null;
  problem?: {
    id: string;
    title: string;
    slug: string | null;
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
  } | null;
}

interface RelatedSolution {
  id: string;
  title: string;
  upvotes: number;
  comments_count: number;
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface SolutionComment {
  id: string;
  user_id: string;
  solution_id: string;
  body: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
    role: string | null;
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
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface SolutionDetailClientProps {
  initialSolution: SolutionDetail;
  initialRelated: RelatedSolution[];
}

export default function SolutionDetailClient({ initialSolution, initialRelated }: SolutionDetailClientProps) {
  const router = useRouter();
  const params = useParams();
  const solutionId = (params?.id || initialSolution.id) as string;
  const { animateUpvote } = useMicroAnimations();

  const [session, setSession] = useState<any>(null);
  const [solution, setSolution] = useState<SolutionDetail | null>(initialSolution);
  const [related, setRelated] = useState<RelatedSolution[]>(initialRelated);
  const [isLoading, setIsLoading] = useState(false);
  const [comments, setComments] = useState<SolutionComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(null);
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) fetchUserVote(s.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) fetchUserVote(s.user.id);
    });
    try {
      const saved = JSON.parse(localStorage.getItem('paoblem_saved_solutions') || '[]');
      setIsSaved(saved.includes(solutionId));
    } catch {}
    return () => subscription.unsubscribe();
  }, [solutionId]);

  const fetchUserVote = async (userId: string) => {
    const { data } = await supabase
      .from('solution_votes')
      .select('vote_type')
      .eq('user_id', userId)
      .eq('solution_id', solutionId)
      .maybeSingle();
    if (data) setUserVote(data.vote_type as 'up' | 'down');
  };

  const fetchSolution = useCallback(async () => {
    if (!solutionId) return;
    try {
      const res = await fetch(`/api/solutions/${solutionId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSolution(data.solution);
      setRelated(data.related || []);
    } catch (err) {
      console.error(err);
    }
  }, [solutionId]);

  // Optionally fetch solution updates on mount/refresh
  useEffect(() => {
    if (!initialSolution) {
      setIsLoading(true);
      fetchSolution().finally(() => setIsLoading(false));
    }
  }, [fetchSolution, initialSolution]);

  const loadComments = async () => {
    if (commentsLoaded || commentsLoading) return;
    setCommentsLoading(true);
    try {
      const { data, error } = await supabase
        .from('solution_comments')
        .select('*, profiles:user_id(full_name, avatar_url, username, role)')
        .eq('solution_id', solutionId)
        .order('created_at', { ascending: true });
      if (!error) {
        setComments(data || []);
        setCommentsLoaded(true);
      }
    } catch {}
    setCommentsLoading(false);
  };

  // Auto-load comments on scroll to comments section
  useEffect(() => {
    const target = document.getElementById('sol-detail-comments');
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadComments(); },
      { threshold: 0.1 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [solutionId, commentsLoaded]);

  const handleVote = async (type: 'up' | 'down') => {
    if (!session) { alert('Sign in to vote'); return; }
    if (isVoting || !solution) return;
    setIsVoting(true);
    const prev = userVote;
    const isToggle = prev === type;
    setUserVote(isToggle ? null : type);
    setSolution((s) => {
      if (!s) return s;
      let up = s.upvotes, down = s.downvotes;
      if (isToggle) { if (type === 'up') up = Math.max(0, up - 1); else down = Math.max(0, down - 1); }
      else {
        if (type === 'up') { up += 1; if (prev === 'down') down = Math.max(0, down - 1); }
        else { down += 1; if (prev === 'up') up = Math.max(0, up - 1); }
      }
      return { ...s, upvotes: up, downvotes: down };
    });
    try {
      await fetch('/api/solutions/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ solution_id: solutionId, vote_type: type }),
      });
    } catch { fetchSolution(); } finally {
      setIsVoting(false);
    }
  };

  const toggleSave = () => {
    try {
      const saved: string[] = JSON.parse(localStorage.getItem('paoblem_saved_solutions') || '[]');
      let next: string[];
      if (isSaved) { next = saved.filter((id) => id !== solutionId); }
      else { next = [...saved, solutionId]; }
      setIsSaved(!isSaved);
      localStorage.setItem('paoblem_saved_solutions', JSON.stringify(next));
    } catch {}
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

  const submitComment = async () => {
    if (!session || !commentBody.trim()) return;
    setIsSubmittingComment(true);
    try {
      const { data, error } = await supabase
        .from('solution_comments')
        .insert({ user_id: session.user.id, solution_id: solutionId, body: commentBody.trim() })
        .select('*, profiles:user_id(full_name, avatar_url, username, role)')
        .single();
      if (error) throw error;
      setComments((prev) => [...prev, data]);
      setCommentBody('');
      setComposerFocused(false);
      setSolution((s) => s ? { ...s, comments_count: s.comments_count + 1 } : s);
    } catch (err: any) {
      alert(err.message || 'Failed to post comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!session) return;
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    try {
      const { error } = await supabase
        .from('solution_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', session.user.id);
      if (error) throw error;
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setSolution((s) => s ? { ...s, comments_count: Math.max(0, s.comments_count - 1) } : s);
    } catch (err: any) {
      alert(err.message || 'Failed to delete comment');
    }
  };

  const saveEditComment = async (commentId: string) => {
    if (!session || !editCommentText.trim()) return;
    try {
      const { error } = await supabase
        .from('solution_comments')
        .update({ body: editCommentText.trim(), updated_at: new Date().toISOString() })
        .eq('id', commentId)
        .eq('user_id', session.user.id);
      if (error) throw error;
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, body: editCommentText.trim(), updated_at: new Date().toISOString() } : c
        )
      );
      setEditCommentId(null);
      setEditCommentText('');
    } catch (err: any) {
      alert(err.message || 'Failed to update comment');
    }
  };

  if (isLoading || !solution) {
    return (
      <div className="app-container">
        <Navbar />
        <div className="main-content">
          <SidebarLeft />
          <main className="center-feed sol-detail-main">
            <div className="sol-detail-skeleton">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton-line" style={{ height: i === 1 ? '28px' : '14px', width: i === 1 ? '70%' : `${60 + i * 5}%`, marginBottom: '12px' }} />
              ))}
            </div>
          </main>
          <SidebarRight />
        </div>
      </div>
    );
  }

  const avatarSrc = solution.profiles?.avatar_url
    || `https://api.dicebear.com/7.x/bottts/svg?seed=${solution.user_id}`;

  let imageUrls: string[] = [];
  try {
    if (solution.image_url) {
      const p = JSON.parse(solution.image_url);
      imageUrls = Array.isArray(p) ? p : [p];
    }
  } catch {
    if (solution.image_url) imageUrls = [solution.image_url];
  }

  const isGithubLink = solution.external_link?.includes('github.com');

  return (
    <div className="app-container">
      <Navbar />
      <div className="main-content">
        <SidebarLeft />
        <main className="center-feed sol-detail-main">

          {/* Back nav */}
          <button
            className="sol-page-back-btn"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('top-loader:start'));
              if (solution.problem) {
                router.push(`/problems/${solution.problem_id}/solutions`);
              } else {
                router.back();
              }
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Solutions</span>
          </button>

          {/* Main solution card */}
          <article className="sol-detail-card">

            {/* Author row */}
            <div className="sol-detail-author-row">
              <Avatar
                src={solution.profiles?.avatar_url}
                name={solution.profiles?.full_name || 'Anonymous'}
                size={44}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('top-loader:start'));
                  router.push(solution.profiles?.username ? `/user/${solution.profiles.username}` : `/profile?userId=${solution.user_id}`);
                }}
                style={{ cursor: 'pointer', flexShrink: 0 }}
              />
              <div className="sol-detail-author-info">
                <div className="sol-detail-author-meta">
                  <span className="sol-detail-author-name">
                    {solution.profiles?.full_name || 'Anonymous'}
                  </span>
                  {solution.profiles?.role && (
                    <span className="sol-detail-author-role">{solution.profiles.role}</span>
                  )}
                </div>
                <span className="sol-detail-author-time">
                  <Clock size={11} /> {timeAgo(solution.created_at)}
                </span>
              </div>
            </div>

            {/* Title */}
            <h1 className="sol-detail-title">{decodeHTMLEntities(solution.title)}</h1>

            {/* Problem reference */}
            {solution.problem && (
              <button
                className="sol-detail-problem-ref"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('top-loader:start'));
                  router.push(`/post/${solution.problem!.slug || solution.problem_id}`);
                }}
              >
                <span className="sol-detail-problem-label">Solving:</span>
                <span className="sol-detail-problem-title">{decodeHTMLEntities(solution.problem.title)}</span>
                <ExternalLink size={11} style={{ opacity: 0.6 }} />
              </button>
            )}

            {/* Full description */}
            <div className="sol-detail-body">
              <p>{decodeHTMLEntities(solution.body)}</p>
            </div>

            {/* Media gallery */}
            {imageUrls.length > 0 && (
              <div className="sol-detail-media">
                <ImageGallery imageUrlsString={solution.image_url} />
              </div>
            )}

            {/* External links */}
            {solution.external_link && (
              <div className="sol-detail-links">
                <a
                  href={solution.external_link}
                  target="_blank"
                  rel="noreferrer"
                  className="sol-detail-link-btn"
                >
                  {isGithubLink ? <Code2 size={15} /> : <Globe size={15} />}
                  <span>{solution.link_name || (isGithubLink ? 'GitHub Repository' : 'View Website')}</span>
                  <ExternalLink size={12} style={{ opacity: 0.6 }} />
                </a>
              </div>
            )}

            {/* Vote & action bar */}
            <div className="sol-detail-action-bar">
              <div className="sol-detail-vote-group">
                <button
                  className={`sol-detail-vote-btn up ${userVote === 'up' ? 'active' : ''} ${isVoting ? 'loading' : ''}`}
                  onClick={(e) => { animateUpvote(e.currentTarget); handleVote('up'); }}
                  disabled={isVoting}
                  title="Upvote"
                >
                  <TriangleIcon size={14} />
                  <span>{solution.upvotes}</span>
                </button>
                <button
                  className={`sol-detail-vote-btn down ${userVote === 'down' ? 'active' : ''} ${isVoting ? 'loading' : ''}`}
                  onClick={() => handleVote('down')}
                  disabled={isVoting}
                  title="Downvote"
                >
                  <TriangleIcon size={14} style={{ transform: 'rotate(180deg)' }} />
                  <span>{solution.downvotes}</span>
                </button>
              </div>

              <button
                className="sol-detail-action-btn"
                onClick={() => document.getElementById('sol-detail-comments')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <MessageCircle size={14} />
                <span>{solution.comments_count}<span className="hide-mobile"> Comments</span></span>
              </button>

              <button
                className={`sol-detail-action-btn ${isSaved ? 'saved' : ''}`}
                onClick={toggleSave}
              >
                <Bookmark size={14} fill={isSaved ? 'currentColor' : 'none'} />
                <span className="hide-mobile">{isSaved ? 'Saved' : 'Save'}</span>
              </button>

              <button className="sol-detail-action-btn" onClick={handleShare}>
                {copiedShare ? <Check size={14} /> : <Share2 size={14} />}
                <span className="hide-mobile">{copiedShare ? 'Copied!' : 'Share'}</span>
              </button>
            </div>
          </article>

          {/* Comments section */}
          <section className="sol-detail-comments-section" id="sol-detail-comments">
            <h2 className="sol-detail-comments-title">
              <MessageCircle size={18} />
              Comments ({comments.length})
            </h2>

            {/* Comment input */}
            {session ? (
              <div className="sol-detail-comment-input-row" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <Avatar
                  src={session.user?.user_metadata?.avatar_url}
                  name="You"
                  className="comment-tree-avatar"
                  size={36}
                />
                <div style={{ flex: 1 }}>
                  <textarea
                    rows={composerFocused || commentBody ? 2 : 1}
                    placeholder="Add a comment..."
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    onFocus={() => setComposerFocused(true)}
                    disabled={isSubmittingComment}
                    style={{
                      width: '100%',
                      resize: 'none',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '14px',
                      padding: '6px 0',
                      outline: 'none',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        submitComment();
                      }
                    }}
                  />
                  {(composerFocused || commentBody) && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '6px 10px',
                          borderRadius: '16px',
                        }}
                        onClick={() => {
                          setCommentBody('');
                          setComposerFocused(false);
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={submitComment}
                        disabled={isSubmittingComment || !commentBody.trim()}
                        style={{
                          background: commentBody.trim() ? 'var(--accent-blue)' : 'rgba(255,255,255,0.08)',
                          color: commentBody.trim() ? '#fff' : 'var(--text-muted)',
                          border: 'none',
                          fontSize: '13px',
                          fontWeight: 600,
                          padding: '6px 16px',
                          borderRadius: '16px',
                          cursor: commentBody.trim() ? 'pointer' : 'default',
                        }}
                      >
                        {isSubmittingComment ? <Loader2 size={14} className="spin" /> : 'Comment'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="sol-detail-comment-signin" style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                <User size={16} />
                <span>Sign in to join the discussion</span>
              </div>
            )}

            {/* Comments list */}
            {commentsLoading && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <Loader2 size={16} className="spin" style={{ display: 'inline', marginRight: '6px' }} />
                Loading comments…
              </div>
            )}

            {commentsLoaded && comments.length === 0 && (
              <div className="sol-detail-no-comments" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '14px' }}>
                <MessageCircle size={20} strokeWidth={1.5} style={{ margin: '0 auto 8px' }} />
                <p>No comments yet. Start the conversation!</p>
              </div>
            )}

            {comments.length > 0 && (
              <div className="comment-tree-list">
                {comments.map((comment) => {
                  const isOwner = session?.user?.id === comment.user_id;
                  const authorName = comment.profiles?.full_name || 'Anonymous';
                  const authorUsername = comment.profiles?.username;
                  const isMenuOpen = openCommentMenuId === comment.id;
                  const isEditingThis = editCommentId === comment.id;

                  return (
                    <div key={comment.id} className="comment-tree-node" style={{ position: 'relative', marginBottom: '20px' }}>
                      <div className="comment-tree-row">
                        <Avatar
                          src={comment.profiles?.avatar_url}
                          name={authorName}
                          className="comment-tree-avatar"
                          size={36}
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('top-loader:start'));
                            router.push(authorUsername ? `/user/${authorUsername}` : `/profile?userId=${comment.user_id}`);
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        <div className="comment-tree-body" style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                              <span
                                onClick={() => {
                                  window.dispatchEvent(new CustomEvent('top-loader:start'));
                                  router.push(authorUsername ? `/user/${authorUsername}` : `/profile?userId=${comment.user_id}`);
                                }}
                                style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-main)', cursor: 'pointer' }}
                              >
                                {authorUsername ? `@${authorUsername}` : authorName}
                              </span>
                              {comment.profiles?.role && (
                                <span className="comment-tree-role" style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '10px', background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                                  {comment.profiles.role}
                                </span>
                              )}
                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>·</span>
                              <time style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                {timeAgo(comment.created_at)}
                              </time>
                            </div>

                            {/* Comment options dropdown */}
                            {isOwner && (
                              <div style={{ position: 'relative', flexShrink: 0 }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenCommentMenuId(isMenuOpen ? null : comment.id);
                                  }}
                                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                >
                                  <MoreHorizontal size={16} />
                                </button>

                                {isMenuOpen && (
                                  <>
                                    <div
                                      onClick={() => setOpenCommentMenuId(null)}
                                      style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                                    />
                                    <div
                                      style={{
                                        position: 'absolute',
                                        right: 0,
                                        top: '24px',
                                        zIndex: 41,
                                        background: 'var(--bg-hover)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        minWidth: '120px',
                                        overflow: 'hidden',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                      }}
                                    >
                                      <button
                                        type="button"
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          width: '100%',
                                          textAlign: 'left',
                                          background: 'none',
                                          border: 'none',
                                          color: 'var(--text-main)',
                                          fontSize: '13px',
                                          padding: '8px 12px',
                                          cursor: 'pointer',
                                        }}
                                        onClick={() => {
                                          setEditCommentId(comment.id);
                                          setEditCommentText(comment.body);
                                          setOpenCommentMenuId(null);
                                        }}
                                      >
                                        <Pencil size={13} /> Edit
                                      </button>
                                      <button
                                        type="button"
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          width: '100%',
                                          textAlign: 'left',
                                          background: 'none',
                                          border: 'none',
                                          color: '#ef4444',
                                          fontSize: '13px',
                                          padding: '8px 12px',
                                          cursor: 'pointer',
                                        }}
                                        onClick={() => {
                                          setOpenCommentMenuId(null);
                                          deleteComment(comment.id);
                                        }}
                                      >
                                        <Trash2 size={13} /> Delete
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {isEditingThis ? (
                            <div className="comment-tree-edit" style={{ marginTop: '6px' }}>
                              <input
                                type="text"
                                value={editCommentText}
                                onChange={(e) => setEditCommentText(e.target.value)}
                                className="comment-tree-edit-input"
                                style={{
                                  width: '100%',
                                  background: 'var(--bg-dark)',
                                  border: '1px solid var(--border-color)',
                                  color: 'var(--text-main)',
                                  borderRadius: '8px',
                                  padding: '6px 10px',
                                  fontSize: '14px',
                                  outline: 'none',
                                }}
                              />
                              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  className="comment-tree-edit-cancel"
                                  onClick={() => setEditCommentId(null)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="comment-tree-edit-save"
                                  onClick={() => saveEditComment(comment.id)}
                                  style={{
                                    background: 'var(--accent-blue)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '4px 10px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                  }}
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="comment-tree-text" style={{ marginTop: '4px', whiteSpace: 'pre-wrap', color: 'var(--text-main)', fontSize: '14px' }}>
                              {comment.body}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Related solutions */}
          {related.length > 0 && (
            <section className="sol-detail-related">
              <h2 className="sol-detail-related-title">Other Solutions for This Problem</h2>
              <div className="sol-detail-related-list">
                {related.map((rel) => (
                  <article
                    key={rel.id}
                    className="sol-detail-related-card"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('top-loader:start'));
                      router.push(`/solutions/${rel.id}`);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        window.dispatchEvent(new CustomEvent('top-loader:start'));
                        router.push(`/solutions/${rel.id}`);
                      }
                    }}
                  >
                    <div className="sol-detail-related-header">
                      <img
                        src={rel.profiles?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${rel.id}`}
                        alt={rel.profiles?.full_name || 'Solver'}
                        className="sol-detail-related-avatar"
                      />
                      <span className="sol-detail-related-author">{rel.profiles?.full_name || 'Anonymous'}</span>
                      <span className="sol-detail-related-time">{timeAgo(rel.created_at)}</span>
                    </div>
                    <h3 className="sol-detail-related-title-text">{rel.title}</h3>
                    <div className="sol-detail-related-stats">
                      <span><TriangleIcon size={11} /> {rel.upvotes}</span>
                      <span><MessageCircle size={11} /> {rel.comments_count}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

        </main>
        <SidebarRight />
      </div>
    </div>
  );
}
