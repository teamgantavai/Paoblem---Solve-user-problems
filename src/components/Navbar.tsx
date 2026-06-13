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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Notification, Message } from '@/lib/types';
import AuthModal from './AuthModal';
import SettingsModal from './SettingsModal';
import DevelopmentNotice from './DevelopmentNotice';
import NotificationItem from './NotificationItem';
import MessageItem from './MessageItem';

function NavbarInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const filter = searchParams.get('filter') || 'all';

  const [isOpen, setIsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [noticeFeature, setNoticeFeature] = useState('');
  const [session, setSession] = useState<any>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Dropdown states for notifications and chats
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [msgDropdownOpen, setMsgDropdownOpen] = useState(false);

  const triggerNotice = (feature: string) => {
    setNoticeFeature(feature);
    setIsNoticeOpen(true);
  };

  // Close dropdowns on clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.nav-item-notif') && !target.closest('.notif-dropdown-wrapper')) {
        setNotifDropdownOpen(false);
      }
      if (!target.closest('.nav-item-msg') && !target.closest('.msg-dropdown-wrapper')) {
        setMsgDropdownOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Listen to Auth State
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  // React Query: Fetch notifications
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications', session?.access_token],
    queryFn: async () => {
      if (!session?.access_token) return [];
      const res = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.notifications || [];
    },
    enabled: !!session?.access_token,
    refetchInterval: 30000 // poll every 30s
  });

  // React Query: Fetch messages
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['messages', session?.access_token],
    queryFn: async () => {
      if (!session?.access_token) return [];
      const res = await fetch('/api/messages', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.messages || [];
    },
    enabled: !!session?.access_token,
    refetchInterval: 30000 // poll every 30s
  });

  // Mark notification read mutation
  const markNotifReadMutation = useMutation({
    mutationFn: async ({ id, read }: { id: string; read: boolean }) => {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id, read })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', session?.access_token] });
    }
  });

  // Mark message read mutation
  const markMsgReadMutation = useMutation({
    mutationFn: async ({ id, read }: { id: string; read: boolean }) => {
      await fetch('/api/messages', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id, read })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', session?.access_token] });
    }
  });

  const handleMarkAllNotifsRead = () => {
    notifications.forEach(n => {
      if (!n.read) {
        markNotifReadMutation.mutate({ id: n.id, read: true });
      }
    });
  };

  const handleMarkAllMsgsRead = () => {
    messages.forEach(m => {
      if (!m.read) {
        markMsgReadMutation.mutate({ id: m.id, read: true });
      }
    });
  };

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

  const unreadNotifCount = notifications.filter(n => !n.read).length;
  const unreadMsgCount = messages.filter(m => !m.read).length;

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

          <div className="nav-links desktop-only" style={{ position: 'relative' }}>
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

            {/* Dynamic Notifications Link */}
            <div 
              className={`nav-item nav-item-notif ${notifDropdownOpen ? 'active' : ''}`} 
              onClick={(e) => {
                e.stopPropagation();
                if (session) {
                  setNotifDropdownOpen(!notifDropdownOpen);
                  setMsgDropdownOpen(false);
                } else {
                  setIsAuthOpen(true);
                }
              }}
            >
              <div className="nav-icon-wrap">
                <Bell size={22} strokeWidth={2} />
                {unreadNotifCount > 0 && (
                  <span className="nav-badge">
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </div>
              <span>Notifications</span>
            </div>

            {/* Dynamic Chats Link */}
            <div 
              className={`nav-item nav-item-msg ${msgDropdownOpen ? 'active' : ''}`} 
              onClick={(e) => {
                e.stopPropagation();
                if (session) {
                  setMsgDropdownOpen(!msgDropdownOpen);
                  setNotifDropdownOpen(false);
                } else {
                  setIsAuthOpen(true);
                }
              }}
            >
              <div className="nav-icon-wrap">
                <MessageCircle size={22} strokeWidth={2} />
                {unreadMsgCount > 0 && (
                  <span className="nav-badge">
                    {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
                  </span>
                )}
              </div>
              <span>Chats</span>
            </div>

            {/* Notifications Dropdown Popover */}
            {notifDropdownOpen && (
              <div className="notif-dropdown-wrapper" onClick={(e) => e.stopPropagation()}>
                <div className="dropdown-header">
                  <h3>Notifications</h3>
                  {unreadNotifCount > 0 && (
                    <button className="dropdown-action-btn" onClick={handleMarkAllNotifsRead}>
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="dropdown-body">
                  {notifications.length === 0 ? (
                    <div className="dropdown-empty">
                      <Bell size={28} style={{ color: 'var(--text-muted)' }} />
                      <p className="dropdown-empty-text">No notifications yet.</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <NotificationItem 
                        key={notif.id} 
                        notification={notif} 
                        onMarkAsRead={(id) => markNotifReadMutation.mutate({ id, read: true })}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Chats Dropdown Popover */}
            {msgDropdownOpen && (
              <div className="msg-dropdown-wrapper" onClick={(e) => e.stopPropagation()}>
                <div className="dropdown-header">
                  <h3>Chats & Messages</h3>
                  {unreadMsgCount > 0 && (
                    <button className="dropdown-action-btn" onClick={handleMarkAllMsgsRead}>
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="dropdown-body">
                  {messages.length === 0 ? (
                    <div className="dropdown-empty">
                      <MessageCircle size={28} style={{ color: 'var(--text-muted)' }} />
                      <p className="dropdown-empty-text">No active messages.</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <MessageItem 
                        key={msg.id} 
                        message={msg} 
                        onMarkAsRead={(id) => markMsgReadMutation.mutate({ id, read: true })}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

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
                      onClick={() => { setDropdownOpen(false); router.push('/profile'); }}
                    >
                      <User size={16} />
                      <span>My Profile</span>
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
              className="search-btn mobile-only nav-item-notif" 
              style={{ position: 'relative' }} 
              aria-label="Notifications"
              onClick={(e) => {
                e.stopPropagation();
                setNotifDropdownOpen(!notifDropdownOpen);
                setMsgDropdownOpen(false);
              }}
            >
              <Bell size={20} strokeWidth={2} />
              {unreadNotifCount > 0 && (
                <span className="nav-badge">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
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
        <div 
          className="mobile-nav-item nav-item-msg" 
          onClick={(e) => {
            e.stopPropagation();
            if (session) {
              setMsgDropdownOpen(!msgDropdownOpen);
              setNotifDropdownOpen(false);
            } else {
              setIsAuthOpen(true);
            }
          }}
        >
          <div className="nav-icon-wrap">
            <MessageCircle size={20} strokeWidth={2} />
            {unreadMsgCount > 0 && (
              <span className="nav-badge">
                {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
              </span>
            )}
          </div>
          <span>Chats</span>
        </div>
        <div className="mobile-nav-item" onClick={() => { if (session) { router.push('/profile'); } else { setIsAuthOpen(true); } }}>
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
          <span>{session ? 'Profile' : 'Sign In'}</span>
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
 
            <div
              className="drawer-menu-item"
              onClick={() => { setIsOpen(false); router.push('/profile'); }}
            >
              <User size={20} />
              <span>My Profile</span>
            </div>

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