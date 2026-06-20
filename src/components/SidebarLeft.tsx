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

function SidebarLeftInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter') || 'all';

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
    supabase
      .from('profiles')
      .select('full_name, avatar_url, role, username, cover_url')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as any);
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
        const [solutionsRes, problemsRes, ideasRes] = await Promise.all([
          fetch('/api/solutions?filter=all'),
          supabase.from('posts').select('id', { count: 'exact', head: true }).eq('type', 'problem'),
          supabase.from('posts').select('id', { count: 'exact', head: true }).eq('type', 'idea'),
        ]);

        const solutionJson = solutionsRes.ok ? await solutionsRes.json() : null;
        const totalProblems = problemsRes.count || 0;
        const totalIdeas = ideasRes.count || 0;

        if (!cancelled) {
          setPulseStats({
            totalSolutions: solutionJson?.stats?.totalSolutions || 0,
            problemsSolved: solutionJson?.stats?.problemsSolved || 0,
            unsolvedProblems: solutionJson?.stats?.unsolvedProblems || 0,
            totalProblems,
            totalIdeas,
            totalPosts: totalProblems + totalIdeas,
          });
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
                    fontWeight: 500,
                    backgroundColor: '#3c11eb',
                    color: 'white',
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
          className={`menu-item ${filter === 'all' || filter === 'problem' || filter === 'idea' ? 'active' : ''}`}
          style={{ cursor: 'pointer', textDecoration: 'none' }}
        >
          <TrendingUp size={20} />
          <span>Trending Problems</span>
        </Link>
        <div className="menu-item" style={{ cursor: 'pointer' }} onClick={() => {
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
          className={`menu-item ${filter === 'mine' ? 'active' : ''}`}
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
            {pathname === '/solutions' ? 'Solution Pulse' : 'Problem Pulse'}
          </span>
          <button type="button" onClick={() => router.push(pathname === '/solutions' ? '/' : '/solutions')}>
            {pathname === '/solutions' ? 'Home' : 'View'}
          </button>
        </div>
        {pathname === '/solutions' ? (
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
              <CheckCircle size={14} />
              <span>{pulseStats.problemsSolved} problems solved by developers</span>
            </div>
            <div className="sidebar-solution-status sidebar-solution-status--open">
              <Clock size={14} />
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
              <TrendingUp size={14} />
              <span>{pulseStats.totalProblems} problems posted by the community</span>
            </div>
            <div className="sidebar-solution-status sidebar-solution-status--open">
              <Lightbulb size={14} />
              <span>{pulseStats.totalIdeas} ideas shared for builders</span>
            </div>
          </>
        )}
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
