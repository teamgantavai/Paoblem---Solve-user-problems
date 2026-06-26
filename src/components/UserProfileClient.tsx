'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  UserCheck, UserPlus, MessageCircle, MapPin, Briefcase,
  ArrowUp, MessageSquare, Lightbulb, BookOpen, Users, Heart,
  ExternalLink, ChevronRight, Calendar, Award, User, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

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
  external_link?: string | null;
  link_name?: string | null;
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

type Tab = 'problems' | 'ideas' | 'solutions' | 'comments' | 'startups';
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

const ProfileAvatar = ({
  src,
  name,
  className,
}: {
  src?: string | null;
  name: string;
  className: string;
}) => {
  const [failed, setFailed] = useState(false);

  const getAvatarColor = (str: string) => {
    const colors = [
      'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
      'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
      'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
      'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
      'linear-gradient(135deg, #f59e0b 0%, #eab308 100%)',
      'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const showImage = !!src && !failed;

  if (showImage) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className={className}
      />
    );
  }

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || name[0]?.toUpperCase() || '?';

  const isSmall = className.includes('upf-user-card-avatar');

  return (
    <div
      className={className}
      style={{
        background: getAvatarColor(name),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontWeight: 700,
        fontSize: isSmall ? '0.85rem' : '1.8rem',
        textShadow: '0 2px 4px rgba(0,0,0,0.15)',
        userSelect: 'none',
      }}
    >
      {isSmall ? (
        <User size={16} style={{ color: 'rgba(255,255,255,0.95)' }} />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};

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
  return (
    <Link href={`/user/${user.username}`} className="upf-user-card">
      <ProfileAvatar src={user.avatar_url} name={user.full_name || user.username || 'User'} className="upf-user-card-avatar" />
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
  view,
  onClose,
  onSwitchView,
  followersList,
  followingList,
  followersCount,
  followingCount,
  name,
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
  // Close on ESC
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

  const [activeTab, setActiveTab] = useState<Tab>('problems');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersList, setFollowersList] = useState<FollowUser[]>([]);
  const [followingList, setFollowingList] = useState<FollowUser[]>([]);
  const [listsLoaded, setListsLoaded] = useState(false);
  const [modalView, setModalView] = useState<ModalView>(null);

  const problems = posts.filter((p) => p.type === 'problem');
  const ideas = posts.filter((p) => p.type === 'idea');
  const startups = posts.filter((p) => p.type === 'startup');

  const name = profile.full_name || profile.username || 'Unknown';
  const isOwnProfile = currentUserId === profile.id;

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
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setModalView(null);
    document.body.style.overflow = '';
  };

  const handleFollow = async () => {
    if (followLoading) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }

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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          recipientId: profile.id,
          startOnly: true
        })
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
    } catch (error) {
      window.dispatchEvent(new CustomEvent('top-loader:finish'));
      router.push(`/chats?userId=${profile.id}`);
    }
  };

  const tabs: { key: Tab; label: string; count: number; icon: React.ReactNode }[] = [
    { key: 'problems', label: 'Problems', count: problems.length, icon: <BookOpen size={15} /> },
    { key: 'ideas', label: 'Ideas', count: ideas.length, icon: <Lightbulb size={15} /> },
    { key: 'startups', label: 'Startups', count: startups.length, icon: <Briefcase size={15} /> },
    { key: 'solutions', label: 'Solutions', count: solutions.length, icon: <Award size={15} /> },
    { key: 'comments', label: 'Comments', count: comments.length, icon: <MessageSquare size={15} /> },
  ];

  return (
    <div className="upf-root">
      {/* ── Cover + Avatar + Identity ─────────────────────────── */}
      <div className="upf-header-card">
        <div
          className="upf-cover"
          style={profile.cover_url ? { backgroundImage: `url(${profile.cover_url})` } : undefined}
        >
          <div className="upf-cover-overlay" />
        </div>

        <div className="upf-identity">
          {/* Avatar */}
          <div className="upf-avatar-wrap">
            <ProfileAvatar src={profile.avatar_url} name={name} className="upf-avatar" />
            <div className="upf-avatar-ring" />
          </div>

          {/* Info body */}
          <div className="upf-identity-body">
            {/* Name + Actions row */}
            <div className="upf-name-row">
              <div className="upf-name-group">
                <div className="upf-name-line">
                  <h1 className="upf-name">{name}</h1>
                  {/* Role badge inline with name */}
                  {profile.role && (
                    <span className="upf-role-badge">
                      <Briefcase size={11} /> {profile.role}
                    </span>
                  )}
                </div>
                <p className="upf-username">@{profile.username}</p>
              </div>

              {/* Action buttons */}
              {!isOwnProfile && currentUserId && (
                <div className="upf-actions">
                  <button
                    className={`upf-btn-follow ${isFollowing ? 'upf-btn-follow--active' : ''}`}
                    onClick={handleFollow}
                    disabled={followLoading}
                    aria-label={isFollowing ? 'Unfollow' : 'Follow'}
                  >
                    {isFollowing ? <UserCheck size={15} /> : <UserPlus size={15} />}
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button className="upf-btn-message" onClick={handleMessage} aria-label="Message">
                    <MessageCircle size={15} />
                    Message
                  </button>
                </div>
              )}
            </div>

            {/* Location */}
            {profile.location && (
              <p className="upf-location"><MapPin size={12} /> {profile.location}</p>
            )}

            {/* Bio */}
            {profile.bio && <p className="upf-bio">{profile.bio}</p>}

            {/* Website */}
            {profile.website && (
              <a href={profile.website} target="_blank" rel="noopener noreferrer" className="upf-website">
                <ExternalLink size={12} /> {profile.website.replace(/^https?:\/\//, '')}
              </a>
            )}

            {/* Stats bar */}
            <div className="upf-stats-bar">
              <div className="upf-stat">
                <span className="upf-stat-num">{stats.postCount}</span>
                <span className="upf-stat-label">Posts</span>
              </div>
              <div className="upf-stat-divider" />
              <div className="upf-stat">
                <span className="upf-stat-num">{stats.solutionCount}</span>
                <span className="upf-stat-label">Solutions</span>
              </div>
              <div className="upf-stat-divider" />
              <div className="upf-stat">
                <span className="upf-stat-num">{stats.totalUpvotes}</span>
                <span className="upf-stat-label">Upvotes</span>
              </div>
              <div className="upf-stat-divider" />
              <button
                className="upf-stat upf-stat--clickable"
                onClick={() => openModal('followers')}
                title="View followers"
              >
                <span className="upf-stat-num">{followersCount}</span>
                <span className="upf-stat-label">Followers</span>
              </button>
              <div className="upf-stat-divider" />
              <button
                className="upf-stat upf-stat--clickable"
                onClick={() => openModal('following')}
                title="View following"
              >
                <span className="upf-stat-num">{followingCount}</span>
                <span className="upf-stat-label">Following</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ───────────────────────────────────────── */}
      <div className="upf-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`upf-tab-btn ${activeTab === tab.key ? 'upf-tab-btn--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            <span className="upf-tab-label">{tab.label}</span>
            <span className="upf-tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* ── Tab Content ──────────────────────────────────────────── */}
      <div className="upf-content">

        {/* Problems Tab */}
        {activeTab === 'problems' && (
          <div className="upf-list">
            {problems.length === 0
              ? <EmptyState icon={<BookOpen size={36} />} text={`${name} hasn't posted any problems yet.`} />
              : problems.map((post) => (
                <article key={post.id} className="upf-post-card">
                  <div className="upf-post-meta">
                    <span className="upf-tag upf-tag--problem">Problem</span>
                    <span className="upf-date"><Calendar size={12} />{formatDate(post.created_at)}</span>
                  </div>
                  <Link href={`/post/${post.slug || post.id}`} className="upf-post-title">{post.title}</Link>
                  {post.body && (
                    <p className="upf-post-body">{post.body.substring(0, 180)}{post.body.length > 180 ? '…' : ''}</p>
                  )}
                  <div className="upf-post-footer">
                    <span className="upf-post-stat"><ArrowUp size={13} />{post.upvotes}</span>
                    <span className="upf-post-stat"><MessageSquare size={13} />{post.comments_count}</span>
                  </div>
                </article>
              ))
            }
          </div>
        )}

        {/* Ideas Tab */}
        {activeTab === 'ideas' && (
          <div className="upf-list">
            {ideas.length === 0
              ? <EmptyState icon={<Lightbulb size={36} />} text={`${name} hasn't shared any ideas yet.`} />
              : ideas.map((post) => (
                <article key={post.id} className="upf-post-card">
                  <div className="upf-post-meta">
                    <span className="upf-tag upf-tag--idea">Idea</span>
                    <span className="upf-date"><Calendar size={12} />{formatDate(post.created_at)}</span>
                  </div>
                  <Link href={`/post/${post.slug || post.id}`} className="upf-post-title">{post.title}</Link>
                  {post.body && (
                    <p className="upf-post-body">{post.body.substring(0, 180)}{post.body.length > 180 ? '…' : ''}</p>
                  )}
                  <div className="upf-post-footer">
                    <span className="upf-post-stat"><ArrowUp size={13} />{post.upvotes}</span>
                    <span className="upf-post-stat"><MessageSquare size={13} />{post.comments_count}</span>
                  </div>
                </article>
              ))
            }
          </div>
        )}

        {/* Startups Tab */}
        {activeTab === 'startups' && (
          <div className="upf-list">
            {startups.length === 0
              ? <EmptyState icon={<Briefcase size={36} />} text={`${name} hasn't posted any startups yet.`} />
              : startups.map((post) => (
                <article key={post.id} className="upf-post-card">
                  <div className="upf-post-meta">
                    <span className="upf-tag upf-tag--startup">Startup</span>
                    <span className="upf-date"><Calendar size={12} />{formatDate(post.created_at)}</span>
                  </div>
                  <Link href={`/post/${post.slug || post.id}`} className="upf-post-title">{post.title}</Link>
                  {post.body && (
                    <p className="upf-post-body">{post.body.substring(0, 180)}{post.body.length > 180 ? '…' : ''}</p>
                  )}
                  {post.external_link && (
                    <a href={post.external_link} target="_blank" rel="noopener noreferrer" className="upf-ext-link" style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary)', textDecoration: 'none', margin: '4px 0 8px 0' }}>
                      <ExternalLink size={12} /> {post.link_name || post.external_link || 'Website'}
                    </a>
                  )}
                  <div className="upf-post-footer">
                    <span className="upf-post-stat"><ArrowUp size={13} />{post.upvotes}</span>
                    <span className="upf-post-stat"><MessageSquare size={13} />{post.comments_count}</span>
                  </div>
                </article>
              ))
            }
          </div>
        )}

        {/* Solutions Tab */}
        {activeTab === 'solutions' && (
          <div className="upf-list">
            {solutions.length === 0
              ? <EmptyState icon={<Award size={36} />} text={`${name} hasn't proposed any solutions yet.`} />
              : solutions.map((sol) => (
                <article key={sol.id} className="upf-post-card">
                  <div className="upf-post-meta">
                    <span className="upf-tag upf-tag--solution">Solution</span>
                    <span className="upf-date"><Calendar size={12} />{formatDate(sol.created_at)}</span>
                  </div>
                  <Link href={`/solutions/${sol.id}`} className="upf-post-title">{sol.title}</Link>
                  {sol.problem && (
                    <Link href={`/post/${sol.problem.slug || sol.problem.id}`} className="upf-solution-problem">
                      <BookOpen size={12} /> Re: {sol.problem.title}
                    </Link>
                  )}
                  {sol.body && (
                    <p className="upf-post-body">{sol.body.substring(0, 200)}{sol.body.length > 200 ? '…' : ''}</p>
                  )}
                  {sol.external_link && (
                    <a href={sol.external_link} target="_blank" rel="noopener noreferrer" className="upf-ext-link">
                      <ExternalLink size={12} /> {sol.link_name || 'View Resource'}
                    </a>
                  )}
                  <div className="upf-post-footer">
                    <span className="upf-post-stat"><ArrowUp size={13} />{sol.upvotes}</span>
                    <span className="upf-post-stat"><MessageSquare size={13} />{sol.comments_count || 0}</span>
                  </div>
                </article>
              ))
            }
          </div>
        )}

        {/* Comments Tab */}
        {activeTab === 'comments' && (
          <div className="upf-list">
            {comments.length === 0
              ? <EmptyState icon={<MessageSquare size={36} />} text={`${name} hasn't commented yet.`} />
              : comments.map((c) => (
                <article key={c.id} className="upf-comment-card">
                  <div className="upf-post-meta">
                    <span className="upf-tag upf-tag--comment">Comment</span>
                    <span className="upf-date"><Calendar size={12} />{formatDate(c.created_at)}</span>
                  </div>
                  {c.post && (
                    <Link href={`/post/${c.post.slug || c.post_id}`} className="upf-comment-context">
                      <BookOpen size={12} /> On: {c.post.title || 'a post'}
                    </Link>
                  )}
                  <p className="upf-comment-body">{c.body}</p>
                </article>
              ))
            }
          </div>
        )}
      </div>

      {/* ── Followers / Following Modal ────────────────────────── */}
      {modalView && (
        <FollowModal
          view={modalView}
          onClose={closeModal}
          onSwitchView={setModalView}
          followersList={followersList}
          followingList={followingList}
          followersCount={followersCount}
          followingCount={followingCount}
          name={name}
        />
      )}
    </div>
  );
}
