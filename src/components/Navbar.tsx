'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Home, 
  NotebookPen, 
  Bell, 
  MessageCircle, 
  User, 
  Search, 
  AlignLeft, 
  X, 
  TrendingUp, 
  BarChart2, 
  Bookmark, 
  Star, 
  Settings, 
  LogOut, 
  LogIn 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AuthModal from './AuthModal';
import SettingsModal from './SettingsModal';
import DevelopmentNotice from './DevelopmentNotice';

function NavbarInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter') || 'all';

  const [isOpen, setIsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [noticeFeature, setNoticeFeature] = useState('');

  const triggerNotice = (feature: string) => {
    setNoticeFeature(feature);
    setIsNoticeOpen(true);
  };
  const [session, setSession] = useState<any>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

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
    setDropdownOpen(false);
    setIsOpen(false);
    router.push('/');
    window.location.reload();
  };

  const handleMeClick = () => {
    if (!session) {
      setIsAuthOpen(true);
    } else {
      setDropdownOpen(!dropdownOpen);
    }
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">

          <div className="nav-brand">
            <button
              className="menu-toggle-btn"
              onClick={() => setIsOpen(true)}
              aria-label="Open menu"
            >
              <AlignLeft size={24} strokeWidth={2.5} />
            </button>
            <img 
              src="/logo.svg" 
              alt="Paoblem Logo" 
              style={{ height: '38px', objectFit: 'contain', cursor: 'pointer' }} 
              onClick={() => router.push('/')}
            />
          </div>

          <div className="nav-links desktop-only">
            <div className="nav-item active" onClick={() => router.push('/')}>
              <div className="nav-icon-wrap">
                <Home size={22} strokeWidth={2} />
              </div>
              <span>Home</span>
            </div>
            <div className="nav-item" onClick={() => router.push('/')}>
              <div className="nav-icon-wrap">
                <NotebookPen size={22} strokeWidth={2} />
              </div>
              <span>Solution</span>
            </div>
            <div className="nav-item" onClick={() => triggerNotice('Notifications')}>
              <div className="nav-icon-wrap">
                <Bell size={22} strokeWidth={2} />
                <span className="nav-badge">9+</span>
              </div>
              <span>Notifications</span>
            </div>
            <div className="nav-item" onClick={() => triggerNotice('Chats')}>
              <div className="nav-icon-wrap">
                <MessageCircle size={22} strokeWidth={2} />
                <span className="nav-badge">6</span>
              </div>
              <span>Chats</span>
            </div>

            {/* Authenticated / Guest User Tab */}
            {session ? (
              <div className="nav-item" onClick={handleMeClick} style={{ position: 'relative' }}>
                <div className="nav-icon-wrap">
                  <img 
                    src={session.user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${session.user.id}`} 
                    alt="Me" 
                    style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }} 
                  />
                </div>
                <span>Me</span>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div 
                    className="card"
                    style={{ 
                      position: 'absolute', 
                      top: '75px', 
                      right: '0', 
                      width: '200px', 
                      zIndex: 100, 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '0.5rem',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                      padding: '0.75rem'
                    }}
                  >
                    <div style={{ padding: '0.25rem 0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                      <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {session.user.user_metadata?.full_name || 'Member'}
                      </p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {session.user.email}
                      </p>
                    </div>
                    <div 
                      className="menu-item" 
                      style={{ padding: '0.4rem 0.5rem', fontSize: '0.82rem' }}
                      onClick={() => { setDropdownOpen(false); setIsSettingsOpen(true); }}
                    >
                      <Settings size={16} />
                      <span>Settings</span>
                    </div>
                    <div 
                      className="menu-item" 
                      style={{ padding: '0.4rem 0.5rem', fontSize: '0.82rem', color: '#ef4444' }}
                      onClick={handleLogout}
                    >
                      <LogOut size={16} />
                      <span>Sign Out</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="nav-item" onClick={() => setIsAuthOpen(true)}>
                <div className="nav-icon-wrap">
                  <LogIn size={22} strokeWidth={2} />
                </div>
                <span>Sign In</span>
              </div>
            )}
          </div>

          <div className="search-bar desktop-only">
            <input type="text" placeholder="Search for Problems" />
            <button className="search-btn" aria-label="Submit search">
              <Search size={16} />
            </button>
          </div>

          {session ? (
            <button 
              className="search-btn mobile-only" 
              style={{ position: 'relative' }} 
              aria-label="Notifications"
              onClick={() => triggerNotice('Notifications')}
            >
              <Bell size={20} strokeWidth={2} />
              <span className="nav-badge">9+</span>
            </button>
          ) : (
            <button className="btn btn-primary mobile-only" style={{ padding: '0.35rem 0.85rem' }} onClick={() => setIsAuthOpen(true)}>
              Sign In
            </button>
          )}

        </div>
      </nav>
 
      {/* Mobile Bottom Navigation */}
      <div className="mobile-bottom-nav">
        <div className="mobile-nav-item active" onClick={() => router.push('/')}>
          <div className="nav-icon-wrap">
            <Home size={20} strokeWidth={2} />
          </div>
          <span>Home</span>
        </div>
        <div className="mobile-nav-item" onClick={() => triggerNotice('Solutions')}>
          <div className="nav-icon-wrap">
            <NotebookPen size={20} strokeWidth={2} />
          </div>
          <span>Solution</span>
        </div>
        <div className="mobile-nav-item" onClick={() => router.push('/create-post')}>
          <div className="nav-icon-wrap">
            <Search size={20} strokeWidth={2} />
          </div>
          <span>Post</span>
        </div>
        <div className="mobile-nav-item" onClick={() => triggerNotice('Chats')}>
          <div className="nav-icon-wrap">
            <MessageCircle size={20} strokeWidth={2} />
            <span className="nav-badge">6</span>
          </div>
          <span>Chats</span>
        </div>
        <div className="mobile-nav-item" onClick={handleMeClick}>
          <div className="nav-icon-wrap">
            {session ? (
              <img 
                src={session.user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${session.user.id}`} 
                alt="Me" 
                style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} 
              />
            ) : (
              <User size={20} strokeWidth={2} />
            )}
          </div>
          <span>{session ? 'Me' : 'Sign In'}</span>
        </div>
      </div>
 
      {/* Drawer Overlay */}
      <div
        className={`drawer-overlay ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(false)}
      />
 
      {/* Side Drawer */}
      <div className={`drawer ${isOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <img src="/logo.svg" alt="Paoblem Logo" style={{ height: '32px', objectFit: 'contain' }} />
          <button
            className="drawer-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>
        <div className="drawer-content">
          {/* Authenticated Drawer Profile Card */}
          {session ? (
            <div className="drawer-profile">
              <div className="drawer-profile-info">
                <img
                  src={session.user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${session.user.id}`}
                  alt="Avatar"
                  className="drawer-profile-avatar"
                />
                <div className="drawer-profile-details">
                  <div className="drawer-profile-name-row">
                    <span className="drawer-profile-name">{session.user.user_metadata?.full_name || 'Member'}</span>
                    <span className="profile-linkedin-badge">in</span>
                  </div>
                  <span className="drawer-profile-role">{session.user.user_metadata?.role || 'Innovator'}</span>
                </div>
              </div>
              <div className="drawer-profile-progress">
                <div className="drawer-profile-progress-bar">
                  <div className="drawer-profile-progress-fill" style={{ width: '90%' }}></div>
                </div>
                <span className="drawer-profile-progress-label">90%</span>
              </div>
            </div>
          ) : (
            <div 
              className="card" 
              style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', textAlign: 'center' }}
            >
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sign in to create problems, post comments, and view custom analytics.</p>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                onClick={() => { setIsOpen(false); setIsAuthOpen(true); }}
              >
                Sign In / Sign Up
              </button>
            </div>
          )}
 
          {/* Navigation Menu */}
          <div className="drawer-menu-section">
            <div 
              className={`drawer-menu-item ${filter === 'all' || filter === 'problem' || filter === 'idea' ? 'active' : ''}`} 
              onClick={() => { setIsOpen(false); router.push('/'); }}
            >
              <TrendingUp size={20} />
              <span>Trending Problems</span>
            </div>
            <div className="drawer-menu-item" onClick={() => { setIsOpen(false); triggerNotice('Analytics'); }}>
              <BarChart2 size={20} />
              <span>Analytics</span>
            </div>
            <div 
              className={`drawer-menu-item ${filter === 'saved' ? 'active' : ''}`} 
              onClick={() => { setIsOpen(false); router.push('/?filter=saved'); }}
            >
              <Bookmark size={20} />
              <span>Saved Problems</span>
            </div>
            <div 
              className={`drawer-menu-item ${filter === 'mine' ? 'active' : ''}`} 
              onClick={() => {
                setIsOpen(false);
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
 
            <div className="drawer-menu-divider" />
 
            <div className="drawer-menu-item" onClick={() => { setIsOpen(false); setIsSettingsOpen(true); }}>
              <Settings size={20} />
              <span>Settings</span>
            </div>
 
            {session && (
              <div className="drawer-menu-item" onClick={handleLogout} style={{ color: '#ef4444' }}>
                <LogOut size={20} />
                <span>Sign Out</span>
              </div>
            )}
          </div>
        </div>
      </div>
 
      {/* Modals */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <DevelopmentNotice isOpen={isNoticeOpen} onClose={() => setIsNoticeOpen(false)} featureName={noticeFeature} />
    </>
  );
}

export default function Navbar() {
  return (
    <Suspense fallback={null}>
      <NavbarInner />
    </Suspense>
  );
}