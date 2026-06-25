'use client';

import React, { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Image as ImageIcon,
  Link2,
  Wand2,
  Send,
  TriangleIcon,
  MessageCircle,
  Bookmark,
  MoreVertical,
  Smile,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Loader2,
  Pencil,
  Share2,
  Copy,
  Flag,
  UserX,
} from 'lucide-react';
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Post } from '@/lib/types';
import AuthModal from './AuthModal';
import EditPostModal from './EditPostModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { parseLinksInText, Segment } from '@/app/lib/linkParser';
import ImageGallery from './ImageGallery';
import ErrorBoundary from './ErrorBoundary';
import { decodeHTMLEntities } from '@/lib/htmlDecoder';
import { useMicroAnimations } from '@/hooks/useMicroAnimations';
import CommentsModal from './CommentsModal';
import Avatar from './Avatar';
import QualityScoreBadge from './QualityScoreBadge';

// ─── helpers ─────────────────────────────────────────────────────────────────

const formatPostTime = (dateStr: string) => {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getPostCategory = (post: Post) => post.category || post.metadata?.category || null;
const getPostTags = (post: Post) => post.tags || post.metadata?.tags || [];
const getRoleClass = (role?: string | null) => {
  const normalized = (role || '').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  if (['founder', 'developer', 'moderator', 'admin', 'problem-solver'].includes(normalized)) {
    return `role-badge--${normalized}`;
  }
  return 'role-badge--default';
};

// ─── PostCard Component ──────────────────────────────────────────────────────

interface PostCardProps {
  post: Post;
  session: any;
  profile: any;
  hasUpvoted: boolean;
  hasDownvoted: boolean;
  followings: string[];
  savedIds: string[];
  activeShareMenuPostId: string | null;
  setActiveShareMenuPostId: (id: string | null) => void;
  handleToggleSave: (id: string) => void;
  handleVote: (id: string, voteType: 'up' | 'down') => void;
  openCommentsModal: (id: string) => void;
  followMutation: any;
  setEditingPost: (post: Post) => void;
  setDeletingPostId: (id: string | null) => void;
  trackPostEvent: (postId: string, eventType: string, metadata?: any) => void;
  showToast: (message: string) => void;
}

const PostCard = React.memo(function PostCard({
  post,
  session,
  profile,
  hasUpvoted,
  hasDownvoted,
  followings,
  savedIds,
  activeShareMenuPostId,
  setActiveShareMenuPostId,
  handleToggleSave,
  handleVote,
  openCommentsModal,
  followMutation,
  setEditingPost,
  setDeletingPostId,
  trackPostEvent,
  showToast,
}: PostCardProps) {
  const router = useRouter();
  const { animateCardHover, animateCardHoverOut, animateUpvote } = useMicroAnimations();

  const isOwner = session?.user?.id === post.user_id;
  const authorName = isOwner
    ? (profile?.full_name || session?.user?.user_metadata?.full_name || post.profiles?.full_name || 'You')
    : (post.profiles?.full_name || (post.profiles?.username ? `@${post.profiles.username}` : 'Anonymous'));
  const authorAvatar = isOwner
    ? (profile?.avatar_url || session?.user?.user_metadata?.avatar_url || post.profiles?.avatar_url)
    : (post.profiles?.avatar_url);
  const authorUsername = isOwner
    ? (profile?.username || session?.user?.user_metadata?.username || post.profiles?.username)
    : (post.profiles?.username);

  return (
    <div
      className="card post-card-animate"
      data-post-id={post.id}
      onMouseEnter={animateCardHover}
      onMouseLeave={animateCardHoverOut}
      style={{ position: 'relative', overflow: 'visible' }}
    >
      {/* Post header (author, share menu) */}
      <div className="post-header">
        <div className="post-user">
          <Avatar
            src={authorAvatar}
            name={authorName}
            className="avatar" size={42}
            onClick={() => router.push(post.profiles?.username ? `/user/${post.profiles.username}` : `/profile?userId=${post.user_id}`)}
            style={{ cursor: 'pointer', flexShrink: 0 }}
          />
          <div className="post-user-info">
            <h4 className="post-author-name-container" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="post-author-name"
                onClick={() => {
                  router.push(post.profiles?.username ? `/user/${post.profiles.username}` : `/profile?userId=${post.user_id}`);
                  trackPostEvent(post.id, 'PROFILE_CLICK');
                  fetch('/api/posts/quality', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ post_id: post.id, counter: 'profile_clicks', delta: 1 }),
                  }).catch(() => {});
                }}>
                {authorName}
              </span>
              <span className={`post-type-badge ${post.type}`} style={{ textTransform: 'capitalize' }}>
                {post.type}
              </span>
              <QualityScoreBadge
                qualityScore={post.quality_score}
                uniqueViewers={post.unique_viewers}
                animate
              />
            </h4>
            {authorUsername && (
              <p className="post-author-username" onClick={() => router.push(`/user/${authorUsername}`)}>
                @{authorUsername}
              </p>
            )}
            <p className="post-author-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <time dateTime={post.created_at} title={new Date(post.created_at).toLocaleString()}>
                {formatPostTime(post.created_at)}
              </time>
              {session?.user?.id && session.user.id !== post.user_id && (
                <>
                  <span style={{ color: 'var(--text-muted)' }}>·</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      followMutation.mutate(post.user_id);
                    }}
                    disabled={followMutation.isPending}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: followings.includes(post.user_id) ? 'var(--text-muted)' : 'var(--accent-primary, #2563eb)',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {followings.includes(post.user_id) ? 'Following' : 'Follow'}
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="post-menu-shell flex items-center gap-1"
          style={{ color: 'var(--text-muted)', position: 'relative', flexShrink: 0, alignSelf: 'flex-start', zIndex: 10 }}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={activeShareMenuPostId === post.id}
            onClick={e => { e.stopPropagation(); setActiveShareMenuPostId(activeShareMenuPostId === post.id ? null : post.id); }}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '6px', borderRadius: '50%' }}
            className="post-header-action-btn" title="More Options">
            <MoreVertical size={18} />
          </button>

          {activeShareMenuPostId === post.id && (
            <div className="post-overflow-menu" role="menu" onClick={e => e.stopPropagation()}>
              <button role="menuitem" onClick={() => { setActiveShareMenuPostId(null); const url = `${window.location.origin}/post/${post.slug || post.id}`; if (navigator.share) navigator.share({ title: post.title, url }).catch(() => undefined); else navigator.clipboard.writeText(url); trackPostEvent(post.id, 'POST_SHARE', { destination: 'native' }); showToast('Share link ready.'); }}>
                <Share2 size={15} /> Share
              </button>
              <button role="menuitem" onClick={() => { setActiveShareMenuPostId(null); const shareUrl = `${window.location.origin}/post/${post.slug || post.id}`; navigator.clipboard.writeText(shareUrl); trackPostEvent(post.id, 'POST_SHARE', { destination: 'copy_link' }); showToast('Link copied.'); }}>
                <Copy size={15} /> Copy Link
              </button>
              <button role="menuitem" onClick={() => { setActiveShareMenuPostId(null); handleToggleSave(post.id); }}>
                <Bookmark size={15} fill={savedIds.includes(post.id) ? 'currentColor' : 'none'} /> {savedIds.includes(post.id) ? 'Unsave' : 'Save'}
              </button>
              {isOwner && (
                <>
                  <button role="menuitem" onClick={() => { setActiveShareMenuPostId(null); setEditingPost(post); }}>
                    <Pencil size={15} /> Edit
                  </button>
                  <button role="menuitem" className="danger" onClick={() => { setActiveShareMenuPostId(null); setDeletingPostId(post.id); }}>
                    <Trash2 size={15} /> Delete
                  </button>
                </>
              )}
              {!isOwner && (
                <>
                  <button role="menuitem" onClick={() => {
                    setActiveShareMenuPostId(null);
                    trackPostEvent(post.id, 'REPORT_SPAM');
                    fetch('/api/posts/quality', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ post_id: post.id, counter: 'reports', delta: 1 }),
                    }).catch(() => {});
                    showToast('Report received for review.');
                  }}>
                    <Flag size={15} /> Report
                  </button>
                  <button role="menuitem" className="danger" onClick={() => {
                    setActiveShareMenuPostId(null);
                    trackPostEvent(post.id, 'HIDE_POST');
                    fetch('/api/posts/quality', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ post_id: post.id, counter: 'hidden_count', delta: 1 }),
                    }).catch(() => {});
                    showToast('User blocked locally.');
                  }}>
                    <UserX size={15} /> Block User
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Post content */}
      <div className="post-content">
        {post.external_link && (
          <a href={post.external_link} target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-1"
             onClick={() => {
               trackPostEvent(post.id, 'LINK_CLICK');
               fetch('/api/posts/quality', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ post_id: post.id, counter: 'link_clicks', delta: 1 }),
               }).catch(() => {});
             }}
             style={{ color: 'var(--accent-blue)', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.5rem', textDecoration: 'none', display: 'inline-flex' }}>
            <ExternalLink size={12} />
            <span>{post.link_name || post.metadata?.link_name || post.external_link}</span>
          </a>
        )}

        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.015em', lineHeight: '1.3', marginBottom: '0.6rem', color: 'var(--text-main)', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
          {decodeHTMLEntities(post.title)}
        </h3>

        <ExpandableBody body={post.body} postId={post.id} />

        {(getPostCategory(post) || getPostTags(post).length > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.65rem' }}>
            {getPostCategory(post) && (
              <span 
                className="post-taxonomy-tag category-hashtag"
                style={{ color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/?category=${encodeURIComponent(getPostCategory(post)!)}`);
                }}
              >
                #{getPostCategory(post).toLowerCase().replace(/\s+/g, '')}
              </span>
            )}
            {getPostTags(post).map((tag: string) => (
              <span key={tag} className="post-taxonomy-tag" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Image gallery */}
      <ImageGallery imageUrlsString={post.image_url} />

      {/* Footer — votes, comments, type badge */}
      <div className="post-footer">
        <div className="flex items-center gap-2 post-footer-actions">
          <div className="vote-container" style={{ borderColor: hasUpvoted ? '#22c55e' : undefined, background: hasUpvoted ? 'rgba(34,197,94,0.08)' : undefined }}>
            <button className="vote-btn" onClick={e => { animateUpvote(e.currentTarget); handleVote(post.id, 'up'); }} style={{ color: hasUpvoted ? '#22c55e' : undefined }} aria-label="Upvote">
              <TriangleIcon size={16} fill={hasUpvoted ? 'currentColor' : 'none'} />
            </button>
            <span className={`vote-label up ${hasUpvoted ? 'active' : ''}`} style={{ color: hasUpvoted ? '#22c55e' : undefined }}>+{post.upvotes}</span>
          </div>

          <div className="vote-container" style={{ borderColor: hasDownvoted ? '#ef4444' : undefined, background: hasDownvoted ? 'rgba(239,68,68,0.08)' : undefined }}>
            <button className="vote-btn" onClick={() => handleVote(post.id, 'down')} style={{ color: hasDownvoted ? '#ef4444' : undefined }} aria-label="Downvote">
              <TriangleIcon size={16} style={{ transform: 'rotate(180deg)' }} fill={hasDownvoted ? 'currentColor' : 'none'} />
            </button>
            <span className={`vote-label down ${hasDownvoted ? 'active' : ''}`}>-{post.downvotes}</span>
          </div>

          <button type="button" className="post-comment-btn" onClick={() => openCommentsModal(post.id)} aria-label="View comments">
            <MessageCircle size={19} />
            <span className="post-comment-count">{post.comments_count}</span>
          </button>

          {post.type === 'problem' && (
            <button
              type="button"
              className="solve-it-btn"
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('top-loader:start'));
                router.push(`/problems/${post.id}/solutions`);
              }}
              style={{
                marginLeft: '0.4rem',
              }}
            >
              Solve It
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── FeedInner Component ─────────────────────────────────────────────────────

function FeedInner({ defaultFilter }: { defaultFilter?: string }) {
  const { animateButtonPress, animateButtonRelease, animateCardHover, animateCardHoverOut, animateListEntrance, animateUpvote } = useMicroAnimations();
  const feedListRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const activeFilter = searchParams.get('filter') || defaultFilter || 'all';
  const [filterType, setFilterType] = useState<string>('all');
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [commentsModalPostId, setCommentsModalPostId] = useState<string | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [activeShareMenuPostId, setActiveShareMenuPostId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [votingPostIds, setVotingPostIds] = useState<Record<string, boolean>>({});
  const dwellStartRef = useRef<Record<string, number>>({});
  const viewedPostIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => { setFilterType(activeFilter); }, [activeFilter]);

  useEffect(() => {
    const saved = localStorage.getItem('paoblem_saved_posts');
    if (saved) {
      try { setSavedIds(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    const pendingToast = sessionStorage.getItem('paoblem_toast');
    if (pendingToast) {
      showToast(pendingToast);
      sessionStorage.removeItem('paoblem_toast');
    }
  }, []);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const trackPostEvent = useCallback(async (postId: string, eventType: string, metadata: Record<string, unknown> = {}) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      await fetch('/api/analytics/track', {
        method: 'POST', headers,
        body: JSON.stringify({ post_id: postId, event_type: eventType, metadata }),
      });
    } catch (err) { console.warn('[feed] Failed to track event', err); }
  }, [session?.access_token]);

  const handleToggleSave = useCallback((postId: string) => {
    let nextSaved: string[];
    if (savedIds.includes(postId)) {
      nextSaved = savedIds.filter(id => id !== postId);
      showToast('Post removed from Saved Problems');
    } else {
      nextSaved = [...savedIds, postId];
      showToast('Post added to Saved Problems');
    }
    setSavedIds(nextSaved);
    localStorage.setItem('paoblem_saved_posts', JSON.stringify(nextSaved));
    if (!savedIds.includes(postId)) trackPostEvent(postId, 'POST_SAVE');
    if (filterType === 'saved') queryClient.invalidateQueries({ queryKey: ['posts', 'saved'] });
  }, [savedIds, filterType, trackPostEvent, queryClient, showToast]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.post-menu-shell')) return;
      setActiveShareMenuPostId(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveShareMenuPostId(null);
    };
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = () => {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    supabase
      .from('profiles')
      .select('full_name, avatar_url, role, username')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data);
      });
  };

  useEffect(() => {
    fetchUserProfile();
  }, [session?.user?.id]);

  useEffect(() => {
    window.addEventListener('profile-updated', fetchUserProfile);
    return () => {
      window.removeEventListener('profile-updated', fetchUserProfile);
    };
  }, [session?.user?.id]);

  const singlePostId = searchParams.get('post');
  const categoryParam = searchParams.get('category');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteQuery({
      queryKey: ['posts', filterType, filterType === 'saved' ? savedIds.join(',') : '', singlePostId || '', categoryParam || ''],
      queryFn: async ({ pageParam = null }) => {
        let url = `/api/posts/list?type=${filterType}`;
        if (categoryParam) {
          url += `&category=${encodeURIComponent(categoryParam)}`;
        }
        if (singlePostId) {
          url = `/api/posts/list?postId=${encodeURIComponent(singlePostId)}`;
        } else {
          if (pageParam) url += `&cursor=${encodeURIComponent(pageParam)}`;
          if (filterType === 'saved') url += `&savedIds=${encodeURIComponent(savedIds.join(','))}`;
        }
        const headers: Record<string, string> = {};
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error('Failed to fetch posts');
        return res.json();
      },
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    });

  const { data: userVotes } = useQuery({
    queryKey: ['userVotes', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return {};
      const { data: votes } = await supabase.from('votes').select('post_id, vote_type').eq('user_id', session.user.id);
      const map: Record<string, 'up' | 'down'> = {};
      votes?.forEach(v => { map[v.post_id] = v.vote_type as 'up' | 'down'; });
      return map;
    },
    enabled: !!session?.user?.id,
  });

  const { data: followings = [] } = useQuery<string[]>( {
    queryKey: ['my-followings', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      const { data } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', session.user.id);
      return data?.map(f => f.following_id) || [];
    },
    enabled: !!session?.user?.id,
  });

  const followMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!session) throw new Error('Must be logged in');
      const res = await fetch('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ targetUserId }),
      });
      if (!res.ok) throw new Error('Failed to follow');
      return res.json();
    },
    onMutate: async (targetUserId) => {
      await queryClient.cancelQueries({ queryKey: ['my-followings', session?.user?.id] });
      const previousFollowings = queryClient.getQueryData<string[]>(['my-followings', session?.user?.id]) || [];
      const isFollowing = previousFollowings.includes(targetUserId);
      const nextFollowings = isFollowing
        ? previousFollowings.filter(id => id !== targetUserId)
        : [...previousFollowings, targetUserId];

      queryClient.setQueryData(['my-followings', session?.user?.id], nextFollowings);
      return { previousFollowings };
    },
    onError: (err, targetUserId, context) => {
      if (context) {
        queryClient.setQueryData(['my-followings', session?.user?.id], context.previousFollowings);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-followings', session?.user?.id] });
    },
  });

  const observerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!observerRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, { threshold: 0.8 });
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [observerRef.current, hasNextPage, isFetchingNextPage]);

  const voteMutation = useMutation({
    mutationFn: async ({ postId, voteType }: { postId: string; voteType: 'up' | 'down' }) => {
      if (!session) throw new Error('Must be logged in to vote');
      const res = await fetch('/api/posts/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ post_id: postId, vote_type: voteType }),
      });
      if (!res.ok) throw new Error('Failed to vote');
      return res.json();
    },
    onMutate: async ({ postId, voteType }) => {
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      await queryClient.cancelQueries({ queryKey: ['userVotes', session?.user?.id] });
      const previousPostsSnapshots = queryClient.getQueriesData({ queryKey: ['posts'] });
      const previousUserVotes = queryClient.getQueryData(['userVotes', session?.user?.id]);
      const currentVote = (previousUserVotes as any)?.[postId];

      queryClient.setQueryData(['userVotes', session?.user?.id], (old: any) => {
        const newMap = { ...(old || {}) };
        if (currentVote === voteType) delete newMap[postId];
        else newMap[postId] = voteType;
        return newMap;
      });

      // Update newlyCreatedPosts state and sessionStorage optimistically
      setNewlyCreatedPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          let upDelta = 0, downDelta = 0;
          if (currentVote === voteType) {
            voteType === 'up' ? (upDelta = -1) : (downDelta = -1);
          } else if (currentVote) {
            voteType === 'up' ? ((upDelta = 1), (downDelta = -1)) : ((upDelta = -1), (downDelta = 1));
          } else {
            voteType === 'up' ? (upDelta = 1) : (downDelta = 1);
          }
          return { ...post, upvotes: Math.max(0, post.upvotes + upDelta), downvotes: Math.max(0, post.downvotes + downDelta) };
        })
      );

      try {
        const stored = JSON.parse(sessionStorage.getItem('paoblem_newly_created_posts') || '[]');
        if (Array.isArray(stored) && stored.length > 0) {
          const updated = stored.map((post: any) => {
            if (post.id !== postId) return post;
            let upDelta = 0, downDelta = 0;
            if (currentVote === voteType) {
              voteType === 'up' ? (upDelta = -1) : (downDelta = -1);
            } else if (currentVote) {
              voteType === 'up' ? ((upDelta = 1), (downDelta = -1)) : ((upDelta = -1), (downDelta = 1));
            } else {
              voteType === 'up' ? (upDelta = 1) : (downDelta = 1);
            }
            return { ...post, upvotes: Math.max(0, post.upvotes + upDelta), downvotes: Math.max(0, post.downvotes + downDelta) };
          });
          sessionStorage.setItem('paoblem_newly_created_posts', JSON.stringify(updated));
        }
      } catch (e) {
        console.error(e);
      }

      queryClient.setQueriesData({ queryKey: ['posts'] }, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            posts: page.posts.map((post: any) => {
              if (post.id !== postId) return post;
              let upDelta = 0, downDelta = 0;
              if (currentVote === voteType) {
                voteType === 'up' ? (upDelta = -1) : (downDelta = -1);
              } else if (currentVote) {
                voteType === 'up' ? ((upDelta = 1), (downDelta = -1)) : ((upDelta = -1), (downDelta = 1));
              } else {
                voteType === 'up' ? (upDelta = 1) : (downDelta = 1);
              }
              return { ...post, upvotes: Math.max(0, post.upvotes + upDelta), downvotes: Math.max(0, post.downvotes + downDelta) };
            }),
          })),
        };
      });

      return { previousPostsSnapshots, previousUserVotes };
    },
    onError: (_err, _vars, context) => {
      if (context) {
        context.previousPostsSnapshots.forEach(([key, data]: [readonly unknown[], unknown]) =>
          queryClient.setQueryData(key, data));
        queryClient.setQueryData(['userVotes', session?.user?.id], context.previousUserVotes);
      }
    },
    onSuccess: (data, { postId }) => {
      // Update quality score in cache when vote API returns fresh score
      if (data?.quality_score != null) {
        queryClient.setQueriesData({ queryKey: ['posts'] }, (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              posts: page.posts.map((post: any) =>
                post.id === postId
                  ? { ...post, quality_score: data.quality_score, unique_viewers: data.unique_viewers }
                  : post
              ),
            })),
          };
        });
      }
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ['userVotes', session?.user?.id] }); },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!session) throw new Error('Must be logged in');
      const res = await fetch(`/api/posts/delete?id=${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to delete post');
    },
    onMutate: async (postId: string) => {
      // Cancel outgoing queries to 'posts' to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ['posts'] });

      // Snapshot the previous query states
      const previousPostsQueries = queryClient.getQueriesData({ queryKey: ['posts'] });

      // Optimistically update the cache for all queries starting with ['posts']
      queryClient.setQueriesData({ queryKey: ['posts'] }, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            posts: page.posts.filter((post: any) => post.id !== postId),
          })),
        };
      });

      // Optimistically update newlyCreatedPosts state
      setNewlyCreatedPosts((prev) => prev.filter((post) => post.id !== postId));

      // Optimistically update sessionStorage
      try {
        const stored = JSON.parse(sessionStorage.getItem('paoblem_newly_created_posts') || '[]');
        if (Array.isArray(stored) && stored.length > 0) {
          const updated = stored.filter((post: any) => post.id !== postId);
          sessionStorage.setItem('paoblem_newly_created_posts', JSON.stringify(updated));
        }
      } catch (e) {
        console.error(e);
      }

      // Return context for rollback
      return { previousPostsQueries };
    },
    onError: (err, postId, context) => {
      // Rollback to the previous state on error
      if (context?.previousPostsQueries) {
        context.previousPostsQueries.forEach(([queryKey, value]) => {
          queryClient.setQueryData(queryKey, value);
        });
      }
      // Restore newlyCreatedPosts state from sessionStorage
      try {
        const stored = JSON.parse(sessionStorage.getItem('paoblem_newly_created_posts') || '[]');
        if (Array.isArray(stored)) {
          setNewlyCreatedPosts(stored);
        }
      } catch (e) {
        console.error(e);
      }
    },
    onSuccess: () => {
      showToast('Post deleted successfully');
    },
    onSettled: () => {
      // Always refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  const handleVote = useCallback((postId: string, voteType: 'up' | 'down') => {
    if (!session) { setIsAuthOpen(true); return; }
    if (votingPostIds[postId]) return;
    setVotingPostIds(prev => ({ ...prev, [postId]: true }));
    voteMutation.mutate({ postId, voteType }, {
      onSettled: () => setVotingPostIds(prev => ({ ...prev, [postId]: false })),
    });
  }, [session, votingPostIds, voteMutation]);

  const openCommentsModal = useCallback((postId: string) => {
    trackPostEvent(postId, 'POST_OPEN');
    setCommentsModalPostId(postId);
  }, [trackPostEvent]);

  const rawPosts = data?.pages.flatMap(page => page.posts) || [];

  const [newlyCreatedPosts, setNewlyCreatedPosts] = useState<any[]>([]);
  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem('paoblem_newly_created_posts') || '[]');
      if (Array.isArray(stored) && stored.length > 0) {
        setNewlyCreatedPosts(stored);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const filteredNewPosts = useMemo(() => {
    let posts = newlyCreatedPosts;
    if (filterType !== 'all') {
      posts = posts.filter(p => p.type === filterType);
    }
    if (categoryParam) {
      posts = posts.filter(p => {
        const cat = p.category || p.metadata?.category;
        return cat === categoryParam;
      });
    }
    return posts;
  }, [newlyCreatedPosts, filterType, categoryParam]);

  const posts = useMemo(() => {
    const rawPosts = data?.pages.flatMap(page => page.posts) || [];
    const mergedPosts = [...filteredNewPosts, ...rawPosts];
    return mergedPosts.filter((post, index, self) => index === self.findIndex(p => p.id === post.id));
  }, [data, filteredNewPosts]);

  const displayedPosts = posts;
  const commentsModalPost = commentsModalPostId
    ? displayedPosts.find(p => p.id === commentsModalPostId) || null
    : null;

  useEffect(() => {
    if (!isLoading && displayedPosts.length > 0)
      animateListEntrance(feedListRef, '.post-card-animate');
  }, [isLoading, filterType, displayedPosts.length]);

  useEffect(() => {
    if (!feedListRef.current || displayedPosts.length === 0) return;
    const cards = Array.from(feedListRef.current.querySelectorAll<HTMLElement>('[data-post-id]'));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const postId = (entry.target as HTMLElement).dataset.postId;
        if (!postId) return;
        if (entry.isIntersecting) {
          dwellStartRef.current[postId] = Date.now();
          if (!viewedPostIdsRef.current.has(postId)) {
            viewedPostIdsRef.current.add(postId);
            trackPostEvent(postId, 'POST_VIEW');
            // Increment unique_viewers counter for quality score
            fetch('/api/posts/quality', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ post_id: postId, counter: 'unique_viewers', delta: 1 }),
            }).catch(() => {});
          }
        } else if (dwellStartRef.current[postId]) {
          const dwellSeconds = Math.round((Date.now() - dwellStartRef.current[postId]) / 1000);
          delete dwellStartRef.current[postId];
          if (dwellSeconds >= 3) trackPostEvent(postId, 'DWELL', { dwellSeconds });
          // LONG_READ: dwell >= 20 seconds triggers quality signal
          if (dwellSeconds >= 20) {
            trackPostEvent(postId, 'LONG_READ');
            fetch('/api/posts/quality', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ post_id: postId, counter: 'long_reads', delta: 1 }),
            }).then(res => res.json()).then(data => {
              if (data?.quality_score != null) {
                queryClient.setQueriesData({ queryKey: ['posts'] }, (old: any) => {
                  if (!old?.pages) return old;
                  return {
                    ...old,
                    pages: old.pages.map((page: any) => ({
                      ...page,
                      posts: page.posts.map((p: any) =>
                        p.id === postId ? { ...p, quality_score: data.quality_score, unique_viewers: data.unique_viewers } : p
                      ),
                    })),
                  };
                });
              }
            }).catch(() => {});
          }
        }
      });
    }, { threshold: 0.55 });
    cards.forEach(card => observer.observe(card));
    return () => {
      cards.forEach(card => {
        const postId = card.dataset.postId;
        if (postId && dwellStartRef.current[postId]) {
          const dwellSeconds = Math.round((Date.now() - dwellStartRef.current[postId]) / 1000);
          delete dwellStartRef.current[postId];
          if (dwellSeconds >= 3) trackPostEvent(postId, 'DWELL', { dwellSeconds });
          if (dwellSeconds >= 20) {
            trackPostEvent(postId, 'LONG_READ');
            fetch('/api/posts/quality', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ post_id: postId, counter: 'long_reads', delta: 1 }),
            }).catch(() => {});
          }
        }
      });
      observer.disconnect();
    };
  }, [displayedPosts.map(post => post.id).join(','), session?.access_token]);

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <main className="center-feed">

      {singlePostId && (
        <button className="btn" onClick={() => router.push('/')}
          style={{ marginBottom: '1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.55rem 1rem', borderRadius: '12px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
          ← Back to Feed
        </button>
      )}

      {/* Composer trigger */}
      {!singlePostId && (
        <div className="card composer-card" onClick={() => router.push('/create-post')} style={{ cursor: 'pointer' }}>
          <div className="composer-top">
            <Avatar src={profile?.avatar_url || session?.user?.user_metadata?.avatar_url} name="You" className="composer-avatar" size={36} />
            <div className="composer-input-wrap">
              <div className="composer-input" style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                What's your Problem or Idea?
              </div>
            </div>
          </div>
          <div className="composer-divider" />
          <div className="composer-actions">
            <div className="composer-action-group">
              <div className="composer-action-btn"><ImageIcon size={16} /><span>Photo</span></div>
              <div className="composer-action-btn"><Link2 size={16} /><span>Link</span></div>
              <div className="composer-action-btn"><Wand2 size={16} /><span>AI Enhance</span></div>
            </div>
            <button className="composer-send-btn" type="button"><span>Post</span><Send size={14} /></button>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      {!singlePostId && (
        <div className="flex gap-2" style={{ margin: '0.5rem 0', padding: '0.25rem 0', overflowX: 'auto', whiteSpace: 'nowrap', maxWidth: '100%', scrollbarWidth: 'none' }}>
          {[
            { id: 'all', label: 'All Feed' },
            { id: 'problem', label: 'Problems' },
            { id: 'idea', label: 'Ideas' },
          ].map(tab => (
            <button key={tab.id} className={`btn ${filterType === tab.id ? 'btn-primary' : ''}`}
              style={{ background: filterType === tab.id ? undefined : 'var(--bg-card)', color: 'var(--text-main)', border: filterType === tab.id ? 'none' : '1px solid var(--border-color)', flexShrink: 0 }}
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                if (tab.id === 'all') params.delete('filter');
                else params.set('filter', tab.id);
                router.push(`/?${params.toString()}`);
              }}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Category Filter Chips */}
      {!singlePostId && (
        <div className="flex gap-2" style={{ margin: '0.25rem 0 0.75rem 0', padding: '0.25rem 0', overflowX: 'auto', whiteSpace: 'nowrap', maxWidth: '100%', scrollbarWidth: 'none', gap: '0.35rem' }}>
          <button 
            className={`btn btn-xs ${!categoryParam ? 'btn-primary' : ''}`}
            style={{ 
              background: !categoryParam ? undefined : 'var(--bg-card)', 
              color: 'var(--text-main)', 
              border: !categoryParam ? 'none' : '1px solid var(--border-color)', 
              flexShrink: 0,
              fontSize: '0.75rem',
              padding: '0.25rem 0.6rem',
              borderRadius: '20px'
            }}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete('category');
              const qs = params.toString();
              router.push(qs ? `/?${qs}` : '/');
            }}
          >
            All Categories
          </button>
          {['AI', 'SaaS', 'Education', 'Healthcare', 'Fintech', 'Developer Tools', 'Design', 'Marketing', 'Product', 'Sales', 'Operations', 'Funding'].map(cat => {
            const isActive = categoryParam === cat;
            return (
              <button 
                key={cat} 
                className={`btn btn-xs ${isActive ? 'btn-primary' : ''}`}
                style={{ 
                  background: isActive ? undefined : 'var(--bg-card)', 
                  color: 'var(--text-main)', 
                  border: isActive ? 'none' : '1px solid var(--border-color)', 
                  flexShrink: 0,
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '20px'
                }}
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set('category', cat);
                  router.push(`/?${params.toString()}`);
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Posts list */}
      <div 
        key={`${filterType}-${categoryParam || ''}`}
        ref={feedListRef} 
        className="feed-list-container" 
        style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
      >
        {isLoading && (<><PostSkeleton /><PostSkeleton /></>)}

        {isError && (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: '#ef4444' }}>Some error, please reload the website</p>
          </div>
        )}

        {!isLoading && posts.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <p>No posts published yet. Be the first to publish a problem or idea!</p>
          </div>
        )}

        {displayedPosts.map((post: Post) => (
          <ErrorBoundary key={post.id}>
            <PostCard
              post={post}
              session={session}
              profile={profile}
              hasUpvoted={userVotes?.[post.id] === 'up'}
              hasDownvoted={userVotes?.[post.id] === 'down'}
              followings={followings}
              savedIds={savedIds}
              activeShareMenuPostId={activeShareMenuPostId}
              setActiveShareMenuPostId={setActiveShareMenuPostId}
              handleToggleSave={handleToggleSave}
              handleVote={handleVote}
              openCommentsModal={openCommentsModal}
              followMutation={followMutation}
              setEditingPost={setEditingPost}
              setDeletingPostId={setDeletingPostId}
              trackPostEvent={trackPostEvent}
              showToast={showToast}
            />
          </ErrorBoundary>
        ))}
      </div>

      {/* Sign-in nudge for unauthenticated */}
      {!session && displayedPosts.length > 0 && !hasNextPage && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', background: 'linear-gradient(180deg, var(--bg-card) 0%, rgba(99,102,241,0.15) 100%)', borderColor: 'rgba(99,102,241,0.3)', boxShadow: '0 8px 32px rgba(99,102,241,0.1)', position: 'relative', overflow: 'hidden', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', borderRadius: '24px' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #6366f1, #3b82f6)' }} />
          <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Want to see more problems & solutions?
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '400px', lineHeight: '1.5', margin: '0 auto' }}>
            Join our developer community to view more, vote on problems, or write comments.
          </p>
          <button className="btn btn-primary" onClick={() => setIsAuthOpen(true)}
            style={{ padding: '0.65rem 1.75rem', fontWeight: 600, fontSize: '0.88rem', marginTop: '0.5rem' }}>
            Sign In / Sign Up
          </button>
        </div>
      )}

      {hasNextPage && (
        <div ref={observerRef} style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem 0' }}>
          <Loader2 size={24} className="spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      )}

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      {commentsModalPost && (
        <CommentsModal
          post={commentsModalPost}
          isOpen={true}
          onClose={() => setCommentsModalPostId(null)}
          session={session}
          profile={profile}
          userVote={userVotes?.[commentsModalPost.id] || null}
          onVote={handleVote}
          onAuthRequired={() => setIsAuthOpen(true)}
        />
      )}
      {editingPost && (
        <EditPostModal isOpen={!!editingPost} onClose={() => setEditingPost(null)} post={editingPost} session={session} />
      )}
      <DeleteConfirmModal
        isOpen={!!deletingPostId}
        onClose={() => setDeletingPostId(null)}
        onConfirm={() => { if (deletingPostId) { deletePostMutation.mutate(deletingPostId); setDeletingPostId(null); } }}
        isPending={deletePostMutation.isPending}
      />
      {toastMessage && <div className="share-toast">{toastMessage}</div>}
    </main>
  );
}

// ── Loading skeleton (unchanged) ──────────────────────────────────────────────
function PostSkeleton() {
  return (
    <div className="card" style={{ pointerEvents: 'none' }}>
      <div className="post-header" style={{ marginBottom: '1rem' }}>
        <div className="post-user">
          <div className="skeleton-loader skeleton-avatar" />
          <div className="post-user-info" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '120px' }}>
            <div className="skeleton-loader skeleton-title" style={{ width: '100%', height: '12px', margin: 0 }} />
            <div className="skeleton-loader skeleton-text" style={{ width: '60%', height: '9px', margin: 0 }} />
          </div>
        </div>
      </div>
      <div className="post-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        <div className="skeleton-loader skeleton-title" style={{ width: '40%' }} />
        <div className="skeleton-loader skeleton-text" style={{ width: '100%' }} />
        <div className="skeleton-loader skeleton-text" style={{ width: '85%' }} />
      </div>
      <div className="post-footer" style={{ border: 'none', padding: 0, margin: 0 }}>
        <div className="skeleton-loader" style={{ width: '140px', height: '28px', borderRadius: '20px' }} />
      </div>
    </div>
  );
}

// ── Link-aware body renderer (unchanged) ──────────────────────────────────────
function renderFormattedText(text: string, listType: 'ul' | 'ol' | null = null): React.ReactNode[] {
  if (!text) return [];
  const regex = /(<strong\b[^>]*>[\s\S]*?<\/strong>|<b\b[^>]*>[\s\S]*?<\/b>|<em\b[^>]*>[\s\S]*?<\/em>|<i\b[^>]*>[\s\S]*?<\/i>|<u\b[^>]*>[\s\S]*?<\/u>|<code\b[^>]*>[\s\S]*?<\/code>|<ul\b[^>]*>[\s\S]*?<\/ul>|<ol\b[^>]*>[\s\S]*?<\/ol>|<li\b[^>]*>[\s\S]*?<\/li>|\*\*[^*]+\*\*|\*[^*]+\*|<u>[^<]+<\/u>|`[^`]+`)/gi;
  const parts = text.split(regex);
  let liCounter = 1;
  return parts.map((part, idx) => {
    if (!part) return null;
    if (listType && !/^<li\b/i.test(part)) return null;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx}>{renderFormattedText(part.slice(2, -2))}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={idx}>{renderFormattedText(part.slice(1, -1))}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={idx} style={{ background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.85em' }}>{part.slice(1, -1)}</code>;
    }
    if (/^<strong\b/i.test(part)) {
      const inner = part.replace(/^<strong\b[^>]*>|<\/strong>$/gi, '');
      return <strong key={idx}>{renderFormattedText(inner)}</strong>;
    }
    if (/^<b\b/i.test(part)) {
      const inner = part.replace(/^<b\b[^>]*>|<\/b>$/gi, '');
      return <strong key={idx}>{renderFormattedText(inner)}</strong>;
    }
    if (/^<em\b/i.test(part)) {
      const inner = part.replace(/^<em\b[^>]*>|<\/em>$/gi, '');
      return <em key={idx}>{renderFormattedText(inner)}</em>;
    }
    if (/^<i\b/i.test(part)) {
      const inner = part.replace(/^<i\b[^>]*>|<\/i>$/gi, '');
      return <em key={idx}>{renderFormattedText(inner)}</em>;
    }
    if (/^<u\b/i.test(part)) {
      const inner = part.replace(/^<u\b[^>]*>|<\/u>$/gi, '');
      return <u key={idx}>{renderFormattedText(inner)}</u>;
    }
    if (/^<code\b/i.test(part)) {
      const inner = part.replace(/^<code\b[^>]*>|<\/code>$/gi, '');
      return <code key={idx} style={{ background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.85em' }}>{inner}</code>;
    }
    if (/^<ul\b/i.test(part)) {
      const inner = part.replace(/^<ul\b[^>]*>|<\/ul>$/gi, '').trim();
      return <ul key={idx} style={{ margin: '0.4rem 0', paddingLeft: '1.15rem', listStyleType: 'none' }}>{renderFormattedText(inner, 'ul')}</ul>;
    }
    if (/^<ol\b/i.test(part)) {
      const inner = part.replace(/^<ol\b[^>]*>|<\/ol>$/gi, '').trim();
      return <ol key={idx} style={{ margin: '0.4rem 0', paddingLeft: '1.15rem', listStyleType: 'none' }}>{renderFormattedText(inner, 'ol')}</ol>;
    }
    if (/^<li\b/i.test(part)) {
      const inner = part.replace(/^<li\b[^>]*>|<\/li>$/gi, '').trim();
      const currentNumber = liCounter++;
      const marker = listType === 'ol' ? `${currentNumber}.` : '•';
      return (
        <li key={idx} style={{ 
          marginBottom: '0.38rem', 
          display: 'flex', 
          alignItems: 'flex-start',
          gap: '0.6rem',
          lineHeight: '1.45'
        }}>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0, minWidth: listType === 'ol' ? '1.25rem' : 'auto' }}>{marker}</span>
          <div style={{ flex: 1 }}>{renderFormattedText(inner)}</div>
        </li>
      );
    }
    return part;
  }).filter(Boolean) as React.ReactNode[];
}

function stripHtmlTags(html: string): string {
  if (!html) return '';
  let text = html;
  text = text.replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  text = text.replace(/<b\b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  text = text.replace(/<em\b[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  text = text.replace(/<i\b[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  text = text.replace(/<u\b[^>]*>([\s\S]*?)<\/u>/gi, '<u>$1</u>');
  text = text.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  text = text.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (match, inner) => {
    return `• ${inner.trim()}\n`;
  });
  text = text.replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, '');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function renderParagraphs(text: string, listType: 'ul' | 'ol' | null = null): React.ReactNode[] {
  if (!text) return [];
  const paragraphs = text.split(/\n{2,}/g);
  return paragraphs.map((para, pIdx) => {
    if (!para.trim()) return null;
    const isLast = pIdx === paragraphs.length - 1;
    return (
      <div key={pIdx} style={{ marginBottom: isLast ? '0' : '0.75rem' }}>
        {renderFormattedText(para, listType)}
      </div>
    );
  }).filter(Boolean) as React.ReactNode[];
}

function RenderSegments({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'link') {
          return (
            <a key={i} href={seg.url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 500, wordBreak: 'break-all' }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
              {seg.display}
            </a>
          );
        }
        return <React.Fragment key={i}>{renderParagraphs(seg.content)}</React.Fragment>;
      })}
    </>
  );
}

function closeUnclosedTags(text: string, suffix: string = ''): string {
  let result = text.trimEnd();
  
  // Handle HTML tag cut-offs: if we cut inside a tag like "<st" or "<li st", truncate before the opening "<"
  const openBracketIndex = result.lastIndexOf('<');
  const closeBracketIndex = result.lastIndexOf('>');
  if (openBracketIndex > closeBracketIndex) {
    result = result.substring(0, openBracketIndex);
  }

  const tags = ['strong', 'b', 'em', 'i', 'u', 'code', 'ul', 'ol', 'li'];
  const stack: string[] = [];
  const tagRegex = /<\/?([a-zA-Z0-9]+)\b[^>]*>/g;
  let match;
  while ((match = tagRegex.exec(result)) !== null) {
    const isClose = match[0].startsWith('</');
    const tagName = match[1].toLowerCase();
    if (tags.includes(tagName)) {
      if (isClose) {
        if (stack.length > 0 && stack[stack.length - 1] === tagName) {
          stack.pop();
        }
      } else {
        stack.push(tagName);
      }
    }
  }

  // Append suffix before closing HTML tags
  result += suffix;

  // Close any open HTML tags in reverse order
  while (stack.length > 0) {
    const tag = stack.pop();
    result += `</${tag}>`;
  }

  // Handle markdown bold/italic tags
  const doubleStars = (result.match(/\*\*/g) || []).length;
  if (doubleStars % 2 !== 0) {
    result += '**';
  }
  
  const temp = result.replace(/\*\*/g, '@@');
  const singleStars = (temp.match(/\*/g) || []).length;
  if (singleStars % 2 !== 0) {
    result += '*';
  }
  
  const openU = (result.match(/<u>/gi) || []).length;
  const closeU = (result.match(/<\/u>/gi) || []).length;
  if (openU > closeU) {
    result += '</u>';
  }
  
  return result;
}

function ExpandableBody({ body, postId }: { body: string; postId?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const maxLength = 320;
  const decodedBody = decodeHTMLEntities(body).replace(/\n{3,}/g, '\n\n');
  const cleanBody = stripHtmlTags(decodedBody);
  const segments = parseLinksInText(decodedBody);

  const baseStyle = {
    fontSize: '0.925rem', color: 'var(--text-body)', lineHeight: '1.65',
    fontWeight: 400, letterSpacing: '0.01em', wordBreak: 'break-word' as const,
    overflowWrap: 'break-word' as const, whiteSpace: 'pre-wrap' as const,
  };

  if (cleanBody.length <= maxLength) {
    return <div className="post-body-text" style={baseStyle}><RenderSegments segments={segments} /></div>;
  }

  const displayText = isExpanded ? decodedBody : closeUnclosedTags(decodedBody.slice(0, maxLength), '…');
  const displaySegments = parseLinksInText(displayText);

  return (
    <div>
      <div className="post-body-text" style={{ ...baseStyle, margin: 0 }}>
        <RenderSegments segments={displaySegments} />
      </div>
      <button onClick={e => {
        e.stopPropagation();
        if (!isExpanded && postId) {
          fetch('/api/analytics/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: postId, event_type: 'SEE_MORE' }),
          }).catch(() => {});
          fetch('/api/posts/quality', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: postId, counter: 'see_more_clicks', delta: 1 }),
          }).catch(() => {});
        }
        setIsExpanded(!isExpanded);
      }}
        style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', padding: '4px 0', marginTop: '4px', display: 'inline-flex', alignItems: 'center' }}>
        {isExpanded ? 'See less' : 'See more'}
      </button>
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────
export default function Feed({ defaultFilter }: { defaultFilter?: string }) {
  return (
    <Suspense fallback={null}>
      <FeedInner defaultFilter={defaultFilter} />
    </Suspense>
  );
}
