'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Send,
  Loader2,
  Edit2,
  Trash2,
  Heart,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Link2,
} from 'lucide-react';
import { Comment } from '@/lib/types';
import Avatar from './Avatar';

export interface CommentNode extends Comment {
  children: CommentNode[];
}

export function buildCommentTree(comments: Comment[]): CommentNode[] {
  const map = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  comments.forEach((comment) => {
    map.set(comment.id, { ...comment, children: [] });
  });

  comments.forEach((comment) => {
    const node = map.get(comment.id)!;
    if (comment.parent_id && map.has(comment.parent_id)) {
      map.get(comment.parent_id)!.children.push(node);
    } else if (!comment.parent_id) {
      roots.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

// ---------------------------------------------------------------------
// Design notes (from the Uxcel "Interactive Comment Sections" lesson +
// YouTube's comment system):
//  - Threaded view, but capped to ONE visual nesting level. Replies-to-
//    replies are flattened into the same reply list (YouTube does this
//    too) with an "@name" mention inserted so context isn't lost.
//  - Replies are collapsed by default behind a "View N replies" toggle.
//  - Top-level comments are paginated client-side ("Show more comments")
//    instead of all rendering at once.
//  - Visual hierarchy: bold name, muted @handle/timestamp, body text at
//    full contrast.
//  - Only Like + Reply are surface-level actions; Edit/Delete/Copy link
//    live behind a "..." menu to keep the card uncluttered.
//  - Long comments truncate with "Read more".
//  - The composer is the most prominent action (top of the list, expands
//    on focus), reply boxes are secondary/inline.
//  - @mentions render in the accent color.
// ---------------------------------------------------------------------

const TRUNCATE_LEN = 280;

const COLORS = {
  text: 'var(--text-main, #e9e9ee)',
  subtext: 'var(--text-muted, #92929c)',
  border: 'var(--border-color, rgba(255,255,255,0.09))',
  accent: 'var(--accent-primary, #2f8fff)',
  danger: 'var(--accent-danger, #ef4444)',
  surface: 'var(--bg-hover, #16161b)',
};

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.floor(day / 7);
  if (week < 5) return `${week}w ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}

// Flattens every descendant of a root comment (replies, replies-to-replies,
// etc.) into a single, chronologically sorted list - this is what gives us
// YouTube's "one level deep visually, infinite levels logically" thread.
function flattenReplies(node: CommentNode): CommentNode[] {
  const out: CommentNode[] = [];
  const walk = (n: CommentNode) => {
    n.children.forEach((child) => {
      out.push(child);
      walk(child);
    });
  };
  walk(node);
  out.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return out;
}

function renderBodyWithMentions(text: string) {
  return text.split(/(@\w+)/g).map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} style={{ color: COLORS.accent, fontWeight: 600 }}>
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

const sortTabStyle = (active: boolean): React.CSSProperties => ({
  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
  border: 'none',
  color: active ? COLORS.text : COLORS.subtext,
  fontSize: 13,
  fontWeight: 600,
  padding: '4px 12px',
  borderRadius: 14,
  cursor: 'pointer',
});

const likeBtnStyle = (liked: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  background: 'none',
  border: 'none',
  color: liked ? COLORS.accent : COLORS.subtext,
  cursor: 'pointer',
  fontSize: 12,
  padding: 0,
});

const replyBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: COLORS.subtext,
  fontWeight: 700,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  cursor: 'pointer',
  padding: 0,
};

const viewRepliesBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  background: 'none',
  border: 'none',
  color: COLORS.accent,
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
  padding: '4px 0',
};

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  textAlign: 'left',
  background: 'none',
  border: 'none',
  color: COLORS.text,
  fontSize: 13,
  padding: '9px 12px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const readMoreStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: COLORS.accent,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  padding: 0,
  marginLeft: 4,
};

const cancelBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: COLORS.subtext,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  padding: '6px 10px',
  borderRadius: 16,
};

const postBtnStyle = (enabled: boolean): React.CSSProperties => ({
  background: enabled ? COLORS.accent : 'rgba(255,255,255,0.08)',
  color: enabled ? '#fff' : COLORS.subtext,
  border: 'none',
  fontSize: 13,
  fontWeight: 600,
  padding: '6px 16px',
  borderRadius: 16,
  cursor: enabled ? 'pointer' : 'default',
});

const showMoreStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: COLORS.accent,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  padding: '10px 0',
};

interface CommentThreadProps {
  comments: Comment[];
  session: any;
  profile?: any;
  postId: string;
  onAddComment: (body: string, parentId?: string | null) => Promise<void>;
  onEditComment?: (commentId: string, body: string) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  onToggleLike?: (commentId: string, liked: boolean) => Promise<void> | void;
  onAuthRequired?: () => void;
  compact?: boolean;
  highlightCommentId?: string | null;
}

export default function CommentThread({
  comments,
  session,
  profile,
  postId,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onToggleLike,
  onAuthRequired,
  compact = false,
  highlightCommentId = null,
}: CommentThreadProps) {
  const router = useRouter();

  // top-level composer
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);

  // inline reply box (one open at a time, attached to whichever comment id it targets)
  const [activeReplyTarget, setActiveReplyTarget] = useState<{ rootId: string; parentId: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  // edit
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [isEditingComment, setIsEditingComment] = useState(false);

  // collapse/expand reply groups, per top-level comment id
  const [expandedRoots, setExpandedRoots] = useState<Set<string>>(new Set());

  // "..." overflow menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // "Read more" truncation
  const [expandedBodies, setExpandedBodies] = useState<Set<string>>(new Set());

  // sort + pagination of top-level comments
  const [sortMode, setSortMode] = useState<'top' | 'newest'>('top');
  const [visibleCount, setVisibleCount] = useState(10);

  // local like state (optimistic only - see onToggleLike prop to persist)
  const [likes, setLikes] = useState<Record<string, { liked: boolean; count: number }>>({});

  useEffect(() => {
    setLikes((prev) => {
      const next = { ...prev };
      comments.forEach((c) => {
        if (!next[c.id]) {
          next[c.id] = {
            liked: !!(c as any).liked_by_me,
            count: (c as any).like_count || 0,
          };
        }
      });
      return next;
    });
  }, [comments]);

  const tree = buildCommentTree(comments);

  // auto-expand + scroll to a deep-linked comment, even if it's a flattened reply
  useEffect(() => {
    if (!highlightCommentId) return;
    for (const root of tree) {
      if (root.id === highlightCommentId) continue;
      if (flattenReplies(root).some((d) => d.id === highlightCommentId)) {
        setExpandedRoots((prev) => new Set(prev).add(root.id));
        break;
      }
    }
  }, [highlightCommentId, comments]);

  useEffect(() => {
    if (!highlightCommentId) return;
    const el = document.getElementById(`comment-${highlightCommentId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightCommentId, expandedRoots]);

  const sortedRoots = useMemo(() => {
    const arr = [...tree];
    if (sortMode === 'newest') {
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      arr.sort((a, b) => {
        const aScore = (likes[a.id]?.count || 0) + flattenReplies(a).length;
        const bScore = (likes[b.id]?.count || 0) + flattenReplies(b).length;
        if (bScore !== aScore) return bScore - aScore;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    return arr;
  }, [tree, sortMode, likes]);

  const visibleRoots = sortedRoots.slice(0, visibleCount);

  const handleTopComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      onAuthRequired?.();
      return;
    }
    if (!commentText.trim()) return;
    setCommentSubmitting(true);
    try {
      await onAddComment(commentText.trim(), null);
      setCommentText('');
      setComposerFocused(false);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleReply = async (parentId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      onAuthRequired?.();
      return;
    }
    if (!replyText.trim()) return;
    setReplySubmitting(true);
    try {
      await onAddComment(replyText.trim(), parentId);
      setReplyText('');
      setActiveReplyTarget(null);
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editCommentText.trim() || !onEditComment) return;
    setIsEditingComment(true);
    try {
      await onEditComment(commentId, editCommentText.trim());
      setEditCommentId(null);
      setEditCommentText('');
    } finally {
      setIsEditingComment(false);
    }
  };

  const openReplyForm = (rootId: string, parentId: string, mentionName?: string) => {
    if (!session) {
      onAuthRequired?.();
      return;
    }
    setActiveReplyTarget({ rootId, parentId });
    setReplyText(mentionName ? `@${mentionName} ` : '');
    setExpandedRoots((prev) => new Set(prev).add(rootId));
  };

  const toggleLike = (commentId: string) => {
    if (!session) {
      onAuthRequired?.();
      return;
    }
    setLikes((prev) => {
      const current = prev[commentId] || { liked: false, count: 0 };
      const liked = !current.liked;
      const next = { ...prev, [commentId]: { liked, count: current.count + (liked ? 1 : -1) } };
      onToggleLike?.(commentId, liked);
      return next;
    });
  };

  const toggleExpandedBody = (commentId: string) => {
    setExpandedBodies((prev) => {
      const next = new Set(prev);
      next.has(commentId) ? next.delete(commentId) : next.add(commentId);
      return next;
    });
  };

  const handleCopyLink = (commentId: string) => {
    const url = `${window.location.origin}${window.location.pathname}#comment-${commentId}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopiedId(commentId);
        setTimeout(() => setCopiedId(null), 1500);
      })
      .catch(() => {});
  };

  const renderReplyForm = (parentId: string) => (
    <form className="comment-tree-reply-form" onSubmit={(e) => handleReply(parentId, e)} style={{ marginTop: 8 }}>
      <Avatar
        src={profile?.avatar_url || session?.user?.user_metadata?.avatar_url}
        name="You"
        className="comment-tree-avatar comment-tree-avatar--sm"
        size={24}
      />
      <div className="comment-tree-reply-input-wrap">
        <textarea
          className="comment-tree-reply-input"
          rows={1}
          placeholder="Write a reply..."
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          disabled={replySubmitting}
          autoFocus
        />
        <button type="submit" className="comment-tree-reply-send" disabled={replySubmitting || !replyText.trim()}>
          {replySubmitting ? <Loader2 size={12} className="spin" /> : <Send size={12} />}
        </button>
      </div>
    </form>
  );

  const renderCommentCard = (node: CommentNode, opts: { isReply?: boolean; rootId: string }) => {
    const { isReply = false, rootId } = opts;
    const isOwner = session?.user?.id === node.user_id;
    const authorName = node.profiles?.full_name || (node.profiles?.username ? `@${node.profiles.username}` : (session?.user && node.user_id === session.user.id ? (session.user.user_metadata?.full_name || session.user.user_metadata?.username || session.user.email?.split('@')[0]) : 'Anonymous'));
    const authorAvatar = (isOwner ? (profile?.avatar_url || session?.user?.user_metadata?.avatar_url) : null) || node.profiles?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${node.user_id}`;
    const authorUsername = node.profiles?.username;
    const isHighlighted = highlightCommentId === node.id;
    const isEdited = (node as any).updated_at && (node as any).updated_at !== node.created_at;
    const likeState = likes[node.id] || { liked: false, count: 0 };
    const bodyExpanded = expandedBodies.has(node.id);
    const body = node.body || '';
    const isLong = body.length > TRUNCATE_LEN;
    const displayBody = !isLong || bodyExpanded ? body : `${body.slice(0, TRUNCATE_LEN)}…`;
    const isReplyFormOpenHere = activeReplyTarget?.parentId === node.id;
    const isMenuOpen = openMenuId === node.id;
    const isEditingThis = editCommentId === node.id;
    const goToProfile = () => router.push(authorUsername ? `/user/${authorUsername}` : `/profile?userId=${node.user_id}`);
    // Professional, low-noise identity line: handle (or name as fallback) + time only.
    const displayHandle = authorUsername ? `@${authorUsername}` : authorName;

    return (
      <div
        key={node.id}
        id={`comment-${node.id}`}
        className={`comment-tree-node ${isHighlighted ? 'comment-tree-node--highlight' : ''}`}
        style={{ position: 'relative', marginTop: isReply ? 14 : 0 }}
      >
        <div className="comment-tree-row">
          <Avatar
            src={authorAvatar}
            name={authorName}
            className={`comment-tree-avatar ${compact || isReply ? 'comment-tree-avatar--sm' : ''}`}
            size={compact || isReply ? 28 : 36}
            onClick={goToProfile}
          />

          <div className="comment-tree-body" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span
                  onClick={goToProfile}
                  title={authorName}
                  style={{
                    fontWeight: 600,
                    fontSize: 13.5,
                    color: COLORS.text,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 220,
                  }}
                >
                  {displayHandle}
                </span>
                <span style={{ color: COLORS.subtext, fontSize: 12 }}>·</span>
                <time
                  title={new Date(node.created_at).toLocaleString()}
                  style={{ fontSize: 12, color: COLORS.subtext, whiteSpace: 'nowrap' }}
                >
                  {timeAgo(node.created_at)}
                  {isEdited ? ' (edited)' : ''}
                </time>
              </div>

              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  type="button"
                  aria-label="More options"
                  onClick={() => setOpenMenuId(isMenuOpen ? null : node.id)}
                  style={{ background: 'none', border: 'none', color: COLORS.subtext, cursor: 'pointer', padding: 4 }}
                >
                  <MoreHorizontal size={16} />
                </button>

                {isMenuOpen && (
                  <>
                    <div onClick={() => setOpenMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 26,
                        zIndex: 41,
                        background: COLORS.surface,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 8,
                        minWidth: 150,
                        overflow: 'hidden',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                      }}
                    >
                      <button type="button" style={menuItemStyle} onClick={() => { handleCopyLink(node.id); setOpenMenuId(null); }}>
                        <Link2 size={13} /> {copiedId === node.id ? 'Copied!' : 'Copy link'}
                      </button>
                      {isOwner && onEditComment && (
                        <button
                          type="button"
                          style={menuItemStyle}
                          onClick={() => {
                            setEditCommentId(node.id);
                            setEditCommentText(node.body);
                            setOpenMenuId(null);
                          }}
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                      )}
                      {isOwner && onDeleteComment && (
                        <button
                          type="button"
                          style={{ ...menuItemStyle, color: COLORS.danger }}
                          onClick={() => {
                            onDeleteComment(node.id);
                            setOpenMenuId(null);
                          }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {isEditingThis ? (
              <div className="comment-tree-edit">
                <input
                  type="text"
                  value={editCommentText}
                  onChange={(e) => setEditCommentText(e.target.value)}
                  disabled={isEditingComment}
                  className="comment-tree-edit-input"
                />
                <button type="button" className="comment-tree-edit-save" onClick={() => handleSaveEdit(node.id)} disabled={isEditingComment}>
                  Save
                </button>
                <button type="button" className="comment-tree-edit-cancel" onClick={() => setEditCommentId(null)} disabled={isEditingComment}>
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <p className="comment-tree-text" style={{ whiteSpace: 'pre-wrap', marginTop: 2 }}>
                  {renderBodyWithMentions(displayBody)}
                  {isLong && (
                    <button type="button" style={readMoreStyle} onClick={() => toggleExpandedBody(node.id)}>
                      {bodyExpanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
                  <button type="button" style={likeBtnStyle(likeState.liked)} onClick={() => toggleLike(node.id)} aria-label="Like">
                    <Heart size={14} fill={likeState.liked ? COLORS.accent : 'none'} />
                    {likeState.count > 0 && <span>{likeState.count}</span>}
                  </button>

                  {session && (
                    <button
                      type="button"
                      style={replyBtnStyle}
                      onClick={() => openReplyForm(rootId, node.id, isReply ? authorName : undefined)}
                    >
                      Reply
                    </button>
                  )}
                </div>
              </>
            )}

            {isReplyFormOpenHere && renderReplyForm(node.id)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`comment-thread ${compact ? 'comment-thread--compact' : ''}`}
      data-post-id={postId}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      {/* Fixed header: count, sort, composer */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0 12px' }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: COLORS.text }}>{comments.length} Comments</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" style={sortTabStyle(sortMode === 'top')} onClick={() => setSortMode('top')}>
              Top
            </button>
            <button type="button" style={sortTabStyle(sortMode === 'newest')} onClick={() => setSortMode('newest')}>
              Newest
            </button>
          </div>
        </div>

        <form onSubmit={handleTopComment} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <Avatar
            src={profile?.avatar_url || session?.user?.user_metadata?.avatar_url}
            name="You"
            className="comment-tree-avatar"
            size={36}
          />
          <div style={{ flex: 1 }}>
            <textarea
              rows={composerFocused || commentText ? 2 : 1}
              placeholder={session ? 'Add a comment...' : 'Sign in to join the discussion...'}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onFocus={() => {
                if (!session) {
                  onAuthRequired?.();
                  return;
                }
                setComposerFocused(true);
              }}
              disabled={commentSubmitting}
              style={{
                width: '100%',
                resize: 'none',
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${COLORS.border}`,
                color: COLORS.text,
                fontSize: 14,
                padding: '6px 0',
                outline: 'none',
              }}
            />
            {(composerFocused || commentText) && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  style={cancelBtnStyle}
                  onClick={() => {
                    setCommentText('');
                    setComposerFocused(false);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" style={postBtnStyle(!!commentText.trim())} disabled={commentSubmitting || !commentText.trim()}>
                  {commentSubmitting ? <Loader2 size={14} className="spin" /> : 'Comment'}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Scrollable list */}
      <div className="comment-tree-list" style={{ flex: '1 1 auto', overflowY: 'auto', minHeight: 0 }}>
        {tree.length === 0 ? (
          <p className="comment-tree-empty">No comments yet. Start the conversation!</p>
        ) : (
          <>
            {visibleRoots.map((root) => {
              const replies = flattenReplies(root);
              const isExpanded = expandedRoots.has(root.id);
              return (
                <div key={root.id} style={{ marginBottom: 20 }}>
                  {renderCommentCard(root, { rootId: root.id })}

                  {replies.length > 0 && (
                    <div style={{ marginLeft: compact ? 32 : 44, marginTop: 6 }}>
                      {!isExpanded ? (
                        <button
                          type="button"
                          style={viewRepliesBtnStyle}
                          onClick={() => setExpandedRoots((prev) => new Set(prev).add(root.id))}
                        >
                          <ChevronDown size={14} />
                          View {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            style={viewRepliesBtnStyle}
                            onClick={() =>
                              setExpandedRoots((prev) => {
                                const next = new Set(prev);
                                next.delete(root.id);
                                return next;
                              })
                            }
                          >
                            <ChevronUp size={14} />
                            Hide replies
                          </button>
                          <div>
                            {replies.map((reply) => renderCommentCard(reply, { isReply: true, rootId: root.id }))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {visibleCount < sortedRoots.length && (
              <button type="button" style={showMoreStyle} onClick={() => setVisibleCount((v) => v + 10)}>
                Show more comments
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}