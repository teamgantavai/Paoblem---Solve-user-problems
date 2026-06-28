'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  MapPin, Pencil, ChevronRight,
  Check, Camera, Image, MessageCircle, MessageSquare, Loader2, ExternalLink,
  AlertTriangle, Lightbulb, User, UserPlus, UserMinus, LogOut, Settings,
  Sun, Moon, BarChart2, BookOpen, Award, Users, Heart, ArrowUp, Calendar, X,
  ShieldAlert, Briefcase, Trophy, Plus, Trash2, Globe, Lock, Share2
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import BadgeArtwork from '@/components/badges/BadgeArtwork';
import { RARITY_CONFIG, BADGE_DEFINITIONS } from '@/lib/badgeDefinitions';
import PhotoEditorModal from '@/components/PhotoEditorModal';
import { useMicroAnimations } from '@/hooks/useMicroAnimations';
import { ADMIN_EMAIL } from '@/lib/adminConstants';

/* ── Social Platform Custom Icons (Workaround for Lucide brand icons) ── */
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

/* ── Constants ────────────────────────────────────────── */
const VALID_ROLES = [
  'Innovator', 'Founder', 'Builder', 'Developer',
  'Designer', 'Investor', 'Maker', 'Researcher',
];

const SKILL_SUGGESTIONS = [
  'React', 'Next.js', 'Flutter', 'Python', 'AI', 'Machine Learning',
  'UI/UX', 'Product Design', 'Marketing', 'Sales', 'Finance', 'TypeScript',
  'Node.js', 'PostgreSQL', 'Golang', 'Rust', 'Cloud Computing', 'Web3'
];

const INTEREST_OPTIONS = [
  'AI', 'SaaS', 'Space', 'Healthcare', 'Education', 'Climate',
  'Robotics', 'FinTech', 'Gaming', 'Cybersecurity', 'Open Source', 'Web3'
];

const LOOKING_FOR_OPTIONS = [
  'Join a Startup', 'Find Team Members', 'Find a Co-founder',
  'Hire Talent', 'Internship', 'Freelance', 'Open Source'
];

const PREFERRED_ROLE_OPTIONS = [
  'Founder', 'AI Engineer', 'Frontend Developer', 'Backend Developer',
  'Full Stack Developer', 'Product Designer', 'Product Manager', 'Marketing', 'Sales'
];

const AVAILABILITY_OPTIONS = ['Full Time', 'Part Time', 'Weekends', 'Flexible'];
const WORK_PREFERENCE_OPTIONS = ['Remote', 'Hybrid', 'On-site'];

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
  reputation?: number | null;
  pref_receive_saves?: boolean;
  pref_receive_analytics?: boolean;
  pref_receive_solutions?: boolean;
  pref_receive_replies?: boolean;

  // Rich profile columns
  headline?: string | null;
  languages?: string[] | null;
  github?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  youtube?: string | null;
  other_link?: string | null;
  website?: string | null;
  about?: string | null;
  skills?: string[] | null;
  looking_for?: string[] | null;
  preferred_roles?: string[] | null;
  availability?: string | null;
  work_preference?: string | null;
  interests?: string[] | null;
  experience?: any[] | null;
  projects?: any[] | null;
  ai_summary?: string | null;
  ai_keywords?: string[] | null;
  last_ai_update?: string | null;
}

interface ProfileStats {
  postCount: number;
  commentCount: number;
  totalUpvotes: number;
  solutionCount?: number;
}

interface UserPost {
  id: string;
  title: string;
  body: string;
  type: 'problem' | 'idea' | 'startup';
  upvotes: number;
  comments_count: number;
  created_at: string;
  slug?: string | null;
  external_link?: string | null;
  link_name?: string | null;
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

  return <ProfileView session={session} setSession={setSession} targetUserId={targetUserId} queryClient={queryClient} />;
}

