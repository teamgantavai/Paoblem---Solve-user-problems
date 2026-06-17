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
  BarChart2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Post, Comment } from '@/lib/types';
import { trackEvent } from '@/lib/analytics-track';
import AuthModal from './AuthModal';
import EditPostModal from './EditPostModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { decodeHTMLEntities } from '@/lib/htmlDecoder';
import ImageGallery from './ImageGallery';
import CommentThread from './CommentThread';

interface InteractivePostProps {
  initialPost: Post;
  initialComments: Comment[];
}

export default function InteractivePost({ initialPost, initialComments }: InteractivePostProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightComment = searchParams ? searchParams.get('highlightComment') : null;

  const [post, setPost] = useState<Post>(initialPost);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [session, setSession] = useState<any>(null);
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  
  // Modals & Popovers state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isEditPostOpen, setIsEditPostOpen] = useState(false);
  const [isDeletePostOpen, setIsDeletePostOpen] = useState(false);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [activeShareMenu, setActiveShareMenu] = useState(false);
  const [showSubShare, setShowSubShare] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const postRef = useRef<HTMLElement>(null);
  const viewTrackedRef = useRef(false);

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

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
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

  const handleToggleSave = () => {
    let nextSaved: string[];
    if (savedIds.includes(post.id)) {
      nextSaved = savedIds.filter(id => id !== post.id);
      showToast('Post removed from Saved');
    } else {
      nextSaved = [...savedIds, post.id];
      showToast('Post saved successfully');
    }
    setSavedIds(nextSaved);
    localStorage.setItem('paoblem_saved_posts', JSON.stringify(nextSaved));
    if (!savedIds.includes(post.id)) {
      trackEvent(post.id, 'POST_SAVE', session?.access_token);
    }
  };

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!session) {
      setIsAuthOpen(true);
      return;
    }

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

    // Perform optimistic update
    const previousVote = userVote;
    const isToggleOff = userVote === voteType;
    setUserVote(isToggleOff ? null : voteType);

    setPost(prev => {
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
      return {
        ...prev,
        upvotes: Math.max(0, prev.upvotes + upDelta),
        downvotes: Math.max(0, prev.downvotes + downDelta)
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
      trackEvent(post.id, voteType === 'up' ? 'POST_UPVOTE' : 'POST_DOWNVOTE', session.access_token);
    } catch (err) {
      console.error(err);
      // Revert optimistic update
      setUserVote(previousVote);
      setPost(prev => {
        let upDelta = 0;
        let downDelta = 0;
        if (previousVote === voteType) {
          if (voteType === 'up') upDelta = 1;
          else downDelta = 1;
        } else if (previousVote) {
          if (voteType === 'up') { upDelta = -1; downDelta = 1; }
          else { upDelta = 1; downDelta = -1; }
        } else {
          if (voteType === 'up') upDelta = -1;
          else downDelta = -1;
        }
        return {
          ...prev,
          upvotes: Math.max(0, prev.upvotes + upDelta),
          downvotes: Math.max(0, prev.downvotes + downDelta)
        };
      });
    }
  };

  const handleAddComment = async (body: string, parentId?: string | null) => {
    if (!session) {
      setIsAuthOpen(true);
      return;
    }

    if (post.id === 'dylan-post' || post.id === 'ryan-post') {
      const mockComment: Comment = {
        id: `mock-comment-${Date.now()}`,
        post_id: post.id,
        parent_id: parentId || null,
        user_id: session.user.id,
        body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        profiles: {
          full_name: session.user.user_metadata?.full_name || 'Member',
          avatar_url: session.user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${session.user.id}`,
          role: session.user.user_metadata?.role || 'Innovator',
          username: session.user.user_metadata?.username || null,
        } as any,
      };
      setComments((prev) => [...prev, mockComment]);
      setPost((prev) => ({ ...prev, comments_count: prev.comments_count + 1 }));
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

    const { error } = await supabase
      .from('comments')
      .update({ body: body.trim(), updated_at: new Date().toISOString() })
      .eq('id', commentId)
      .eq('user_id', session.user.id);

    if (error) throw error;

    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, body: body.trim(), updated_at: new Date().toISOString() } : c
      )
    );
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', session.user.id);

      if (error) throw error;

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
  const authorName = authorProfile?.full_name || 'Anonymous';
  const authorAvatar = authorProfile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.user_id}`;
  const authorRole = authorProfile?.role || 'Innovator';
  const authorUsername = authorProfile?.username;

  return (
    <article ref={postRef} className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      {/* Dynamic Header */}
      <div className="post-header" style={{ marginBottom: '1rem' }}>
        <div className="post-user">
          <img
            src={authorAvatar}
            alt={authorName}
            className="avatar"
            onError={(e) => { e.currentTarget.src = "https://api.dicebear.com/7.x/bottts/svg?seed=guest"; }}
            onClick={() => router.push(authorUsername ? `/user/${authorUsername}` : `/profile?userId=${post.user_id}`)}
            style={{ cursor: 'pointer', flexShrink: 0, width: '42px', height: '42px', borderRadius: '50%' }}
          />
          <div className="post-user-info">
            <h4
              className="flex items-center gap-2"
              style={{ fontWeight: 600, cursor: 'pointer', fontSize: '0.92rem' }}
              onClick={() => router.push(authorUsername ? `/user/${authorUsername}` : `/profile?userId=${post.user_id}`)}
            >
              {authorName}
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 500,
                  background: 'var(--bg-hover)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  color: 'var(--text-muted)'
                }}
              >
                {authorRole}
              </span>
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {new Date(post.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>

        {/* Options and Share dropdown */}
        <div className="flex items-center gap-1" style={{ color: 'var(--text-muted)', position: 'relative' }}>
          <button
            onClick={handleToggleSave}
            style={{
              background: 'transparent',
              border: 'none',
              color: savedIds.includes(post.id) ? 'var(--accent-blue)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              padding: '6px',
              borderRadius: '50%'
            }}
            className="theme-toggle-btn"
            title={savedIds.includes(post.id) ? "Unsave Post" : "Save Post"}
          >
            <Bookmark size={18} fill={savedIds.includes(post.id) ? "currentColor" : "none"} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
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
            className="theme-toggle-btn"
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
                    onClick={() => setShowSubShare(true)}
                  >
                    <Share2 size={13} /> Share Post…
                  </button>

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
                      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(post.title + '\n' + window.location.origin + '/post/' + post.slug)}`, '_blank');
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
                      window.open(`https://reddit.com/submit?url=${encodeURIComponent(window.location.origin + '/post/' + post.slug)}&title=${encodeURIComponent(post.title)}`, '_blank');
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
            className="flex items-center gap-1"
            style={{
              color: 'var(--accent-blue)',
              fontSize: '0.8rem',
              fontWeight: 500,
              marginBottom: '0.6rem',
              textDecoration: 'none',
              display: 'inline-flex'
            }}
          >
            <ExternalLink size={12} />
            <span>{post.link_name || post.external_link}</span>
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
        
        <p style={{
          fontSize: '0.94rem',
          lineHeight: '1.6',
          color: 'var(--text-main)',
          whiteSpace: 'pre-wrap',
          marginBottom: '1.25rem',
          wordBreak: 'break-word'
        }}>
          {post.body}
        </p>
      </div>

      {/* Attachments */}
      <ImageGallery imageUrlsString={post.image_url} />

      {/* Post Footer Actions */}
      <div className="post-footer" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
        <div className="flex items-center gap-2">
          {/* Upvote Capsule */}
          <div className="vote-container" style={{ borderColor: userVote === 'up' ? 'var(--accent-blue)' : undefined, background: userVote === 'up' ? 'rgba(0, 132, 255, 0.08)' : undefined }}>
            <button
              className="vote-btn"
              onClick={() => handleVote('up')}
              style={{ color: userVote === 'up' ? 'var(--accent-blue)' : undefined }}
              aria-label="Upvote"
            >
              <TriangleIcon size={16} />
            </button>
            <span className={`vote-label up ${userVote === 'up' ? 'active' : ''}`} style={{ color: userVote === 'up' ? 'var(--accent-blue)' : undefined }}>
              +{post.upvotes}
            </span>
          </div>

          {/* Downvote Capsule */}
          <div className="vote-container" style={{ borderColor: userVote === 'down' ? '#ef4444' : undefined, background: userVote === 'down' ? 'rgba(239, 68, 68, 0.08)' : undefined }}>
            <button
              className="vote-btn"
              onClick={() => handleVote('down')}
              style={{ color: userVote === 'down' ? '#ef4444' : undefined }}
              aria-label="Downvote"
            >
              <TriangleIcon size={16} style={{ transform: 'rotate(180deg)' }} />
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

          {/* Post Type Sticker */}
          <span className={`sticker-tag ${post.type}`} style={{ marginLeft: '1.25rem' }}>
            {post.type === 'problem' ? 'Problem' : 'Idea'}
          </span>

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

      {/* ── Interactive Comments Section ── */}
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

      {/* Modals & Toast */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      
      {isEditPostOpen && (
        <EditPostModal
          isOpen={isEditPostOpen}
          onClose={() => setIsEditPostOpen(false)}
          post={post}
          session={session}
        />
      )}

      <DeleteConfirmModal
        isOpen={isDeletePostOpen}
        onClose={() => setIsDeletePostOpen(false)}
        onConfirm={handleDeletePost}
        isPending={isDeletingPost}
      />

      {toastMessage && (
        <div className="share-toast">
          {toastMessage}
        </div>
      )}
    </article>
  );
}
