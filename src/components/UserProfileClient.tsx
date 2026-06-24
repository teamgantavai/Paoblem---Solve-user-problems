'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  UserCheck, UserPlus, MessageCircle, MapPin, Briefcase,
  ArrowUp, MessageSquare, Lightbulb, BookOpen, Users, Heart,
  ExternalLink, ChevronRight, Calendar, Award, User
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import '../app/styles/user-profile.css';
import '../app/styles/profile-page.css';

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
  type: 'problem' | 'idea';
  upvotes: number;
  comments_count: number;
  created_at: string;
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

type Tab = 'problems' | 'ideas' | 'solutions' | 'comments' | 'followers' | 'following';

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

function avatarUrl(profile: { id?: string; avatar_url?: string | null; username?: string | null }) {
  return profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.id || profile.username}`;
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

  // Generate unique background gradient color based on the name/username
  const getAvatarColor = (str: string) => {
    const colors = [
      'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', // Indigo to Purple
      'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)', // Pink to Rose
      'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)', // Blue to Cyan
      'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)', // Emerald to Teal
      'linear-gradient(135deg, #f59e0b 0%, #eab308 100%)', // Amber to Yellow
      'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)', // Violet to Fuchsia
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
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

  // Draw user initials
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

  const problems = posts.filter((p) => p.type === 'problem');
  const ideas = posts.filter((p) => p.type === 'idea');

  const name = profile.full_name || profile.username || 'Unknown';
  const isOwnProfile = currentUserId === profile.id;

  // Auth & follow state
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) setCurrentUserId(session.user.id);
      // Fetch follow data
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

  // Load follow lists when tabs are opened
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

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'followers' || tab === 'following') loadLists();
  };

  const handleFollow = async () => {
    if (followLoading) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }

    // ── Optimistic update: flip UI immediately ──────────────────────
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
        // Roll back on error
        setIsFollowing(wasFollowing);
        setFollowersCount((c) => wasFollowing ? c + 1 : Math.max(0, c - 1));
      }
      // On success the optimistic state is already correct — no extra update needed
    } catch {
      // Network error — roll back
      setIsFollowing(wasFollowing);
      setFollowersCount((c) => wasFollowing ? c + 1 : Math.max(0, c - 1));
    } finally {
      setFollowLoading(false);
    }
  };


  const handleMessage = () => router.push(`/chats?userId=${profile.id}`);

  const tabs: { key: Tab; label: string; count: number; icon: React.ReactNode }[] = [
    { key: 'problems', label: 'Problems', count: problems.length, icon: <BookOpen size={15} /> },
    { key: 'ideas', label: 'Ideas', count: ideas.length, icon: <Lightbulb size={15} /> },
    { key: 'solutions', label: 'Solutions', count: solutions.length, icon: <Award size={15} /> },
    { key: 'comments', label: 'Comments', count: comments.length, icon: <MessageSquare size={15} /> },
    { key: 'followers', label: 'Followers', count: followersCount, icon: <Users size={15} /> },
    { key: 'following', label: 'Following', count: followingCount, icon: <Heart size={15} /> },
  ];

  return (
    <div className="upf-root">
      {/* ── Cover + Avatar + Actions ─────────────────────────────── */}
      <div className="upf-header-card">
        <div
          className="upf-cover"
          style={profile.cover_url ? { backgroundImage: `url(${profile.cover_url})` } : undefined}
        >
          <div className="upf-cover-overlay" />
        </div>

        <div className="upf-identity">
          <div className="upf-avatar-wrap">
            <ProfileAvatar src={profile.avatar_url} name={name} className="upf-avatar" />
            <div className="upf-avatar-ring" />
          </div>

          <div className="upf-identity-body">
            <div className="upf-name-row">
              <div>
                <h1 className="upf-name">{name}</h1>
                <p className="upf-username">@{profile.username}</p>
              </div>
            </div>
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

            {profile.role && (
              <span className="upf-role-badge">
                <Briefcase size={11} /> {profile.role}
              </span>
            )}
            {profile.location && (
              <p className="upf-location"><MapPin size={12} /> {profile.location}</p>
            )}
            {profile.bio && <p className="upf-bio">{profile.bio}</p>}

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
              <div className="upf-stat">
                <span className="upf-stat-num">{followersCount}</span>
                <span className="upf-stat-label">Followers</span>
              </div>
              <div className="upf-stat-divider" />
              <div className="upf-stat">
                <span className="upf-stat-num">{followingCount}</span>
                <span className="upf-stat-label">Following</span>
              </div>
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
            onClick={() => handleTabChange(tab.key)}
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

        {/* Followers Tab */}
        {activeTab === 'followers' && (
          <div className="upf-follow-grid">
            {followersList.length === 0
              ? <EmptyState icon={<Users size={36} />} text={`${name} has no followers yet.`} />
              : followersList.map((u) => <UserCard key={u.id} user={u} />)
            }
          </div>
        )}

        {/* Following Tab */}
        {activeTab === 'following' && (
          <div className="upf-follow-grid">
            {followingList.length === 0
              ? <EmptyState icon={<Heart size={36} />} text={`${name} isn't following anyone yet.`} />
              : followingList.map((u) => <UserCard key={u.id} user={u} />)
            }
          </div>
        )}
      </div>
    </div>
  );
}
