'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MessageCircle, MapPin, Briefcase,
  MessageSquare, Lightbulb, BookOpen, Users,
  ExternalLink, ChevronRight, Calendar, Award, User, X,
  Globe, Check, Plus, Share2, MoreHorizontal,
  Flag, VolumeX, Ban, Link2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import BadgeArtwork from '@/components/badges/BadgeArtwork';
import { BADGE_DEFINITIONS, RARITY_CONFIG } from '@/lib/badgeDefinitions';
import type { BadgeCategory } from '@/lib/badgeDefinitions';

/* ── Social Platform Custom Icons ── */
interface CustomIconProps {
  size?: number;
  style?: React.CSSProperties;
}

const Github = ({ size = 18, style }: CustomIconProps) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const Linkedin = ({ size = 18, style }: CustomIconProps) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const Twitter = ({ size = 18, style }: CustomIconProps) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const Youtube = ({ size = 18, style }: CustomIconProps) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}>
    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.53 3.545 12 3.545 12 3.545s-7.53 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.017 0 12 0 12s0 3.983.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.858.508 9.388.508 9.388.508s7.53 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.983 24 12 24 12s0-3.983-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  bio?: string | null;
  role?: string | null;
  location?: string | null;
  website?: string | null;
  reputation?: number | null;
  headline?: string | null;
  languages?: string[] | null;
  github?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  youtube?: string | null;
  other_link?: string | null;
  about?: string | null;
  skills?: string[] | null;
  looking_for?: string[] | null;
  preferred_roles?: string[] | null;
  availability?: string | null;
  work_preference?: string | null;
  interests?: string[] | null;
  experience?: any[] | null;
  projects?: any[] | null;
}

interface PostItem {
  id: string;
  title: string;
  body?: string;
  slug?: string;
  type: 'problem' | 'idea' | 'startup';
  upvotes: number;
  comments_count: number;
  created_at: string;
  external_link?: string | null;
  link_name?: string | null;
}

interface SolutionItem {
  id: string;
  title: string;
  body?: string;
  upvotes: number;
  comments_count?: number;
  created_at: string;
  problem?: { id: string; title?: string; slug?: string } | null;
}

interface CommentItem {
  id: string;
  body: string;
  created_at: string;
  post?: { id: string; title?: string; slug?: string } | null;
  post_id: string;
}

interface FollowUser {
  id: string;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  bio?: string | null;
}

type Tab = 'overview' | 'posts' | 'solutions' | 'achievements' | 'comments' | 'about';
type ModalView = 'followers' | 'following' | null;

// ─── Props ───────────────────────────────────────────────────────────────────

interface UserProfileClientProps {
  profile: Profile;
  posts: PostItem[];
  solutions: SolutionItem[];
  comments: CommentItem[];
  stats: { postCount: number; commentCount: number; totalUpvotes: number; solutionCount: number };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="upf-empty">
      <div className="upf-empty-icon">{icon}</div>
      <p>{text}</p>
    </div>
  );
}

