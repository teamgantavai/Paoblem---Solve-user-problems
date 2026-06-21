'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
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
  Copy
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

function FeedInner({ defaultFilter }: { defaultFilter?: string }) {
  const { animateButtonPress, animateButtonRelease, animateCardHover, animateCardHoverOut, animateListEntrance, animateUpvote } = useMicroAnimations();
  const feedListRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const activeFilter = searchParams.get('filter') || defaultFilter || 'all';
  const [filterType, setFilterType] = useState<string>('all');
  const [session, setSession] = useState<any>(null);
  const [commentsModalPostId, setCommentsModalPostId] = useState<string | null>(null);
  const [shuffledPosts, setShuffledPosts] = useState<Post[]>([]);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  // Bookmarks state (localStorage)
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [activeShareMenuPostId, setActiveShareMenuPostId] = useState<string | null>(null);
  const [showSubSharePostId, setShowSubSharePostId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [votingPostIds, setVotingPostIds] = useState<Record<string, boolean>>({});
  const dwellStartRef = useRef<Record<string, number>>({});
  const viewedPostIdsRef = useRef<Set<string>>(new Set());

  // Synchronize URL query parameter with component state
  useEffect(() => {
    setFilterType(activeFilter);
  }, [activeFilter]);

  // Load saved post IDs on mount
  useEffect(() => {
    const saved = localStorage.getItem('paoblem_saved_posts');
    if (saved) {
      try {
        setSavedIds(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleToggleSave = (postId: string) => {
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
    if (!savedIds.includes(postId)) {
      trackPostEvent(postId, 'POST_SAVE');
    }

    // Invalidate react-query cache if we are in the saved list tab to instantly remove the post visually
    if (filterType === 'saved') {
      queryClient.invalidateQueries({ queryKey: ['posts', 'saved'] });
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Close sharing menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveShareMenuPostId(null);
      setShowSubSharePostId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // 1. Listen to Auth State
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const singlePostId = searchParams.get('post');

  // 2. Infinite Query for Posts
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ['posts', filterType, filterType === 'saved' ? savedIds.join(',') : '', singlePostId || ''],
    queryFn: async ({ pageParam = null }) => {
      let url = `/api/posts/list?type=${filterType}`;
      if (singlePostId) {
        url = `/api/posts/list?postId=${encodeURIComponent(singlePostId)}`;
      } else {
        if (pageParam) {
          url += `&cursor=${encodeURIComponent(pageParam)}`;
        }
        if (filterType === 'saved') {
          url += `&savedIds=${encodeURIComponent(savedIds.join(','))}`;
        }
      }

      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Failed to fetch posts');
      return res.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  // 3. User Votes mapping
  const { data: userVotes } = useQuery({
    queryKey: ['userVotes', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return {};
      const { data: votes } = await supabase
        .from('votes')
        .select('post_id, vote_type')
        .eq('user_id', session.user.id);

      const map: Record<string, 'up' | 'down'> = {};
      votes?.forEach((v) => {
        map[v.post_id] = v.vote_type as 'up' | 'down';
      });
      return map;
    },
    enabled: !!session?.user?.id,
  });

  // 4. Infinite scroll intersection observer trigger
  const observerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!observerRef.current) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }, { threshold: 0.8 });

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [observerRef.current, hasNextPage, isFetchingNextPage]);

  const voteMutation = useMutation({
    mutationFn: async ({ postId, voteType }: { postId: string; voteType: 'up' | 'down' }) => {
      if (!session) throw new Error('Must be logged in to vote');
      const res = await fetch('/api/posts/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ post_id: postId, vote_type: voteType }),
      });
      if (!res.ok) throw new Error('Failed to vote');
      return res.json();
    },
    onMutate: async ({ postId, voteType }) => {
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      await queryClient.cancelQueries({ queryKey: ['userVotes', session?.user?.id] });

      // Snapshot EVERY posts cache variant (all filters/tabs), not just current filterType
      const previousPostsSnapshots = queryClient.getQueriesData({ queryKey: ['posts'] });
      const previousUserVotes = queryClient.getQueryData(['userVotes', session?.user?.id]);

      const currentVote = (previousUserVotes as any)?.[postId];

      queryClient.setQueryData(['userVotes', session?.user?.id], (old: any) => {
        const newMap = { ...(old || {}) };
        if (currentVote === voteType) delete newMap[postId];
        else newMap[postId] = voteType;
        return newMap;
      });

      // Update the post wherever it appears, across ALL posts queries
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

              return {
                ...post,
                upvotes: Math.max(0, post.upvotes + upDelta),
                downvotes: Math.max(0, post.downvotes + downDelta),
              };
            }),
          })),
        };
      });

      return { previousPostsSnapshots, previousUserVotes };
    },
    onError: (err, variables, context) => {
      if (context) {
        // Restore every snapshot exactly as it was
        context.previousPostsSnapshots.forEach(([key, data]: [readonly unknown[], unknown]) => {
          queryClient.setQueryData(key, data);
        });
        queryClient.setQueryData(['userVotes', session?.user?.id], context.previousUserVotes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['userVotes', session?.user?.id] });
    },
  });

  // 6. Delete Post Mutation
  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!session) throw new Error('Must be logged in');
      const res = await fetch(`/api/posts/delete?id=${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      });
      if (!res.ok) throw new Error('Failed to delete post');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', filterType] });
    }
  });

  const handleVote = (postId: string, voteType: 'up' | 'down') => {
    if (!session) {
      setIsAuthOpen(true);
      return;
    }
    if (votingPostIds[postId]) return;

    setVotingPostIds(prev => ({ ...prev, [postId]: true }));
    voteMutation.mutate({ postId, voteType }, {
      onSettled: () => {
        setVotingPostIds(prev => ({ ...prev, [postId]: false }));
      }
    });
  };

  const openCommentsModal = (postId: string) => {
    trackPostEvent(postId, 'POST_OPEN');
    setCommentsModalPostId(postId);
  };

  const trackPostEvent = async (postId: string, eventType: string, metadata: Record<string, unknown> = {}) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers,
        body: JSON.stringify({ post_id: postId, event_type: eventType, metadata }),
      });
    } catch (err) {
      console.warn('[feed] Failed to track event', err);
    }
  };

  // Render list of posts
  const posts = data?.pages.flatMap((page) => page.posts) || [];

  useEffect(() => {
    if (!session && posts.length > 0 && shuffledPosts.length === 0) {
      const shuffled = [...posts].sort(() => 0.5 - Math.random());
      setShuffledPosts(shuffled.slice(0, Math.min(shuffled.length, 4)));
    }
  }, [posts, session, shuffledPosts.length]);

  useEffect(() => {
    if (session) {
      setShuffledPosts([]);
    }
  }, [session]);

  const displayedPosts = session ? posts : shuffledPosts;

  const commentsModalPost = commentsModalPostId
    ? displayedPosts.find((p) => p.id === commentsModalPostId) || null
    : null;

  useEffect(() => {
    if (!isLoading && displayedPosts.length > 0) {
      animateListEntrance(feedListRef, '.post-card-animate');
    }
  }, [isLoading, filterType, displayedPosts.length]);

  useEffect(() => {
    if (!feedListRef.current || displayedPosts.length === 0) return;
    const cards = Array.from(feedListRef.current.querySelectorAll<HTMLElement>('[data-post-id]'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const postId = (entry.target as HTMLElement).dataset.postId;
        if (!postId) return;

        if (entry.isIntersecting) {
          dwellStartRef.current[postId] = Date.now();
          if (!viewedPostIdsRef.current.has(postId)) {
            viewedPostIdsRef.current.add(postId);
            trackPostEvent(postId, 'POST_VIEW');
          }
        } else if (dwellStartRef.current[postId]) {
          const dwellSeconds = Math.round((Date.now() - dwellStartRef.current[postId]) / 1000);
          delete dwellStartRef.current[postId];
          if (dwellSeconds >= 3) {
            trackPostEvent(postId, 'DWELL', { dwellSeconds });
          }
        }
      });
    }, { threshold: 0.55 });

    cards.forEach((card) => observer.observe(card));
    return () => {
      cards.forEach((card) => {
        const postId = card.dataset.postId;
        if (postId && dwellStartRef.current[postId]) {
          const dwellSeconds = Math.round((Date.now() - dwellStartRef.current[postId]) / 1000);
          delete dwellStartRef.current[postId];
          if (dwellSeconds >= 3) trackPostEvent(postId, 'DWELL', { dwellSeconds });
        }
      });
      observer.disconnect();
    };
  }, [displayedPosts.map((post) => post.id).join(','), session?.access_token]);

  return (
    <main className="center-feed">
      <h1 className="feed-title">Paoblems</h1>

      {singlePostId && (
        <button
          className="btn"
          onClick={() => router.push('/')}
          style={{
            marginBottom: '1.25rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'var(--bg-hover)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            padding: '0.55rem 1rem',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: 600
          }}
        >
          ← Back to Feed
        </button>
      )}

      {/* ── Post Composer Trigger ── */}
      {!singlePostId && (
        <div
          className="card composer-card"
          onClick={() => router.push('/create-post')}
          style={{ cursor: 'pointer' }}
        >
          <div className="composer-top">
            <Avatar
              src={session?.user?.user_metadata?.avatar_url}
              name="You"
              className="composer-avatar"
              size={36}
            />
            <div className="composer-input-wrap">
              <div className="composer-input" style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                What's your Problem or Idea?
              </div>
            </div>
          </div>

          <div className="composer-divider" />

          <div className="composer-actions">
            <div className="composer-action-group">
              <div className="composer-action-btn">
                <ImageIcon size={16} />
                <span>Photo</span>
              </div>
              <div className="composer-action-btn">
                <Link2 size={16} />
                <span>Link</span>
              </div>
              <div className="composer-action-btn">
                <Wand2 size={16} />
                <span>AI Enhance</span>
              </div>
            </div>
            <button className="composer-send-btn" type="button">
              <span>Post</span>
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      {!singlePostId && (
        <div className="flex gap-2" style={{ margin: '0.5rem 0', padding: '0.25rem 0', overflowX: 'auto', whiteSpace: 'nowrap', maxWidth: '100%', scrollbarWidth: 'none' }}>
          {[
            { id: 'all', label: 'All Feed' },
            { id: 'problem', label: 'Problems' },
            { id: 'idea', label: 'Ideas' }
          ].map((tab) => (
            <button
              key={tab.id}
              className={`btn ${filterType === tab.id ? 'btn-primary' : ''}`}
              style={{
                background: filterType === tab.id ? undefined : 'var(--bg-card)',
                color: 'var(--text-main)',
                border: filterType === tab.id ? 'none' : '1px solid var(--border-color)',
                flexShrink: 0
              }}
              onClick={() => router.push(tab.id === 'all' ? '/' : `/?filter=${tab.id}`)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Posts List ── */}
      <div ref={feedListRef} className="feed-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {isLoading && (
          <>
            <PostSkeleton />
            <PostSkeleton />
          </>
        )}

        {isError && (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: '#ef4444' }}>Error fetching posts. Please check your Supabase connection.</p>
          </div>
        )}

        {!isLoading && posts.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <p>No posts published yet. Be the first to publish a problem or idea!</p>
          </div>
        )}

        {displayedPosts.map((post: Post) => {
          const hasUpvoted = userVotes?.[post.id] === 'up';
          const hasDownvoted = userVotes?.[post.id] === 'down';
          const isOwner = session?.user?.id === post.user_id;

          return (
            <ErrorBoundary key={post.id}>
              <div
                className="card post-card-animate"
                data-post-id={post.id}
                onMouseEnter={animateCardHover}
                onMouseLeave={animateCardHoverOut}
              >
                <div className="post-header">
                  <div className="post-user">
                    <Avatar
                      src={post.profiles?.avatar_url}
                      name={post.profiles?.full_name || 'Anonymous'}
                      className="avatar"
                      size={42}
                      onClick={() => router.push(post.profiles?.username ? `/user/${post.profiles.username}` : `/profile?userId=${post.user_id}`)}
                      style={{ cursor: 'pointer', flexShrink: 0 }}
                    />
                    <div className="post-user-info">
                      <h4
                        className="post-author-name-container"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <span
                          className="post-author-name"
                          onClick={() => router.push(post.profiles?.username ? `/user/${post.profiles.username}` : `/profile?userId=${post.user_id}`)}
                        >
                          {post.profiles?.full_name || 'Anonymous'}
                        </span>
                        <span className="post-author-role">
                          {post.profiles?.role || 'Innovator'}
                        </span>
                      </h4>
                      {post.profiles?.username && (
                        <p
                          className="post-author-username"
                          onClick={() => router.push(`/user/${post.profiles!.username!}`)}
                        >
                          @{post.profiles.username}
                        </p>
                      )}
                      <p className="post-author-meta">
                        {new Date(post.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1" style={{ color: 'var(--text-muted)', position: 'relative', flexShrink: 0, alignSelf: 'flex-start' }}>
                    <button
                      onClick={() => handleToggleSave(post.id)}
                      style={{ background: 'transparent', border: 'none', color: savedIds.includes(post.id) ? 'var(--accent-blue)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '6px', borderRadius: '50%' }}
                      className="theme-toggle-btn"
                      title={savedIds.includes(post.id) ? "Unsave Problem" : "Save Problem"}
                    >
                      <Bookmark size={18} fill={savedIds.includes(post.id) ? "currentColor" : "none"} />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const isClosing = activeShareMenuPostId === post.id;
                        setActiveShareMenuPostId(isClosing ? null : post.id);
                        setShowSubSharePostId(null);
                      }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '6px', borderRadius: '50%' }}
                      className="theme-toggle-btn"
                      title="More Options"
                    >
                      <MoreVertical size={18} />
                    </button>

                    {activeShareMenuPostId === post.id && (
                      <div
                        className="share-dropdown-menu"
                        onClick={(e) => e.stopPropagation()}
                        style={{ position: 'absolute', top: '34px', right: 0 }}
                      >
                        {showSubSharePostId !== post.id ? (
                          <>
                            <button
                              className="share-menu-item"
                              onClick={() => setShowSubSharePostId(post.id)}
                            >
                              <Share2 size={13} /> Share Post…
                            </button>

                            {(isOwner) && (
                              <>
                                <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                                <button
                                  className="share-menu-item"
                                  onClick={() => {
                                    setActiveShareMenuPostId(null);
                                    setEditingPost(post);
                                  }}
                                  style={{ color: 'var(--accent-blue)' }}
                                >
                                  <Pencil size={13} /> Edit Post
                                </button>
                                <button
                                  className="share-menu-item"
                                  onClick={() => {
                                    setActiveShareMenuPostId(null);
                                    setDeletingPostId(post.id);
                                  }}
                                  style={{ color: '#ef4444' }}
                                >
                                  <Trash2 size={13} /> Delete Post
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <button
                              className="share-menu-item"
                              onClick={() => setShowSubSharePostId(null)}
                              style={{ fontWeight: 600, color: 'var(--text-muted)' }}
                            >
                              ← Back
                            </button>
                            <div style={{ height: '1px', background: 'var(--border-color)', margin: '2px 0' }} />
                            <button
                              className="share-menu-item"
                              onClick={() => {
                                setActiveShareMenuPostId(null);
                                setShowSubSharePostId(null);
                                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(post.title + '\n' + window.location.origin + '/post/' + (post.slug || post.id))}`, '_blank');
                                trackPostEvent(post.id, 'POST_SHARE', { destination: 'whatsapp' });
                              }}
                            >
                              💬 WhatsApp
                            </button>
                            <button
                              className="share-menu-item"
                              onClick={() => {
                                setActiveShareMenuPostId(null);
                                setShowSubSharePostId(null);
                                window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin + '/post/' + (post.slug || post.id))}`, '_blank');
                                trackPostEvent(post.id, 'POST_SHARE', { destination: 'linkedin' });
                              }}
                            >
                              💼 LinkedIn
                            </button>
                            <button
                              className="share-menu-item"
                              onClick={() => {
                                setActiveShareMenuPostId(null);
                                setShowSubSharePostId(null);
                                window.open(`https://reddit.com/submit?url=${encodeURIComponent(window.location.origin + '/post/' + (post.slug || post.id))}&title=${encodeURIComponent(post.title)}`, '_blank');
                                trackPostEvent(post.id, 'POST_SHARE', { destination: 'reddit' });
                              }}
                            >
                              👽 Reddit
                            </button>
                            <button
                              className="share-menu-item"
                              onClick={() => {
                                setActiveShareMenuPostId(null);
                                setShowSubSharePostId(null);
                                const shareUrl = `${window.location.origin}/post/${post.slug || post.id}`;
                                navigator.clipboard.writeText(shareUrl);
                                trackPostEvent(post.id, 'POST_SHARE', { destination: 'copy_link' });
                                showToast('Link copied!');
                              }}
                            >
                              <Copy size={13} /> Copy Link
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="post-content">
                  {post.external_link && (
                    <a
                      href={post.external_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                      style={{
                        color: 'var(--accent-blue)',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        marginBottom: '0.5rem',
                        textDecoration: 'none',
                        display: 'inline-flex'
                      }}
                    >
                      <ExternalLink size={12} />
                      <span>{post.link_name || post.external_link}</span>
                    </a>
                  )}
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.015em', lineHeight: '1.3', marginBottom: '0.6rem', color: 'var(--text-main)', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                    {decodeHTMLEntities(post.title)}
                  </h3>
                  <ExpandableBody body={post.body} />
                </div>

                {/* Multiple Image Gallery Grid / Lightbox display */}
                <ImageGallery imageUrlsString={post.image_url} />

                <div className="post-footer">
                  <div className="flex items-center gap-2 post-footer-actions">
                    {/* Upvote Capsule */}
                    <div className="vote-container" style={{ borderColor: hasUpvoted ? '#22c55e' : undefined, background: hasUpvoted ? 'rgba(34, 197, 94, 0.08)' : undefined }}>
                      <button
                        className="vote-btn"
                        onClick={(e) => {
                          animateUpvote(e.currentTarget);
                          handleVote(post.id, 'up');
                        }}
                        style={{ color: hasUpvoted ? '#22c55e' : undefined }}
                        aria-label="Upvote"
                      >
                        <TriangleIcon size={16} fill={hasUpvoted ? 'currentColor' : 'none'} />
                      </button>
                      <span className={`vote-label up ${hasUpvoted ? 'active' : ''}`} style={{ color: hasUpvoted ? '#22c55e' : undefined }}>
                        +{post.upvotes}
                      </span>
                    </div>

                    {/* Downvote Capsule */}
                    <div className="vote-container" style={{ borderColor: hasDownvoted ? '#ef4444' : undefined, background: hasDownvoted ? 'rgba(239, 68, 68, 0.08)' : undefined }}>
                      <button
                        className="vote-btn"
                        onClick={() => {
                          handleVote(post.id, 'down');
                        }}
                        style={{ color: hasDownvoted ? '#ef4444' : undefined }}
                        aria-label="Downvote"
                      >
                        <TriangleIcon size={16} style={{ transform: 'rotate(180deg)' }} fill={hasDownvoted ? 'currentColor' : 'none'} />
                      </button>
                      <span className={`vote-label down ${hasDownvoted ? 'active' : ''}`}>
                        -{post.downvotes}
                      </span>
                    </div>

                    {/* Comments — opens modal */}
                    <button
                      type="button"
                      className="post-comment-btn"
                      onClick={() => openCommentsModal(post.id)}
                      aria-label="View comments"
                    >
                      <MessageCircle size={19} />
                      <span className="post-comment-count">{post.comments_count}</span>
                    </button>

                    {/* Post Type Badge */}
                    <span className={`sticker-tag ${post.type}`} style={{ marginLeft: '1.25rem' }}>
                      {post.type === 'problem' ? 'Problem' : 'Idea'}
                    </span>
                    {post.type === 'problem' && (
                      <button
                        type="button"
                        className="see-solutions-btn"
                        onClick={() => router.push(`/post/${post.slug || post.id}#solutions`)}
                      >
                        See solutions
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </ErrorBoundary>
          );
        })}
      </div>

      {!session && displayedPosts.length > 0 && (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '3rem 2rem',
            background: 'linear-gradient(180deg, var(--bg-card) 0%, rgba(99, 102, 241, 0.15) 100%)',
            borderColor: 'rgba(99, 102, 241, 0.3)',
            boxShadow: '0 8px 32px rgba(99, 102, 241, 0.1)',
            position: 'relative',
            overflow: 'hidden',
            marginTop: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            alignItems: 'center',
            borderRadius: '24px'
          }}
        >
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, height: '4px',
            background: 'linear-gradient(90deg, #6366f1, #3b82f6)'
          }} />
          <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Want to see more problems & solutions?
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '400px', lineHeight: '1.5', margin: '0 auto' }}>
            You have read all preview posts. Join or sign in to our developer community to view more startup ideas, vote on problems, or write comments.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setIsAuthOpen(true)}
            style={{ padding: '0.65rem 1.75rem', fontWeight: 600, fontSize: '0.88rem', marginTop: '0.5rem' }}
          >
            Sign In / Sign Up
          </button>
        </div>
      )}

      {/* Infinite Scroll Trigger Indicator */}
      {session && hasNextPage && (
        <div ref={observerRef} style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem 0' }}>
          <Loader2 size={24} className="spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      )}

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      <CommentsModal
        post={commentsModalPost}
        isOpen={!!commentsModalPost}
        onClose={() => setCommentsModalPostId(null)}
        session={session}
        userVote={commentsModalPost ? userVotes?.[commentsModalPost.id] || null : null}
        onVote={handleVote}
        onAuthRequired={() => setIsAuthOpen(true)}
      />

      {editingPost && (
        <EditPostModal
          isOpen={!!editingPost}
          onClose={() => setEditingPost(null)}
          post={editingPost}
          session={session}
        />
      )}

      <DeleteConfirmModal
        isOpen={!!deletingPostId}
        onClose={() => setDeletingPostId(null)}
        onConfirm={() => {
          if (deletingPostId) {
            deletePostMutation.mutate(deletingPostId);
            setDeletingPostId(null);
          }
        }}
        isPending={deletePostMutation.isPending}
      />

      {toastMessage && (
        <div className="share-toast">
          {toastMessage}
        </div>
      )}
    </main>
  );
}