/* ── ProfileView ── */
function ProfileView({ session, setSession, targetUserId, queryClient }: { session: any; setSession: any; targetUserId: string | null; queryClient: any }) {
  const router = useRouter();
  const currentUserId = session?.user?.id;
  const isOwnProfile = !targetUserId || targetUserId === currentUserId;
  const displayUserId = isOwnProfile ? currentUserId : targetUserId;

  const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'solutions' | 'comments' | 'achievements' | 'settings' | 'projects' | 'about'>('overview');
  const [modalView, setModalView] = useState<'followers' | 'following' | null>(null);
  const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null);

  // Modular Edit Modals
  const [heroModalOpen, setHeroModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [skillsModalOpen, setSkillsModalOpen] = useState(false);
  const [startupInterestsModalOpen, setStartupInterestsModalOpen] = useState(false);
  const [experienceModalOpen, setExperienceModalOpen] = useState(false);
  const [selectedExperience, setSelectedExperience] = useState<any | null>(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

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

  const openModal = (view: 'followers' | 'following') => {
    loadLists();
    setModalView(view);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setModalView(null);
    document.body.style.overflow = '';
  };

  // Avatar/Cover Upload States
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [tempAvatar, setTempAvatar] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [coverUploading, setCoverUploading] = useState(false);
  const [tempCover, setTempCover] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorImgUrl, setEditorImgUrl] = useState('');
  const [editorType, setEditorType] = useState<'avatar' | 'cover'>('avatar');

  const handleAvatarClick = () => {
    if (isOwnProfile && !avatarUploading) {
      setActiveLightboxImg(null); // close lightbox so old photo doesn't show
      avatarInputRef.current?.click();
    }
  };

  const handleCoverClick = () => {
    if (isOwnProfile && !coverUploading) {
      setActiveLightboxImg(null); // close lightbox so old photo doesn't show
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
    setEditorImgUrl('');        // clear stale image first
    setEditorOpen(false);       // ensure modal is unmounted first
    // defer so React unmounts the old modal before mounting with new URL
    setTimeout(() => {
      setEditorImgUrl(localUrl);
      setEditorType(type);
      setEditorOpen(true);
    }, 0);
    e.target.value = '';
  };

  const handleEditorSave = async (editedBlob: Blob) => {
    const isAvatar = editorType === 'avatar';
    if (isAvatar) setAvatarUploading(true);
    else setCoverUploading(true);

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

      if (!res.ok) throw new Error(`Failed to update profile ${editorType}`);

      await queryClient.invalidateQueries({ queryKey: ['profile', displayUserId] });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({ queryKey: ['posts'] });

      // Update session metadata explicitly on auth client
      await supabase.auth.updateUser({ data: updatePayload });
      window.dispatchEvent(new Event('profile-updated'));
      refetch();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to upload image.');
      if (isAvatar) setTempAvatar(null);
      else setTempCover(null);
    } finally {
      if (isAvatar) setAvatarUploading(false);
      else setCoverUploading(false);
    }
  };

  // Fetch Profile & Stats
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

  // Fetch Follow State
  const { data: followData } = useQuery({
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

  // Fetch User's Posts
  const { data: userPosts = [] } = useQuery<UserPost[]>({
    queryKey: ['profile-posts', displayUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('id, title, body, type, upvotes, comments_count, created_at, slug, external_link, link_name')
        .eq('user_id', displayUserId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!displayUserId,
  });

  // Fetch User's Solutions
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

  // Fetch User's Comments
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
      const postIds = [...new Set(data.map(c => c.post_id))];
      const { data: posts } = await supabase.from('posts').select('id, title').in('id', postIds);
      const postMap = new Map(posts?.map(p => [p.id, p.title]) ?? []);
      return data.map(c => ({ ...c, post_title: postMap.get(c.post_id) || '' }));
    },
    enabled: !!displayUserId,
  });

  // Fetch User's Earned Badges
  const { data: userBadges = [] } = useQuery<any[]>({
    queryKey: ['profile-badges', displayUserId],
    queryFn: async () => {
      const res = await fetch(`/api/badges/user/${displayUserId}`);
      if (!res.ok) throw new Error('Failed to load user badges');
      const d = await res.json();
      return d.badges || [];
    },
    enabled: !!displayUserId,
  });

  const trustScore = React.useMemo(() => {
    return userBadges.reduce((total: number, ub: any) => {
      const badge = ub.badge_definitions;
      return badge ? total + (badge.rep_reward || 0) : total;
    }, 0);
  }, [userBadges]);

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

  const profile = profileData?.profile;
  const stats = profileData?.stats;

  // Filter lists
  const [postSubFilter, setPostSubFilter] = useState<'all' | 'problems' | 'ideas' | 'startups'>('all');
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuMobileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const clickedOutsideDesktop = !settingsMenuRef.current || !settingsMenuRef.current.contains(e.target as Node);
      const clickedOutsideMobile = !settingsMenuMobileRef.current || !settingsMenuMobileRef.current.contains(e.target as Node);
      if (clickedOutsideDesktop && clickedOutsideMobile) {
        setSettingsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Inline Settings States
  const [settingsUsername, setSettingsUsername] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsTheme, setSettingsTheme] = useState<'dark' | 'light'>('dark');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');

  const [prefReceiveSaves, setPrefReceiveSaves] = useState(true);
  const [prefReceiveAnalytics, setPrefReceiveAnalytics] = useState(true);
  const [prefReceiveSolutions, setPrefReceiveSolutions] = useState(true);
  const [prefReceiveReplies, setPrefReceiveReplies] = useState(true);

  const settingsUsernameChanged = !!session?.user?.user_metadata?.username_changed;

  useEffect(() => {
    if (profile) {
      setSettingsUsername(profile.username || '');
      setPrefReceiveSaves(profile.pref_receive_saves ?? true);
      setPrefReceiveAnalytics(profile.pref_receive_analytics ?? true);
      setPrefReceiveSolutions(profile.pref_receive_solutions ?? true);
      setPrefReceiveReplies(profile.pref_receive_replies ?? true);
    }
  }, [profile]);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    setSettingsTheme(saved === 'light' ? 'light' : 'dark');
  }, []);

  const applyThemeSettings = (next: 'dark' | 'light') => {
    setSettingsTheme(next);
    localStorage.setItem('theme', next);
    if (next === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    setSettingsError('');
    setSettingsSuccess('');
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          username: settingsUsername,
          pref_receive_saves: prefReceiveSaves,
          pref_receive_analytics: prefReceiveAnalytics,
          pref_receive_solutions: prefReceiveSolutions,
          pref_receive_replies: prefReceiveReplies
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save settings');
      }
      try {
        await supabase.auth.refreshSession();
      } catch (err) { }
      window.dispatchEvent(new Event('profile-updated'));
      queryClient.invalidateQueries({ queryKey: ['profile', displayUserId] });
      setSettingsSuccess('Preferences saved successfully!');
      setTimeout(() => setSettingsSuccess(''), 4000);
    } catch (err: any) {
      setSettingsError(err.message);
    } finally {
      setSettingsSaving(false);
    }
  };

  // Profile Completeness Score
  const readiness = React.useMemo(() => {
    if (!profile) return { score: 0, missing: [] };
    const items = [
      { name: 'Profile Photo', check: !!profile.avatar_url, weight: 10 },
      { name: 'Cover Image', check: !!profile.cover_url, weight: 5 },
      { name: 'Full Name', check: !!profile.full_name?.trim(), weight: 10 },
      { name: 'Headline', check: !!profile.headline?.trim(), weight: 10 },
      { name: 'Bio', check: !!profile.bio?.trim(), weight: 10 },
      { name: 'About Journey', check: !!profile.about?.trim(), weight: 10 },
      { name: 'Skills', check: Array.isArray(profile.skills) && profile.skills.length > 0, weight: 10 },
      { name: 'Work Experience', check: Array.isArray(profile.experience) && profile.experience.length > 0, weight: 10 },
      { name: 'Projects', check: Array.isArray(profile.projects) && profile.projects.length > 0, weight: 10 },
      { name: 'Startup Interests', check: (Array.isArray(profile.looking_for) && profile.looking_for.length > 0) || (Array.isArray(profile.preferred_roles) && profile.preferred_roles.length > 0) || !!profile.availability || !!profile.work_preference, weight: 10 },
      { name: 'Social Links', check: !!profile.github || !!profile.linkedin || !!profile.website || !!profile.twitter || !!profile.youtube || !!profile.other_link, weight: 5 }
    ];

    const score = items.reduce((sum, item) => sum + (item.check ? item.weight : 0), 0);
    const missing = items.filter(item => !item.check).map(item => item.name);
    return { score, missing };
  }, [profile]);

  const aiMatchScores = React.useMemo(() => {
    if (!profile) return { profileStrength: 0, founderMatch: 80, technicalMatch: 80, startupMatch: 80 };
    const baseStrength = readiness.score;
    const skillsList = Array.isArray(profile.skills) ? profile.skills : [];
    const lookingForList = Array.isArray(profile.looking_for) ? profile.looking_for : [];

    const isTech = skillsList.some(s => typeof s === 'string' && ['react', 'next.js', 'typescript', 'python', 'ai', 'supabase', 'flutter', 'backend', 'frontend', 'developer', 'engineer'].includes(s.toLowerCase()));
    const isFounder = (typeof profile.role === 'string' && profile.role.toLowerCase().includes('founder')) ||
      (typeof profile.headline === 'string' && profile.headline.toLowerCase().includes('founder')) ||
      lookingForList.some(l => typeof l === 'string' && l.toLowerCase().includes('founder'));

    return {
      profileStrength: baseStrength,
      founderMatch: isFounder ? 95 : 82,
      technicalMatch: isTech ? 92 : 80,
      startupMatch: profile.work_preference ? 90 : 85
    };
  }, [profile, readiness.score]);


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
  const coverSrc = tempCover || profile?.cover_url;

  const problemsList = userPosts.filter(p => p.type === 'problem');
  const ideasList = userPosts.filter(p => p.type === 'idea');
  const startupsList = userPosts.filter(p => p.type === 'startup');
  return (
    <div className="upf-root" style={{ margin: '0 auto', maxWidth: '1000px', padding: '1rem' }}>
      {isOwnProfile && (
        <>
          <input type="file" ref={avatarInputRef} onChange={(e) => handleFileChange(e, 'avatar')} accept="image/*" style={{ display: 'none' }} />
          <input type="file" ref={coverInputRef} onChange={(e) => handleFileChange(e, 'cover')} accept="image/*" style={{ display: 'none' }} />
        </>
      )}


      {/* ── Premium Hero Card ── */}
      <div className="upf-hero-card" id="section-intro">

        {/* Cover Banner */}
        <div
          className="upf-hero-cover"
          onClick={() => coverSrc && setActiveLightboxImg(coverSrc)}
          style={{
            backgroundImage: coverSrc ? `url(${coverSrc})` : undefined,
            cursor: coverSrc ? 'zoom-in' : 'default',
          }}
        >
          {/* Desktop hover: frosted glass button */}
          {isOwnProfile && (
            <div className="phero-cover-change-btn">
              <button
                onClick={(e) => { e.stopPropagation(); handleCoverClick(); }}
                type="button"
              >
                <Camera size={14} /> Change Cover
              </button>
            </div>
          )}

          {/* Mobile: always-visible circular cam button */}
          {isOwnProfile && (
            <button
              className="phero-cover-mobile-btn"
              onClick={(e) => { e.stopPropagation(); handleCoverClick(); }}
              type="button"
              title="Change cover photo"
            >
              <Camera size={15} />
            </button>
          )}

          {/* Cover uploading spinner */}
          {coverUploading && (
            <div className="phero-cover-uploading">
              <Loader2 size={24} className="spin" color="white" />
            </div>
          )}
        </div>

        {/* Identity Section */}
        <div className="upf-hero-identity">
          <div className="phero-identity-row">

            {/* Avatar Row Wrapper for Mobile Inline Layout */}
            <div className="upf-avatar-socials-row">
              {/* Avatar */}
              <div
                className="upf-hero-avatar-container"
                onClick={() => setActiveLightboxImg(avatarSrc)}
              >
                <img src={avatarSrc} alt={displayName} className="upf-hero-avatar" />

                {/* Desktop: hover overlay with "Change Photo" */}
                {isOwnProfile && (
                  <div
                    className="phero-avatar-hover-overlay"
                    onClick={(e) => { e.stopPropagation(); handleAvatarClick(); }}
                  >
                    <Camera size={18} />
                    <span>Change Photo</span>
                  </div>
                )}

                {/* Mobile: always-visible circular cam badge */}
                {isOwnProfile && (
                  <button
                    className="upf-avatar-camera-btn"
                    onClick={(e) => { e.stopPropagation(); handleAvatarClick(); }}
                    type="button"
                    title="Update profile picture"
                  >
                    <Camera size={13} />
                  </button>
                )}

                {/* Upload spinner */}
                {avatarUploading && (
                  <div className="phero-avatar-uploading">
                    <Loader2 size={18} className="spin" color="white" />
                  </div>
                )}
              </div>

              {/* Mobile Inline Socials */}
              <div className="upf-hero-socials-inline-mobile">
                {profile?.github && (
                  <a href={profile.github.startsWith('http') ? profile.github : `https://github.com/${profile.github}`} target="_blank" rel="noopener noreferrer" className="upf-social-icon" title="GitHub">
                    <Github size={15} />
                  </a>
                )}
                {profile?.linkedin && (
                  <a href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://linkedin.com/in/${profile.linkedin}`} target="_blank" rel="noopener noreferrer" className="upf-social-icon" title="LinkedIn">
                    <Linkedin size={15} />
                  </a>
                )}
                {profile?.twitter && (
                  <a href={profile.twitter.startsWith('http') ? profile.twitter : `https://x.com/${profile.twitter}`} target="_blank" rel="noopener noreferrer" className="upf-social-icon" title="Twitter/X">
                    <Twitter size={15} />
                  </a>
                )}
                {profile?.youtube && (
                  <a href={profile.youtube.startsWith('http') ? profile.youtube : `https://youtube.com/${profile.youtube}`} target="_blank" rel="noopener noreferrer" className="upf-social-icon" title="YouTube">
                    <Youtube size={15} />
                  </a>
                )}
                {profile?.other_link && (
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
                  <h1 className="upf-hero-name">
                    {displayName}
                  </h1>

                  <span className="upf-hero-username">@{profile?.username}</span>
                </div>

                {/* Action Buttons — own profile (Desktop) */}
                {isOwnProfile && (
                  <div className="phero-actions phero-actions-desktop" ref={settingsMenuRef} style={{ position: 'relative' }}>
                    <button
                      onClick={() => setHeroModalOpen(true)}
                      className="phero-btn phero-btn-primary"
                      type="button"
                    >
                      <Pencil size={13} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} /> Edit Profile
                    </button>
                    <button
                      className="phero-btn phero-btn-icon"
                      title="Analytics"
                      type="button"
                      onClick={() => router.push('/analytics')}
                    >
                      <BarChart2 size={14} />
                    </button>
                    <button
                      className="phero-btn phero-btn-icon"
                      title="Share profile"
                      type="button"
                      onClick={() => { if (navigator.share) { navigator.share({ title: displayName, url: window.location.href }); } else { navigator.clipboard?.writeText(window.location.href); } }}
                    >
                      <Share2 size={14} />
                    </button>
                    <button
                      className="phero-btn phero-btn-icon"
                      title="More options"
                      type="button"
                      onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
                    >
                      <Settings size={14} />
                    </button>

                    {settingsMenuOpen && (
                      <div className="settings-menu-dropdown-new">
                        <button className="settings-menu-item-new" onClick={() => { applyThemeSettings(settingsTheme === 'dark' ? 'light' : 'dark'); setSettingsMenuOpen(false); }}>
                          {settingsTheme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
                          Switch to {settingsTheme === 'dark' ? 'Light' : 'Dark'} Mode
                        </button>
                        <button className="settings-menu-item-new" onClick={() => { setStartupInterestsModalOpen(true); setSettingsMenuOpen(false); }}>
                          <Briefcase size={13} /> Edit Startup Interests
                        </button>
                        <button className="settings-menu-item-new" onClick={() => { setSkillsModalOpen(true); setSettingsMenuOpen(false); }}>
                          <Award size={13} /> Edit Skills & Tags
                        </button>
                        <button className="settings-menu-item-new" onClick={() => { setActiveTab('settings'); setSettingsMenuOpen(false); }}>
                          <Settings size={13} /> Settings & Notifications
                        </button>
                        <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
                        <button className="settings-menu-item-new" style={{ color: 'var(--accent-danger)' }} onClick={handleLogout}>
                          <LogOut size={13} /> Log Out
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons — own profile (Mobile) */}
                {isOwnProfile && (
                  <div className="phero-actions-mobile" ref={settingsMenuMobileRef} style={{ position: 'relative' }}>
                    <button
                      onClick={() => setHeroModalOpen(true)}
                      className="phero-btn-mobile-edit"
                      type="button"
                    >
                      <Pencil size={13} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} /> Edit Profile
                    </button>
                    <button
                      className="phero-btn-mobile-analytics"
                      type="button"
                      onClick={() => router.push('/analytics')}
                    >
                      <BarChart2 size={13} style={{ display: 'inline-block', verticalAlign: 'middle' }} /> Analytics
                    </button>
                    <button
                      className="phero-btn-mobile-settings"
                      title="More Options"
                      type="button"
                      onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
                    >
                      <Settings size={13} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                    </button>
                    <button
                      className="phero-btn-mobile-logout"
                      title="Log Out"
                      type="button"
                      onClick={handleLogout}
                    >
                      <LogOut size={13} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                    </button>

                    {settingsMenuOpen && (
                      <div className="settings-menu-dropdown-new">
                        <button className="settings-menu-item-new" onClick={() => { applyThemeSettings(settingsTheme === 'dark' ? 'light' : 'dark'); setSettingsMenuOpen(false); }}>
                          {settingsTheme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
                          Switch to {settingsTheme === 'dark' ? 'Light' : 'Dark'} Mode
                        </button>
                        <button className="settings-menu-item-new" onClick={() => { setStartupInterestsModalOpen(true); setSettingsMenuOpen(false); }}>
                          <Briefcase size={13} /> Edit Startup Interests
                        </button>
                        <button className="settings-menu-item-new" onClick={() => { setSkillsModalOpen(true); setSettingsMenuOpen(false); }}>
                          <Award size={13} /> Edit Skills & Tags
                        </button>
                        <button className="settings-menu-item-new" onClick={() => { setActiveTab('settings'); setSettingsMenuOpen(false); }}>
                          <Settings size={13} /> Settings & Notifications
                        </button>
                        <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
                        <button className="settings-menu-item-new" style={{ color: 'var(--accent-danger)' }} onClick={handleLogout}>
                          <LogOut size={13} /> Log Out
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Headline / Bio */}
              {profile?.headline ? (
                <p className="upf-hero-headline" style={{ margin: '0.5rem 0', fontSize: '0.92rem', color: 'var(--text-main)', fontWeight: 500 }}>{profile.headline}</p>
              ) : (
                <p className="upf-hero-headline" style={{ margin: '0.5rem 0', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.88rem' }}>
                  Founder building Paoblem • AI • Product Development
                </p>
              )}
              {profile?.bio && (
                <p className="upf-hero-bio" style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.88rem', color: 'var(--text-body)', lineHeight: 1.5 }}>{profile.bio.substring(0, 250)}</p>
              )}

              {/* Combined bottom details row (Meta, Stats, and Socials) */}
              <div className="phero-bottom-row-desktop">
                {/* Location + Website */}
                {(profile?.location || profile?.website) && (
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

                {/* Followers / Following counts */}
                <div className="phero-counts">
                  <span className="phero-count-item" onClick={() => openModal('followers')}>
                    <strong>{followData?.followersCount || 0}</strong> Followers
                  </span>
                  <span className="phero-counts-separator">•</span>
                  <span className="phero-count-item" onClick={() => openModal('following')}>
                    <strong>{followData?.followingCount || 0}</strong> Following
                  </span>
                </div>

                {/* Social Icons (Desktop only - hidden on mobile) */}
                <div className="upf-hero-socials">
                  {profile?.github && (
                    <a href={profile.github.startsWith('http') ? profile.github : `https://github.com/${profile.github}`} target="_blank" rel="noopener noreferrer" className="upf-social-icon" title="GitHub">
                      <Github size={15} />
                    </a>
                  )}
                  {profile?.linkedin && (
                    <a href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://linkedin.com/in/${profile.linkedin}`} target="_blank" rel="noopener noreferrer" className="upf-social-icon" title="LinkedIn">
                      <Linkedin size={15} />
                    </a>
                  )}
                  {profile?.twitter && (
                    <a href={profile.twitter.startsWith('http') ? profile.twitter : `https://x.com/${profile.twitter}`} target="_blank" rel="noopener noreferrer" className="upf-social-icon" title="Twitter/X">
                      <Twitter size={15} />
                    </a>
                  )}
                  {profile?.youtube && (
                    <a href={profile.youtube.startsWith('http') ? profile.youtube : `https://youtube.com/${profile.youtube}`} target="_blank" rel="noopener noreferrer" className="upf-social-icon" title="YouTube">
                      <Youtube size={15} />
                    </a>
                  )}
                  {profile?.other_link && (
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

      {/* ── Unified Top Navigation ── */}
      <div className="profile-nav-tabs">
        <button className={`profile-nav-tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          Overview
        </button>
        <button className={`profile-nav-tab-btn ${activeTab === 'about' ? 'active' : ''}`} onClick={() => setActiveTab('about')}>
          About
        </button>
        <button className={`profile-nav-tab-btn ${activeTab === 'posts' ? 'active' : ''}`} onClick={() => setActiveTab('posts')}>
          Posts ({userPosts.length})
        </button>
        <button className={`profile-nav-tab-btn ${activeTab === 'achievements' ? 'active' : ''}`} onClick={() => setActiveTab('achievements')}>
          Achievements ({userBadges.length})
        </button>
        <button className={`profile-nav-tab-btn ${activeTab === 'comments' ? 'active' : ''}`} onClick={() => setActiveTab('comments')}>
          Comments ({userComments.length})
        </button>
      </div>

      {/* ── Content View Blocks ── */}
      <div className="upf-content">

        {/* Tab 1: Overview (Structured Rich Profile - Stack of Rows) */}
        {activeTab === 'overview' && (
          <div className="profile-layout-rows-new">
            {/* Suggested For You (Completeness Stepper card) */}
            {readiness.score < 100 && readiness.missing.length > 0 && (() => {
              const missingItems = readiness.missing;
              const activeIndex = Math.min(suggestionIndex, Math.max(0, missingItems.length - 1));
              const activeItemName = missingItems[activeIndex];

              const getSuggestionDetail = (itemName: string) => {
                switch (itemName) {
                  case 'Profile Photo':
                    return { title: 'Add a profile photo', actionText: 'Add photo', onClick: () => handleAvatarClick() };
                  case 'Cover Image':
                    return { title: 'Add a cover banner', actionText: 'Add cover', onClick: () => handleCoverClick() };
                  case 'Full Name':
                    return { title: 'Add your full name', actionText: 'Add name', onClick: () => setHeroModalOpen(true) };
                  case 'Headline':
                    return { title: 'Add a professional headline', actionText: 'Add headline', onClick: () => setHeroModalOpen(true) };
                  case 'Bio':
                    return { title: 'Add a short bio', actionText: 'Add bio', onClick: () => setHeroModalOpen(true) };
                  case 'About Journey':
                    return { title: 'Write an about summary', actionText: 'Write summary', onClick: () => setAboutModalOpen(true) };
                  case 'Skills':
                    return { title: 'Add your skills', actionText: 'Add skills', onClick: () => setSkillsModalOpen(true) };
                  case 'Work Experience':
                    return { title: 'Add work experience', actionText: 'Add experience', onClick: () => { setSelectedExperience(null); setExperienceModalOpen(true); } };
                  case 'Projects':
                    return { title: 'Showcase a project', actionText: 'Add project', onClick: () => { setSelectedProject(null); setProjectModalOpen(true); } };
                  case 'Startup Interests':
                    return { title: 'Specify startup interests', actionText: 'Specify interests', onClick: () => setStartupInterestsModalOpen(true) };
                  case 'Social Links':
                    return { title: 'Link social accounts', actionText: 'Link socials', onClick: () => setHeroModalOpen(true) };
                  default:
                    return null;
                }
              };

              const suggestion = getSuggestionDetail(activeItemName);
              if (!suggestion) return null;

              return (
                <div className="profile-card-new" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Suggested For You</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {readiness.score}% Complete
                    </span>
                  </div>

                  <div className="profile-strength-bar-container" style={{ marginBottom: '0.85rem' }}>
                    <div className="profile-strength-bar-bg" style={{ margin: 0, flex: 1 }}>
                      <div className="profile-strength-bar-fill" style={{ width: `${readiness.score}%` }} />
                    </div>
                    {missingItems.length > 1 && (
                      <div className="profile-strength-nav-group" style={{ marginLeft: '0.5rem' }}>
                        <button
                          className="profile-strength-nav-btn"
                          title="Previous suggestion"
                          onClick={() => setSuggestionIndex((prev) => (prev - 1 + missingItems.length) % missingItems.length)}
                        >
                          &lt;
                        </button>
                        <button
                          className="profile-strength-nav-btn"
                          title="Next suggestion"
                          onClick={() => setSuggestionIndex((prev) => (prev + 1) % missingItems.length)}
                        >
                          &gt;
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="profile-suggestion-wizard-step" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>{suggestion.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {activeItemName === 'Profile Photo' && 'Make a great first impression with a clear avatar.'}
                      {activeItemName === 'Cover Image' && 'Personalize your profile with a background banner that reflects your style or project.'}
                      {activeItemName === 'Full Name' && 'Ensure other members can address you by name.'}
                      {activeItemName === 'Headline' && 'Summarize what you are building or your primary focus.'}
                      {activeItemName === 'Bio' && 'Write a brief description about your background or aspirations.'}
                      {activeItemName === 'About Journey' && 'Share your founder journey or technical details about your expertise.'}
                      {activeItemName === 'Skills' && 'Tag your technical stack or business capabilities.'}
                      {activeItemName === 'Work Experience' && 'Detail your past startups, software achievements, or company experience.'}
                      {activeItemName === 'Projects' && 'Highlight the code repository or web link to your creations.'}
                      {activeItemName === 'Startup Interests' && 'Tell us your role preferences and co-founder availability details.'}
                      {activeItemName === 'Social Links' && 'Help users connect with you on GitHub, LinkedIn, or Twitter.'}
                    </div>
                    <button onClick={suggestion.onClick} className="profile-suggestion-btn">
                      {suggestion.actionText}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* About card */}
            <div className="profile-card-new">
              <div className="profile-section-header">
                <h2 className="profile-card-title-new"><User size={16} /> About Me</h2>
                <button onClick={() => setAboutModalOpen(true)} className="profile-section-edit-btn" title="Edit About">
                  <Pencil size={13} />
                </button>
              </div>
              {profile?.about ? (
                <div className="profile-about-markdown">{profile.about}</div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.88rem' }}>
                  Introduce yourself! Click the edit button to add details about your journey, goals, interests, or background.
                </p>
              )}
            </div>

            {/* Startup Interests Card */}
            <div className="profile-card-new">
              <div className="profile-section-header">
                <h2 className="profile-card-title-new"><Briefcase size={16} /> Startup Interests</h2>
                <button onClick={() => setStartupInterestsModalOpen(true)} className="profile-section-edit-btn" title="Edit Startup Interests">
                  <Pencil size={13} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Looking For</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {profile?.looking_for && profile.looking_for.length > 0 ? (
                      profile.looking_for.map((item: string) => (
                        <span key={item} className="profile-tag-pill" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-main)' }}>{item}</span>
                      ))
                    ) : <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preferred Roles</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {profile?.preferred_roles && profile.preferred_roles.length > 0 ? (
                      profile.preferred_roles.map((item: string) => (
                        <span key={item} className="profile-tag-pill" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-main)' }}>{item}</span>
                      ))
                    ) : <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Availability</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: profile?.availability ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    {profile?.availability || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Work Preference</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: profile?.work_preference ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    {profile?.work_preference || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Showcase Projects Card */}
            <div className="profile-card-new">
              <div className="profile-section-header">
                <h2 className="profile-card-title-new"><Award size={16} /> Showcase Projects</h2>
                <button onClick={() => { setSelectedProject(null); setProjectModalOpen(true); }} className="profile-section-add-btn" title="Add Project">
                  <Plus size={16} />
                </button>
              </div>
              {profile?.projects && profile.projects.length > 0 ? (
                <div className="profile-projects-grid">
                  {profile.projects.slice(0, 3).map((proj: any, index: number) => (
                    <div key={index} className="profile-project-item-card">
                      <div>
                        <div className="profile-project-header">
                          <h3 className="profile-project-title">{proj.title}</h3>
                          <button
                            onClick={() => { setSelectedProject({ ...proj, index }); setProjectModalOpen(true); }}
                            className="profile-bio-see-more"
                            style={{ padding: '4px' }}
                          >
                            <Pencil size={12} />
                          </button>
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
                  No projects showcased yet. Click plus to showcase your creations.
                </p>
              )}
            </div>

            {/* Skills card */}
            <div className="profile-card-new">
              <div className="profile-section-header">
                <h2 className="profile-card-title-new"><Award size={16} /> Skills & Capabilities</h2>
                <button onClick={() => setSkillsModalOpen(true)} className="profile-section-edit-btn" title="Edit Skills">
                  <Pencil size={13} />
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                {profile?.skills && profile.skills.length > 0 ? (
                  profile.skills.map((item: string) => (
                    <span key={item} className="profile-skill-tag-new">{item}</span>
                  ))
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.78rem', margin: 0 }}>No skills listed yet.</p>
                )}
              </div>
            </div>

            {/* Work Experience Card */}
            <div className="profile-card-new">
              <div className="profile-section-header">
                <h2 className="profile-card-title-new"><Briefcase size={16} /> Work Experience</h2>
                <button onClick={() => { setSelectedExperience(null); setExperienceModalOpen(true); }} className="profile-section-add-btn" title="Add Experience">
                  <Plus size={16} />
                </button>
              </div>
              {profile?.experience && profile.experience.length > 0 ? (
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
                          <button
                            onClick={() => { setSelectedExperience({ ...exp, index }); setExperienceModalOpen(true); }}
                            className="profile-bio-see-more"
                            style={{ padding: '4px' }}
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                        {exp.description && <p className="profile-experience-description">{exp.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.88rem' }}>
                  No work experience listed yet. Add your startup projects or company experience.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: About (Separate tab for detailed view) */}
        {activeTab === 'about' && (
          <div className="profile-card-new">
            <div className="profile-section-header">
              <h2 className="profile-card-title-new"><User size={16} /> About Me</h2>
              <button onClick={() => setAboutModalOpen(true)} className="profile-section-edit-btn" title="Edit About">
                <Pencil size={13} />
              </button>
            </div>
            {profile?.about ? (
              <div className="profile-about-markdown" style={{ fontSize: '0.95rem' }}>{profile.about}</div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.88rem' }}>
                Introduce yourself! Click the edit button to add details about your journey, goals, interests, or background.
              </p>
            )}
          </div>
        )}

        {/* Tab 3: Projects (Separate tab for detailed grid) */}
        {activeTab === 'projects' && (
          <div className="profile-card-new">
            <div className="profile-section-header">
              <h2 className="profile-card-title-new"><Award size={16} /> Showcase Projects</h2>
              <button onClick={() => { setSelectedProject(null); setProjectModalOpen(true); }} className="profile-section-add-btn" title="Add Project">
                <Plus size={16} />
              </button>
            </div>
            {profile?.projects && profile.projects.length > 0 ? (
              <div className="profile-projects-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {profile.projects.map((proj: any, index: number) => (
                  <div key={index} className="profile-project-item-card">
                    <div>
                      <div className="profile-project-header">
                        <h3 className="profile-project-title">{proj.title}</h3>
                        <button
                          onClick={() => { setSelectedProject({ ...proj, index }); setProjectModalOpen(true); }}
                          className="profile-bio-see-more"
                          style={{ padding: '4px' }}
                        >
                          <Pencil size={12} />
                        </button>
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
              <EmptyState icon={<Award size={36} />} text="You haven't showcased any projects yet." />
            )}
          </div>
        )}        {/* Tab 2: Posts (Feed style list) */}
        {activeTab === 'posts' && (
          <div>
            <div className="profile-sub-filters">
              <button className={`profile-sub-filter-pill ${postSubFilter === 'all' ? 'active' : ''}`} onClick={() => setPostSubFilter('all')}>
                All Posts ({userPosts.length})
              </button>
              <button className={`profile-sub-filter-pill ${postSubFilter === 'problems' ? 'active' : ''}`} onClick={() => setPostSubFilter('problems')}>
                Problems ({problemsList.length})
              </button>
              <button className={`profile-sub-filter-pill ${postSubFilter === 'ideas' ? 'active' : ''}`} onClick={() => setPostSubFilter('ideas')}>
                Ideas ({ideasList.length})
              </button>
              <button className={`profile-sub-filter-pill ${postSubFilter === 'startups' ? 'active' : ''}`} onClick={() => setPostSubFilter('startups')}>
                Startups ({startupsList.length})
              </button>
            </div>

            <div className="upf-list">
              {(() => {
                const filtered = userPosts.filter(p => {
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
                    <EmptyState
                      icon={icon}
                      text={`You haven't posted any ${postSubFilter === 'all' ? 'posts' : postSubFilter} yet.`}
                    />
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

        {/* Tab 3: Solutions */}
        {activeTab === 'solutions' && (
          <div className="upf-list">
            {userSolutions.length === 0 ? (
              <EmptyState icon={<Award size={36} />} text="You haven't proposed any solutions yet." />
            ) : (
              userSolutions.map((sol) => (
                <article key={sol.id} className="upf-post-card" onClick={() => router.push(`/solutions/${sol.id}`)}>
                  <div className="upf-post-meta">
                    <span className="sticker-tag solution" style={{ marginLeft: 0 }}>Solution</span>
                    <span className="upf-date"><Calendar size={12} />{formatDate(sol.created_at)}</span>
                  </div>
                  <Link href={`/solutions/${sol.id}`} className="upf-post-title" onClick={(e) => e.stopPropagation()}>{sol.title}</Link>
                  {sol.problem && (
                    <Link href={`/post/${sol.problem.slug || sol.problem.id}`} className="upf-solution-problem" onClick={(e) => e.stopPropagation()} style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', display: 'inline-flex', gap: '3px', alignItems: 'center', margin: '0.2rem 0' }}>
                      Re: {sol.problem.title}
                    </Link>
                  )}
                  {sol.body && <p className="upf-post-body">{sol.body.substring(0, 200)}...</p>}
                  <div className="upf-post-footer">
                    <span className="upf-post-stat">▲ {sol.upvotes} upvotes</span>
                  </div>
                </article>
              ))
            )}
          </div>
        )}

        {/* Tab 4: Achievements */}
        {activeTab === 'achievements' && (
          <div className="profile-achievements-tab">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 className="profile-achievements-title" style={{ margin: 0 }}>Earned Badges ({userBadges.length})</h3>
              <button
                type="button"
                onClick={() => router.push('/achievements')}
                className="profile-sub-filter-pill active"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  border: '1.5px solid var(--border-color)',
                }}
              >
                View All Badges <ChevronRight size={14} />
              </button>
            </div>
            {userBadges.length === 0 ? (
              <EmptyState icon={<Award size={36} />} text="Unlock badges by contributing to the community!" />
            ) : (
              <div className="profile-badges-grid">
                {userBadges.map((ub) => {
                  const badge = ub.badge_definitions;
                  if (!badge) return null;
                  const rConf = RARITY_CONFIG[badge.rarity as keyof typeof RARITY_CONFIG] || { color: '#ffffff', glow: 'rgba(255,255,255,0.1)' };
                  return (
                    <div key={badge.slug} className="profile-badge-card" style={{ '--rarity-color': rConf.color } as React.CSSProperties} title={badge.description}>
                      <div className="profile-badge-icon-wrapper">
                        <BadgeArtwork slug={badge.slug} rarity={badge.rarity} category={badge.category} size={70} locked={false} animated={true} />
                      </div>
                      <span className="profile-badge-name">{badge.name}</span>
                      <span className="profile-badge-rarity" style={{ color: rConf.color, fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>
                        {badge.rarity}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Comments */}
        {activeTab === 'comments' && (
          <div className="upf-list">
            {userComments.length === 0 ? (
              <EmptyState icon={<MessageSquare size={36} />} text="You haven't commented on any posts yet." />
            ) : (
              userComments.map((c) => (
                <article key={c.id} className="upf-comment-card" style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <MessageSquare size={13} style={{ color: 'var(--text-muted)' }} />
                      <span>Commented on</span>
                      {c.post_title ? (
                        <Link href={`/post/${c.post_id}`} style={{ fontWeight: 600, color: 'var(--accent-primary)', textDecoration: 'none' }} className="hover-underline">
                          {c.post_title}
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

        {activeTab === 'settings' && (
          <div className="profile-section-card">
            <div className="profile-section-header" style={{ marginBottom: '1.5rem' }}>
              <h2 className="profile-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={18} /> Settings & Preferences
              </h2>
            </div>

            {settingsError && (
              <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', fontSize: '0.85rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                {settingsError}
              </div>
            )}

            {settingsSuccess && (
              <div style={{ padding: '0.75rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent-success)', fontSize: '0.85rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                {settingsSuccess}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

              {/* Theme Toggle */}
              <div className="profile-settings-row">
                <div className="profile-settings-info">
                  <h4 className="profile-settings-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {settingsTheme === 'dark' ? <Moon size={15} /> : <Sun size={15} />} Appearance
                  </h4>
                </div>
                <div className="profile-settings-control">
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => applyThemeSettings('dark')}
                      className={`profile-theme-toggle-btn ${settingsTheme === 'dark' ? 'active' : ''}`}
                    >
                      <Moon size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                      Dark
                    </button>
                    <button
                      onClick={() => applyThemeSettings('light')}
                      className={`profile-theme-toggle-btn ${settingsTheme === 'light' ? 'active' : ''}`}
                    >
                      <Sun size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                      Light
                    </button>
                  </div>
                </div>
              </div>

              {/* Push Notifications */}
              <div className="profile-settings-row">
                <div className="profile-settings-info">
                  <h4 className="profile-settings-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BarChart2 size={15} /> Push Notifications
                  </h4>
                </div>
                <div className="profile-settings-control">
                  <button
                    onClick={async () => {
                      if ('Notification' in window) {
                        const perm = await Notification.requestPermission();
                        if (perm === 'granted') {
                          setSettingsSuccess('Push notifications enabled!');
                        } else {
                          setSettingsError('Permission denied. Enable in browser settings.');
                        }
                        setTimeout(() => { setSettingsSuccess(''); setSettingsError(''); }, 3500);
                      } else {
                        setSettingsError('Your browser does not support notifications.');
                        setTimeout(() => setSettingsError(''), 3000);
                      }
                    }}
                    className="profile-action-btn"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <ShieldAlert size={13} /> Enable Notifications
                  </button>
                </div>
              </div>

              {/* Email Notifications */}
              <div className="profile-settings-row" style={{ borderBottom: 'none' }}>
                <div className="profile-settings-info">
                  <h4 className="profile-settings-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MessageSquare size={15} /> Email Notifications
                  </h4>
                </div>
                <div className="profile-settings-control">
                  <div className="profile-settings-checkbox-group">
                    <label className="profile-settings-checkbox-label">
                      <input type="checkbox" checked={prefReceiveSaves} onChange={(e) => setPrefReceiveSaves(e.target.checked)} />
                      Profile saves and highlights
                    </label>
                    <label className="profile-settings-checkbox-label">
                      <input type="checkbox" checked={prefReceiveAnalytics} onChange={(e) => setPrefReceiveAnalytics(e.target.checked)} />
                      Monthly view analytics
                    </label>
                    <label className="profile-settings-checkbox-label">
                      <input type="checkbox" checked={prefReceiveSolutions} onChange={(e) => setPrefReceiveSolutions(e.target.checked)} />
                      Solution feedback and updates
                    </label>
                    <label className="profile-settings-checkbox-label">
                      <input type="checkbox" checked={prefReceiveReplies} onChange={(e) => setPrefReceiveReplies(e.target.checked)} />
                      Replies to my comments and posts
                    </label>
                    <button
                      onClick={handleSaveSettings}
                      className="profile-action-btn primary"
                      disabled={settingsSaving}
                      style={{ marginTop: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%' }}
                    >
                      {settingsSaving ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
                      {settingsSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* ── Image Lightbox Modal ── */}
      {activeLightboxImg && (
        <div
          className="upf-modal-backdrop"
          onClick={() => setActiveLightboxImg(null)}
          style={{ zIndex: 9999, cursor: 'zoom-out', background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)' }}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              animation: 'lightboxScale 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activeLightboxImg}
              alt="Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                borderRadius: '12px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                border: '1px solid var(--border-color)',
                display: 'block'
              }}
            />
            <button
              onClick={() => setActiveLightboxImg(null)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── Photo Editor Modal ── */}
      {editorOpen && editorImgUrl && (
        <PhotoEditorModal
          isOpen={editorOpen}
          onClose={() => {
            setEditorOpen(false);
            setEditorImgUrl('');
            if (typeof window !== 'undefined') window.location.hash = '';
          }}
          imageUrl={editorImgUrl}
          onSave={handleEditorSave}
        />
      )}

      {/* ── Followers/Following Modal ── */}
      {modalView && (
        <div className="upf-modal-backdrop" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="upf-modal" role="dialog" aria-modal="true">
            <div className="upf-modal-header">
              <div className="upf-modal-tabs">
                <button className={`upf-modal-tab ${modalView === 'followers' ? 'upf-modal-tab--active' : ''}`} onClick={() => setModalView('followers')}>
                  Followers <span style={{ opacity: 0.6, marginLeft: 3 }}>{followData?.followersCount || 0}</span>
                </button>
                <button className={`upf-modal-tab ${modalView === 'following' ? 'upf-modal-tab--active' : ''}`} onClick={() => setModalView('following')}>
                  Following <span style={{ opacity: 0.6, marginLeft: 3 }}>{followData?.followingCount || 0}</span>
                </button>
              </div>
              <button className="upf-modal-close" onClick={closeModal} aria-label="Close">
                <X size={15} />
              </button>
            </div>
            <div className="upf-modal-body">
              {modalView === 'followers' && (
                followersList.length === 0 ? <EmptyState icon={<Users size={32} />} text="No followers yet." /> : followersList.map((u) => <UserCard key={u.id} user={u} />)
              )}
              {modalView === 'following' && (
                followingList.length === 0
                  ? <EmptyState icon={<Heart size={32} />} text={`${displayName} isn't following anyone yet.`} />
                  : followingList.map((u) => <UserCard key={u.id} user={u} />)
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Hero Modal ── */}
      <EditHeroModal
        isOpen={heroModalOpen}
        onClose={() => setHeroModalOpen(false)}
        profile={profile}
        session={session}
        onSaved={refetch}
        onTriggerAvatarUpload={handleAvatarClick}
        onTriggerCoverUpload={handleCoverClick}
      />

      {/* ── Edit About Modal ── */}
      <EditAboutModal
        isOpen={aboutModalOpen}
        onClose={() => setAboutModalOpen(false)}
        profile={profile}
        session={session}
        onSaved={refetch}
      />

      {/* ── Edit Skills Modal ── */}
      <EditSkillsModal
        isOpen={skillsModalOpen}
        onClose={() => setSkillsModalOpen(false)}
        profile={profile}
        session={session}
        onSaved={refetch}
      />

      {/* ── Edit Startup Interests Modal ── */}
      <EditStartupInterestsModal
        isOpen={startupInterestsModalOpen}
        onClose={() => setStartupInterestsModalOpen(false)}
        profile={profile}
        session={session}
        onSaved={refetch}
      />

      {/* ── Add/Edit Experience Modal ── */}
      <AddEditExperienceModal
        isOpen={experienceModalOpen}
        onClose={() => { setExperienceModalOpen(false); setSelectedExperience(null); }}
        profile={profile}
        session={session}
        experience={selectedExperience}
        onSaved={refetch}
      />

      {/* ── Add/Edit Project Modal ── */}
      <AddEditProjectModal
        isOpen={projectModalOpen}
        onClose={() => { setProjectModalOpen(false); setSelectedProject(null); }}
        profile={profile}
        session={session}
        project={selectedProject}
        onSaved={refetch}
      />

      {/* ── Settings Modal ── */}
      <EditProfileModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        session={session}
        profile={profile}
        onSaved={refetch}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Edit Hero Modal
   ───────────────────────────────────────────────────────── */
function EditHeroModal({
  isOpen,
  onClose,
  profile,
  session,
  onSaved,
  onTriggerAvatarUpload,
  onTriggerCoverUpload,
}: {
  isOpen: boolean;
  onClose: () => void;
  profile?: Profile;
  session: any;
  onSaved: () => void;
  onTriggerAvatarUpload: () => void;
  onTriggerCoverUpload: () => void;
}) {
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [headline, setHeadline] = useState(profile?.headline || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [website, setWebsite] = useState(profile?.website || '');
  const [github, setGithub] = useState(profile?.github || '');
  const [linkedin, setLinkedin] = useState(profile?.linkedin || '');
  const [twitter, setTwitter] = useState(profile?.twitter || '');
  const [youtube, setYoutube] = useState(profile?.youtube || '');
  const [otherLink, setOtherLink] = useState(profile?.other_link || '');
  const [languages, setLanguages] = useState(profile?.languages?.join(', ') || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setHeadline(profile.headline || '');
      setBio(profile.bio || '');
      setLocation(profile.location || '');
      setWebsite(profile.website || '');
      setGithub(profile.github || '');
      setLinkedin(profile.linkedin || '');
      setTwitter(profile.twitter || '');
      setYoutube(profile.youtube || '');
      setOtherLink(profile.other_link || '');
      setLanguages(profile.languages?.join(', ') || '');
    }
  }, [profile, isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const langsArray = languages.split(',').map(l => l.trim()).filter(Boolean);
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          full_name: fullName,
          headline,
          bio,
          location,
          website,
          github,
          linkedin,
          twitter,
          youtube,
          other_link: otherLink,
          languages: langsArray
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="admin-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 className="admin-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: 700 }}>
            <User size={18} /> Update Profile
          </h3>
          <button onClick={onClose} className="btn-admin" style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSave} style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div style={{ color: 'var(--accent-danger)', fontSize: '0.85rem' }}>{error}</div>}

          <div className="profile-edit-field">
            <label className="profile-edit-label">Profile Images</label>
            <div className="profile-images-edit-buttons">
              <button
                type="button"
                onClick={() => { onTriggerAvatarUpload(); onClose(); }}
                className="profile-theme-toggle-btn"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Camera size={14} /> Update Profile Photo
              </button>
              <button
                type="button"
                onClick={() => { onTriggerCoverUpload(); onClose(); }}
                className="profile-theme-toggle-btn"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Image size={14} /> Update Cover Banner
              </button>
            </div>
          </div>

          <div className="profile-edit-field">
            <label className="profile-edit-label">Full Name</label>
            <input className="profile-edit-input" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Your Name" maxLength={80} />
          </div>

          <div className="profile-edit-field">
            <label className="profile-edit-label">Headline</label>
            <input className="profile-edit-input" value={headline} onChange={e => setHeadline(e.target.value)} placeholder="e.g. Founder building Paoblem | AI & Product Development" />
          </div>

          <div className="profile-edit-field">
            <label className="profile-edit-label">Short Bio</label>
            <textarea className="profile-edit-textarea" value={bio} onChange={e => setBio(e.target.value)} placeholder="Short intro (max 250 characters)..." maxLength={250} style={{ minHeight: '60px' }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right', display: 'block' }}>{bio.length}/250</span>
          </div>

          <div className="profile-edit-field">
            <label className="profile-edit-label">Location</label>
            <input className="profile-edit-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" />
          </div>

          <div className="profile-edit-field">
            <label className="profile-edit-label">Languages (comma separated)</label>
            <input className="profile-edit-input" value={languages} onChange={e => setLanguages(e.target.value)} placeholder="English, Spanish, Hindi" />
          </div>

          <div className="profile-edit-field">
            <label className="profile-edit-label">Website</label>
            <input className="profile-edit-input" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yourwebsite.com" />
          </div>

          <div className="profile-edit-field">
            <label className="profile-edit-label">GitHub Username / URL</label>
            <input className="profile-edit-input" value={github} onChange={e => setGithub(e.target.value)} placeholder="github_username" />
          </div>

          <div className="profile-edit-field">
            <label className="profile-edit-label">LinkedIn Username / URL</label>
            <input className="profile-edit-input" value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="linkedin_username" />
          </div>

          <div className="profile-edit-field">
            <label className="profile-edit-label">Twitter / X Username</label>
            <input className="profile-edit-input" value={twitter} onChange={e => setTwitter(e.target.value)} placeholder="twitter_username" />
          </div>

          <div className="profile-edit-field">
            <label className="profile-edit-label">YouTube Channel URL</label>
            <input className="profile-edit-input" value={youtube} onChange={e => setYoutube(e.target.value)} placeholder="https://youtube.com/c/yourchannel" />
          </div>

          <div className="profile-edit-field">
            <label className="profile-edit-label">Other Link</label>
            <input className="profile-edit-input" value={otherLink} onChange={e => setOtherLink(e.target.value)} placeholder="https://anotherlink.com" />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} className="upf-btn-message" style={{ border: '1px solid var(--border-color)', background: 'transparent' }} disabled={saving}>Cancel</button>
            <button type="submit" className="upf-btn-follow" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Edit About Modal
   ───────────────────────────────────────────────────────── */
function EditAboutModal({
  isOpen,
  onClose,
  profile,
  session,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  profile?: Profile;
  session: any;
  onSaved: () => void;
}) {
  const [about, setAbout] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setAbout(profile.about || '');
    }
  }, [profile, isOpen]);

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
        body: JSON.stringify({ about }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="admin-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', width: '95%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 className="admin-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: 700 }}>
            <User size={18} /> Edit About Me
          </h3>
          <button onClick={onClose} className="btn-admin" style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div style={{ color: 'var(--accent-danger)', fontSize: '0.85rem' }}>{error}</div>}

          <div className="profile-edit-field">
            <label className="profile-edit-label">Journey, Goals & Background</label>
            <textarea
              className="profile-edit-textarea"
              value={about}
              onChange={e => setAbout(e.target.value)}
              placeholder="Tell the community about your journey, interests, current focus, and what you're trying to build..."
              style={{ minHeight: '180px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="upf-btn-message" style={{ border: '1px solid var(--border-color)', background: 'transparent' }} disabled={saving}>Cancel</button>
            <button type="submit" className="upf-btn-follow" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Edit Skills Modal
   ───────────────────────────────────────────────────────── */
function EditSkillsModal({
  isOpen,
  onClose,
  profile,
  session,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  profile?: Profile;
  session: any;
  onSaved: () => void;
}) {
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [interestInput, setInterestInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setSkills(profile.skills || []);
      setInterests(profile.interests || []);
    }
  }, [profile, isOpen]);

  const addSkill = (skillName: string) => {
    const clean = skillName.trim();
    if (clean && !skills.includes(clean)) {
      setSkills([...skills, clean]);
    }
    setSkillInput('');
  };

  const removeSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const addInterest = (interestName: string) => {
    const clean = interestName.trim();
    if (clean && !interests.includes(clean)) {
      setInterests([...interests, clean]);
    }
    setInterestInput('');
  };

  const removeInterest = (index: number) => {
    setInterests(interests.filter((_, i) => i !== index));
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
        body: JSON.stringify({ skills, interests }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="admin-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 className="admin-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: 700 }}>
            <Award size={18} /> Edit Skills & Interests
          </h3>
          <button onClick={onClose} className="btn-admin" style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSave} style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && <div style={{ color: 'var(--accent-danger)', fontSize: '0.85rem' }}>{error}</div>}

          <div>
            <label className="profile-edit-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Skills</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <input
                className="profile-edit-input"
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput); } }}
                placeholder="Add a skill (press Enter)"
              />
              <button type="button" onClick={() => addSkill(skillInput)} className="upf-btn-follow" style={{ padding: '0.5rem 1rem' }}>Add</button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
              {SKILL_SUGGESTIONS.filter(s => !skills.includes(s)).slice(0, 8).map(s => (
                <button key={s} type="button" onClick={() => addSkill(s)} className="profile-tag-pill skill" style={{ background: 'transparent', cursor: 'pointer', borderStyle: 'dashed', opacity: 0.75 }}>
                  +{s}
                </button>
              ))}
            </div>

            <div className="interests-detail-tags" style={{ minHeight: '32px', padding: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--search-bg)' }}>
              {skills.length === 0 ? <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '0.25rem' }}>No skills added.</span> :
                skills.map((s, i) => (
                  <span key={s} className="profile-tag-pill skill" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {s}
                    <button type="button" onClick={() => removeSkill(i)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}>
                      <X size={10} />
                    </button>
                  </span>
                ))
              }
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
            <label className="profile-edit-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Interests</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <input
                className="profile-edit-input"
                value={interestInput}
                onChange={e => setInterestInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addInterest(interestInput); } }}
                placeholder="Add an interest (press Enter)"
              />
              <button type="button" onClick={() => addInterest(interestInput)} className="upf-btn-follow" style={{ padding: '0.5rem 1rem' }}>Add</button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
              {INTEREST_OPTIONS.filter(i => !interests.includes(i)).slice(0, 8).map(i => (
                <button key={i} type="button" onClick={() => addInterest(i)} className="profile-tag-pill interest" style={{ background: 'transparent', cursor: 'pointer', borderStyle: 'dashed', opacity: 0.75 }}>
                  +{i}
                </button>
              ))}
            </div>

            <div className="interests-detail-tags" style={{ minHeight: '32px', padding: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--search-bg)' }}>
              {interests.length === 0 ? <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '0.25rem' }}>No interests added.</span> :
                interests.map((it, i) => (
                  <span key={it} className="profile-tag-pill interest" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {it}
                    <button type="button" onClick={() => removeInterest(i)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}>
                      <X size={10} />
                    </button>
                  </span>
                ))
              }
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} className="upf-btn-message" style={{ border: '1px solid var(--border-color)', background: 'transparent' }} disabled={saving}>Cancel</button>
            <button type="submit" className="upf-btn-follow" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Edit Startup Interests Modal
   ───────────────────────────────────────────────────────── */
function EditStartupInterestsModal({
  isOpen,
  onClose,
  profile,
  session,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  profile?: Profile;
  session: any;
  onSaved: () => void;
}) {
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [preferredRoles, setPreferredRoles] = useState<string[]>([]);
  const [availability, setAvailability] = useState('');
  const [workPreference, setWorkPreference] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setLookingFor(profile.looking_for || []);
      setPreferredRoles(profile.preferred_roles || []);
      setAvailability(profile.availability || '');
      setWorkPreference(profile.work_preference || '');
    }
  }, [profile, isOpen]);

  const toggleLookingFor = (item: string) => {
    if (lookingFor.includes(item)) {
      setLookingFor(lookingFor.filter(x => x !== item));
    } else {
      setLookingFor([...lookingFor, item]);
    }
  };

  const togglePreferredRole = (item: string) => {
    if (preferredRoles.includes(item)) {
      setPreferredRoles(preferredRoles.filter(x => x !== item));
    } else {
      setPreferredRoles([...preferredRoles, item]);
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
        body: JSON.stringify({
          looking_for: lookingFor,
          preferred_roles: preferredRoles,
          availability: availability || null,
          work_preference: workPreference || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="admin-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 className="admin-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: 700 }}>
            <Briefcase size={18} /> Edit Startup Interests
          </h3>
          <button onClick={onClose} className="btn-admin" style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSave} style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && <div style={{ color: 'var(--accent-danger)', fontSize: '0.85rem' }}>{error}</div>}

          <div>
            <label className="profile-edit-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Looking For</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.50rem' }}>
              {LOOKING_FOR_OPTIONS.map(opt => (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                  <input
                    type="checkbox"
                    checked={lookingFor.includes(opt)}
                    onChange={() => toggleLookingFor(opt)}
                    style={{ width: '16px', height: '16px', borderRadius: '4px', accentColor: 'var(--accent-blue)' }}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
            <label className="profile-edit-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Preferred Roles</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.50rem' }}>
              {PREFERRED_ROLE_OPTIONS.map(opt => (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                  <input
                    type="checkbox"
                    checked={preferredRoles.includes(opt)}
                    onChange={() => togglePreferredRole(opt)}
                    style={{ width: '16px', height: '16px', borderRadius: '4px', accentColor: 'var(--accent-blue)' }}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="profile-edit-field">
              <label className="profile-edit-label">Availability</label>
              <select value={availability} onChange={e => setAvailability(e.target.value)} className="profile-edit-input" style={{ width: '100%', background: 'var(--search-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', outline: 'none' }}>
                <option value="">Select availability</option>
                {AVAILABILITY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div className="profile-edit-field">
              <label className="profile-edit-label">Work Preference</label>
              <select value={workPreference} onChange={e => setWorkPreference(e.target.value)} className="profile-edit-input" style={{ width: '100%', background: 'var(--search-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', outline: 'none' }}>
                <option value="">Select work preference</option>
                {WORK_PREFERENCE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} className="upf-btn-message" style={{ border: '1px solid var(--border-color)', background: 'transparent' }} disabled={saving}>Cancel</button>
            <button type="submit" className="upf-btn-follow" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Add/Edit Experience Modal
   ───────────────────────────────────────────────────────── */
function AddEditExperienceModal({
  isOpen,
  onClose,
  profile,
  session,
  experience,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  profile?: Profile;
  session: any;
  experience?: any | null;
  onSaved: () => void;
}) {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [duration, setDuration] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (experience) {
      setCompany(experience.company || '');
      setRole(experience.role || '');
      setDuration(experience.duration || '');
      setDescription(experience.description || '');
    } else {
      setCompany('');
      setRole('');
      setDuration('');
      setDescription('');
    }
  }, [experience, isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const list = Array.isArray(profile?.experience) ? [...profile.experience] : [];
      const item = { company, role, duration, description };

      if (experience && typeof experience.index === 'number') {
        list[experience.index] = item;
      } else {
        list.push(item);
      }

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ experience: list }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!experience || typeof experience.index !== 'number') return;
    if (!confirm('Are you sure you want to delete this experience item?')) return;
    setError('');
    setSaving(true);
    try {
      const list = Array.isArray(profile?.experience) ? [...profile.experience] : [];
      list.splice(experience.index, 1);
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ experience: list }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="admin-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', width: '95%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 className="admin-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: 700 }}>
            <Briefcase size={18} /> {experience ? 'Edit Work Experience' : 'Add Work Experience'}
          </h3>
          <button onClick={onClose} className="btn-admin" style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div style={{ color: 'var(--accent-danger)', fontSize: '0.85rem' }}>{error}</div>}

          <div className="profile-edit-field">
            <label className="profile-edit-label">Company Name</label>
            <input className="profile-edit-input" value={company} onChange={e => setCompany(e.target.value)} required placeholder="e.g. Acme Corp or Self-Employed" />
          </div>

          <div className="profile-edit-field">
            <label className="profile-edit-label">Role</label>
            <input className="profile-edit-input" value={role} onChange={e => setRole(e.target.value)} required placeholder="e.g. Co-founder & CTO or Software Engineer" />
          </div>

          <div className="profile-edit-field">
            <label className="profile-edit-label">Duration</label>
            <input className="profile-edit-input" value={duration} onChange={e => setDuration(e.target.value)} required placeholder="e.g. Jan 2024 - Present or June 2022 - Dec 2023" />
          </div>

          <div className="profile-edit-field">
            <label className="profile-edit-label">Description (Optional)</label>
            <textarea className="profile-edit-textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your achievements and key responsibilities..." style={{ minHeight: '90px' }} />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            {experience && (
              <button type="button" onClick={handleDelete} className="upf-btn-message danger" style={{ marginRight: 'auto', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-danger)' }} disabled={saving}>
                <Trash2 size={13} /> Delete
              </button>
            )}
            <button type="button" onClick={onClose} className="upf-btn-message" style={{ border: '1px solid var(--border-color)', background: 'transparent' }} disabled={saving}>Cancel</button>
            <button type="submit" className="upf-btn-follow" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Add/Edit Project Modal
   ───────────────────────────────────────────────────────── */
function AddEditProjectModal({
  isOpen,
  onClose,
  profile,
  session,
  project,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  profile?: Profile;
  session: any;
  project?: any | null;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [techStack, setTechStack] = useState('');
  const [github, setGithub] = useState('');
  const [liveDemo, setLiveDemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (project) {
      setTitle(project.title || '');
      setDescription(project.description || '');
      setTechStack(Array.isArray(project.techStack) ? project.techStack.join(', ') : project.techStack || '');
      setGithub(project.github || '');
      setLiveDemo(project.liveDemo || '');
    } else {
      setTitle('');
      setDescription('');
      setTechStack('');
      setGithub('');
      setLiveDemo('');
    }
  }, [project, isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const list = Array.isArray(profile?.projects) ? [...profile.projects] : [];
      const techArray = techStack.split(',').map(t => t.trim()).filter(Boolean);
      const item = { title, description, techStack: techArray, github, liveDemo };

      if (project && typeof project.index === 'number') {
        list[project.index] = item;
      } else {
        list.push(item);
      }

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ projects: list }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!project || typeof project.index !== 'number') return;
    if (!confirm('Are you sure you want to delete this project?')) return;
    setError('');
    setSaving(true);
    try {
      const list = Array.isArray(profile?.projects) ? [...profile.projects] : [];
      list.splice(project.index, 1);
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ projects: list }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="admin-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', width: '95%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 className="admin-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: 700 }}>
            <Award size={18} /> {project ? 'Edit Project' : 'Add Project'}
          </h3>
          <button onClick={onClose} className="btn-admin" style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div style={{ color: 'var(--accent-danger)', fontSize: '0.85rem' }}>{error}</div>}

          <div className="profile-edit-field">
            <label className="profile-edit-label">Project Title</label>
            <input className="profile-edit-input" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Paoblem or MyAwesomeApp" />
          </div>

          <div className="profile-edit-field">
            <label className="profile-edit-label">Project Description</label>
            <textarea className="profile-edit-textarea" value={description} onChange={e => setDescription(e.target.value)} required placeholder="What does this project do? Who is it for?..." style={{ minHeight: '90px' }} />
          </div>

          <div className="profile-edit-field">
            <label className="profile-edit-label">Tech Stack (comma separated)</label>
            <input className="profile-edit-input" value={techStack} onChange={e => setTechStack(e.target.value)} placeholder="React, Next.js, PostgreSQL" />
          </div>

          <div className="profile-edit-field">
            <label className="profile-edit-label">GitHub Repository URL</label>
            <input className="profile-edit-input" value={github} onChange={e => setGithub(e.target.value)} placeholder="https://github.com/username/project" />
          </div>

          <div className="profile-edit-field">
            <label className="profile-edit-label">Live Demo URL</label>
            <input className="profile-edit-input" value={liveDemo} onChange={e => setLiveDemo(e.target.value)} placeholder="https://myproject.com" />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            {project && (
              <button type="button" onClick={handleDelete} className="upf-btn-message danger" style={{ marginRight: 'auto', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-danger)' }} disabled={saving}>
                <Trash2 size={13} /> Delete
              </button>
            )}
            <button type="button" onClick={onClose} className="upf-btn-message" style={{ border: '1px solid var(--border-color)', background: 'transparent' }} disabled={saving}>Cancel</button>
            <button type="submit" className="upf-btn-follow" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Edit Settings / Profile Modal
   ───────────────────────────────────────────────────────── */
function EditProfileModal({
  isOpen,
  onClose,
  session,
  profile,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  session: any;
  profile?: Profile & { username?: string | null };
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(profile?.full_name || session?.user?.user_metadata?.full_name || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [username, setUsername] = useState(profile?.username || session?.user?.user_metadata?.username || '');
  const [role, setRole] = useState(profile?.role || 'Innovator');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [prefReceiveSaves, setPrefReceiveSaves] = useState(profile?.pref_receive_saves ?? true);
  const [prefReceiveAnalytics, setPrefReceiveAnalytics] = useState(profile?.pref_receive_analytics ?? true);
  const [prefReceiveSolutions, setPrefReceiveSolutions] = useState(profile?.pref_receive_solutions ?? true);
  const [prefReceiveReplies, setPrefReceiveReplies] = useState(profile?.pref_receive_replies ?? true);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setLocation(profile.location || '');
      setBio(profile.bio || '');
      setUsername(profile.username || '');
      setRole(profile.role || 'Innovator');
      setPrefReceiveSaves(profile.pref_receive_saves ?? true);
      setPrefReceiveAnalytics(profile.pref_receive_analytics ?? true);
      setPrefReceiveSolutions(profile.pref_receive_solutions ?? true);
      setPrefReceiveReplies(profile.pref_receive_replies ?? true);
    }
  }, [profile, isOpen]);

  useEffect(() => {
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
        body: JSON.stringify({
          full_name: fullName,
          bio,
          location,
          username,
          role,
          pref_receive_saves: prefReceiveSaves,
          pref_receive_analytics: prefReceiveAnalytics,
          pref_receive_solutions: prefReceiveSolutions,
          pref_receive_replies: prefReceiveReplies
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save settings');
      }
      try {
        await supabase.auth.refreshSession();
      } catch (err) { }
      window.dispatchEvent(new Event('profile-updated'));
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const usernameChanged = !!session?.user?.user_metadata?.username_changed;

  return (
    <div className="admin-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 className="admin-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: 700 }}>
            <Settings size={18} /> Edit Account Settings
          </h3>
          <button onClick={onClose} className="btn-admin" style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--accent-danger)', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
            <div className="profile-edit-field">
              <label className="profile-edit-label">Username</label>
              <input
                className="profile-edit-input"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="username"
                maxLength={30}
                required
                disabled={usernameChanged}
                style={usernameChanged ? { opacity: 0.6, cursor: 'not-allowed', background: 'rgba(255,255,255,0.02)' } : undefined}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                {usernameChanged ? "🔒 Username has already been changed once and is locked." : "ℹ️ Username can only be changed once."}
              </span>
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
              <label className="profile-edit-label">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="profile-edit-input"
                style={{ width: '100%', background: 'var(--search-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', outline: 'none' }}
              >
                {VALID_ROLES.map(r => (
                  <option key={r} value={r} style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>{r}</option>
                ))}
              </select>
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
                placeholder="Introduce yourself..."
                maxLength={500}
                style={{ minHeight: '80px' }}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right', display: 'block' }}>
                {bio.length}/500
              </span>
            </div>
          </div>

          <div style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.85rem' }}>
              Appearance Theme
            </h4>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => applyTheme('dark')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: theme === 'dark' ? '2px solid var(--accent-blue)' : '1.5px solid var(--border-color)',
                  background: theme === 'dark' ? 'rgba(0, 132, 255, 0.06)' : 'var(--bg-hover)',
                  cursor: 'pointer',
                  color: theme === 'dark' ? 'var(--accent-blue)' : 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                <Moon size={14} /> Dark Theme
              </button>
              <button
                type="button"
                onClick={() => applyTheme('light')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: theme === 'light' ? '2px solid var(--accent-blue)' : '1.5px solid var(--border-color)',
                  background: theme === 'light' ? 'rgba(0, 132, 255, 0.06)' : 'var(--bg-hover)',
                  cursor: 'pointer',
                  color: theme === 'light' ? 'var(--accent-blue)' : 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                <Sun size={14} /> Light Theme
              </button>
            </div>
          </div>

          <div style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
            <h4 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.85rem' }}>
              Notifications
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                <input
                  type="checkbox"
                  checked={prefReceiveSaves}
                  onChange={(e) => setPrefReceiveSaves(e.target.checked)}
                  style={{ width: '16px', height: '16px', borderRadius: '4px', accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
                />
                Someone saves my post
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                <input
                  type="checkbox"
                  checked={prefReceiveAnalytics}
                  onChange={(e) => setPrefReceiveAnalytics(e.target.checked)}
                  style={{ width: '16px', height: '16px', borderRadius: '4px', accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
                />
                Weekly analytics summary
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                <input
                  type="checkbox"
                  checked={prefReceiveSolutions}
                  onChange={(e) => setPrefReceiveSolutions(e.target.checked)}
                  style={{ width: '16px', height: '16px', borderRadius: '4px', accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
                />
                Someone submits a solution to my problem
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                <input
                  type="checkbox"
                  checked={prefReceiveReplies}
                  onChange={(e) => setPrefReceiveReplies(e.target.checked)}
                  style={{ width: '16px', height: '16px', borderRadius: '4px', accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
                />
                Someone replies to my comment
              </label>
            </div>
          </div>
        </form>

        <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} className="upf-btn-message" style={{ border: '1px solid var(--border-color)', background: 'transparent' }} disabled={saving}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="upf-btn-follow" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

      </div>
    </div>
  );
}
