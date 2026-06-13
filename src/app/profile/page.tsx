'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  MapPin, Pencil, MoreVertical, ChevronDown, ChevronUp,
  Check, Camera, MessageCircle, Phone, Loader2, ExternalLink,
  AlertTriangle, Lightbulb, Bookmark, Share2, User
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import '../styles/profile-page.css';

/* ── Constants ────────────────────────────────────────── */
const VALID_ROLES = [
  'Innovator', 'Founder', 'Builder', 'Developer',
  'Designer', 'Investor', 'Maker', 'Researcher',
];

const BIO_PREVIEW_LENGTH = 200;

/* ── Types ────────────────────────────────────────────── */
interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  bio: string | null;
  location: string | null;
  created_at: string;
}

interface ProfileStats {
  postCount: number;
  commentCount: number;
  totalUpvotes: number;
}

interface UserPost {
  id: string;
  title: string;
  body: string;
  type: 'problem' | 'idea';
  upvotes: number;
  comments_count: number;
  created_at: string;
}

interface UserComment {
  id: string;
  body: string;
  created_at: string;
  post_id: string;
  post_title?: string;
}

/* ────────────────────────────────────────────────────────
   Main Page
───────────────────────────────────────────────────────── */
export default function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Listen for auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setSessionLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (sessionLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Loader2 size={30} className="spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', gap: '1rem', textAlign: 'center', padding: '2rem' }}>
        <User size={48} style={{ color: 'var(--text-muted)' }} />
        <h2 style={{ fontWeight: 700, fontSize: '1.35rem' }}>Sign in to view your profile</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: 360 }}>Join the community of founders and innovators to manage your profile, problems and ideas.</p>
        <button
          className="profile-action-btn primary"
          onClick={() => router.push('/')}
        >
          Go to Home
        </button>
      </div>
    );
  }

  return <ProfileView session={session} queryClient={queryClient} />;
}

