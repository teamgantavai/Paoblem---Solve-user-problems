'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  TrendingUp,
  BarChart2,
  Bookmark,
  Settings,
  Plus,
  Star,
  LogOut,
  LogIn
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AuthModal from './AuthModal';
import SettingsModal from './SettingsModal';
import DevelopmentNotice from './DevelopmentNotice';

export default function SidebarLeft() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter') || 'all';

  const [session, setSession] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [noticeFeature, setNoticeFeature] = useState('');

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <aside className="left-sidebar">

      {/* Profile Card / Promo Card */}
      {session ? (
        <div className="profile-card">
          <div className="profile-banner"></div>
          <div className="profile-body">
            <div className="profile-avatar-wrap">
              <img
                src={session.user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${session.user.id}`}
                alt={session.user.user_metadata?.full_name || 'Member'}
                className="profile-avatar"
              />
            </div>
            <div className="profile-info">
              <div className="profile-name-row">
                <span className="profile-name">{session.user.user_metadata?.full_name || 'Member'}</span>
              </div>
              <p className="profile-role">{session.user.user_metadata?.role || 'Innovator'}</p>
            </div>
            <div className="profile-progress-row">
              <div className="profile-progress-bar">
                <div className="profile-progress-fill" style={{ width: '90%' }}></div>
              </div>
              <span className="profile-progress-label">90%</span>
            </div>
          </div>
          <div
            className="profile-footer"
            onClick={handleLogout}
            style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </div>
        </div>
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
        <div
          className={`menu-item ${filter === 'all' || filter === 'problem' || filter === 'idea' ? 'active' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => router.push('/')}
        >
          <TrendingUp size={20} />
          <span>Trending Problems</span>
        </div>
        <div className="menu-item" style={{ cursor: 'pointer' }} onClick={() => triggerNotice('Analytics')}>
          <BarChart2 size={20} />
          <span>Analytics</span>
        </div>
        <div
          className={`menu-item ${filter === 'saved' ? 'active' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => router.push('/?filter=saved')}
        >
          <Bookmark size={20} />
          <span>Saved Posts</span>
        </div>
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

      {/* Settings Action Row */}
      <div className="card" style={{ padding: '0.75rem 1.25rem' }}>
        <div
          className="menu-item"
          style={{ padding: '0' }}
          onClick={() => setIsSettingsOpen(true)}
        >
          <Settings size={20} />
          <span>Settings</span>
        </div>
      </div>

      {/* Modals rendered inline */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <DevelopmentNotice isOpen={isNoticeOpen} onClose={() => setIsNoticeOpen(false)} featureName={noticeFeature} />

    </aside>
  );
}