function UserCard({ user }: { user: FollowUser }) {
  const avatarSrc = user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`;
  return (
    <Link href={`/user/${user.username}`} className="upf-user-card">
      <img src={avatarSrc} alt={user.full_name || user.username || 'User'} className="upf-user-card-avatar" />
      <div className="upf-user-card-info">
        <span className="upf-user-card-name">{user.full_name || user.username}</span>
        <span className="upf-user-card-role">@{user.username} {user.role ? `· ${user.role}` : ''}</span>
        {user.bio && <p className="upf-user-card-bio">{user.bio.substring(0, 80)}{user.bio.length > 80 ? '…' : ''}</p>}
      </div>
      <ChevronRight size={16} className="upf-user-card-arrow" />
    </Link>
  );
}

// ─── Followers/Following Modal ────────────────────────────────────────────────

function FollowModal({
  view, onClose, onSwitchView,
  followersList, followingList,
  followersCount, followingCount, name,
}: {
  view: 'followers' | 'following';
  onClose: () => void;
  onSwitchView: (v: 'followers' | 'following') => void;
  followersList: FollowUser[];
  followingList: FollowUser[];
  followersCount: number;
  followingCount: number;
  name: string;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const list = view === 'followers' ? followersList : followingList;
  const emptyText = view === 'followers'
    ? `${name} has no followers yet.`
    : `${name} isn't following anyone yet.`;

  return (
    <div className="upf-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="upf-modal" role="dialog" aria-modal="true">
        <div className="upf-modal-header">
          <div className="upf-modal-tabs">
            <button
              className={`upf-modal-tab ${view === 'followers' ? 'upf-modal-tab--active' : ''}`}
              onClick={() => onSwitchView('followers')}
            >
              Followers <span style={{ opacity: 0.6, marginLeft: 3 }}>{followersCount}</span>
            </button>
            <button
              className={`upf-modal-tab ${view === 'following' ? 'upf-modal-tab--active' : ''}`}
              onClick={() => onSwitchView('following')}
            >
              Following <span style={{ opacity: 0.6, marginLeft: 3 }}>{followingCount}</span>
            </button>
          </div>
          <button className="upf-modal-close" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>
        <div className="upf-modal-body">
          {list.length === 0
            ? <EmptyState icon={<Users size={32} />} text={emptyText} />
            : list.map((u) => <UserCard key={u.id} user={u} />)
          }
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserProfileClient({ profile, posts, solutions, comments, stats }: UserProfileClientProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [postSubFilter, setPostSubFilter] = useState<'all' | 'problems' | 'ideas' | 'startups'>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followHover, setFollowHover] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersList, setFollowersList] = useState<FollowUser[]>([]);
  const [followingList, setFollowingList] = useState<FollowUser[]>([]);
  const [listsLoaded, setListsLoaded] = useState(false);
  const [modalView, setModalView] = useState<ModalView>(null);
  const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Badge state
  const [userBadges, setUserBadges] = useState<Record<string, { earned_at: string; is_featured: boolean }>>({});
  const [badgesLoaded, setBadgesLoaded] = useState(false);

  const problems = posts.filter((p) => p.type === 'problem');
  const ideas = posts.filter((p) => p.type === 'idea');
  const startups = posts.filter((p) => p.type === 'startup');

  const name = profile.full_name || profile.username || 'Member';
  const avatarSrc = profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.id}`;
  const coverSrc = profile.cover_url;

  // Auth & follow state
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) setCurrentUserId(session.user.id);
      const res = await fetch(`/api/follows?userId=${profile.id}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setFollowersCount(data.followersCount || 0);
        setFollowingCount(data.followingCount || 0);
        setIsFollowing(data.isFollowing || false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setCurrentUserId(session?.user?.id || null);
    });
    return () => subscription.unsubscribe();
  }, [profile.id]);

  // Load profile badges
  useEffect(() => {
    if (badgesLoaded) return;
    setBadgesLoaded(true);
    fetch(`/api/badges/user/${profile.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const map: Record<string, { earned_at: string; is_featured: boolean }> = {};
        (data.badges || []).forEach((ub: any) => {
          if (ub.badge_definitions) {
            map[ub.badge_definitions.slug] = { earned_at: ub.earned_at, is_featured: ub.is_featured };
          }
        });
        setUserBadges(map);
      })
      .catch(() => { });
  }, [profile.id, badgesLoaded]);

  // Load follow lists
  const loadLists = useCallback(async () => {
    if (listsLoaded) return;
    setListsLoaded(true);
    const [fersRes, fingRes] = await Promise.all([
      fetch(`/api/follows/list?userId=${profile.id}&type=followers`),
      fetch(`/api/follows/list?userId=${profile.id}&type=following`),
    ]);
    if (fersRes.ok) { const d = await fersRes.json(); setFollowersList(d.users || []); }
    if (fingRes.ok) { const d = await fingRes.json(); setFollowingList(d.users || []); }
  }, [listsLoaded, profile.id]);

  const openModal = (view: 'followers' | 'following') => {
    loadLists();
    setModalView(view);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setModalView(null);
    document.body.style.overflow = '';
  };

  // Close more menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleFollow = async () => {
    if (followLoading) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/'); return; }

    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowersCount((c) => wasFollowing ? Math.max(0, c - 1) : c + 1);
    setFollowLoading(true);

    try {
      const res = await fetch('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ targetUserId: profile.id }),
      });
      if (!res.ok) {
        setIsFollowing(wasFollowing);
        setFollowersCount((c) => wasFollowing ? c + 1 : Math.max(0, c - 1));
      }
    } catch {
      setIsFollowing(wasFollowing);
      setFollowersCount((c) => wasFollowing ? c + 1 : Math.max(0, c - 1));
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessage = async () => {
    window.dispatchEvent(new CustomEvent('top-loader:start'));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ recipientId: profile.id, startOnly: true }),
      });
      if (!res.ok) throw new Error('Could not start chat');
      const data = await res.json();
      const params = new URLSearchParams();
      params.set('conversationId', data.conversationId);
      params.set('partnerId', profile.id);
      if (profile.full_name) params.set('partnerName', profile.full_name);
      if (profile.avatar_url) params.set('partnerAvatar', profile.avatar_url);
      if (profile.username) params.set('partnerUsername', profile.username);
      router.push(`/chats?${params.toString()}`);
    } catch {
      window.dispatchEvent(new CustomEvent('top-loader:finish'));
      router.push(`/chats?userId=${profile.id}`);
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: name, url });
    } else {
      navigator.clipboard?.writeText(url);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    }
  };

  const earnedBadges = BADGE_DEFINITIONS.filter(b => userBadges[b.slug]);

  return (
    <div className="upf-root" style={{ margin: '0 auto', maxWidth: '1000px', padding: '1rem' }}>

      {/* ── Premium Hero Card — identical layout to /profile ── */}
      <div className="upf-hero-card" id="section-intro">

        {/* Cover Banner */}
        <div
          className="upf-hero-cover"
          onClick={() => coverSrc && setActiveLightboxImg(coverSrc)}
          style={{
            backgroundImage: coverSrc ? `url(${coverSrc})` : undefined,
            cursor: coverSrc ? 'zoom-in' : 'default',
          }}
        />

        {/* Identity Section */}
        <div className="upf-hero-identity">
          <div className="phero-identity-row">
            {/* Avatar Row Wrapper for Mobile Inline Layout */}
            <div className="upf-avatar-socials-row">
              {/* Avatar */}
              <div
                className="upf-hero-avatar-container"
                onClick={() => setActiveLightboxImg(avatarSrc)}
                style={{ cursor: 'zoom-in' }}
              >
                <img src={avatarSrc} alt={name} className="upf-hero-avatar" />
              </div>

              {/* Mobile Inline Socials */}
              <div className="upf-hero-socials-inline-mobile">
                {profile.github && (
                  <a href={profile.github.startsWith('http') ? profile.github : `https://github.com/${profile.github}`} target="_blank" rel="noopener noreferrer" className="upf-social-icon" title="GitHub">
                    <Github size={15} />
                  </a>
                )}
                {profile.linkedin && (
                  <a href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://linkedin.com/in/${profile.linkedin}`} target="_blank" rel="noopener noreferrer" className="upf-social-icon" title="LinkedIn">
                    <Linkedin size={15} />
                  </a>
                )}
                {profile.twitter && (
                  <a href={profile.twitter.startsWith('http') ? profile.twitter : `https://x.com/${profile.twitter}`} target="_blank" rel="noopener noreferrer" className="upf-social-icon" title="Twitter/X">
                    <Twitter size={15} />
                  </a>
                )}
                {profile.youtube && (
                  <a href={profile.youtube.startsWith('http') ? profile.youtube : `https://youtube.com/${profile.youtube}`} target="_blank" rel="noopener noreferrer" className="upf-social-icon" title="YouTube">
                    <Youtube size={15} />
                  </a>
                )}
                {profile.other_link && (
                  <a href={profile.other_link.startsWith('http') ? profile.other_link : `https://${profile.other_link}`} target="_blank" rel="noopener noreferrer" className="upf-social-icon" title="Other Link">
                    <Globe size={15} />
                  </a>
                )}
              </div>
            </div>

            {/* Details Column */}
            <div className="phero-details-col">
              <div className="phero-top-row">
                <div className="phero-name-block">
                  <h1 className="upf-hero-name">{name}</h1>
                  <span className="upf-hero-username">@{profile.username}</span>
                </div>

                {/* Visitor Action Buttons — Desktop */}
                <div className="phero-actions phero-actions-desktop" ref={moreMenuRef} style={{ position: 'relative' }}>
                  {/* Follow / Following */}
                  <button
                    className={`phero-btn ${isFollowing ? '' : 'phero-btn-primary'}`}
                    onClick={handleFollow}
                    disabled={followLoading}
                    onMouseEnter={() => setFollowHover(true)}
                    onMouseLeave={() => setFollowHover(false)}
                    style={{
                      minWidth: '100px',
                      ...(isFollowing && followHover ? {
                        background: 'rgba(239,68,68,0.12) !important' as any,
                        borderColor: 'rgba(239,68,68,0.35) !important' as any,
                        color: '#ef4444 !important' as any,
                      } : {}),
                    }}
                  >
                    {isFollowing
                      ? (followHover ? <><X size={13} /> Unfollow</> : <><Check size={13} /> Following</>)
                      : <><Plus size={13} /> Follow</>
                    }
                  </button>

                  {/* Message */}
                  <button
                    className="phero-btn"
                    onClick={handleMessage}
                    title="Send message"
                  >
                    <MessageCircle size={13} /> Message
                  </button>

                  {/* Share */}
                  <button
                    className="phero-btn phero-btn-icon"
                    onClick={handleShare}
                    title="Share profile"
                  >
                    <Share2 size={14} />
                  </button>

                  {/* More ⋯ */}
                  <button
                    className="phero-btn phero-btn-icon"
                    onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                    title="More options"
                  >
                    <MoreHorizontal size={14} />
                  </button>

                  {/* More dropdown */}
                  {moreMenuOpen && (
                    <div className="settings-menu-dropdown-new">
                      <button
                        className="settings-menu-item-new"
                        onClick={() => {
                          navigator.clipboard?.writeText(window.location.href);
                          setShareToast(true);
                          setTimeout(() => setShareToast(false), 2000);
                          setMoreMenuOpen(false);
                        }}
                      >
                        <Link2 size={13} /> Copy Profile Link
                      </button>
                      <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
                      <button className="settings-menu-item-new" style={{ color: 'var(--text-muted)' }} onClick={() => setMoreMenuOpen(false)}>
                        <Flag size={13} /> Report User
                      </button>
                      <button className="settings-menu-item-new" style={{ color: 'var(--text-muted)' }} onClick={() => setMoreMenuOpen(false)}>
                        <VolumeX size={13} /> Mute User
                      </button>
                      <button className="settings-menu-item-new" style={{ color: 'var(--accent-danger, #ef4444)' }} onClick={() => setMoreMenuOpen(false)}>
                        <Ban size={13} /> Block User
                      </button>
                    </div>
                  )}
                </div>

                {/* Visitor Action Buttons — Mobile */}
                <div className="phero-actions-mobile" ref={moreMenuRef} style={{ position: 'relative' }}>
                  {/* Follow / Following */}
                  <button
                    className={`phero-btn-mobile-follow ${isFollowing ? 'following' : 'primary'}`}
                    onClick={handleFollow}
                    disabled={followLoading}
                  >
                    {isFollowing ? <><Check size={13} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} /> Following</> : <><Plus size={13} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} /> Follow</>}
                  </button>
                  {/* Message */}
                  <button className="phero-btn-mobile-message" onClick={handleMessage}>
                    <MessageCircle size={13} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} /> Message
                  </button>
                  {/* Share */}
                  <button className="phero-btn-mobile-share" onClick={handleShare} title="Share">
                    <Share2 size={13} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                  </button>
                  {/* More */}
                  <button className="phero-btn-mobile-more" onClick={() => setMoreMenuOpen(!moreMenuOpen)} title="More">
                    <MoreHorizontal size={13} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                  </button>

                  {/* More dropdown (duplicate for mobile visibility) */}
                  {moreMenuOpen && (
                    <div className="settings-menu-dropdown-new">
                      <button
                        className="settings-menu-item-new"
                        onClick={() => {
                          navigator.clipboard?.writeText(window.location.href);
                          setShareToast(true);
                          setTimeout(() => setShareToast(false), 2000);
                          setMoreMenuOpen(false);
                        }}
                      >
                        <Link2 size={13} /> Copy Profile Link
                      </button>
                      <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
                      <button className="settings-menu-item-new" style={{ color: 'var(--text-muted)' }} onClick={() => setMoreMenuOpen(false)}>
                        <Flag size={13} /> Report User
                      </button>
                      <button className="settings-menu-item-new" style={{ color: 'var(--text-muted)' }} onClick={() => setMoreMenuOpen(false)}>
                        <VolumeX size={13} /> Mute User
                      </button>
                      <button className="settings-menu-item-new" style={{ color: 'var(--accent-danger, #ef4444)' }} onClick={() => setMoreMenuOpen(false)}>
                        <Ban size={13} /> Block User
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Headline */}
              {profile.headline ? (
                <p className="upf-hero-headline" style={{ margin: '0.5rem 0', fontSize: '0.92rem', color: 'var(--text-main)', fontWeight: 500 }}>{profile.headline}</p>
              ) : (
                <p className="upf-hero-headline" style={{ margin: '0.5rem 0', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.88rem' }}>
                  Member of Paoblem
                </p>
              )}

              {/* Bio */}
              {profile.bio && (
                <p className="upf-hero-bio" style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.88rem', color: 'var(--text-body)', lineHeight: 1.5 }}>{profile.bio.substring(0, 250)}</p>
              )}

              {/* Bottom row: location + website + followers + socials */}
              <div className="phero-bottom-row-desktop">
                {/* Location + Website */}
                {(profile.location || profile.website) && (
                  <div className="phero-meta-row">
                    {profile.location && (
                      <span className="phero-meta-item">
                        <MapPin size={13} /> {profile.location}
                      </span>
                    )}
                    {profile.website && (
                      <span className="phero-meta-item">
                        <ExternalLink size={13} />
                        <a
                          href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {profile.website.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                      </span>
                    )}
                  </div>
                )}

                {/* Followers / Following */}
                <div className="phero-counts">
                  <span className="phero-count-item" onClick={() => openModal('followers')}>
                    <strong className="phero-count-number">{followersCount}</strong>
                    <span className="phero-count-label">{followersCount === 1 ? 'Follower' : 'Followers'}</span>
                  </span>
                  <span className="phero-counts-separator">•</span>
                  <span className="phero-count-item" onClick={() => openModal('following')}>
                    <strong className="phero-count-number">{followingCount}</strong>
                    <span className="phero-count-label">Following</span>
                  </span>
                </div>

                {/* Social Icons */}
                <div className="upf-hero-socials">
                  {profile.github && (
                    <a href={profile.github.startsWith('http') ? profile.github : `https://github.com/${profile.github}`} target="_blank" rel="noopener noreferrer" className="upf-social-icon" title="GitHub">
                      <Github size={15} />
                    </a>
                  )}
                  {profile.linkedin && (
                    <a href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://linkedin.com/in/${profile.linkedin}`} target="_blank" rel="noopener noreferrer" className="upf-social-icon" title="LinkedIn">
                      <Linkedin size={15} />
                    </a>
                  )}
                  {profile.twitter && (
                    <a href={profile.twitter.startsWith('http') ? profile.twitter : `https://x.com/${profile.twitter}`} target="_blank" rel="noopener noreferrer" className="upf-social-icon" title="Twitter/X">
                      <Twitter size={15} />
                    </a>
                  )}
                  {profile.youtube && (
                    <a href={profile.youtube.startsWith('http') ? profile.youtube : `https://youtube.com/${profile.youtube}`} target="_blank" rel="noopener noreferrer" className="upf-social-icon" title="YouTube">
                      <Youtube size={15} />
                    </a>
                  )}
                  {profile.other_link && (
                    <a href={profile.other_link.startsWith('http') ? profile.other_link : `https://${profile.other_link}`} target="_blank" rel="noopener noreferrer" className="upf-social-icon" title="Other Link">
                      <Globe size={15} />
                    </a>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation — identical to /profile ── */}
      <div className="profile-nav-tabs">
        <button className={`profile-nav-tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          Overview
        </button>
        <button className={`profile-nav-tab-btn ${activeTab === 'about' ? 'active' : ''}`} onClick={() => setActiveTab('about')}>
          About
        </button>
        <button className={`profile-nav-tab-btn ${activeTab === 'posts' ? 'active' : ''}`} onClick={() => setActiveTab('posts')}>
          Posts ({posts.length})
        </button>
        <button className={`profile-nav-tab-btn ${activeTab === 'achievements' ? 'active' : ''}`} onClick={() => setActiveTab('achievements')}>
          Achievements ({earnedBadges.length})
        </button>
        <button className={`profile-nav-tab-btn ${activeTab === 'comments' ? 'active' : ''}`} onClick={() => setActiveTab('comments')}>
          Comments ({comments.length})
        </button>
      </div>

      {/* ── Content Tabs ── */}
      <div className="upf-content">

        {/* ── Tab 1: Overview ── */}
        {activeTab === 'overview' && (
          <div className="profile-layout-rows-new">

            {/* About Card */}
            <div className="profile-card-new">
              <div className="profile-section-header">
                <h2 className="profile-card-title-new"><User size={16} /> About Me</h2>
              </div>
              {profile.about ? (
                <div className="profile-about-markdown">{profile.about}</div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.88rem' }}>
                  No about details provided yet.
                </p>
              )}
            </div>

            {/* Startup Interests Card */}
            <div className="profile-card-new">
              <div className="profile-section-header">
                <h2 className="profile-card-title-new"><Briefcase size={16} /> Startup Interests</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Looking For</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {profile.looking_for && profile.looking_for.length > 0 ? (
                      profile.looking_for.map((item: string) => (
                        <span key={item} className="profile-tag-pill" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-main)' }}>{item}</span>
                      ))
                    ) : <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preferred Roles</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {profile.preferred_roles && profile.preferred_roles.length > 0 ? (
                      profile.preferred_roles.map((item: string) => (
                        <span key={item} className="profile-tag-pill" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-main)' }}>{item}</span>
                      ))
                    ) : <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Availability</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: profile.availability ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    {profile.availability || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Work Preference</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: profile.work_preference ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    {profile.work_preference || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Projects Card */}
            <div className="profile-card-new">
              <div className="profile-section-header">
                <h2 className="profile-card-title-new"><Award size={16} /> Showcase Projects</h2>
              </div>
              {profile.projects && profile.projects.length > 0 ? (
                <div className="profile-projects-grid">
                  {profile.projects.slice(0, 3).map((proj: any, index: number) => (
                    <div key={index} className="profile-project-item-card">
                      <div>
                        <div className="profile-project-header">
                          <h3 className="profile-project-title">{proj.title}</h3>
                        </div>
                        {proj.description && <p className="profile-project-desc">{proj.description}</p>}
                        {proj.techStack && (
                          <div className="profile-project-tech-list">
                            {(Array.isArray(proj.techStack) ? proj.techStack : String(proj.techStack).split(',')).map((tech: string) => (
                              <span key={tech} className="profile-project-tech-tag">{tech.trim()}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="profile-project-links">
                        {proj.github && (
                          <a href={proj.github.startsWith('http') ? proj.github : `https://${proj.github}`} target="_blank" rel="noopener noreferrer" className="profile-project-link">
                            <Github size={12} /> Repo
                          </a>
                        )}
                        {proj.liveDemo && (
                          <a href={proj.liveDemo.startsWith('http') ? proj.liveDemo : `https://${proj.liveDemo}`} target="_blank" rel="noopener noreferrer" className="profile-project-link">
                            <ExternalLink size={12} /> Live Demo
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.88rem' }}>
                  No highlighted projects showcased yet.
                </p>
              )}
            </div>

            {/* Skills Card */}
            <div className="profile-card-new">
              <div className="profile-section-header">
                <h2 className="profile-card-title-new"><Award size={16} /> Skills &amp; Capabilities</h2>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                {profile.skills && profile.skills.length > 0 ? (
                  profile.skills.map((item: string) => (
                    <span key={item} className="profile-skill-tag-new">{item}</span>
                  ))
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.78rem', margin: 0 }}>No skills listed.</p>
                )}
              </div>
            </div>

            {/* Work Experience Card */}
            <div className="profile-card-new">
              <div className="profile-section-header">
                <h2 className="profile-card-title-new"><Briefcase size={16} /> Work Experience</h2>
              </div>
              {profile.experience && profile.experience.length > 0 ? (
                <div className="profile-experience-timeline-new">
                  {profile.experience.map((exp: any, index: number) => (
                    <div key={index} className="profile-experience-item-new">
                      <div className="profile-timeline-company-logo">
                        {exp.company ? exp.company.charAt(0).toUpperCase() : 'W'}
                      </div>
                      <div className="profile-experience-content">
                        <div className="profile-experience-title-row">
                          <div>
                            <h3 className="profile-experience-company-name">{exp.company}</h3>
                            <p className="profile-experience-role-title">{exp.role}</p>
                            <span className="profile-experience-dates">{exp.duration}</span>
                          </div>
                        </div>
                        {exp.description && <p className="profile-experience-description">{exp.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.88rem' }}>
                  No work experience listed yet.
                </p>
              )}
            </div>

          </div>
        )}

        {/* ── Tab 2: About ── */}
        {activeTab === 'about' && (
          <div className="profile-layout-rows-new">
            <div className="profile-card-new">
              <div className="profile-section-header">
                <h2 className="profile-card-title-new"><User size={16} /> About Me</h2>
              </div>
              {profile.about ? (
                <div className="profile-about-markdown" style={{ fontSize: '0.95rem' }}>{profile.about}</div>
              ) : profile.bio ? (
                <div className="profile-about-markdown">{profile.bio}</div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.88rem' }}>No about details provided.</p>
              )}
            </div>

            {/* Skills + Languages */}
            {((profile.skills && profile.skills.length > 0) || (profile.languages && profile.languages.length > 0)) && (
              <div className="profile-card-new">
                <div className="profile-section-header">
                  <h2 className="profile-card-title-new"><Award size={16} /> Skills &amp; Languages</h2>
                </div>
                {profile.skills && profile.skills.length > 0 && (
                  <div style={{ marginBottom: '0.85rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Skills</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                      {profile.skills.map((s: string) => <span key={s} className="profile-skill-tag-new">{s}</span>)}
                    </div>
                  </div>
                )}
                {profile.languages && profile.languages.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Languages</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {profile.languages.map((l: string) => <span key={l} className="profile-tag-pill">{l}</span>)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Social Links */}
            {(profile.github || profile.linkedin || profile.twitter || profile.youtube || profile.website || profile.other_link) && (
              <div className="profile-card-new">
                <div className="profile-section-header">
                  <h2 className="profile-card-title-new"><Globe size={16} /> Links &amp; Contact</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {profile.github && (
                    <a href={profile.github.startsWith('http') ? profile.github : `https://github.com/${profile.github}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', textDecoration: 'none', fontSize: '0.85rem' }}>
                      <Github size={16} /><span>{profile.github.replace(/^https?:\/\/(www\.)?/, '')}</span>
                    </a>
                  )}
                  {profile.linkedin && (
                    <a href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://linkedin.com/in/${profile.linkedin}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', textDecoration: 'none', fontSize: '0.85rem' }}>
                      <Linkedin size={16} /><span>{profile.linkedin.replace(/^https?:\/\/(www\.)?/, '')}</span>
                    </a>
                  )}
                  {profile.twitter && (
                    <a href={profile.twitter.startsWith('http') ? profile.twitter : `https://x.com/${profile.twitter}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', textDecoration: 'none', fontSize: '0.85rem' }}>
                      <Twitter size={16} /><span>{profile.twitter.replace(/^https?:\/\/(www\.)?/, '')}</span>
                    </a>
                  )}
                  {profile.youtube && (
                    <a href={profile.youtube.startsWith('http') ? profile.youtube : `https://youtube.com/${profile.youtube}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', textDecoration: 'none', fontSize: '0.85rem' }}>
                      <Youtube size={16} /><span>{profile.youtube.replace(/^https?:\/\/(www\.)?/, '')}</span>
                    </a>
                  )}
                  {profile.website && (
                    <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', textDecoration: 'none', fontSize: '0.85rem' }}>
                      <ExternalLink size={16} /><span>{profile.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
                    </a>
                  )}
                  {profile.other_link && (
                    <a href={profile.other_link.startsWith('http') ? profile.other_link : `https://${profile.other_link}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', textDecoration: 'none', fontSize: '0.85rem' }}>
                      <Globe size={16} /><span>{profile.other_link.replace(/^https?:\/\/(www\.)?/, '')}</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 3: Posts ── */}
        {activeTab === 'posts' && (
          <div>
            <div className="profile-sub-filters">
              <button className={`profile-sub-filter-pill ${postSubFilter === 'all' ? 'active' : ''}`} onClick={() => setPostSubFilter('all')}>
                All Posts ({posts.length})
              </button>
              <button className={`profile-sub-filter-pill ${postSubFilter === 'problems' ? 'active' : ''}`} onClick={() => setPostSubFilter('problems')}>
                Problems ({problems.length})
              </button>
              <button className={`profile-sub-filter-pill ${postSubFilter === 'ideas' ? 'active' : ''}`} onClick={() => setPostSubFilter('ideas')}>
                Ideas ({ideas.length})
              </button>
              <button className={`profile-sub-filter-pill ${postSubFilter === 'startups' ? 'active' : ''}`} onClick={() => setPostSubFilter('startups')}>
                Startups ({startups.length})
              </button>
            </div>

            <div className="upf-list">
              {(() => {
                const filtered = posts.filter(p => {
                  if (postSubFilter === 'problems') return p.type === 'problem';
                  if (postSubFilter === 'ideas') return p.type === 'idea';
                  if (postSubFilter === 'startups') return p.type === 'startup';
                  return true;
                });

                if (filtered.length === 0) {
                  const icon = postSubFilter === 'problems' ? <BookOpen size={36} /> :
                    postSubFilter === 'ideas' ? <Lightbulb size={36} /> :
                      postSubFilter === 'startups' ? <Briefcase size={36} /> : <BookOpen size={36} />;
                  return (
                    <EmptyState icon={icon} text={`${name} hasn't posted any ${postSubFilter === 'all' ? 'posts' : postSubFilter} yet.`} />
                  );
                }

                return filtered.map((post) => (
                  <article key={post.id} className="upf-post-card" onClick={() => router.push(`/post/${post.slug || post.id}`)}>
                    <div className="upf-post-meta">
                      <span className={`sticker-tag ${post.type}`} style={{ marginLeft: 0 }}>
                        {post.type}
                      </span>
                      <span className="upf-date"><Calendar size={12} />{formatDate(post.created_at)}</span>
                    </div>
                    <Link href={`/post/${post.slug || post.id}`} className="upf-post-title" onClick={(e) => e.stopPropagation()}>{post.title}</Link>
                    {post.body && (
                      <p className="upf-post-body">{post.body.substring(0, 180)}{post.body.length > 180 ? '…' : ''}</p>
                    )}
                    {post.external_link && (
                      <a href={post.external_link} target="_blank" rel="noopener noreferrer" className="upf-ext-link" onClick={(e) => e.stopPropagation()} style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary)', textDecoration: 'none', margin: '4px 0 8px 0' }}>
                        <ExternalLink size={12} /> {post.link_name || post.external_link || 'Website'}
                      </a>
                    )}
                    <div className="upf-post-footer">
                      <span className="upf-post-stat">▲ {post.upvotes} upvotes</span>
                      <span className="upf-post-stat">💬 {post.comments_count} comments</span>
                    </div>
                  </article>
                ));
              })()}
            </div>
          </div>
        )}

        {/* ── Tab 4: Achievements ── */}
        {activeTab === 'achievements' && (
          <div className="profile-achievements-tab">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 className="profile-achievements-title" style={{ margin: 0 }}>Earned Badges ({earnedBadges.length})</h3>
            </div>

            {earnedBadges.length === 0 ? (
              <EmptyState icon={<Award size={36} />} text={`${name} hasn't unlocked any badges yet.`} />
            ) : (
              <div className="profile-badges-grid">
                {earnedBadges.map((badge) => {
                  const rConf = RARITY_CONFIG[badge.rarity] || { color: '#ffffff', glow: 'rgba(255,255,255,0.1)' };
                  return (
                    <div
                      key={badge.slug}
                      className="profile-badge-card"
                      style={{ '--rarity-color': rConf.color } as React.CSSProperties}
                      title={badge.description}
                    >
                      <div className="profile-badge-icon-wrapper">
                        <BadgeArtwork
                          slug={badge.slug}
                          rarity={badge.rarity}
                          category={badge.category as BadgeCategory}
                          size={70}
                          locked={false}
                          animated={true}
                        />
                      </div>
                      <span className="profile-badge-name">{badge.name}</span>
                      <span className="profile-badge-rarity" style={{ color: rConf.color, fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                        {badge.rarity}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab 5: Comments ── */}
        {activeTab === 'comments' && (
          <div className="upf-list">
            {comments.length === 0 ? (
              <EmptyState icon={<MessageSquare size={36} />} text={`${name} hasn't commented on any posts yet.`} />
            ) : (
              comments.map((c) => (
                <article key={c.id} className="upf-comment-card" style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <MessageSquare size={13} style={{ color: 'var(--text-muted)' }} />
                      <span>Commented on</span>
                      {c.post ? (
                        <Link href={`/post/${c.post.slug || c.post_id}`} style={{ fontWeight: 600, color: 'var(--accent-primary)', textDecoration: 'none' }} className="hover-underline">
                          {c.post.title || 'a post'}
                        </Link>
                      ) : (
                        <Link href={`/post/${c.post_id}`} style={{ fontWeight: 600, color: 'var(--accent-primary)', textDecoration: 'none' }} className="hover-underline">
                          Post #{c.post_id.substring(0, 8)}
                        </Link>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}><Calendar size={11} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />{formatDate(c.created_at)}</span>
                  </div>
                  <div style={{ borderLeft: '2px solid var(--border-color)', paddingLeft: '0.75rem', marginTop: '0.25rem', color: 'var(--text-main)', fontSize: '0.86rem', lineHeight: 1.5 }}>
                    {c.body}
                  </div>
                </article>
              ))
            )}
          </div>
        )}

      </div>

      {/* ── Followers / Following Modal ── */}
      {modalView && (
        <FollowModal
          view={modalView as 'followers' | 'following'}
          onClose={closeModal}
          onSwitchView={setModalView}
          followersList={followersList}
          followingList={followingList}
          followersCount={followersCount}
          followingCount={followingCount}
          name={name}
        />
      )}

      {/* ── Share Toast ── */}
      {shareToast && (
        <div style={{
          position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: '10px', padding: '0.65rem 1.25rem',
          fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          zIndex: 9999, display: 'flex', alignItems: 'center', gap: '0.5rem',
          animation: 'upf-card-in 0.2s ease',
        }}>
          <Check size={15} style={{ color: '#22c55e' }} /> Link copied!
        </div>
      )}

      {/* ── Image Lightbox ── */}
      {activeLightboxImg && (
        <div
          onClick={() => setActiveLightboxImg(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out', backdropFilter: 'blur(8px)',
            animation: 'upf-card-in 0.2s ease',
          }}
        >
          <img
            src={activeLightboxImg}
            alt="Preview"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw', maxHeight: '90vh',
              borderRadius: '12px',
              boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
              objectFit: 'contain',
            }}
          />
          <button
            onClick={() => setActiveLightboxImg(null)}
            style={{
              position: 'absolute', top: '1.25rem', right: '1.25rem',
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '50%', width: '40px', height: '40px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff',
              backdropFilter: 'blur(4px)',
            }}
            title="Close"
          >✕</button>
        </div>
      )}
    </div>
  );
}