// ── Loading Skeleton Card ──
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

// ── Expandable Body for long text with inline link detection ──
function RenderSegments({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'link') {
          return (
            <a
              key={i}
              href={seg.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                color: 'var(--accent-blue)',
                textDecoration: 'none',
                fontWeight: 500,
                wordBreak: 'break-all',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              {seg.display}
            </a>
          );
        }
        return <React.Fragment key={i}>{seg.content}</React.Fragment>;
      })}
    </>
  );
}

function ExpandableBody({ body }: { body: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const maxLength = 250;

  const decodedBody = decodeHTMLEntities(body);
  const segments = parseLinksInText(decodedBody);

  if (decodedBody.length <= maxLength) {
    return (
      <p className="post-body-text" style={{
        fontSize: '0.925rem',
        color: 'var(--text-body)',
        lineHeight: '1.65',
        fontWeight: 400,
        letterSpacing: '0.01em',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        whiteSpace: 'pre-wrap'
      }}>
        <RenderSegments segments={segments} />
      </p>
    );
  }

  // For truncated view, parse only the visible slice
  const displayText = isExpanded ? decodedBody : decodedBody.slice(0, maxLength) + '...';
  const displaySegments = parseLinksInText(displayText);

  return (
    <div>
      <p className="post-body-text" style={{
        fontSize: '0.925rem',
        color: 'var(--text-body)',
        lineHeight: '1.65',
        fontWeight: 400,
        letterSpacing: '0.01em',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        whiteSpace: 'pre-wrap',
        margin: 0
      }}>
        <RenderSegments segments={displaySegments} />
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent-blue)',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer',
          padding: '4px 0',
          marginTop: '4px',
          display: 'inline-flex',
          alignItems: 'center'
        }}
      >
        {isExpanded ? 'See less' : 'See more'}
      </button>
    </div>
  );
}

export default function Feed({ defaultFilter }: { defaultFilter?: string }) {
  return (
    <Suspense fallback={null}>
      <FeedInner defaultFilter={defaultFilter} />
    </Suspense>
  );
}
