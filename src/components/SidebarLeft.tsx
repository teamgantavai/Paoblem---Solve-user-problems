'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePathname } from 'next/navigation';
import {
  TrendingUp,
  BarChart2,
  Bookmark,
  Plus,
  Star,
  LogIn,
  Lightbulb,
  CheckCircle,
  Clock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import AuthModal from './AuthModal';
import SettingsModal from './SettingsModal';
import DevelopmentNotice from './DevelopmentNotice';
import Avatar from './Avatar';

const SIDEBAR_PROFILE_CACHE_KEY = 'sidebar-left-profile-cache';
const SIDEBAR_PULSE_CACHE_KEY = 'sidebar-left-pulse-cache';
const SIDEBAR_CACHE_TTL_MS = 5 * 60 * 1000;

type CachedSidebarProfile = {
  data: { full_name: string | null; avatar_url: string | null; role: string | null; username?: string | null; cover_url?: string | null };
  cachedAt: number;
};

type CachedPulseStats = {
  data: {
    totalSolutions: number;
    problemsSolved: number;
    unsolvedProblems: number;
    totalProblems: number;
    totalIdeas: number;
    totalPosts: number;
  };
  cachedAt: number;
};

function SidebarLeftInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter') || 'all';
  const isHomeRoute = pathname === '/' || pathname === '/home';
  const isAnalyticsRoute = pathname === '/analytics';
  const isSolutionsRoute = pathname === '/solutions';

  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null; role: string | null } | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [noticeFeature, setNoticeFeature] = useState('');
  const [pulseStats, setPulseStats] = useState({
    totalSolutions: 0,
    problemsSolved: 0,
    unsolvedProblems: 0,
    totalProblems: 0,
    totalIdeas: 0,
    totalPosts: 0,
  });

  const triggerNotice = (feature: string) => {
    setNoticeFeature(feature);
    setIsNoticeOpen(true);
  };

  const readCachedProfile = () => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(SIDEBAR_PROFILE_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedSidebarProfile;
      if (!parsed?.data || (Date.now() - parsed.cachedAt) > SIDEBAR_CACHE_TTL_MS) return null;
      return parsed.data;
    } catch {
      return null;
    }
  };

  const writeCachedProfile = (data: CachedSidebarProfile['data']) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SIDEBAR_PROFILE_CACHE_KEY, JSON.stringify({ data, cachedAt: Date.now() } satisfies CachedSidebarProfile));
    } catch {}
  };

  const readCachedPulse = () => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(SIDEBAR_PULSE_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedPulseStats;
      if (!parsed?.data || (Date.now() - parsed.cachedAt) > SIDEBAR_CACHE_TTL_MS) return null;
      return parsed.data;
    } catch {
      return null;
    }
  };

  const writeCachedPulse = (data: CachedPulseStats['data']) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SIDEBAR_PULSE_CACHE_KEY, JSON.stringify({ data, cachedAt: Date.now() } satisfies CachedPulseStats));
    } catch {}
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchLeftProfile = () => {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    const cachedProfile = readCachedProfile();
    if (cachedProfile) {
      setProfile(cachedProfile as any);
    }
    supabase
      .from('profiles')
      .select('full_name, avatar_url, role, username, cover_url')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile(data as any);
          writeCachedProfile(data as any);
        }
      });
  };

  useEffect(() => {
    fetchLeftProfile();
  }, [session?.user?.id]);

  useEffect(() => {
    window.addEventListener('profile-updated', fetchLeftProfile);
    return () => {
      window.removeEventListener('profile-updated', fetchLeftProfile);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    let cancelled = false;
    async function fetchPulseStats() {
      try {
        const cachedPulse = readCachedPulse();
        if (cachedPulse) {
          setPulseStats(cachedPulse);
          return;
        }
        const [solutionsRes, problemsRes, ideasRes] = await Promise.all([
          fetch('/api/solutions?filter=all'),
          supabase.from('posts').select('id', { count: 'exact', head: true }).eq('type', 'problem'),
          supabase.from('posts').select('id', { count: 'exact', head: true }).eq('type', 'idea'),
        ]);

        const solutionJson = solutionsRes.ok ? await solutionsRes.json() : null;
        const totalProblems = problemsRes.count || 0;
        const totalIdeas = ideasRes.count || 0;

        if (!cancelled) {
          const nextStats = {
            totalSolutions: solutionJson?.stats?.totalSolutions || 0,
            problemsSolved: solutionJson?.stats?.problemsSolved || 0,
            unsolvedProblems: solutionJson?.stats?.unsolvedProblems || 0,
            totalProblems,
            totalIdeas,
            totalPosts: totalProblems + totalIdeas,
          };
          setPulseStats(nextStats);
          writeCachedPulse(nextStats);
        }
      } catch (err) {
        console.error('Failed to load pulse stats', err);
      }
    }

    fetchPulseStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = profile?.full_name || session?.user?.user_metadata?.full_name || 'Member';
  const displayRole = profile?.role || 'Innovator';
  const displayAvatar = profile?.avatar_url || session?.user?.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${session?.user?.id}`;

  return (
    <aside className="left-sidebar">

      {/* Profile Card / Promo Card */}
      {session ? (
        <Link href="/profile" style={{ textDecoration: 'none' }}>
          <div className="profile-card" style={{ cursor: 'pointer' }}>
            <div 
              className="profile-banner" 
              style={{ 
                backgroundImage: (profile as any)?.cover_url || session?.user?.user_metadata?.cover_url ? `url(${(profile as any)?.cover_url || session?.user?.user_metadata?.cover_url})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            ></div>
            <div className="profile-body">
              <div className="profile-avatar-wrap">
                <Avatar
                  src={profile?.avatar_url || session?.user?.user_metadata?.avatar_url}
                  name={displayName}
                  className="profile-avatar"
                  size={54}
                />
              </div>
              <div className="profile-info">
                <div className="profile-name-row" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span className="profile-name">{displayName}</span>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    backgroundColor: 'var(--text-main)',
                    color: 'var(--bg-card)',
                    padding: '1px 6px',
                    borderRadius: '12px',
                    whiteSpace: 'nowrap'
                  }}>
                    {displayRole}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Link>
      ) : (
        <div
          className="card"
          style={{
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(0, 0, 0, 0) 100%)',
            borderColor: 'rgba(99, 102, 241, 0.15)'
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-main)' }}>Join Paoblem</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Create posts, vote on problems, comment on ideas, and showcase your professional progress!
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ display: 'flex', gap: '0.5rem', width: '100%', padding: '0.55rem' }}
            onClick={() => setIsAuthOpen(true)}
          >
            <LogIn size={14} />
            <span>Sign In / Register</span>
          </button>
        </div>
      )}

      {/* Navigation Menu */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <Link
          href="/"
          className={`menu-item ${isHomeRoute && (filter === 'all' || filter === 'problem' || filter === 'idea') ? 'active' : ''}`}
          style={{ cursor: 'pointer', textDecoration: 'none' }}
        >
          <TrendingUp size={20} />
          <span>Home Feed</span>
        </Link>
        <div
          className={`menu-item ${isAnalyticsRoute ? 'active' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => {
          if (!session) {
            setIsAuthOpen(true);
          } else {
            router.push('/analytics');
          }
        }}>
          <BarChart2 size={20} />
          <span>Analytics</span>
        </div>
        <Link
          href="/?filter=saved"
          className={`menu-item ${filter === 'saved' ? 'active' : ''}`}
          style={{ cursor: 'pointer', textDecoration: 'none' }}
        >
          <Bookmark size={20} />
          <span>Saved Posts</span>
        </Link>
        <div
          className={`menu-item ${isHomeRoute && filter === 'mine' ? 'active' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => {
            if (!session) {
              setIsAuthOpen(true);
            } else {
              router.push('/?filter=mine');
            }
          }}
        >
          <Star size={20} />
          <span>My Posts</span>
        </div>
      </div>

        <div className="card sidebar-solutions-card">
        <div className="sidebar-solutions-head">
          <span>
            <Lightbulb size={15} />
            {isSolutionsRoute ? 'Solution Pulse' : 'Problem Pulse'}
          </span>
          <button type="button" onClick={() => router.push(isSolutionsRoute ? '/' : '/solutions')}>
            {isSolutionsRoute ? 'Home' : 'View'}
          </button>
        </div>
        {isSolutionsRoute ? (
          <>
            <div className="sidebar-solutions-grid">
              <div>
                <strong>{pulseStats.totalSolutions}</strong>
                <span>Total</span>
              </div>
              <div>
                <strong>{pulseStats.problemsSolved}</strong>
                <span>Solved</span>
              </div>
              <div>
                <strong>{pulseStats.unsolvedProblems}</strong>
                <span>Open</span>
              </div>
            </div>
            <div className="sidebar-solution-status">
              <CheckCircle size={18} strokeWidth={1.5} />
              <span>{pulseStats.problemsSolved} problems solved by developers</span>
            </div>
            <div className="sidebar-solution-status sidebar-solution-status--open">
              <Clock size={18} strokeWidth={1.5} />
              <span>{pulseStats.unsolvedProblems} waiting for solutions</span>
            </div>
          </>
        ) : (
          <>
            <div className="sidebar-solutions-grid">
              <div>
                <strong>{pulseStats.totalProblems}</strong>
                <span>Problems</span>
              </div>
              <div>
                <strong>{pulseStats.totalIdeas}</strong>
                <span>Ideas</span>
              </div>
              <div>
                <strong>{pulseStats.totalPosts}</strong>
                <span>Total</span>
              </div>
            </div>
            <div className="sidebar-solution-status">
              <TrendingUp size={18} strokeWidth={1.5} />
              <span>{pulseStats.totalProblems} problems posted by the community</span>
            </div>
            <div className="sidebar-solution-status sidebar-solution-status--open">
              <Lightbulb size={18} strokeWidth={1.5} />
              <span>{pulseStats.totalIdeas} ideas shared for builders</span>
            </div>
          </>
        )}
      </div>

      {/* Legal Footer Links */}
      <div 
        style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          justifyContent: 'center', 
          gap: '0.4rem 0.6rem', 
          padding: '0.5rem 0.75rem', 
          fontSize: '0.7rem', 
          color: 'var(--text-muted)', 
          textAlign: 'center',
          marginTop: '0.25rem',
          lineHeight: '1.4'
        }}
      >
        <Link href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }} className="hover-underline-target">Privacy Policy</Link>
        <span>•</span>
        <Link href="/terms" style={{ color: 'inherit', textDecoration: 'none' }} className="hover-underline-target">Terms</Link>
        <span>•</span>
        <Link href="/cookies" style={{ color: 'inherit', textDecoration: 'none' }} className="hover-underline-target">Cookies</Link>
        <div style={{ width: '100%', fontSize: '0.65rem', marginTop: '0.25rem', opacity: 0.85 }}>
          © {new Date().getFullYear()} Paoblem
        </div>
      </div>

      {/* Modals rendered inline */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <DevelopmentNotice isOpen={isNoticeOpen} onClose={() => setIsNoticeOpen(false)} featureName={noticeFeature} />

    </aside>
  );
}

export default function SidebarLeft() {
  return (
    <Suspense fallback={null}>
      <SidebarLeftInner />
    </Suspense>
  );
}
