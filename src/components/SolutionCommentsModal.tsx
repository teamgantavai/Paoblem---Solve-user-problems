'use client';

import React, { useEffect, useState } from 'react';
import { X, MessageCircle, Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { decodeHTMLEntities } from '@/lib/htmlDecoder';
import Avatar from './Avatar';

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

interface SolutionCommentsModalProps {
  solutionId: string | null;
  solutionTitle: string;
  session: any;
  isOpen: boolean;
  onClose: () => void;
  onAuthRequired: () => void;
  onCommentCountChange?: (solutionId: string, newCount: number) => void;
}

function timeAgo(dateStr: string): string {
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
}

export default function SolutionCommentsModal({
  solutionId,
  solutionTitle,
  session,
  isOpen,
  onClose,
  onAuthRequired,
  onCommentCountChange,
}: SolutionCommentsModalProps) {
  const [comments, setComments] = useState<SolutionComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(null);
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

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

  const loadComments = async () => {
    if (!solutionId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('solution_comments')
        .select('*, profiles:user_id(full_name, avatar_url, username, role)')
        .eq('solution_id', solutionId)
        .order('created_at', { ascending: true });
      if (!error) {
        setComments(data || []);
        if (onCommentCountChange && solutionId) {
          onCommentCountChange(solutionId, data ? data.length : 0);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && solutionId) {
      loadComments();
    }
  }, [isOpen, solutionId]);

  if (!isOpen || !solutionId) return null;

  const submitComment = async () => {
    if (!session) {
      onAuthRequired();
      return;
    }
    if (!commentBody.trim()) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('solution_comments')
        .insert({ user_id: session.user.id, solution_id: solutionId, body: commentBody.trim() })
        .select('*, profiles:user_id(full_name, avatar_url, username, role)')
        .single();
      if (error) throw error;
      const newComments = [...comments, data];
      setComments(newComments);
      setCommentBody('');
      setComposerFocused(false);
      if (onCommentCountChange && solutionId) {
        onCommentCountChange(solutionId, newComments.length);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
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
      const newComments = comments.filter((c) => c.id !== commentId);
      setComments(newComments);
      if (onCommentCountChange && solutionId) {
        onCommentCountChange(solutionId, newComments.length);
      }
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
            <h3 id="comments-modal-title">Solution Comments</h3>
            <span className="comments-modal-count">{comments.length}</span>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="comments-modal-post" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <p className="comments-modal-post-title" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {decodeHTMLEntities(solutionTitle)}
          </p>
        </div>

        <div
          className="comments-modal-body"
          style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '1rem' }}
        >
          {/* Comment input */}
          {session ? (
            <div className="sol-detail-comment-input-row" style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexShrink: 0 }}>
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
                  disabled={isSubmitting}
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
                      disabled={isSubmitting || !commentBody.trim()}
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
                      {isSubmitting ? <Loader2 size={14} className="spin" /> : 'Comment'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="sol-detail-comment-signin" style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '1.5rem', flexShrink: 0 }}>
              <span>Sign in to join the discussion</span>
            </div>
          )}

          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader2 size={22} className="spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          )}

          {!isLoading && comments.length === 0 && (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '14px' }}>
              <MessageCircle size={20} strokeWidth={1.5} style={{ margin: '0 auto 8px' }} />
              <p>No comments yet. Start the conversation!</p>
            </div>
          )}

          {comments.length > 0 && (
            <div className="comment-tree-list" style={{ overflowY: 'auto' }}>
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
                      />
                      <div className="comment-tree-body" style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                            <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-main)' }}>
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
        </div>
      </div>
    </div>
  );
}
