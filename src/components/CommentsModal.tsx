'use client';

import React, { useEffect } from 'react';
import { X, TriangleIcon, MessageCircle, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Post, Comment } from '@/lib/types';
import { decodeHTMLEntities } from '@/lib/htmlDecoder';
import CommentThread from './CommentThread';

interface CommentsModalProps {
  post: Post | null;
  session: any;
  isOpen: boolean;
  onClose: () => void;
  userVote?: 'up' | 'down' | null;
  onVote: (postId: string, voteType: 'up' | 'down') => void;
  onAuthRequired: () => void;
}

export default function CommentsModal({
  post,
  session,
  isOpen,
  onClose,
  userVote = null,
  onVote,
  onAuthRequired,
}: CommentsModalProps) {
  const queryClient = useQueryClient();
  const postId = post?.id;

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  const { data: comments, isLoading, isError } = useQuery<Comment[]>({
    queryKey: ['comments', postId],
    queryFn: async () => {
      if (!postId) return [];
      const { data, error } = await supabase
        .from('comments')
        .select('*, profiles:user_id(full_name, avatar_url, role, username)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) {
        const { data: rawComments, error: commentsError } = await supabase
          .from('comments')
          .select('*')
          .eq('post_id', postId)
          .order('created_at', { ascending: true });

        if (commentsError) throw new Error(commentsError.message);
        if (!rawComments?.length) return [];

        const userIds = Array.from(new Set(rawComments.map((c) => c.user_id)));
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role, username')
          .in('id', userIds);

        const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
        return rawComments.map((c) => ({
          ...c,
          profiles: profileMap.get(c.user_id) || null,
        }));
      }

      return data || [];
    },
    enabled: isOpen && !!postId,
  });

  if (!isOpen || !post) return null;

  const handleAddComment = async (body: string, parentId?: string | null) => {
    if (!session) throw new Error('Must be logged in');
    const res = await fetch('/api/posts/comment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ post_id: post.id, body, parent_id: parentId || null }),
    });
    if (!res.ok) throw new Error('Failed to post comment');
    queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
    queryClient.invalidateQueries({ queryKey: ['posts'] });
  };

  const handleEditComment = async (commentId: string, body: string) => {
    const { error } = await supabase.from('comments').update({ body }).eq('id', commentId);
    if (error) throw new Error(error.message);
    queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
  };

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) throw new Error(error.message);
    queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
    queryClient.invalidateQueries({ queryKey: ['posts'] });
  };

  const hasUpvoted = userVote === 'up';
  const hasDownvoted = userVote === 'down';

  return (
    <div className="comments-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="comments-modal-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="comments-modal-title"
        style={{ display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}
      >
        <div className="comments-modal-header">
          <div className="comments-modal-header-left">
            <MessageCircle size={18} />
            <h3 id="comments-modal-title">Comments</h3>
            <span className="comments-modal-count">{post.comments_count}</span>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="comments-modal-post">
          <p className="comments-modal-post-title">{decodeHTMLEntities(post.title)}</p>
          <div className="comments-modal-vote-row">
            <div
              className="vote-container"
              style={{
                borderColor: hasUpvoted ? 'var(--accent-blue)' : undefined,
                background: hasUpvoted ? 'rgba(0, 132, 255, 0.08)' : undefined,
              }}
            >
              <button
                type="button"
                className="vote-btn"
                onClick={() => onVote(post.id, 'up')}
                style={{ color: hasUpvoted ? 'var(--accent-blue)' : undefined }}
                aria-label="Upvote"
              >
                <TriangleIcon size={16} />
              </button>
              <span
                className={`vote-label up ${hasUpvoted ? 'active' : ''}`}
                style={{ color: hasUpvoted ? 'var(--accent-blue)' : undefined }}
              >
                +{post.upvotes}
              </span>
            </div>
            <div
              className="vote-container"
              style={{
                borderColor: hasDownvoted ? '#ef4444' : undefined,
                background: hasDownvoted ? 'rgba(239, 68, 68, 0.08)' : undefined,
              }}
            >
              <button
                type="button"
                className="vote-btn"
                onClick={() => onVote(post.id, 'down')}
                style={{ color: hasDownvoted ? '#ef4444' : undefined }}
                aria-label="Downvote"
              >
                <TriangleIcon size={16} style={{ transform: 'rotate(180deg)' }} />
              </button>
              <span className={`vote-label down ${hasDownvoted ? 'active' : ''}`}>
                -{post.downvotes}
              </span>
            </div>
            <span className={`sticker-tag ${post.type}`}>
              {post.type === 'problem' ? 'Problem' : 'Idea'}
            </span>
          </div>
        </div>

        <div
          className="comments-modal-body"
          style={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        >
          {isLoading && (
            <div className="comments-modal-loading">
              <Loader2 size={22} className="spin" />
            </div>
          )}

          {isError && (
            <p className="comments-modal-error">Failed to load comments.</p>
          )}

          {!isLoading && !isError && (
            <CommentThread
              comments={comments || []}
              session={session}
              postId={post.id}
              onAuthRequired={onAuthRequired}
              onAddComment={async (body, parentId) => {
                try {
                  await handleAddComment(body, parentId);
                } catch {
                  alert('Failed to post comment');
                }
              }}
              onEditComment={handleEditComment}
              onDeleteComment={async (commentId) => {
                if (!window.confirm('Delete this comment?')) return;
                await handleDeleteComment(commentId);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}