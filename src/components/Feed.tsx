'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Image as ImageIcon, 
  Link2, 
  Wand2, 
  Send, 
  ChevronUp, 
  ChevronDown, 
  MessageCircle, 
  Bookmark, 
  MoreVertical, 
  Smile, 
  Trash2, 
  ExternalLink,
  AlertTriangle,
  Lightbulb,
  Loader2
} from 'lucide-react';
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Post, Comment } from '@/lib/types';
import AuthModal from './AuthModal';

export default function Feed() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<string>('all');
  const [session, setSession] = useState<any>(null);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [shuffledPosts, setShuffledPosts] = useState<Post[]>([]);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

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

  // 2. Infinite Query for Posts
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ['posts', filterType],
    queryFn: async ({ pageParam = null }) => {
      const url = pageParam 
        ? `/api/posts/list?cursor=${encodeURIComponent(pageParam)}&type=${filterType}`
        : `/api/posts/list?type=${filterType}`;
      const res = await fetch(url);
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

  // 5. Vote Mutation (Optimistic Update)
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
      await queryClient.cancelQueries({ queryKey: ['posts', filterType] });
      await queryClient.cancelQueries({ queryKey: ['userVotes', session?.user?.id] });

      const previousPosts = queryClient.getQueryData(['posts', filterType]);
      const previousUserVotes = queryClient.getQueryData(['userVotes', session?.user?.id]);

      // Optimistically set the user vote status
      queryClient.setQueryData(['userVotes', session?.user?.id], (old: any) => {
        const newMap = { ...(old || {}) };
        const currentVote = newMap[postId];
        if (currentVote === voteType) {
          delete newMap[postId]; // Toggled off
        } else {
          newMap[postId] = voteType;
        }
        return newMap;
      });

      // Optimistically update counters in infinite query pages
      queryClient.setQueryData(['posts', filterType], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            posts: page.posts.map((post: any) => {
              if (post.id !== postId) return post;
              
              const currentVote = (previousUserVotes as any)?.[postId];
              let upDelta = 0;
              let downDelta = 0;

              if (currentVote === voteType) {
                // Remove vote
                if (voteType === 'up') upDelta = -1;
                else downDelta = -1;
              } else if (currentVote) {
                // Change vote direction
                if (voteType === 'up') {
                  upDelta = 1;
                  downDelta = -1;
                } else {
                  upDelta = -1;
                  downDelta = 1;
                }
              } else {
                // Fresh vote
                if (voteType === 'up') upDelta = 1;
                else downDelta = 1;
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

      return { previousPosts, previousUserVotes };
    },
    onError: (err, variables, context) => {
      if (context) {
        queryClient.setQueryData(['posts', filterType], context.previousPosts);
        queryClient.setQueryData(['userVotes', session?.user?.id], context.previousUserVotes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', filterType] });
      queryClient.invalidateQueries({ queryKey: ['userVotes', session?.user?.id] });
    }
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
      alert('Please sign in to vote.');
      return;
    }
    voteMutation.mutate({ postId, voteType });
  };

  const handleDeletePost = (postId: string) => {
    if (confirm('Are you sure you want to delete this post?')) {
      deletePostMutation.mutate(postId);
    }
  };

  const toggleComments = (postId: string) => {
    setOpenComments(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
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

  return (
    <main className="center-feed">
      <h1 className="feed-title">Paoblems</h1>

      {/* ── Post Composer Trigger ── */}
      <div 
        className="card composer-card" 
        onClick={() => router.push('/create-post')}
        style={{ cursor: 'pointer' }}
      >
        <div className="composer-top">
          <img
            src={session?.user?.user_metadata?.avatar_url || "https://api.dicebear.com/7.x/bottts/svg?seed=fallback"}
            alt="You"
            className="composer-avatar"
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

      {/* Filter Tabs */}
      <div className="flex gap-2" style={{ margin: '0.5rem 0', padding: '0.25rem 0' }}>
        <button 
          className={`btn ${filterType === 'all' ? 'btn-primary' : ''}`}
          style={{ 
            background: filterType === 'all' ? undefined : 'var(--bg-card)', 
            color: 'var(--text-main)',
            border: filterType === 'all' ? 'none' : '1px solid var(--border-color)'
          }}
          onClick={() => setFilterType('all')}
        >
          All Feed
        </button>
        <button 
          className={`btn ${filterType === 'problem' ? 'btn-primary' : ''}`}
          style={{ 
            background: filterType === 'problem' ? undefined : 'var(--bg-card)', 
            color: 'var(--text-main)',
            border: filterType === 'problem' ? 'none' : '1px solid var(--border-color)'
          }}
          onClick={() => setFilterType('problem')}
        >
          Problems
        </button>
        <button 
          className={`btn ${filterType === 'idea' ? 'btn-primary' : ''}`}
          style={{ 
            background: filterType === 'idea' ? undefined : 'var(--bg-card)', 
            color: 'var(--text-main)',
            border: filterType === 'idea' ? 'none' : '1px solid var(--border-color)'
          }}
          onClick={() => setFilterType('idea')}
        >
          Ideas
        </button>
      </div>

      {/* ── Posts List ── */}
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
          <div className="card" key={post.id}>
            <div className="post-header">
              <div className="post-user">
                <img 
                  src={post.profiles?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.user_id}`} 
                  alt={post.profiles?.full_name || 'Anonymous'} 
                  className="avatar" 
                />
                <div className="post-user-info">
                  <h4 className="flex items-center gap-2" style={{ fontWeight: 600 }}>
                    {post.profiles?.full_name || 'Anonymous'}
                    <span 
                      style={{ 
                        fontSize: '0.65rem', 
                        fontWeight: 500, 
                        background: 'rgba(255,255,255,0.05)', 
                        padding: '1px 6px', 
                        borderRadius: '10px',
                        color: 'var(--text-muted)'
                      }}
                    >
                      {post.profiles?.role || 'Innovator'}
                    </span>
                  </h4>
                  <p>{new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                {isOwner && (
                  <button 
                    onClick={() => handleDeletePost(post.id)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                    title="Delete Post"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <Bookmark size={18} style={{ cursor: 'pointer' }} />
                <MoreVertical size={18} style={{ cursor: 'pointer' }} />
              </div>
            </div>

            <div className="post-content">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-main)', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{post.title}</h3>
              <ExpandableBody body={post.body} />
            </div>

            {post.image_url && (
              <div style={{ position: 'relative', width: '100%', marginBottom: '1rem', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <img 
                  src={post.image_url} 
                  alt="Post content" 
                  style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '400px', objectFit: 'cover' }} 
                />
              </div>
            )}

            {post.external_link && (
              <a 
                href={post.external_link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2" 
                style={{ 
                  background: 'var(--search-bg)', 
                  border: '1px solid var(--border-color)', 
                  padding: '0.65rem 1rem', 
                  borderRadius: '12px', 
                  marginBottom: '1rem',
                  fontSize: '0.8rem',
                  color: 'var(--accent-blue)',
                  fontWeight: 500
                }}
              >
                <ExternalLink size={14} />
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {post.link_name || post.external_link}
                </span>
              </a>
            )}

            <div className="post-footer" style={{ borderBottom: openComments[post.id] ? 'none' : undefined, paddingBottom: openComments[post.id] ? '0' : undefined }}>
              <div className="flex items-center gap-2">
                {/* Upvote Capsule */}
                <div className="vote-container" style={{ borderColor: hasUpvoted ? 'var(--accent-blue)' : undefined, background: hasUpvoted ? 'rgba(0, 132, 255, 0.08)' : undefined }}>
                  <button 
                    className="vote-btn" 
                    onClick={() => handleVote(post.id, 'up')}
                    style={{ color: hasUpvoted ? 'var(--accent-blue)' : undefined }}
                    aria-label="Upvote"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <span className={`vote-label up ${hasUpvoted ? 'active' : ''}`} style={{ color: hasUpvoted ? 'var(--accent-blue)' : undefined }}>
                    +{post.upvotes}
                  </span>
                </div>

                {/* Downvote Capsule */}
                <div className="vote-container" style={{ borderColor: hasDownvoted ? '#ef4444' : undefined, background: hasDownvoted ? 'rgba(239, 68, 68, 0.08)' : undefined }}>
                  <button 
                    className="vote-btn" 
                    onClick={() => handleVote(post.id, 'down')}
                    style={{ color: hasDownvoted ? '#ef4444' : undefined }}
                    aria-label="Downvote"
                  >
                    <ChevronDown size={16} />
                  </button>
                  <span className={`vote-label down ${hasDownvoted ? 'active' : ''}`}>
                    -{post.downvotes}
                  </span>
                </div>

                {/* Comments Toggle */}
                <div 
                  onClick={() => toggleComments(post.id)}
                  style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '0.5rem', color: openComments[post.id] ? 'var(--text-main)' : 'var(--text-muted)' }}
                  aria-label="Toggle comments"
                >
                  <MessageCircle size={19} />
                  <span className="comment-count-badge" style={{ background: openComments[post.id] ? 'var(--text-main)' : undefined, color: openComments[post.id] ? 'var(--bg-dark)' : undefined }}>
                    {post.comments_count}
                  </span>
                </div>

                {/* Post Type Badge */}
                <span className={`sticker-tag ${post.type}`} style={{ marginLeft: '1.25rem' }}>
                  {post.type === 'problem' ? 'Problem' : 'Idea'}
                </span>
              </div>
            </div>

            {/* Collapsible Comments Section */}
            {openComments[post.id] && (
              <CommentsSection postId={post.id} session={session} />
            )}
          </div>
        );
      })}

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
    </main>
  );
}

// ── Comments Subcomponent ──
interface CommentsSectionProps {
  postId: string;
  session: any;
}

function CommentsSection({ postId, session }: CommentsSectionProps) {
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');

  // Fetch comments for this post
  const { data: comments, isLoading, isError } = useQuery<Comment[]>({
    queryKey: ['comments', postId],
    queryFn: async () => {
      // 1. Try join fetch (depends on foreign key constraint)
      const { data, error } = await supabase
        .from('comments')
        .select('*, profiles:user_id(full_name, avatar_url)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.warn('Comments join query failed (likely missing FK constraint). Falling back to split fetch...', error);
        
        // 2. Fallback: Fetch raw comments first
        const { data: rawComments, error: commentsError } = await supabase
          .from('comments')
          .select('*')
          .eq('post_id', postId)
          .order('created_at', { ascending: true });
          
        if (commentsError) throw new Error(commentsError.message);
        if (!rawComments || rawComments.length === 0) return [];
        
        // 3. Fetch profiles for user_ids in comments
        const userIds = Array.from(new Set(rawComments.map(c => c.user_id)));
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role')
          .in('id', userIds);
          
        if (profilesError) {
          console.warn('Fallback profiles fetch failed:', profilesError);
          return rawComments.map(c => ({
            ...c,
            profiles: null
          }));
        }
        
        // 4. Map profiles back to comments
        const profileMap = new Map(profiles.map(p => [p.id, p]));
        return rawComments.map(c => ({
          ...c,
          profiles: profileMap.get(c.user_id) || null
        }));
      }
      
      return data || [];
    }
  });

  // Create Comment Mutation
  const addCommentMutation = useMutation({
    mutationFn: async (body: string) => {
      if (!session) throw new Error('Must be logged in');
      const res = await fetch('/api/posts/comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ post_id: postId, body }),
      });
      if (!res.ok) throw new Error('Failed to post comment');
      return res.json();
    },
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    }
  });

  // Delete Comment Mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    }
  });

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      alert('Please sign in to add comments.');
      return;
    }
    if (!commentText.trim()) return;
    addCommentMutation.mutate(commentText);
  };

  const handleDeleteComment = (commentId: string) => {
    if (confirm('Delete this comment?')) {
      deleteCommentMutation.mutate(commentId);
    }
  };

  return (
    <div className="comments-section">
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
          <Loader2 size={18} className="spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      )}

      {isError && (
        <p style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center', margin: '0.5rem 0' }}>
          Failed to load comments.
        </p>
      )}

      {!isLoading && !isError && (
        <div className="comments-list">
          {comments?.length === 0 ? (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem 0' }}>
              No comments yet. Start the conversation!
            </p>
          ) : (
            comments?.map((comment) => {
              const isCommentOwner = session?.user?.id === comment.user_id;
              const authorName = (comment.profiles?.full_name?.trim() ? comment.profiles.full_name : null) || 
                (isCommentOwner ? session?.user?.user_metadata?.full_name : null) || 
                'Anonymous';
              const authorAvatar = comment.profiles?.avatar_url || 
                (isCommentOwner ? session?.user?.user_metadata?.avatar_url : null) || 
                `https://api.dicebear.com/7.x/bottts/svg?seed=${comment.user_id}`;
              const authorRole = comment.profiles?.role || 
                (isCommentOwner ? session?.user?.user_metadata?.role : null) || 
                'Innovator';

              return (
                <div className="comment-item" key={comment.id}>
                  <img 
                    src={authorAvatar} 
                    alt={authorName} 
                    className="comment-avatar" 
                  />
                  <div className="comment-content">
                    <div className="comment-author-time">
                      <span className="comment-author">
                        {authorName}
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: '0.4rem', fontWeight: 500 }}>
                          {authorRole}
                        </span>
                      </span>
                      <span className="comment-time" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {new Date(comment.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {isCommentOwner && (
                          <button 
                            onClick={() => handleDeleteComment(comment.id)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </span>
                    </div>
                    <div className="comment-text">{comment.body}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Write Comment Form */}
      <form onSubmit={handleCommentSubmit} className="comment-input-wrapper">
        <img 
          src={session?.user?.user_metadata?.avatar_url || "https://api.dicebear.com/7.x/bottts/svg?seed=fallback"} 
          alt="You" 
          style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} 
        />
        <input 
          type="text" 
          placeholder={session ? "Write a comment..." : "Sign in to write a comment"} 
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          disabled={!session || addCommentMutation.isPending}
        />
        <button 
          type="submit" 
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px' }}
          disabled={!session || !commentText.trim() || addCommentMutation.isPending}
        >
          {addCommentMutation.isPending ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
        </button>
      </form>
    </div>
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

// ── Expandable Body for long text ──
function ExpandableBody({ body }: { body: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const maxLength = 250;

  if (body.length <= maxLength) {
    return (
      <p style={{ 
        fontSize: '0.88rem', 
        color: 'var(--text-muted)', 
        lineHeight: '1.5',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        whiteSpace: 'pre-wrap'
      }}>
        {body}
      </p>
    );
  }

  const displayText = isExpanded ? body : body.slice(0, maxLength) + '...';

  return (
    <div>
      <p style={{ 
        fontSize: '0.88rem', 
        color: 'var(--text-muted)', 
        lineHeight: '1.5',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        whiteSpace: 'pre-wrap',
        margin: 0
      }}>
        {displayText}
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