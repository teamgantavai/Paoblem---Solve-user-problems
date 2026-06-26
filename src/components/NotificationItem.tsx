'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, CheckCheck, EyeOff, BellOff, UserX, Flag, UserCircle } from 'lucide-react';
import { Notification } from '@/lib/types';
import { supabase } from '@/lib/supabase';

// ─── Colored initials helper ────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#0ea5e9', '#10b981', '#06b6d4',
];

function nameToColor(name: string): string {
  if (!name) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  if (!name) return '?';
  const p = name.trim().split(' ');
  return p.length > 1
    ? (p[0][0] + p[p.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ─── Compact timestamp ───────────────────────────────────────────────────────
function ago(iso: string): string {
  try {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 30) return 'now';
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    if (h < 48) return 'Yesterday';
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

// ─── Type icons ──────────────────────────────────────────────────────────────
const ICONS: Record<string, string> = {
  upvote: '⬆️', like: '❤️', comment: '💬', reply: '💬',
  follow: '👤', mention: '📢', solved: '🚀', new_post: '📝',
  save: '⭐', achievement: '🏆', xp: '⚡', milestone: '🎉',
  trending: '🔥', admin: '📣', system: '🔔',
};

// ─── Action suffix (everything after the actor name) ─────────────────────────
function actionSuffix(n: Notification): string {
  const extra = n.grouped_count && n.grouped_count > 0
    ? ` and ${n.grouped_count} other${n.grouped_count > 1 ? 's' : ''}`
    : '';
  switch (n.type) {
    case 'upvote':      return `${extra} upvoted your post`;
    case 'like':        return `${extra} liked your ${n.comment_preview ? 'comment' : 'post'}`;
    case 'comment':     return `${extra} commented`;
    case 'reply':       return `${extra} replied to your comment`;
    case 'follow':      return ' started following you';
    case 'mention':     return ' mentioned you';
    case 'solved':      return ''; // handled via title
    case 'new_post':    return `${extra} posted`;
    case 'save':        return `${extra} saved your post`;
    default:            return '';
  }
}

// ─── Avatar with colored-initials fallback ───────────────────────────────────
function Av({
  src, name, size = 40, onClick,
}: {
  src?: string | null; name?: string | null; size?: number; onClick?: (e: React.MouseEvent<HTMLElement>) => void;
}) {
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [src]);
  const n = name || '?';

  if (src && !err) {
    return (
      <img
        src={src}
        alt={n}
        className="nf-avatar-img"
        style={{ width: size, height: size, cursor: onClick ? 'pointer' : 'default' }}
        onError={() => setErr(true)}
        onClick={onClick}
      />
    );
  }
  return (
    <div
      className="nf-avatar-fallback"
      style={{
        width: size, height: size,
        background: nameToColor(n),
        cursor: onClick ? 'pointer' : 'default',
        fontSize: Math.round(size * 0.34),
      }}
      onClick={onClick}
    >
      {initials(n)}
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onHide: (id: string) => void;
  isNew?: boolean;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function NotificationItem({
  notification: n,
  onMarkAsRead, onDelete, onHide, isNew = false,
}: NotificationItemProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [following, setFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  useEffect(() => {
    if (n.type !== 'follow' || !n.actor_id) return;
    
    let active = true;
    const checkFollowStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !active) return;
        const res = await fetch(`/api/follows?userId=${n.actor_id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok && active) {
          const data = await res.json();
          setFollowing(data.isFollowing);
        }
      } catch (err) {
        console.error('Error checking follow status:', err);
      }
    };
    
    checkFollowStatus();
    return () => { active = false; };
  }, [n.type, n.actor_id]);

  const handleFollowToggle = async () => {
    if (isFollowLoading || !n.actor_id) return;
    setIsFollowLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const res = await fetch('/api/follows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ targetUserId: n.actor_id }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setFollowing(data.isFollowing);
      }
    } catch (err) {
      console.error('Error toggling follow status:', err);
    } finally {
      setIsFollowLoading(false);
    }
  };

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpen]);

  // Parse actor from stored fields or from body
  const body = n.body || '';
  const uMatch = body.match(/^@([a-zA-Z0-9_]+)/);
  const parsedUsername = uMatch ? uMatch[1] : null;
  const actorUsername = n.actor_username || parsedUsername;
  const actorName = n.actor_name || parsedUsername || 'Someone';

  // Comment preview: prefer API-enriched value, else strip from body
  let commentText = n.comment_preview ?? null;
  if (!commentText && ['comment', 'reply'].includes(n.type)) {
    let rest = body.replace(/^@[a-zA-Z0-9_]+\s*/i, '').trim();
    rest = rest.replace(/^(?:commented|replied|said|mentioned you)[:\s]+/i, '').trim();
    rest = rest.replace(/^["'""]|["'""]$/g, '').trim();
    commentText = rest || null;
  }

  // ── Navigate immediately, mark read in background ─────────────────────────
  const go = useCallback(() => {
    // Fire mark-read in background (non-blocking)
    if (!n.read) onMarkAsRead(n.id);

    // Navigate right away
    if (n.post_id && ['upvote','downvote','save','solved','new_post','trending','like','comment','reply','mention'].includes(n.type)) {
      router.push(`/post/${n.post_id}`);
    } else if (n.type === 'follow' && actorUsername) {
      router.push(`/user/${actorUsername}`);
    }
  }, [n, actorUsername, onMarkAsRead, router]);

  const goProfile = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (actorUsername) router.push(`/user/${actorUsername}`);
  }, [actorUsername, router]);

  // ── Admin announcement ────────────────────────────────────────────────────
  if (n.type === 'admin' || n.type === 'system') {
    return (
      <div className={`nf-admin-row ${isNew ? 'entering' : ''}`}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: 1 }}>📣</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>
            Announcement
          </div>
          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>{n.title}</div>
          {n.body && (
            <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)', marginTop: '0.15rem', lineHeight: 1.45 }}>{n.body}</div>
          )}
        </div>
        {!n.read && <div className="nf-dot" style={{ marginTop: 4 }} />}
      </div>
    );
  }

  // ── Achievement / milestone / XP (no actor) ───────────────────────────────
  const noActor = ['achievement', 'xp', 'milestone', 'solved'].includes(n.type) && !actorUsername;
  const typeIcon = ICONS[n.type] || '🔔';
  const suffix = actionSuffix(n);

  return (
    <div
      className={`nf-item ${n.read ? '' : 'unread'} ${isNew ? 'entering' : ''}`}
      onClick={go}
      role="listitem"
    >
      {/* ── Avatar ── */}
      <div className="nf-avatar-wrap">
        <Av
          src={n.actor_avatar}
          name={actorName}
          size={40}
          onClick={actorUsername ? (e: any) => goProfile(e) : undefined}
        />
        <div className="nf-type-icon">{typeIcon}</div>
      </div>

      {/* ── Content ── */}
      <div className="nf-content">
        {noActor ? (
          /* System / achievement notification — no actor */
          <div className="nf-actor-line">
            <span className="nf-action-text" style={{ color: 'var(--text-main)', fontWeight: 600 }}>
              {n.title || n.body}
            </span>
          </div>
        ) : (
          /* Normal notification with actor */
          <div className="nf-actor-line">
            <span className="nf-actor-name" onClick={goProfile}>
              {actorName}
            </span>
            {suffix && (
              <span className="nf-action-text">{suffix}</span>
            )}
          </div>
        )}

        {/* 2-line comment/reply preview */}
        {commentText && (
          <div className="nf-preview-text">
            "{commentText}"
          </div>
        )}

        {/* Post title for upvotes/likes */}
        {!commentText && n.post_preview && (
          <div className="nf-post-preview">"{n.post_preview}"</div>
        )}

        <div className="nf-timestamp">{ago(n.created_at)}</div>
      </div>

      {/* ── Right side ── */}
      <div className="nf-right">
        {/* Post thumbnail */}
        {n.post_image && (
          <img
            src={n.post_image}
            alt=""
            className="nf-thumb"
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Follow back */}
        {n.type === 'follow' && (
          <button
            className={`nf-follow-btn ${following ? 'following' : ''}`}
            disabled={isFollowLoading}
            onClick={(e) => { e.stopPropagation(); handleFollowToggle(); }}
          >
            {following ? 'Following' : 'Follow'}
          </button>
        )}

        {/* Unread dot (only when no other right element) */}
        {!n.read && n.type !== 'follow' && !n.post_image && (
          <div className="nf-dot" />
        )}

        {/* 3-dot menu */}
        <div
          className="nf-item-menu-wrapper"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="nf-item-menu-btn"
            aria-label="More options"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}
          >
            <MoreHorizontal size={14} />
          </button>

          {menuOpen && (
            <div className="nf-item-menu" onClick={(e) => e.stopPropagation()}>
              {!n.read && (
                <button className="nf-menu-item" onClick={() => { onMarkAsRead(n.id); setMenuOpen(false); }}>
                  <CheckCheck size={13} /> Mark as read
                </button>
              )}
              <button className="nf-menu-item" onClick={() => { onHide(n.id); setMenuOpen(false); }}>
                <EyeOff size={13} /> Hide notification
              </button>
              <button className="nf-menu-item">
                <BellOff size={13} /> Mute this type
              </button>
              {actorUsername && (
                <>
                  <div className="nf-menu-divider" />
                  <button className="nf-menu-item" onClick={() => { router.push(`/user/${actorUsername}`); setMenuOpen(false); }}>
                    <UserCircle size={13} /> View profile
                  </button>
                  <button className="nf-menu-item">
                    <UserX size={13} /> Mute user
                  </button>
                </>
              )}
              <div className="nf-menu-divider" />
              <button className="nf-menu-item danger" onClick={() => { onDelete(n.id); setMenuOpen(false); }}>
                <Flag size={13} /> Report
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
