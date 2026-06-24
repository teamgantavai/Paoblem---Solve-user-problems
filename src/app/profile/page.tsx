'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  MapPin, Pencil, MoreVertical, ChevronDown, ChevronUp, ChevronRight,
  Check, Camera, MessageCircle, MessageSquare, Phone, Loader2, ExternalLink,
  AlertTriangle, Lightbulb, Bookmark, Share2, User, UserPlus, UserMinus, LogOut, Settings,
  Sun, Moon, BarChart2, BookOpen, Award, Users, Heart, ArrowUp, Calendar
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PhotoEditorModal from '@/components/PhotoEditorModal';
import '../styles/profile-page.css';
import '../styles/user-profile.css';
import { useMicroAnimations } from '@/hooks/useMicroAnimations';

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
  username: string | null;
  cover_url?: string | null;
  created_at: string;
}

interface ProfileStats {
  postCount: number;
  commentCount: number;
  totalUpvotes: number;
  solutionCount?: number;
  problemCount?: number;
  ideaCount?: number;
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

/* ── Utilities ────────────────────────────────────────────── */
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function avatarUrl(profile: { id?: string; avatar_url?: string | null; username?: string | null }) {
  return profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.id || profile.username || 'guest'}`;
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="upf-empty">
      <div className="upf-empty-icon">{icon}</div>
      <p>{text}</p>
    </div>
  );
}

function UserCard({ user }: { user: any }) {
  return (
    <Link href={`/user/${user.username}`} className="upf-user-card">
      <img src={avatarUrl(user)} alt={user.full_name || user.username || 'User'} className="upf-user-card-avatar" />
      <div className="upf-user-card-info">
        <span className="upf-user-card-name">{user.full_name || user.username}</span>
        <span className="upf-user-card-role">@{user.username} {user.role ? `· ${user.role}` : ''}</span>
        {user.bio && <p className="upf-user-card-bio">{user.bio.substring(0, 80)}{user.bio.length > 80 ? '…' : ''}</p>}
      </div>
      <ChevronRight size={16} className="upf-user-card-arrow" />
    </Link>
  );
}

/* ────────────────────────────────────────────────────────
   Main Page Wrapper with Suspense
   ───────────────────────────────────────────────────────── */
export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Loader2 size={30} className="spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    }>
      <ProfilePageContent />
    </Suspense>
  );
}

function ProfilePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const targetUserId = searchParams.get('userId');

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

  // If viewing own profile and not signed in
  if (!session && !targetUserId) {
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

  return <ProfileView session={session} targetUserId={targetUserId} queryClient={queryClient} />;
}

/* ────────────────────────────────────────────────────────
   ProfileView
   ───────────────────────────────────────────────────────── */
function ProfileView({ session, targetUserId, queryClient }: { session: any; targetUserId: string | null; queryClient: any }) {
  const router = useRouter();
  const currentUserId = session?.user?.id;
  const isOwnProfile = !targetUserId || targetUserId === currentUserId;
  const displayUserId = isOwnProfile ? currentUserId : targetUserId;

  const [activeTab, setActiveTab] = useState<'problems' | 'ideas' | 'solutions' | 'comments' | 'followers' | 'following' | 'settings' | 'signout'>('problems');
  const [bioExpanded, setBioExpanded] = useState(false);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const rolePickerRef = useRef<HTMLDivElement>(null);

  // Follow lists
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [listsLoaded, setListsLoaded] = useState(false);

  const loadLists = async () => {
    if (listsLoaded || !displayUserId) return;
    setListsLoaded(true);
    const [fersRes, fingRes] = await Promise.all([
      fetch(`/api/follows/list?userId=${displayUserId}&type=followers`),
      fetch(`/api/follows/list?userId=${displayUserId}&type=following`),
    ]);
    if (fersRes.ok) { const d = await fersRes.json(); setFollowersList(d.users || []); }
    if (fingRes.ok) { const d = await fingRes.json(); setFollowingList(d.users || []); }
  };

  // Avatar upload states
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [tempAvatar, setTempAvatar] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Cover upload states
  const [coverUploading, setCoverUploading] = useState(false);
  const [tempCover, setTempCover] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // General Image Editor states
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorImgUrl, setEditorImgUrl] = useState('');
  const [editorType, setEditorType] = useState<'avatar' | 'cover'>('avatar');

  const handleAvatarClick = () => {
    if (isOwnProfile && !avatarUploading) {
      avatarInputRef.current?.click();
    }
  };

  const handleCoverClick = () => {
    if (isOwnProfile && !coverUploading) {
      coverInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Invalid file type. PNG, JPEG, GIF, or WEBP only.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size too large. Limit is 5MB.');
      return;
    }

    const localUrl = URL.createObjectURL(file);
    if (typeof window !== 'undefined') {
      window.location.hash = type;
    }
    setEditorImgUrl(localUrl);
    setEditorType(type);
    setEditorOpen(true);
    // Reset file input so same file can be selected again
    e.target.value = '';
  };

  const handleEditorSave = async (editedBlob: Blob) => {
    const isAvatar = editorType === 'avatar';
    if (isAvatar) {
      setAvatarUploading(true);
    } else {
      setCoverUploading(true);
    }

    try {
      const fileName = `${editorType}-${session.user.id}-${Date.now()}.jpg`;
      const filePath = `post-images/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('post-images')
        .upload(filePath, editedBlob, { cacheControl: '3600', contentType: 'image/jpeg', upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath);

      const updatePayload: Record<string, string> = {};
      if (isAvatar) {
        updatePayload.avatar_url = publicUrl;
        setTempAvatar(publicUrl);
      } else {
        updatePayload.cover_url = publicUrl;
        setTempCover(publicUrl);
      }

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(updatePayload),
      });

      if (!res.ok) {
        throw new Error(`Failed to update profile ${editorType}`);
      }

      await queryClient.invalidateQueries({ queryKey: ['profile', displayUserId] });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({ queryKey: ['chats-messages'] });
      await queryClient.invalidateQueries({ queryKey: ['messages'] });
      await queryClient.invalidateQueries({ queryKey: ['posts'] });

      // Update session metadata explicitly on auth client
      await supabase.auth.updateUser({
        data: updatePayload
      });
      // Fire event to notify SidebarLeft and Navbar
      window.dispatchEvent(new Event('profile-updated'));

      refetch();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to upload image.');
      if (isAvatar) setTempAvatar(null);
      else setTempCover(null);
    } finally {
      if (isAvatar) {
        setAvatarUploading(false);
      } else {
        setCoverUploading(false);
      }
    }
  };

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
    queryKey: ['profile', displayUserId],
    queryFn: async () => {
      const res = await fetch(`/api/profile?userId=${displayUserId}`, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load profile');
      return res.json() as Promise<{ profile: Profile; stats: ProfileStats }>;
    },
    enabled: !!displayUserId,
  });

  // Fetch follow state
  const { data: followData, refetch: refetchFollow } = useQuery({
    queryKey: ['follows', displayUserId, currentUserId],
    queryFn: async () => {
      const res = await fetch(`/api/follows?userId=${displayUserId}`, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load follow status');
      return res.json() as Promise<{ followersCount: number; followingCount: number; isFollowing: boolean }>;
    },
    enabled: !!displayUserId,
  });

  // Fetch user's posts
  const { data: userPosts = [] } = useQuery<UserPost[]>({
    queryKey: ['profile-posts', displayUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('id, title, body, type, upvotes, comments_count, created_at')
        .eq('user_id', displayUserId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!displayUserId,
  });

  // Fetch user's solutions
  const { data: userSolutions = [] } = useQuery<any[]>({
    queryKey: ['profile-solutions', displayUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solutions')
        .select('id, title, body, upvotes, comments_count, created_at, external_link, link_name, problem:problem_id(id, title, slug)')
        .eq('user_id', displayUserId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!displayUserId,
  });

  // Fetch user's comments
  const { data: userComments = [] } = useQuery<UserComment[]>({
    queryKey: ['profile-comments', displayUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('id, body, created_at, post_id')
        .eq('user_id', displayUserId)
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
    enabled: !!displayUserId,
  });

  // Fetch user's saved post IDs from localstorage
  const [savedIds, setSavedIds] = useState<string[]>([]);
  useEffect(() => {
    if (isOwnProfile) {
      const saved = localStorage.getItem('paoblem_saved_posts');
      if (saved) {
        try {
          setSavedIds(JSON.parse(saved));
        } catch { }
      }
    }
  }, [isOwnProfile]);

  // Fetch saved posts content
  const { data: savedPosts = [] } = useQuery<UserPost[]>({
    queryKey: ['profile-saved-posts', savedIds.join(',')],
    queryFn: async () => {
      if (savedIds.length === 0) return [];
      const { data, error } = await supabase
        .from('posts')
        .select('id, title, body, type, upvotes, comments_count, created_at')
        .in('id', savedIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isOwnProfile && savedIds.length > 0,
  });

  // Toggle follow mutation
  const toggleFollowMutation = useMutation({
    mutationFn: async () => {
      if (!session) {
        throw new Error('Please sign in to follow users');
      }
      const res = await fetch('/api/follows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ targetUserId: displayUserId }),
      });
      if (!res.ok) throw new Error('Failed to toggle follow');
      return res.json();
    },
    onMutate: async () => {
      const queryKey = ['follows', displayUserId, session?.user?.id];
      await queryClient.cancelQueries({ queryKey });
      const previousFollow = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        const nextFollowing = !old.isFollowing;
        return {
          ...old,
          isFollowing: nextFollowing,
          followersCount: Math.max(0, old.followersCount + (nextFollowing ? 1 : -1)),
        };
      });

      return { previousFollow };
    },
    onError: (err, variables, context) => {
      const queryKey = ['follows', displayUserId, session?.user?.id];
      if (context) {
        queryClient.setQueryData(queryKey, context.previousFollow);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['follows', displayUserId, session?.user?.id] });
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
      // Invalidate queries so feed posts/comments also show the updated role instantly!
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  const handleLogout = async () => {
    if (session?.user?.id) {
      try {
        await supabase.from('profiles').update({ online: false, last_seen: new Date().toISOString() }).eq('id', session.user.id);
      } catch (err) { }
    }
    await supabase.auth.signOut();
    router.push('/');
    window.location.reload();
  };

  const handleMessageUser = () => {
    // Navigate to chats page and open chat with this user
    router.push(`/chats?userId=${displayUserId}`);
  };

  const profile = profileData?.profile;
  const stats = profileData?.stats;

  if (isLoading) {
    return (
      <div className="profile-page-wrap" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <Loader2 size={28} className="spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      </div>
    );
  }

  const avatarSrc = tempAvatar || profile?.avatar_url || (isOwnProfile ? session?.user?.user_metadata?.avatar_url : null) || `https://api.dicebear.com/7.x/bottts/svg?seed=${displayUserId}`;
  const displayName = profile?.full_name || (isOwnProfile ? session?.user?.user_metadata?.full_name : null) || 'Member';
  const currentRole = profile?.role || 'Innovator';
  const roleClass = (() => {
    const normalized = currentRole.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
    return ['founder', 'developer', 'moderator', 'admin', 'problem-solver'].includes(normalized)
      ? `role-badge--${normalized}`
      : 'role-badge--default';
  })();
  const bio = profile?.bio || '';
  const location = profile?.location || '';

  const bioTruncated = bio.length > BIO_PREVIEW_LENGTH && !bioExpanded;
  const displayBio = bioTruncated ? bio.slice(0, BIO_PREVIEW_LENGTH) + '…' : bio;

  // Split posts into problems and ideas
  const problemsList = userPosts.filter(p => p.type === 'problem');
  const ideasList = userPosts.filter(p => p.type === 'idea');

  const coverSrc = tempCover || profile?.cover_url;

  return (
    <div className="upf-root" style={{ margin: '0 auto' }}>
      {/* ── Cover + Avatar + Actions ─────────────────────────────── */}
      <div className="upf-header-card">
        <div
          className="upf-cover"
          onClick={handleCoverClick}
          style={{
            cursor: isOwnProfile ? 'pointer' : 'default',
            backgroundImage: coverSrc ? `url(${coverSrc})` : undefined,
          }}
        >
          <div className="upf-cover-overlay" />
          {isOwnProfile && (
            <div className="cover-edit-overlay" style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0, 0, 0, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity 0.2s', zIndex: 10
            }}>
              <Camera size={24} color="white" />
              <span style={{ color: 'white', marginLeft: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>Change Cover</span>
            </div>
          )}
          {coverUploading && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20
            }}>
              <Loader2 size={24} className="spin" color="white" />
            </div>
          )}
          {isOwnProfile && (
            <input
              type="file"
              ref={coverInputRef}
              onChange={(e) => handleFileChange(e, 'cover')}
              accept="image/png, image/jpeg, image/gif, image/webp"
              style={{ display: 'none' }}
            />
          )}
        </div>

        <div className="upf-identity">
          <div
            className="upf-avatar-wrap"
            onClick={handleAvatarClick}
            style={{ cursor: isOwnProfile ? 'pointer' : 'default' }}
          >
            <img
              src={avatarSrc}
              alt={displayName}
              onError={(e) => { e.currentTarget.src = "https://api.dicebear.com/7.x/bottts/svg?seed=guest"; }}
              className="upf-avatar"
              style={{ opacity: avatarUploading ? 0.6 : 1, transition: 'opacity 0.2s' }}
            />
            <div className="upf-avatar-ring" />
            {isOwnProfile && (
              <div className="avatar-edit-overlay" style={{
                position: 'absolute', inset: -3,
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0, transition: 'opacity 0.2s', zIndex: 5
              }}>
                <Camera size={20} color="white" />
              </div>
            )}
            {avatarUploading && (
              <div style={{
                position: 'absolute', inset: -3,
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6
              }}>
                <Loader2 size={24} className="spin" color="white" />
              </div>
            )}
            {isOwnProfile && (
              <input
                type="file"
                ref={avatarInputRef}
                onChange={(e) => handleFileChange(e, 'avatar')}
                accept="image/png, image/jpeg, image/gif, image/webp"
                style={{ display: 'none' }}
              />
            )}
            <style dangerouslySetInnerHTML={{
              __html: `
              .upf-avatar-wrap:hover .avatar-edit-overlay { opacity: 1 !important; }
              .upf-cover:hover .cover-edit-overlay { opacity: 1 !important; }
            ` }} />
          </div>

          <div className="upf-identity-body">
            <div className="upf-name-row">
              <div>
                <h1 className="upf-name">{displayName}</h1>
                <p className="upf-username">@{profile?.username || 'member'}</p>
              </div>
            </div>

            {isOwnProfile && (
              <div className="upf-actions">
                <button onClick={() => setActiveTab('settings')} className="upf-btn-follow">
                  <Settings size={15} /> Edit Profile
                </button>
                <button onClick={() => router.push('/analytics')} className="upf-btn-message">
                  <BarChart2 size={15} /> Analytics
                </button>
              </div>
            )}

            {!isOwnProfile && (
              <div className="upf-actions">
                <button
                  className={`upf-btn-follow ${followData?.isFollowing ? 'upf-btn-follow--active' : ''}`}
                  onClick={() => toggleFollowMutation.mutate()}
                  disabled={toggleFollowMutation.isPending}
                >
                  {toggleFollowMutation.isPending ? (
                    <Loader2 size={14} className="spin" />
                  ) : followData?.isFollowing ? (
                    <>
                      <UserMinus size={15} /> Unfollow
                    </>
                  ) : (
                    <>
                      <UserPlus size={15} /> Follow
                    </>
                  )}
                </button>
                <button className="upf-btn-message" onClick={handleMessageUser}>
                  <MessageCircle size={15} /> Message
                </button>
              </div>
            )}

            <div style={{ position: 'relative', width: 'fit-content' }} ref={rolePickerRef}>
              <button
                className={`upf-role-badge ${roleClass}`}
                onClick={() => isOwnProfile && setRolePickerOpen(!rolePickerOpen)}
                style={{ cursor: isOwnProfile ? 'pointer' : 'default' }}
                title={isOwnProfile ? "Change your role tag" : undefined}
              >
                {isOwnProfile && (
                  updateRoleMutation.isPending ? (
                    <Loader2 size={11} className="spin" style={{ marginRight: '4px' }} />
                  ) : (
                    <Pencil size={11} style={{ marginRight: '4px' }} />
                  )
                )}
                {currentRole}
              </button>

              {isOwnProfile && rolePickerOpen && (
                <div className="profile-role-picker" style={{ position: 'absolute', top: '110%', left: 0, zIndex: 100 }}>
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

            {location && (
              <p className="upf-location"><MapPin size={12} /> {location}</p>
            )}

            {bio ? (
              <p className="upf-bio">
                {displayBio}
                {bio.length > BIO_PREVIEW_LENGTH && (
                  <button
                    className="profile-bio-see-more"
                    onClick={() => setBioExpanded(!bioExpanded)}
                    style={{ marginLeft: '0.4rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    {bioExpanded ? 'See less' : 'SEE MORE'}
                  </button>
                )}
              </p>
            ) : (
              isOwnProfile && (
                <p className="upf-bio" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No bio yet.{' '}
                  <button
                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '0.9rem', padding: 0, fontStyle: 'normal' }}
                    onClick={() => setActiveTab('settings')}
                  >
                    Add one
                  </button>
                </p>
              )
            )}

            <div className="upf-stats-bar">
              <div className="upf-stat">
                <span className="upf-stat-num">{stats?.postCount || 0}</span>
                <span className="upf-stat-label">Posts</span>
              </div>
              <div className="upf-stat-divider" />
              <div className="upf-stat">
                <span className="upf-stat-num">{stats?.solutionCount || 0}</span>
                <span className="upf-stat-label">Solutions</span>
              </div>
              <div className="upf-stat-divider" />
              <div className="upf-stat">
                <span className="upf-stat-num">{stats?.totalUpvotes || 0}</span>
                <span className="upf-stat-label">Upvotes</span>
              </div>
              <div className="upf-stat-divider" />
              <div className="upf-stat">
                <span className="upf-stat-num">{followData?.followersCount || 0}</span>
                <span className="upf-stat-label">Followers</span>
              </div>
              <div className="upf-stat-divider" />
              <div className="upf-stat">
                <span className="upf-stat-num">{followData?.followingCount || 0}</span>
                <span className="upf-stat-label">Following</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="upf-tabs">
        <button className={`upf-tab-btn ${activeTab === 'problems' ? 'upf-tab-btn--active' : ''}`} onClick={() => setActiveTab('problems')}>
          <BookOpen size={15} /> <span className="upf-tab-label">Problems</span>
          <span className="upf-tab-count">{problemsList.length}</span>
        </button>
        <button className={`upf-tab-btn ${activeTab === 'ideas' ? 'upf-tab-btn--active' : ''}`} onClick={() => setActiveTab('ideas')}>
          <Lightbulb size={15} /> <span className="upf-tab-label">Ideas</span>
          <span className="upf-tab-count">{ideasList.length}</span>
        </button>
        <button className={`upf-tab-btn ${activeTab === 'solutions' ? 'upf-tab-btn--active' : ''}`} onClick={() => setActiveTab('solutions')}>
          <Award size={15} /> <span className="upf-tab-label">Solutions</span>
          <span className="upf-tab-count">{userSolutions.length}</span>
        </button>
        <button className={`upf-tab-btn ${activeTab === 'comments' ? 'upf-tab-btn--active' : ''}`} onClick={() => setActiveTab('comments')}>
          <MessageSquare size={15} /> <span className="upf-tab-label">Comments</span>
          <span className="upf-tab-count">{userComments.length}</span>
        </button>
        <button className={`upf-tab-btn ${activeTab === 'followers' ? 'upf-tab-btn--active' : ''}`} onClick={() => { setActiveTab('followers'); loadLists(); }}>
          <Users size={15} /> <span className="upf-tab-label">Followers</span>
          <span className="upf-tab-count">{followData?.followersCount || 0}</span>
        </button>
        <button className={`upf-tab-btn ${activeTab === 'following' ? 'upf-tab-btn--active' : ''}`} onClick={() => { setActiveTab('following'); loadLists(); }}>
          <Heart size={15} /> <span className="upf-tab-label">Following</span>
          <span className="upf-tab-count">{followData?.followingCount || 0}</span>
        </button>
        {isOwnProfile && (
          <button className={`upf-tab-btn ${activeTab === 'settings' ? 'upf-tab-btn--active' : ''}`} onClick={() => setActiveTab('settings')} style={{ marginLeft: 'auto' }}>
            <Settings size={15} /> <span className="upf-tab-label">Settings</span>
          </button>
        )}
      </div>

      <div className="upf-content">
        {activeTab === 'problems' && (
          <div className="upf-list">
            {problemsList.length === 0
              ? <EmptyState icon={<BookOpen size={36} />} text={`${displayName} hasn't posted any problems yet.`} />
              : problemsList.map((post) => (
                <article key={post.id} className="upf-post-card">
                  <div className="upf-post-meta">
                    <span className="upf-tag upf-tag--problem">Problem</span>
                    <span className="upf-date"><Calendar size={12} />{formatDate(post.created_at)}</span>
                  </div>
                  <Link href={`/post/${post.id}`} className="upf-post-title">{post.title}</Link>
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

        {activeTab === 'ideas' && (
          <div className="upf-list">
            {ideasList.length === 0
              ? <EmptyState icon={<Lightbulb size={36} />} text={`${displayName} hasn't shared any ideas yet.`} />
              : ideasList.map((post) => (
                <article key={post.id} className="upf-post-card">
                  <div className="upf-post-meta">
                    <span className="upf-tag upf-tag--idea">Idea</span>
                    <span className="upf-date"><Calendar size={12} />{formatDate(post.created_at)}</span>
                  </div>
                  <Link href={`/post/${post.id}`} className="upf-post-title">{post.title}</Link>
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

        {activeTab === 'solutions' && (
          <div className="upf-list">
            {userSolutions.length === 0
              ? <EmptyState icon={<Award size={36} />} text={`${displayName} hasn't proposed any solutions yet.`} />
              : userSolutions.map((sol) => (
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

        {activeTab === 'comments' && (
          <div className="upf-list">
            {userComments.length === 0
              ? <EmptyState icon={<MessageSquare size={36} />} text={`${displayName} hasn't commented yet.`} />
              : userComments.map((c) => (
                <article key={c.id} className="upf-comment-card">
                  <div className="upf-post-meta">
                    <span className="upf-tag upf-tag--comment">Comment</span>
                    <span className="upf-date"><Calendar size={12} />{formatDate(c.created_at)}</span>
                  </div>
                  {c.post_title && (
                    <Link href={`/post/${c.post_id}`} className="upf-comment-context">
                      <BookOpen size={12} /> On: {c.post_title || 'a post'}
                    </Link>
                  )}
                  <p className="upf-comment-body">{c.body}</p>
                </article>
              ))
            }
          </div>
        )}

        {activeTab === 'followers' && (
          <div className="upf-follow-grid">
            {followersList.length === 0
              ? <EmptyState icon={<Users size={36} />} text={`${displayName} has no followers yet.`} />
              : followersList.map((u) => <UserCard key={u.id} user={u} />)
            }
          </div>
        )}

        {activeTab === 'following' && (
          <div className="upf-follow-grid">
            {followingList.length === 0
              ? <EmptyState icon={<Heart size={36} />} text={`${displayName} isn't following anyone yet.`} />
              : followingList.map((u) => <UserCard key={u.id} user={u} />)
            }
          </div>
        )}

        {activeTab === 'settings' && isOwnProfile && (
          <SettingsTab session={session} profile={profile} onSaved={() => { refetch(); setActiveTab('problems'); }} />
        )}

        {activeTab === 'signout' && isOwnProfile && (
          <SignOutTab onLogout={handleLogout} />
        )}
      </div>

      <PhotoEditorModal
        isOpen={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          if (typeof window !== 'undefined') window.location.hash = '';
        }}
        imageUrl={editorImgUrl}
        onSave={handleEditorSave}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   About Tab
   ───────────────────────────────────────────────────────── */
function AboutTab({ bio, userComments, onAddBioClick }: { bio: string; userComments: UserComment[]; onAddBioClick: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="profile-about-section">
        <div className="profile-about-title">About Bio</div>
        {bio ? (
          <p className="profile-about-body">{bio}</p>
        ) : (
          <p className="profile-about-body" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No bio added yet.{' '}
            <button
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontStyle: 'normal', padding: 0 }}
              onClick={onAddBioClick}
            >
              Add bio in Settings.
            </button>
          </p>
        )}
      </div>

      <div className="profile-about-section">
        <div className="profile-about-title">Recent Comments ({userComments.length})</div>
        <CommentsTab comments={userComments} />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Problems / Ideas Tab Component
   ───────────────────────────────────────────────────────── */
function ProblemsTab({ posts, isSavedTab = false }: { posts: UserPost[]; isSavedTab?: boolean }) {
  const { animateListEntrance, animateCardHover, animateCardHoverOut } = useMicroAnimations();
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (posts.length > 0) {
      animateListEntrance(listRef, '.profile-post-card');
    }
  }, [posts.length, animateListEntrance]);

  if (posts.length === 0) {
    return (
      <div className="profile-empty-state card">
        <AlertTriangle size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
        <p>{isSavedTab ? 'No saved posts.' : 'No posts in this category yet.'}</p>
      </div>
    );
  }

  return (
    <div ref={listRef} className="profile-post-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
      {posts.map((post) => (
        <div
          key={post.id}
          className="card profile-post-card"
          onMouseEnter={animateCardHover}
          onMouseLeave={animateCardHoverOut}
          onClick={() => router.push(`/?post=${post.id}`)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span className={`sticker-tag ${post.type}`} style={{ marginLeft: 0 }}>
              {post.type === 'problem' ? 'Problem' : 'Idea'}
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <h3 className="profile-post-card-title">
            {post.title}
          </h3>
          <p className="profile-post-card-body">
            {post.body.length > 220 ? post.body.slice(0, 220) + '…' : post.body}
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
   Comments Sub-component
   ───────────────────────────────────────────────────────── */
function CommentsTab({ comments }: { comments: UserComment[] }) {
  const { animateListEntrance } = useMicroAnimations();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (comments.length > 0) {
      animateListEntrance(listRef, '.profile-comment-item-card');
    }
  }, [comments.length, animateListEntrance]);

  if (comments.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.875rem' }}>No recent comments.</p>
    );
  }

  return (
    <div ref={listRef} style={{ display: 'flex', flexDirection: 'column', gap: '0.50rem' }}>
      {comments.map((comment) => (
        <div key={comment.id} className="profile-comment-item-card">
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
   Settings Tab Component (Dedicated Settings Section)
   ───────────────────────────────────────────────────────── */
function SettingsTab({ session, profile, onSaved }: { session: any; profile?: Profile & { username?: string | null }; onSaved: () => void }) {
  const [fullName, setFullName] = useState(profile?.full_name || session?.user?.user_metadata?.full_name || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [username, setUsername] = useState(profile?.username || session?.user?.user_metadata?.username || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Load saved theme on mount
  React.useEffect(() => {
    const saved = localStorage.getItem('theme');
    setTheme(saved === 'light' ? 'light' : 'dark');
  }, []);

  const applyTheme = (next: 'dark' | 'light') => {
    setTheme(next);
    localStorage.setItem('theme', next);
    if (next === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  };

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
        body: JSON.stringify({ full_name: fullName, bio, location, username }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save settings');
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Appearance ── */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-main)' }}>
          Appearance
        </h3>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.85rem' }}>
          Theme
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {/* Dark Mode */}
          <button
            onClick={() => applyTheme('dark')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '1rem 0.75rem',
              borderRadius: '14px',
              border: theme === 'dark' ? '2px solid var(--accent-blue)' : '1.5px solid var(--border-color)',
              background: theme === 'dark' ? 'rgba(0, 132, 255, 0.06)' : 'var(--bg-hover)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative',
            }}
          >
            {theme === 'dark' && (
              <span style={{
                position: 'absolute', top: '8px', right: '8px',
                width: '18px', height: '18px', borderRadius: '50%',
                background: 'var(--accent-blue)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Check size={10} color="white" strokeWidth={3} />
              </span>
            )}
            {/* Dark preview */}
            <div style={{ width: '100%', height: '52px', borderRadius: '8px', background: '#0a0a0c', border: '1px solid #2a2a2e', overflow: 'hidden' }}>
              <div style={{ height: '10px', background: '#111113', borderBottom: '1px solid #1e1e21' }} />
              <div style={{ padding: '5px 8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ height: '5px', width: '60%', background: '#2a2a2e', borderRadius: '3px' }} />
                <div style={{ height: '4px', width: '80%', background: '#1e1e21', borderRadius: '3px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Moon size={13} style={{ color: theme === 'dark' ? 'var(--accent-blue)' : 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: theme === 'dark' ? 'var(--accent-blue)' : 'var(--text-muted)' }}>
                Dark
              </span>
            </div>
          </button>

          {/* Light Mode */}
          <button
            onClick={() => applyTheme('light')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '1rem 0.75rem',
              borderRadius: '14px',
              border: theme === 'light' ? '2px solid var(--accent-blue)' : '1.5px solid var(--border-color)',
              background: theme === 'light' ? 'rgba(0, 132, 255, 0.06)' : 'var(--bg-hover)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative',
            }}
          >
            {theme === 'light' && (
              <span style={{
                position: 'absolute', top: '8px', right: '8px',
                width: '18px', height: '18px', borderRadius: '50%',
                background: 'var(--accent-blue)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Check size={10} color="white" strokeWidth={3} />
              </span>
            )}
            {/* Light preview */}
            <div style={{ width: '100%', height: '52px', borderRadius: '8px', background: '#f8f9fa', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div style={{ height: '10px', background: '#ffffff', borderBottom: '1px solid #e5e7eb' }} />
              <div style={{ padding: '5px 8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ height: '5px', width: '60%', background: '#d1d5db', borderRadius: '3px' }} />
                <div style={{ height: '4px', width: '80%', background: '#e5e7eb', borderRadius: '3px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sun size={13} style={{ color: theme === 'light' ? 'var(--accent-blue)' : 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: theme === 'light' ? 'var(--accent-blue)' : 'var(--text-muted)' }}>
                Light
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* ── Profile Info Form ── */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-main)' }}>Profile Settings</h3>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="profile-edit-field">
            <label className="profile-edit-label">Username</label>
            <input
              className="profile-edit-input"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="username"
              maxLength={30}
              required
            />
          </div>
          <div className="profile-edit-field">
            <label className="profile-edit-label">Display Name</label>
            <input
              className="profile-edit-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your Name"
              maxLength={80}
              required
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
              placeholder="Introduce yourself to the community..."
              maxLength={500}
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right', display: 'block' }}>
              {bio.length}/500
            </span>
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '0.8rem' }}>{error}</p>
          )}

          <button type="submit" className="profile-save-btn" style={{ marginTop: '0.5rem' }} disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" style={{ margin: '0 auto' }} /> : 'Save Profile Details'}
          </button>
        </form>
      </div>
    </div>
  );
}


/* ────────────────────────────────────────────────────────
   Sign Out Tab Component (Dedicated Sign Out Section)
   ───────────────────────────────────────────────────────── */
function SignOutTab({ onLogout }: { onLogout: () => void }) {
  const router = useRouter();
  return (
    <div className="card" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
      <LogOut size={40} style={{ color: '#ef4444' }} />
      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>Confirm Sign Out</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: 360, lineHeight: '1.5' }}>
        Are you sure you want to sign out of your Paoblem session? You will need to sign back in to create posts, write comments, or receive updates.
      </p>
      <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '320px', marginTop: '0.5rem' }}>
        <button
          className="profile-action-btn"
          style={{ flex: 1 }}
          onClick={() => router.push('/')}
        >
          Cancel
        </button>
        <button
          className="profile-action-btn primary"
          style={{ flex: 1, backgroundColor: '#ef4444', borderColor: '#ef4444' }}
          onClick={onLogout}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
