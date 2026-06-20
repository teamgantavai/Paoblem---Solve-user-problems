'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
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
  LogIn,
  Lightbulb,
  CheckCircle,
  Clock,
  PlusCircle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Notification as AppNotification, Message } from '@/lib/types';
import AuthModal from './AuthModal';
import SettingsModal from './SettingsModal';
import DevelopmentNotice from './DevelopmentNotice';
import NotificationItem from './NotificationItem';
import MessageItem from './MessageItem';
import SearchOverlay from './SearchOverlay';

function NavbarInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const filter = searchParams.get('filter') || 'all';

  const [isOpen, setIsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [noticeFeature, setNoticeFeature] = useState('');
  const [session, setSession] = useState<any>(null);
  const [theme, setTheme] = useState('dark');
  const [avatarFailed, setAvatarFailed] = useState(false);

  // Profile fetched from DB (so role changes propagate immediately)
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null; role: string | null } | null>(null);

  // Dropdown states for desktop notifications and chats (if clicking popovers is still desired, or if we go to page)
  // Let's make them navigate directly to their pages to fix active state cleanly as required
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [msgDropdownOpen, setMsgDropdownOpen] = useState(false);

  const triggerNotice = (feature: string) => {
    setNoticeFeature(feature);
    setIsNoticeOpen(true);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLight = document.documentElement.classList.contains('light-theme');
      setTheme(isLight ? 'light' : 'dark');

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'class') {
            const isNowLight = document.documentElement.classList.contains('light-theme');
            setTheme(isNowLight ? 'light' : 'dark');
          }
        });
      });
      observer.observe(document.documentElement, { attributes: true });
      return () => observer.disconnect();
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchNavProfile = () => {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    supabase
      .from('profiles')
      .select('full_name, avatar_url, role, username')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          setAvatarFailed(false); // Reset failed flag on fresh fetch
        }
      });
  };

  useEffect(() => {
    fetchNavProfile();
  }, [session?.user?.id]);

  useEffect(() => {
    window.addEventListener('profile-updated', fetchNavProfile);
    return () => {
      window.removeEventListener('profile-updated', fetchNavProfile);
    };
  }, [session?.user?.id]);

  // Fetch notifications counts
  const { data: notifications = [] } = useQuery<AppNotification[]>({
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

  // Fetch messages counts
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

  const { data: pulseStats } = useQuery<{
    stats: { totalSolutions: number; problemsSolved: number; unsolvedProblems: number };
    postStats?: { totalProblems: number; totalIdeas: number; totalPosts: number };
  }>({
    queryKey: ['mobile-pulse-stats'],
    queryFn: async () => {
      const [solutionsRes, problemsRes, ideasRes] = await Promise.all([
        fetch('/api/solutions?filter=all'),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('type', 'problem'),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('type', 'idea'),
      ]);
      const solutionJson = solutionsRes.ok ? await solutionsRes.json() : { stats: { totalSolutions: 0, problemsSolved: 0, unsolvedProblems: 0 } };
      const totalProblems = problemsRes.count || 0;
      const totalIdeas = ideasRes.count || 0;
      return {
        ...solutionJson,
        postStats: {
          totalProblems,
          totalIdeas,
          totalPosts: totalProblems + totalIdeas,
        },
      };
    },
  });

  // Global message realtime listener for browser notifications
  useEffect(() => {
    if (!session?.user?.id) return;

    // Request notification permission if not already granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const channel = supabase.channel('global-message-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${session.user.id}`
        },
        async (payload) => {
          const newMsg = payload.new;
          
          // Trigger browser notification if allowed and we are not actively looking at the chat
          if ('Notification' in window && Notification.permission === 'granted') {
            if (document.hidden || !window.location.pathname.startsWith('/chats')) {
              // Fetch sender profile to show name
              const { data: senderProfile } = await supabase
                .from('profiles')
                .select('full_name, username, avatar_url')
                .eq('id', newMsg.sender_id)
                .single();
                
              const senderName = senderProfile?.full_name || senderProfile?.username || 'Someone';
              
              const notification = new Notification(`New message from ${senderName}`, {
                body: newMsg.body || 'Sent an attachment',
                icon: senderProfile?.avatar_url || '/favicon.ico',
              });

              notification.onclick = () => {
                window.focus();
                // Optionally navigate to the chat
                // router.push(`/chats?id=${newMsg.conversation_id || newMsg.sender_id}`);
              };
            }
          }
          
          // Invalidate messages query to update navbar badge
          queryClient.invalidateQueries({ queryKey: ['messages', session.access_token] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, session?.access_token, queryClient]);

  const handleLogout = async () => {
    if (session?.user?.id) {
      try {
        await supabase.from('profiles').update({ online: false, last_seen: new Date().toISOString() }).eq('id', session.user.id);
      } catch (err) {}
    }
    await supabase.auth.signOut();
    setIsOpen(false);
    router.push('/');
    window.location.reload();
  };

  const handleMeClick = () => {
    if (!session) {
      setIsAuthOpen(true);
    } else {
      router.push('/profile');
    }
  };

  const unreadNotifCount = notifications.filter(n => !n.read).length;
  const unreadMsgCount = messages.filter(m => !m.read && m.sender_id !== session?.user?.id).length;

  const isHomeActive = pathname === '/' || pathname === '/home';
  const isSolutionsActive = pathname === '/solutions';
  const isNotificationsActive = pathname === '/notifications';
  const isChatsActive = pathname === '/chats';
  const isProfileActive = pathname === '/profile';

  const displayName = profile?.full_name || session?.user?.user_metadata?.full_name || 'Member';
  const displayRole = profile?.role || 'Innovator';
  const displayAvatar = profile?.avatar_url || session?.user?.user_metadata?.avatar_url || '';
  const renderProfileAvatar = (size: number, className?: string) => (
    displayAvatar && !avatarFailed ? (
      <img
        src={displayAvatar}
        alt="Me"
        onError={() => setAvatarFailed(true)}
        className={className}
        style={!className ? { width: size, height: size, borderRadius: '50%', objectFit: 'cover' } : undefined}
      />
    ) : (
      <span
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-hover)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-muted)'
        }}
      >
        <User size={Math.max(14, Math.floor(size * 0.62))} />
      </span>
    )
  );

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
              src={theme === 'light' ? '/logo-light.svg' : '/logo.svg'} 
              alt="Paoblem Logo" 
              style={{ height: '38px', objectFit: 'contain', cursor: 'pointer' }} 
              onClick={() => router.push('/')}
            />
          </div>

          <div className="nav-links desktop-only" style={{ position: 'relative' }}>
            <div className={`nav-item ${isHomeActive ? 'active' : ''}`} onClick={() => router.push('/')}>
              <div className="nav-icon-wrap">
                <Home size={22} strokeWidth={2} />
              </div>
              <span>Home</span>
            </div>
            
            <div className={`nav-item ${isSolutionsActive ? 'active' : ''}`} onClick={() => router.push('/solutions')}>
              <div className="nav-icon-wrap">
                <NotebookPen size={22} strokeWidth={2} />
              </div>
              <span>Solution</span>
            </div>

            {/* Notifications Link */}
            <div 
              className={`nav-item nav-item-notif ${isNotificationsActive ? 'active' : ''}`} 
              onClick={() => {
                if (session) {
                  router.push('/notifications');
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

            {/* Chats Link */}
            <div 
              className={`nav-item nav-item-msg ${isChatsActive ? 'active' : ''}`} 
              onClick={() => {
                if (session) {
                  router.push('/chats');
                } else {
                  setIsAuthOpen(true);
                }
              }}
            >
              <div className="nav-icon-wrap">
                <MessageCircle size={22} strokeWidth={2} />
                {unreadMsgCount > 0 && (
                  <span className="nav-badge" style={{ backgroundColor: '#ef4444', color: 'white' }}>
                    {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
                  </span>
                )}
              </div>
              <span>Chats</span>
            </div>

            {/* Authenticated / Guest User Tab */}
            {session ? (
              <div className={`nav-item ${isProfileActive ? 'active' : ''}`} onClick={handleMeClick} style={{ position: 'relative' }}>
                <div className="nav-icon-wrap">
                  {renderProfileAvatar(22)}
                </div>
                <span>Me</span>
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

          <div 
            className="search-bar desktop-only" 
            onClick={() => setIsSearchOpen(true)}
            style={{ cursor: 'pointer' }}
          >
            <input 
              type="text" 
              placeholder="Search problems, solutions, users..." 
              readOnly 
              style={{ cursor: 'pointer' }}
            />
            <button className="search-btn" aria-label="Submit search" type="button">
              <Search size={16} />
            </button>
          </div>

          <button 
            className="search-btn mobile-only" 
            style={{ marginRight: '8px', background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Open Search"
            onClick={() => setIsSearchOpen(true)}
            type="button"
          >
            <Search size={20} strokeWidth={2} />
          </button>

          {session ? (
            <button 
              className="search-btn mobile-only nav-item-notif" 
              style={{ position: 'relative' }} 
              aria-label="Notifications"
              onClick={() => router.push('/notifications')}
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
        <div className={`mobile-nav-item ${isHomeActive ? 'active' : ''}`} onClick={() => router.push('/')}>
          <div className="nav-icon-wrap">
            <Home size={20} strokeWidth={2} />
          </div>
          <span>Home</span>
        </div>
        <div className={`mobile-nav-item ${isSolutionsActive ? 'active' : ''}`} onClick={() => router.push('/solutions')}>
          <div className="nav-icon-wrap">
            <NotebookPen size={20} strokeWidth={2} />
          </div>
          <span>Solution</span>
        </div>
        <div className={`mobile-nav-item ${pathname === '/create-post' ? 'active' : ''}`} onClick={() => router.push('/create-post')}>
          <div className="nav-icon-wrap">
            <PlusCircle size={20} strokeWidth={2} />
          </div>
          <span>Post</span>
        </div>
        <div 
          className={`mobile-nav-item ${isChatsActive ? 'active' : ''}`} 
          onClick={() => {
            if (session) {
              router.push('/chats');
            } else {
              setIsAuthOpen(true);
            }
          }}
        >
          <div className="nav-icon-wrap">
            <MessageCircle size={20} strokeWidth={2} />
            {unreadMsgCount > 0 && (
              <span className="nav-badge" style={{ backgroundColor: '#ef4444', color: 'white' }}>
                {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
              </span>
            )}
          </div>
          <span>Chats</span>
        </div>
        <div className={`mobile-nav-item ${isProfileActive ? 'active' : ''}`} onClick={() => { if (session) { router.push('/profile'); } else { setIsAuthOpen(true); } }}>
          <div className="nav-icon-wrap">
            {session ? (
              renderProfileAvatar(20)
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
          <img src={theme === 'light' ? '/logo-light.svg' : '/logo.svg'} alt="Paoblem Logo" style={{ height: '32px', objectFit: 'contain' }} />
          <button
            className="drawer-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>
        <div className="drawer-content">
          {session ? (
            <div className="drawer-profile" onClick={() => { setIsOpen(false); router.push('/profile'); }} style={{ cursor: 'pointer' }}>
              <div className="drawer-profile-info">
                {renderProfileAvatar(48, 'drawer-profile-avatar')}
                <div className="drawer-profile-details">
                  <div className="drawer-profile-name-row" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span className="drawer-profile-name">{displayName}</span>
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
              className={`drawer-menu-item ${isHomeActive ? 'active' : ''}`} 
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
              className={`drawer-menu-item ${isSolutionsActive ? 'active' : ''}`} 
              onClick={() => { setIsOpen(false); router.push('/solutions'); }}
            >
              <Bookmark size={20} />
              <span>Solutions Feed</span>
            </div>
 
            <div className="drawer-menu-divider" />
 
            <div
              className={`drawer-menu-item ${isProfileActive ? 'active' : ''}`}
              onClick={() => { setIsOpen(false); router.push('/profile'); }}
            >
              <User size={20} />
              <span>My Profile</span>
            </div>
 
            {session && (
              <div className="drawer-menu-item" onClick={handleLogout} style={{ color: '#ef4444' }}>
                <LogOut size={20} />
                <span>Sign Out</span>
              </div>
            )}
          </div>
 
          <div className="drawer-pulse-card">
            <div className="drawer-pulse-head">
              <span>
                <Lightbulb size={15} />
                {isSolutionsActive ? 'Solution Pulse' : 'Problem Pulse'}
              </span>
            </div>
            <div className="drawer-pulse-grid">
              {isSolutionsActive ? (
                <>
                  <div><strong>{pulseStats?.stats?.totalSolutions ?? 0}</strong><span>Total</span></div>
                  <div><strong>{pulseStats?.stats?.problemsSolved ?? 0}</strong><span>Solved</span></div>
                  <div><strong>{pulseStats?.stats?.unsolvedProblems ?? 0}</strong><span>Open</span></div>
                </>
              ) : (
                <>
                  <div><strong>{pulseStats?.postStats?.totalProblems ?? 0}</strong><span>Problems</span></div>
                  <div><strong>{pulseStats?.postStats?.totalIdeas ?? 0}</strong><span>Ideas</span></div>
                  <div><strong>{pulseStats?.postStats?.totalPosts ?? 0}</strong><span>Total</span></div>
                </>
              )}
            </div>
            <p className="drawer-pulse-note">
              {isSolutionsActive ? (
                <>
                  <CheckCircle size={13} />
                  {pulseStats?.stats?.problemsSolved ?? 0} solved, <Clock size={13} /> {pulseStats?.stats?.unsolvedProblems ?? 0} open
                </>
              ) : (
                <>
                  <TrendingUp size={13} />
                  Community problem and idea activity
                </>
              )}
            </p>
          </div>
        </div>
      </div>
  
      {/* Modals */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <DevelopmentNotice isOpen={isNoticeOpen} onClose={() => setIsNoticeOpen(false)} featureName={noticeFeature} />
      <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
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
