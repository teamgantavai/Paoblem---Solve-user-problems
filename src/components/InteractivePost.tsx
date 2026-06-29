'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Image as ImageIcon,
  Link2,
  TriangleIcon,
  MessageCircle,
  Bookmark,
  MoreVertical,
  Trash2,
  ExternalLink,
  Pencil,
  Share2,
  Copy,
  Loader2,
  BarChart2,
  Send,
  Rocket,
  SendHorizontal,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Post, Comment } from '@/lib/types';
import { trackEvent } from '@/lib/analytics-track';
import AuthModal from './AuthModal';
import EditPostModal from './EditPostModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { decodeHTMLEntities } from '@/lib/htmlDecoder';
import ImageGallery from './ImageGallery';
import ImageUploader from './ImageUploader';
import CommentThread from './CommentThread';
import Avatar from './Avatar';
import { useMicroAnimations } from '@/hooks/useMicroAnimations';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import QualityScoreBadge from './QualityScoreBadge';
import ShareModal from './ShareModal';
import ShareInAppChatsModal from './ShareInAppChatsModal';

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

interface InteractivePostProps {
  initialPost: Post;
  initialComments: Comment[];
}

export default function InteractivePost({ initialPost, initialComments }: InteractivePostProps) {
  const { animateUpvote } = useMicroAnimations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightComment = searchParams ? searchParams.get('highlightComment') : null;
  const queryClient = useQueryClient();

  const [session, setSession] = useState<any>(null);

  const { data: followings = [] } = useQuery<string[]>({
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

  const [post, setPost] = useState<Post>(initialPost);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  // Modals & Popovers state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isEditPostOpen, setIsEditPostOpen] = useState(false);
  const [isDeletePostOpen, setIsDeletePostOpen] = useState(false);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [activeShareMenu, setActiveShareMenu] = useState(false);
  const [showSubShare, setShowSubShare] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isChatShareModalOpen, setIsChatShareModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };
  const postRef = useRef<HTMLElement>(null);
  const viewTrackedRef = useRef(false);
  const hasTrackedLongRead = useRef(false);

  // Edit Comment State - handled by CommentThread

  // Load Session and Votes on Mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession?.user?.id) {
        fetchUserVote(currentSession.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user?.id) {
        fetchUserVote(currentSession.user.id);
      } else {
        setUserVote(null);
      }
    });

    // Load saved bookmarks
    const saved = localStorage.getItem('paoblem_saved_posts');
    if (saved) {
      try {
        setSavedIds(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }

    return () => subscription.unsubscribe();
  }, []);

  // Sync saves from server
  useEffect(() => {
    if (!session?.access_token) return;
    fetch('/api/posts/save', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.savedIds) {
          setSavedIds(data.savedIds);
          localStorage.setItem('paoblem_saved_posts', JSON.stringify(data.savedIds));
        }
      })
      .catch((err) => console.error('[post-detail] Failed to fetch saved posts', err));
  }, [session?.access_token]);

  // Realtime updates for post detail metrics
  useEffect(() => {
    const channel = supabase.channel(`post-detail-realtime:${post.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts', filter: `id=eq.${post.id}` },
        (payload) => {
          setPost(prev => ({
            ...prev,
            saves: payload.new.saves,
            upvotes: payload.new.upvotes,
            downvotes: payload.new.downvotes,
            comments_count: payload.new.comments_count,
            quality_score: payload.new.quality_score,
          }));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [post.id]);

  // Track post open on detail page load
  useEffect(() => {
    trackEvent(post.id, 'POST_OPEN', session?.access_token);
  }, [post.id, session?.access_token]);

  // Track post view when visible in viewport
  useEffect(() => {
    if (!postRef.current || viewTrackedRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !viewTrackedRef.current) {
          viewTrackedRef.current = true;
          trackEvent(post.id, 'POST_VIEW', session?.access_token);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(postRef.current);
    return () => observer.disconnect();
  }, [post.id, session?.access_token]);

  // LONG_READ event tracking after 20 seconds
  useEffect(() => {
    if (!post?.id || hasTrackedLongRead.current) return;
    const timer = setTimeout(() => {
      hasTrackedLongRead.current = true;
      trackEvent(post.id, 'LONG_READ', session?.access_token).catch(() => { });
      fetch('/api/posts/quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id, counter: 'long_reads', delta: 1 }),
      }).catch(() => { });
    }, 20000); // 20s

    return () => clearTimeout(timer);
  }, [post?.id, session?.access_token]);

  // Highlight and scroll to comment
  useEffect(() => {
    if (highlightComment && comments.length > 0) {
      const matchedComment = comments.find(
        c => c.id === highlightComment || c.profiles?.username === highlightComment
      );
      if (matchedComment) {
        const timer = setTimeout(() => {
          const element = document.getElementById(`comment-${matchedComment.id}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.style.transition = 'background-color 0.5s ease';
            element.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
            setTimeout(() => {
              element.style.backgroundColor = 'transparent';
            }, 3000);
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [highlightComment, comments]);

  const fetchUserVote = async (userId: string) => {
    if (post.id === 'dylan-post' || post.id === 'ryan-post') return;
    try {
      const { data, error } = await supabase
        .from('votes')
        .select('vote_type')
        .eq('user_id', userId)
        .eq('post_id', post.id)
        .maybeSingle();
      if (data) {
        setUserVote(data.vote_type as 'up' | 'down');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Close share menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveShareMenu(false);
      setShowSubShare(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleToggleSave = async () => {
    if (!session) {
      setIsAuthOpen(true);
      return;
    }
    try {
      const res = await fetch('/api/posts/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ postId: post.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      let nextSaved: string[];
      if (data.saved) {
        nextSaved = [...savedIds, post.id];
        showToast('Post saved successfully');
      } else {
        nextSaved = savedIds.filter(id => id !== post.id);
        showToast('Post removed from Saved');
      }
      setSavedIds(nextSaved);
      localStorage.setItem('paoblem_saved_posts', JSON.stringify(nextSaved));
    } catch (err: any) {
      showToast(err.message || 'Failed to save post');
    }
  };

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!session) {
      setIsAuthOpen(true);
      return;
    }
    // Prevent spam/double clicks
    if (isVoting) return;

    // Trivial local update for mock posts
    if (post.id === 'dylan-post' || post.id === 'ryan-post') {
      setUserVote(prev => prev === voteType ? null : voteType);
      setPost(prev => {
        let upDelta = 0;
        let downDelta = 0;
        if (userVote === voteType) {
          if (voteType === 'up') upDelta = -1;
          else downDelta = -1;
        } else if (userVote) {
          if (voteType === 'up') { upDelta = 1; downDelta = -1; }
          else { upDelta = -1; downDelta = 1; }
        } else {
          if (voteType === 'up') upDelta = 1;
          else downDelta = 1;
        }
        return {
          ...prev,
          upvotes: Math.max(0, prev.upvotes + upDelta),
          downvotes: Math.max(0, prev.downvotes + downDelta)
        };
      });
      return;
    }

    setIsVoting(true);

    // Compute deltas before mutating state
    const previousVote = userVote;
    const isToggleOff = userVote === voteType;
    const newVote = isToggleOff ? null : voteType;

    let upDelta = 0;
    let downDelta = 0;
    if (previousVote === voteType) {
      if (voteType === 'up') upDelta = -1;
      else downDelta = -1;
    } else if (previousVote) {
      if (voteType === 'up') { upDelta = 1; downDelta = -1; }
      else { upDelta = -1; downDelta = 1; }
    } else {
      if (voteType === 'up') upDelta = 1;
      else downDelta = 1;
    }

    // Perform optimistic update on detail page
    setUserVote(newVote);
    setPost(prev => ({
      ...prev,
      upvotes: Math.max(0, prev.upvotes + upDelta),
      downvotes: Math.max(0, prev.downvotes + downDelta)
    }));

    // Sync the feed's React Query cache so navigating back shows updated count
    queryClient.setQueriesData({ queryKey: ['posts'] }, (oldData: any) => {
      if (!oldData?.pages) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page: any) => ({
          ...page,
          posts: page.posts.map((p: any) =>
            p.id === post.id
              ? { ...p, upvotes: Math.max(0, p.upvotes + upDelta), downvotes: Math.max(0, p.downvotes + downDelta) }
              : p
          )
        }))
      };
    });

    try {
      const res = await fetch('/api/posts/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ post_id: post.id, vote_type: voteType }),
      });
      if (!res.ok) throw new Error('Vote failed');
      const data = await res.json();
      if (data.quality_score !== undefined) {
        setPost(prev => ({
          ...prev,
          quality_score: data.quality_score,
          unique_viewers: data.unique_viewers,
        }));
        queryClient.setQueriesData({ queryKey: ['posts'] }, (oldData: any) => {
          if (!oldData?.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              posts: page.posts.map((p: any) =>
                p.id === post.id
                  ? { ...p, quality_score: data.quality_score, unique_viewers: data.unique_viewers }
                  : p
              )
            }))
          };
        });
      }
      trackEvent(post.id, voteType === 'up' ? 'POST_UPVOTE' : 'POST_DOWNVOTE', session.access_token);
    } catch (err) {
      console.error(err);
      // Revert optimistic update on detail page
      setUserVote(previousVote);
      setPost(prev => ({
        ...prev,
        upvotes: Math.max(0, prev.upvotes - upDelta),
        downvotes: Math.max(0, prev.downvotes - downDelta)
      }));
      // Revert feed cache
      queryClient.setQueriesData({ queryKey: ['posts'] }, (oldData: any) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            posts: page.posts.map((p: any) =>
              p.id === post.id
                ? { ...p, upvotes: Math.max(0, p.upvotes - upDelta), downvotes: Math.max(0, p.downvotes - downDelta) }
                : p
            )
          }))
        };
      });
    } finally {
      setIsVoting(false);
    }
  };

  const handleAddComment = async (body: string, parentId?: string | null) => {
    if (!session) {
      setIsAuthOpen(true);
      return;
    }

    const res = await fetch('/api/posts/comment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        post_id: post.id,
        body,
        parent_id: parentId || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit comment');

    const newComment: Comment = {
      ...data.comment,
      profiles: {
        full_name: session.user.user_metadata?.full_name || 'Member',
        avatar_url:
          session.user.user_metadata?.avatar_url ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${session.user.id}`,
        role: session.user.user_metadata?.role || 'Innovator',
        username: session.user.user_metadata?.username || null,
      },
    };

    setComments((prev) => [...prev, newComment]);
    setPost((prev) => ({ ...prev, comments_count: prev.comments_count + 1 }));
    if (!parentId) {
      trackEvent(post.id, 'POST_COMMENT', session.access_token);
    }
  };

  const handleEditComment = async (commentId: string, body: string) => {
    if (!body.trim()) return;
    if (!session) throw new Error('Must be logged in');

    const res = await fetch('/api/posts/comment', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ id: commentId, body: body.trim() }),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to update comment');
    }

    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, body: body.trim(), updated_at: new Date().toISOString() } : c
      )
    );
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      if (!session) throw new Error('Must be logged in');
      const res = await fetch(`/api/posts/comment?id=${commentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete comment');
      }

      setComments(prev => prev.filter(c => c.id !== commentId));
      setPost(prev => ({ ...prev, comments_count: Math.max(0, prev.comments_count - 1) }));
    } catch (err: any) {
      alert(err.message || 'Failed to delete comment');
    }
  };

  const handleDeletePost = async () => {
    if (!session) return;
    setIsDeletingPost(true);

    try {
      const res = await fetch(`/api/posts/delete?id=${post.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      });
      if (!res.ok) throw new Error('Delete failed');
      sessionStorage.setItem('paoblem_toast', 'Post deleted successfully');
      router.push('/');
    } catch (err: any) {
      alert(err.message || 'Failed to delete post');
    } finally {
      setIsDeletingPost(false);
      setIsDeletePostOpen(false);
    }
  };

  const isOwner = session?.user?.id === post.user_id;
  const authorProfile = post.profiles;
  const authorName = authorProfile?.full_name || (authorProfile?.username ? `@${authorProfile.username}` : (session?.user && post.user_id === session.user.id ? (session.user.user_metadata?.full_name || session.user.user_metadata?.username || session.user.email?.split('@')[0]) : 'Anonymous'));
  const authorAvatar = authorProfile?.avatar_url || (session?.user && post.user_id === session.user.id ? session.user.user_metadata?.avatar_url : undefined) || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.user_id}`;
  const authorRole = authorProfile?.role || 'Innovator';
  const authorUsername = authorProfile?.username || (session?.user && post.user_id === session.user.id ? (session.user.user_metadata?.username || session.user.user_metadata?.full_name?.toLowerCase().replace(/\s+/g, '_') || session.user.email?.split('@')[0]) : undefined);

  return (
    <article ref={postRef} className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      {/* Dynamic Header */}
      <div className="post-header" style={{ marginBottom: '1rem' }}>
        <div className="post-user">
          <Avatar
            src={authorProfile?.avatar_url}
            name={authorName}
            className="avatar"
            size={48}
            onClick={() => {
              router.push(authorUsername ? `/user/${authorUsername}` : `/profile?userId=${post.user_id}`);
              trackEvent(post.id, 'PROFILE_CLICK', session?.access_token).catch(() => { });
              fetch('/api/posts/quality', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ post_id: post.id, counter: 'profile_clicks', delta: 1 }),
              }).catch(() => { });
            }}
            style={{ cursor: 'pointer', flexShrink: 0, width: '48px', height: '48px', borderRadius: '50%' }}
          />
          <div className="post-user-info">
            <h4
              className="flex items-center gap-2"
              style={{ fontWeight: 600, cursor: 'pointer', fontSize: '0.92rem' }}
              onClick={() => {
                router.push(authorUsername ? `/user/${authorUsername}` : `/profile?userId=${post.user_id}`);
                trackEvent(post.id, 'PROFILE_CLICK', session?.access_token).catch(() => { });
                fetch('/api/posts/quality', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ post_id: post.id, counter: 'profile_clicks', delta: 1 }),
                }).catch(() => { });
              }}
            >
              {authorName}
              <span className={`post-type-badge ${post.type}`} style={{ textTransform: 'capitalize', marginLeft: '6px' }}>
                {post.type}
              </span>
              <QualityScoreBadge qualityScore={post.quality_score} uniqueViewers={post.unique_viewers} animate />
            </h4>
            {authorUsername && (
              <p className="post-author-username" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer', margin: 0 }} onClick={() => router.push(`/user/${authorUsername}`)}>
                @{authorUsername}
              </p>
            )}
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span>
                {new Date(post.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
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
                      color: followings.includes(post.user_id) ? 'var(--text-muted)' : '#2563eb',
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

        <div className="flex items-center gap-1" style={{ color: 'var(--text-muted)', position: 'relative' }}>

          <button
            onClick={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              setActiveShareMenu(!activeShareMenu);
              setShowSubShare(false);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              padding: '6px',
              borderRadius: '50%'
            }}
            className="post-header-action-btn"
            title="More Options"
          >
            <MoreVertical size={18} />
          </button>

          {activeShareMenu && (
            <div
              className="share-dropdown-menu"
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'absolute', top: '34px', right: 0, zIndex: 100 }}
            >
              {!showSubShare ? (
                <>
                  <button
                    className="share-menu-item"
                    onClick={() => { setActiveShareMenu(false); setIsShareModalOpen(true); }}
                  >
                    <Share2 size={13} /> Share Post…
                  </button>

                  {!isOwner && (
                    <button
                      className="share-menu-item"
                      onClick={async () => {
                        setActiveShareMenu(false);
                        if (!session) {
                          setIsAuthOpen(true);
                          return;
                        }
                        window.dispatchEvent(new CustomEvent('top-loader:start'));
                        try {
                          const res = await fetch('/api/messages', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${session.access_token}`
                            },
                            body: JSON.stringify({
                              recipientId: post.user_id,
                              startOnly: true
                            })
                          });
                          if (!res.ok) throw new Error('Could not start chat');
                          const data = await res.json();
                          
                          const params = new URLSearchParams();
                          params.set('conversationId', data.conversationId);
                          params.set('partnerId', post.user_id);
                          if (authorName) params.set('partnerName', authorName);
                          if (authorAvatar) params.set('partnerAvatar', authorAvatar);
                          if (authorUsername) params.set('partnerUsername', authorUsername);

                          router.push(`/chats?${params.toString()}`);
                        } catch (error) {
                          showToast('Failed to start chat.');
                          window.dispatchEvent(new CustomEvent('top-loader:finish'));
                        }
                      }}
                    >
                      <MessageCircle size={13} /> Chat
                    </button>
                  )}

                  {isOwner && (
                    <>
                      <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                      <button
                        className="share-menu-item"
                        onClick={() => {
                          setActiveShareMenu(false);
                          setIsEditPostOpen(true);
                        }}
                        style={{ color: 'var(--accent-blue)' }}
                      >
                        <Pencil size={13} /> Edit Post
                      </button>
                      <button
                        className="share-menu-item"
                        onClick={() => {
                          setActiveShareMenu(false);
                          setIsDeletePostOpen(true);
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
                    onClick={() => setShowSubShare(false)}
                    style={{ fontWeight: 600, color: 'var(--text-muted)' }}
                  >
                    ← Back
                  </button>
                  <div style={{ height: '1px', background: 'var(--border-color)', margin: '2px 0' }} />
                  <button
                    className="share-menu-item"
                    onClick={() => {
                      setActiveShareMenu(false);
                      const firstImg = post.image_url ? post.image_url.split(',')[0].trim() : '';
                      const shareText = post.title + '\n' + window.location.origin + '/post/' + post.slug + (firstImg ? '\nImage: ' + firstImg : '');
                      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
                      trackEvent(post.id, 'POST_SHARE', session?.access_token, { platform: 'whatsapp' });
                    }}
                  >
                    💬 WhatsApp
                  </button>
                  <button
                    className="share-menu-item"
                    onClick={() => {
                      setActiveShareMenu(false);
                      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin + '/post/' + post.slug)}`, '_blank');
                      trackEvent(post.id, 'POST_SHARE', session?.access_token, { platform: 'linkedin' });
                    }}
                  >
                    💼 LinkedIn
                  </button>
                  <button
                    className="share-menu-item"
                    onClick={() => {
                      setActiveShareMenu(false);
                      const firstImg = post.image_url ? post.image_url.split(',')[0].trim() : '';
                      const redditTitle = post.title + (firstImg ? ' [Image]' : '');
                      window.open(`https://reddit.com/submit?url=${encodeURIComponent(window.location.origin + '/post/' + post.slug)}&title=${encodeURIComponent(redditTitle)}`, '_blank');
                      trackEvent(post.id, 'POST_SHARE', session?.access_token, { platform: 'reddit' });
                    }}
                  >
                    👽 Reddit
                  </button>
                  <button
                    className="share-menu-item"
                    onClick={() => {
                      setActiveShareMenu(false);
                      const shareUrl = `${window.location.origin}/post/${post.slug}`;
                      navigator.clipboard.writeText(shareUrl);
                      showToast('Link copied!');
                      trackEvent(post.id, 'POST_SHARE', session?.access_token, { platform: 'copy' });
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

      {/* Title (H1) and Content */}
      <div className="post-content">
        {post.external_link && (
          <a
            href={post.external_link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackEvent(post.id, 'LINK_CLICK', session?.access_token).catch(() => { });
              fetch('/api/posts/quality', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ post_id: post.id, counter: 'link_clicks', delta: 1 }),
              }).catch(() => { });
            }}
            className="flex items-center gap-1"
            style={{
              color: 'var(--accent-primary)',
              fontSize: '0.8rem',
              fontWeight: 500,
              marginBottom: '0.6rem',
              textDecoration: 'none',
              display: 'inline-flex'
            }}
          >
            <ExternalLink size={12} />
            <span>{post.link_name || post.metadata?.link_name || post.external_link}</span>
          </a>
        )}
        <h1 style={{
          fontSize: '1.6rem',
          fontWeight: 700,
          letterSpacing: '-0.015em',
          lineHeight: '1.3',
          marginBottom: '0.8rem',
          color: 'var(--text-main)',
          wordBreak: 'break-word',
          overflowWrap: 'break-word'
        }}>
          {decodeHTMLEntities(post.title)}
        </h1>

        <div style={{
          fontSize: '0.94rem',
          lineHeight: '1.6',
          color: 'var(--text-main)',
          whiteSpace: 'pre-wrap',
          marginBottom: '1.25rem',
          wordBreak: 'break-word'
        }}>
          {renderParagraphs(decodeHTMLEntities(post.body))}
        </div>

        {/* Category and Tags */}
        {(() => {
          const category = post.category || post.metadata?.category;
          const tags = post.tags || post.metadata?.tags || [];
          if (!category && tags.length === 0) return null;
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.65rem', marginBottom: '1.25rem' }}>
              {category && (
                <span
                  className="post-taxonomy-tag category-hashtag"
                  style={{ color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/?category=${encodeURIComponent(category)}`);
                  }}
                >
                  #{category.toLowerCase().replace(/\s+/g, '')}
                </span>
              )}
              {tags.map((tag: string) => (
                <span key={tag} className="post-taxonomy-tag hashtag" style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  #{tag}
                </span>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Attachments */}
      <ImageGallery imageUrlsString={post.image_url} />

      <div className="post-footer" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
        <div className="flex items-center gap-2" style={{ width: '100%' }}>
          {/* Upvote Capsule */}
          <div className="vote-container" style={{ borderColor: userVote === 'up' ? '#22c55e' : undefined, background: userVote === 'up' ? 'rgba(34, 197, 94, 0.08)' : undefined }}>
            <button
              className="vote-btn"
              onClick={(e) => {
                animateUpvote(e.currentTarget);
                handleVote('up');
              }}
              style={{ color: userVote === 'up' ? '#22c55e' : undefined }}
              aria-label="Upvote"
            >
              <TriangleIcon size={16} fill={userVote === 'up' ? 'currentColor' : 'none'} />
            </button>
            <span className={`vote-label up ${userVote === 'up' ? 'active' : ''}`} style={{ color: userVote === 'up' ? '#22c55e' : undefined }}>
              +{post.upvotes}
            </span>
          </div>

          {/* Downvote Capsule */}
          <div className="vote-container" style={{ borderColor: userVote === 'down' ? '#ef4444' : undefined, background: userVote === 'down' ? 'rgba(239, 68, 68, 0.08)' : undefined }}>
            <button
              className="vote-btn"
              onClick={() => {
                handleVote('down');
              }}
              style={{ color: userVote === 'down' ? '#ef4444' : undefined }}
              aria-label="Downvote"
            >
              <TriangleIcon size={16} style={{ transform: 'rotate(180deg)' }} fill={userVote === 'down' ? 'currentColor' : 'none'} />
            </button>
            <span className={`vote-label down ${userVote === 'down' ? 'active' : ''}`}>
              -{post.downvotes}
            </span>
          </div>

          {/* Comments Count */}
          <div
            style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: '0.5rem', color: 'var(--text-main)' }}
            aria-label="Comments"
          >
            <MessageCircle size={19} />
            <span className="comment-count-badge" style={{ background: 'var(--text-main)', color: 'var(--bg-dark)' }}>
              {post.comments_count}
            </span>
          </div>

          {/* Valuable Count Display */}
          {Number(post.saves || 0) > 0 && (
            <div
              className="post-valuable-badge"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
                padding: '4px 8px',
                borderRadius: '6px',
                background: 'var(--bg-hover)',
                marginLeft: '0.5rem',
              }}
            >
              <span>🔖 {Number(post.saves || 0)} found valuable</span>
            </div>
          )}

          {/* Direct Share Button */}
          <button
            type="button"
            className="post-comment-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (!session) {
                setIsAuthOpen(true);
              } else {
                setIsChatShareModalOpen(true);
              }
            }}
            style={{
              marginLeft: '0.5rem',
              padding: '0.35rem 0.55rem',
            }}
            title="Share in Chat"
          >
            <SendHorizontal size={19} />
          </button>



          {isOwner && (
            <button
              onClick={() => router.push(`/analytics?postId=${post.id}`)}
              className="theme-toggle-btn"
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.65rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-hover)',
                color: 'var(--accent-blue)',
                fontSize: '0.75rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              title="View Analytics"
            >
              <BarChart2 size={14} />
              Analytics
            </button>
          )}
        </div>
      </div>

      <div className="comments-section post-comments-section">
        <h2 className="post-comments-title">Comments ({comments.length})</h2>

        <CommentThread
          comments={comments}
          session={session}
          postId={post.id}
          highlightCommentId={highlightComment}
          onAuthRequired={() => setIsAuthOpen(true)}
          onAddComment={async (body, parentId) => {
            try {
              await handleAddComment(body, parentId);
            } catch (err: any) {
              alert(err.message || 'Failed to post comment');
            }
          }}
          onEditComment={async (commentId, body) => {
            await handleEditComment(commentId, body);
          }}
          onDeleteComment={async (commentId) => {
            if (!window.confirm('Delete comment?')) return;
            await handleDeleteComment(commentId);
          }}
        />
      </div>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      {isEditPostOpen && (
        <EditPostModal
          isOpen={isEditPostOpen}
          onClose={() => setIsEditPostOpen(false)}
          post={post}
          session={session}
          onSuccess={(updatedPost) => {
            setPost(prev => ({
              ...prev,
              ...updatedPost,
              profiles: prev.profiles
            }));
            try {
              const stored = JSON.parse(sessionStorage.getItem('paoblem_newly_created_posts') || '[]');
              if (Array.isArray(stored) && stored.length > 0) {
                const updated = stored.map((p: any) => (p.id === updatedPost.id ? { ...p, ...updatedPost } : p));
                sessionStorage.setItem('paoblem_newly_created_posts', JSON.stringify(updated));
              }
            } catch (e) {
              console.error(e);
            }
          }}
        />
      )}

      <DeleteConfirmModal
        isOpen={isDeletePostOpen}
        onClose={() => setIsDeletePostOpen(false)}
        onConfirm={handleDeletePost}
        isPending={isDeletingPost}
      />

      {isShareModalOpen && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          post={post}
          session={session}
        />
      )}

      {isChatShareModalOpen && (
        <ShareInAppChatsModal
          isOpen={isChatShareModalOpen}
          onClose={() => setIsChatShareModalOpen(false)}
          post={post}
          session={session}
        />
      )}

      {toastMessage && (
        <div className="share-toast">
          {toastMessage}
        </div>
      )}
    </article>
  );
}