/* ────────────────────────────────────────────────────────
   ProfileView – rendered when logged in
───────────────────────────────────────────────────────── */
function ProfileView({ session, queryClient }: { session: any; queryClient: any }) {
  const userId = session.user.id;
  const [activeTab, setActiveTab] = useState<'profile' | 'problems' | 'comments'>('profile');
  const [bioExpanded, setBioExpanded] = useState(false);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const rolePickerRef = useRef<HTMLDivElement>(null);

  // Close role picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rolePickerRef.current && !rolePickerRef.current.contains(e.target as Node)) {
        setRolePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch profile + stats
  const { data: profileData, isLoading, refetch } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const res = await fetch(`/api/profile?userId=${userId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to load profile');
      return res.json() as Promise<{ profile: Profile; stats: ProfileStats }>;
    },
  });

  // Fetch user's posts
  const { data: userPosts = [] } = useQuery<UserPost[]>({
    queryKey: ['profile-posts', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('id, title, body, type, upvotes, comments_count, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch user's comments
  const { data: userComments = [] } = useQuery<UserComment[]>({
    queryKey: ['profile-comments', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('id, body, created_at, post_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return [];
      // Fetch post titles
      const postIds = [...new Set(data.map(c => c.post_id))];
      const { data: posts } = await supabase
        .from('posts')
        .select('id, title')
        .in('id', postIds);
      const postMap = new Map(posts?.map(p => [p.id, p.title]) ?? []);
      return data.map(c => ({ ...c, post_title: postMap.get(c.post_id) || '' }));
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async (role: string) => {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      return res.json();
    },
    onSuccess: () => {
      refetch();
      setRolePickerOpen(false);
    },
  });

  const profile = profileData?.profile;
  const stats = profileData?.stats;

  const avatarSrc = profile?.avatar_url ||
    session.user.user_metadata?.avatar_url ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`;

  const displayName = profile?.full_name ||
    session.user.user_metadata?.full_name ||
    'Member';

  const currentRole = profile?.role || session.user.user_metadata?.role || 'Innovator';
  const bio = profile?.bio || '';
  const location = profile?.location || '';

  const bioTruncated = bio.length > BIO_PREVIEW_LENGTH && !bioExpanded;
  const displayBio = bioTruncated ? bio.slice(0, BIO_PREVIEW_LENGTH) + '…' : bio;

  if (isLoading) {
    return (
      <div className="profile-page-wrap" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <Loader2 size={28} className="spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page-wrap">
      {/* ── Main Profile Card ── */}
      <div className="profile-main-card">
        {/* Cover Banner */}
        <div className="profile-cover">
          <div className="profile-cover-actions">
            <button
              className="profile-edit-btn"
              onClick={() => setEditModalOpen(true)}
            >
              <Pencil size={13} />
              Edit Profile
            </button>
            <button className="profile-cover-more-btn">
              <MoreVertical size={16} />
            </button>
          </div>
        </div>

        {/* Identity Section */}
        <div className="profile-identity-section">
          {/* Avatar */}
          <div className="profile-avatar-col">
            <div className="profile-full-avatar-wrap">
              <img
                src={avatarSrc}
                alt={displayName}
                className="profile-full-avatar"
              />
            </div>
          </div>

          {/* Info */}
          <div className="profile-info-col">
            {/* Name + Role tag */}
            <div className="profile-name-line">
              <span className="profile-full-name">{displayName}</span>

              {/* Editable Role Tag */}
              <div style={{ position: 'relative' }} ref={rolePickerRef}>
                <button
                  className="profile-role-tag"
                  onClick={() => setRolePickerOpen(!rolePickerOpen)}
                  title="Change your role tag"
                >
                  {updateRoleMutation.isPending ? (
                    <Loader2 size={10} className="spin" />
                  ) : (
                    <Pencil size={10} />
                  )}
                  {currentRole}
                </button>

                {/* Role Picker Dropdown */}
                {rolePickerOpen && (
                  <div className="profile-role-picker">
                    {VALID_ROLES.map((r) => (
                      <button
                        key={r}
                        className={`profile-role-option ${r === currentRole ? 'active' : ''}`}
                        onClick={() => updateRoleMutation.mutate(r)}
                        disabled={updateRoleMutation.isPending}
                      >
                        {r === currentRole && <Check size={12} />}
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Location */}
            {location && (
              <div className="profile-location-row">
                <MapPin size={13} />
                <span>{location}</span>
              </div>
            )}

            {/* Bio */}
            {bio && (
              <p className="profile-bio-text">
                {displayBio}
                {bio.length > BIO_PREVIEW_LENGTH && (
                  <button
                    className="profile-bio-see-more"
                    onClick={() => setBioExpanded(!bioExpanded)}
                    style={{ marginLeft: '0.4rem' }}
                  >
                    {bioExpanded ? 'See less' : 'SEE MORE'}
                    {bioExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                )}
              </p>
            )}

            {!bio && (
              <p className="profile-bio-text" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No bio yet.{' '}
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', fontSize: '0.875rem', padding: 0, fontStyle: 'normal' }}
                  onClick={() => setEditModalOpen(true)}
                >
                  Add one
                </button>
              </p>
            )}

            {/* Action Buttons */}
            <div className="profile-actions-row">
              <button className="profile-action-btn" onClick={() => setEditModalOpen(true)}>
                <Phone size={14} />
                Contact Info
              </button>
              <button className="profile-action-btn primary" onClick={() => setEditModalOpen(true)}>
                <MessageCircle size={14} />
                Edit Profile
              </button>
            </div>

            {/* Stats */}
            {stats && (
              <div className="profile-stats-row">
                <div className="profile-stat-item">
                  <span className="profile-stat-value">{stats.postCount}</span>
                  <span className="profile-stat-label">Posts</span>
                </div>
                <div className="profile-stat-item">
                  <span className="profile-stat-value">{stats.commentCount}</span>
                  <span className="profile-stat-label">Comments</span>
                </div>
                <div className="profile-stat-item">
                  <span className="profile-stat-value">{stats.totalUpvotes}</span>
                  <span className="profile-stat-label">Upvotes</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="profile-tabs">
          {(['profile', 'problems', 'comments'] as const).map((tab) => (
            <button
              key={tab}
              className={`profile-tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'profile' ? 'Profile' : tab === 'problems' ? 'Problems' : 'Comments'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="profile-tab-content">
          {activeTab === 'profile' && (
            <ProfileTab bio={bio} stats={stats} onEditClick={() => setEditModalOpen(true)} />
          )}
          {activeTab === 'problems' && (
            <ProblemsTab posts={userPosts} />
          )}
          {activeTab === 'comments' && (
            <CommentsTab comments={userComments} />
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <EditProfileModal
          session={session}
          profile={profile}
          onClose={() => setEditModalOpen(false)}
          onSaved={() => { refetch(); setEditModalOpen(false); }}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Profile Tab
───────────────────────────────────────────────────────── */
function ProfileTab({ bio, stats, onEditClick }: { bio: string; stats?: ProfileStats; onEditClick: () => void }) {
  return (
    <div>
      <div className="profile-about-section">
        <div className="profile-about-title">About</div>
        {bio ? (
          <p className="profile-about-body">{bio}</p>
        ) : (
          <p className="profile-about-body" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No bio added yet.{' '}
            <button
              style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', fontStyle: 'normal', padding: 0 }}
              onClick={onEditClick}
            >
              Edit profile to add one.
            </button>
          </p>
        )}
        <button
          className="profile-bio-see-more"
          style={{ marginTop: '0.75rem' }}
          onClick={onEditClick}
        >
          SEE MORE <ChevronDown size={12} />
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Problems Tab
───────────────────────────────────────────────────────── */
function ProblemsTab({ posts }: { posts: UserPost[] }) {
  if (posts.length === 0) {
    return (
      <div className="profile-empty-state">
        <AlertTriangle size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
        <p>No posts yet. Share your first problem or idea!</p>
      </div>
    );
  }

  return (
    <div className="profile-post-list">
      {posts.map((post) => (
        <div
          key={post.id}
          className="card"
          style={{ cursor: 'pointer', transition: 'border-color 0.2s' }}
          onClick={() => window.location.href = `/?post=${post.id}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span
              className={`sticker-tag ${post.type}`}
              style={{ marginLeft: 0 }}
            >
              {post.type === 'problem' ? 'Problem' : 'Idea'}
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
            {post.title}
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-body)', lineHeight: '1.6', margin: '0 0 0.75rem' }}>
            {post.body.length > 180 ? post.body.slice(0, 180) + '…' : post.body}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            <span>↑ {post.upvotes} upvotes</span>
            <span>💬 {post.comments_count} comments</span>
            <ExternalLink size={12} style={{ marginLeft: 'auto' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Comments Tab
───────────────────────────────────────────────────────── */
function CommentsTab({ comments }: { comments: UserComment[] }) {
  if (comments.length === 0) {
    return (
      <div className="profile-empty-state">
        <MessageCircle size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
        <p>No comments yet. Start engaging with the community!</p>
      </div>
    );
  }

  return (
    <div>
      {comments.map((comment) => (
        <div key={comment.id} className="profile-comment-item">
          {comment.post_title && (
            <div className="profile-comment-post-link">
              <ExternalLink size={11} />
              <span>on</span>
              <a href={`/?post=${comment.post_id}`}>{comment.post_title}</a>
            </div>
          )}
          <p className="profile-comment-body">{comment.body}</p>
          <div className="profile-comment-time">
            {new Date(comment.created_at).toLocaleDateString(undefined, {
              month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Edit Profile Modal
───────────────────────────────────────────────────────── */
function EditProfileModal({
  session,
  profile,
  onClose,
  onSaved,
}: {
  session: any;
  profile?: Profile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(
    profile?.full_name || session.user.user_metadata?.full_name || ''
  );
  const [bio, setBio] = useState(profile?.bio || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ full_name: fullName, bio, location }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        style={{ maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Edit Profile</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <form className="modal-body" onSubmit={handleSave}>
          <div className="profile-edit-field">
            <label className="profile-edit-label">Display Name</label>
            <input
              className="profile-edit-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              maxLength={80}
            />
          </div>
          <div className="profile-edit-field">
            <label className="profile-edit-label">Location</label>
            <input
              className="profile-edit-input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, Country"
              maxLength={80}
            />
          </div>
          <div className="profile-edit-field">
            <label className="profile-edit-label">Bio</label>
            <textarea
              className="profile-edit-textarea"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the community who you are..."
              maxLength={500}
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right', display: 'block' }}>
              {bio.length}/500
            </span>
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{error}</p>
          )}

          <button type="submit" className="profile-save-btn" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
