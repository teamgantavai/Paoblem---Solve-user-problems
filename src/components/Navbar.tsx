'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Home,
  Rocket,
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
import DevelopmentNotice from './DevelopmentNotice';
import NotificationItem from './NotificationItem';
import MessageItem from './MessageItem';
import dynamic from 'next/dynamic';

const AuthModal = dynamic(() => import('./AuthModal'), { ssr: false });
const SettingsModal = dynamic(() => import('./SettingsModal'), { ssr: false });
const SearchOverlay = dynamic(() => import('./SearchOverlay'), { ssr: false });

type NavbarConversationSummary = Message & {
  unread_count?: number;
  last_message?: {
    sender_id?: string;
    content?: string;
    attachments?: unknown[];
  } | null;
};

const NAVBAR_CACHE_TTL_MS = 5 * 60 * 1000;
const NAVBAR_NOTIFICATIONS_CACHE_KEY = 'navbar-notifications-cache';
const NAVBAR_MESSAGES_CACHE_KEY = 'navbar-messages-cache';

function readCachedNavbarData<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: T; cachedAt: number };
    if (!parsed?.data || (Date.now() - parsed.cachedAt) > NAVBAR_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCachedNavbarData<T>(key: string, data: T) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch { }
}

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
  const [visible, setVisible] = useState(true);
  const lastScrollYRef = useRef(0);

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
    if (typeof window === 'undefined') return;

    const handleScroll = () => {
      // Don't hide navbar in desktop mode
      if (window.innerWidth > 768) {
        setVisible(true);
        return;
      }

      const currentScrollY = window.scrollY;
      const lastScrollY = lastScrollYRef.current;

      // Always show at the very top of the page
      if (currentScrollY <= 10) {
        setVisible(true);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      // Scroll threshold to avoid jittery movements
      if (Math.abs(currentScrollY - lastScrollY) < 12) return;

      if (currentScrollY > lastScrollY) {
        // Scrolling down
        setVisible(false);
      } else {
        // Scrolling up
        setVisible(true);
      }
      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
      if (typeof window !== 'undefined' && currentSession?.user?.id !== session?.user?.id) {
        localStorage.removeItem(NAVBAR_NOTIFICATIONS_CACHE_KEY);
        localStorage.removeItem(NAVBAR_MESSAGES_CACHE_KEY);
        localStorage.removeItem('mock_admin');
        queryClient.removeQueries({ queryKey: ['notifications'] });
        queryClient.removeQueries({ queryKey: ['messages'] });
      }
      setSession(currentSession);
    });

    return () => subscription.unsubscribe();
  }, [session?.user?.id, queryClient]);

  const fetchNavProfile = () => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (currentSession) {
        setSession(currentSession);
        supabase
          .from('profiles')
          .select('full_name, avatar_url, role, username')
          .eq('id', currentSession.user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setProfile(data);
              setAvatarFailed(false); // Reset failed flag on fresh fetch
            }
          });
      } else {
        setProfile(null);
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

  useEffect(() => {
    setAvatarFailed(false);
  }, [profile?.avatar_url, session?.user?.user_metadata?.avatar_url]);


  // Fetch unread count only (lightweight COUNT query, no rows transferred)
  const { data: notifCountData } = useQuery<{ count: number }>({
    queryKey: ['notifications-count', session?.access_token],
    queryFn: async () => {
      if (!session?.access_token) return { count: 0 };
      const res = await fetch('/api/notifications/count', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    enabled: !!session?.access_token,
    staleTime: NAVBAR_CACHE_TTL_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchInterval: 60000,
  });
  const notifications = Array.from(
    { length: notifCountData?.count ?? 0 },
    (_, i) => ({ id: `n${i}`, read: false } as AppNotification)
  );

  // Fetch messages counts
  const { data: messages = [] } = useQuery<NavbarConversationSummary[]>({
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
      const nextMessages = data.conversations || data.messages || [];
      writeCachedNavbarData(NAVBAR_MESSAGES_CACHE_KEY, nextMessages);
      return nextMessages;
    },
    enabled: !!session?.access_token,
    initialData: () => readCachedNavbarData<NavbarConversationSummary[]>(NAVBAR_MESSAGES_CACHE_KEY) || undefined,
    staleTime: NAVBAR_CACHE_TTL_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchInterval: 120000
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
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const newMsg = payload.new;
          if (newMsg.sender_id === session.user.id) {
            queryClient.invalidateQueries({ queryKey: ['messages', session.access_token] });
            return;
          }

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
                body: newMsg.content || 'Sent an attachment',
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
      } catch (err) { }
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem(NAVBAR_NOTIFICATIONS_CACHE_KEY);
      localStorage.removeItem(NAVBAR_MESSAGES_CACHE_KEY);
      localStorage.removeItem('mock_admin');
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

  const unreadNotifCount = session?.access_token ? notifications.filter(n => !n.read).length : 0;
  const unreadMsgCount = session?.access_token ? messages.reduce((sum, m) => sum + (m.unread_count || 0), 0) : 0;

  const isHomeActive = pathname === '/' || pathname === '/home';
  const isStartupsActive = pathname === '/startups' || pathname.startsWith('/startups');
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
      <nav className={`navbar ${visible ? '' : 'nav-hidden'}`}>
        <div className="navbar-container">

          <div className="nav-brand">
            <button
              className="menu-toggle-btn"
              onClick={() => setIsOpen(true)}
              aria-label="Open menu"
            >
              <AlignLeft size={20} strokeWidth={2.5} />
            </button>
            <div className="nav-logo-container" onClick={() => router.push('/')} style={{ display: 'inline-flex', cursor: 'pointer' }}>
              <img
                src="/logo.svg"
                alt="Paoblem Logo"
                className="nav-logo logo-dark"
              />
              <img
                src="/logo-light.svg"
                alt="Paoblem Logo"
                className="nav-logo logo-light"
              />
            </div>
          </div>

          <div className="nav-links desktop-only" style={{ position: 'relative' }}>
            <div className={`nav-item ${isHomeActive ? 'active' : ''}`} onClick={() => router.push('/')}>
              <div className="nav-icon-wrap">
                <Home size={22} strokeWidth={2} />
              </div>
              <span>Home</span>
            </div>

            <div className={`nav-item ${isStartupsActive ? 'active' : ''}`} onClick={() => router.push('/startups')}>
              <div className="nav-icon-wrap">
                <Rocket size={22} strokeWidth={2} />
              </div>
              <span>Startups</span>
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
              placeholder="Search anything..."
              readOnly
              style={{ cursor: 'pointer' }}
            />
            <button className="search-btn" aria-label="Submit search" type="button">
              <Search size={16} />
            </button>
          </div>

          <div className="mobile-only" style={{ alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="search-btn"
              style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label="Open Search"
              onClick={() => setIsSearchOpen(true)}
              type="button"
            >
              <Search size={18} strokeWidth={2} />
            </button>

            {session ? (
              <button
                className="search-btn nav-item-notif"
                style={{ position: 'relative' }}
                aria-label="Notifications"
                onClick={() => router.push('/notifications')}
              >
                <Bell size={18} strokeWidth={2} />
                {unreadNotifCount > 0 && (
                  <span className="nav-badge">
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </button>
            ) : (
              <button className="btn btn-primary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }} onClick={() => setIsAuthOpen(true)}>
                Sign In
              </button>
            )}
          </div>

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
        <div className={`mobile-nav-item ${isStartupsActive ? 'active' : ''}`} onClick={() => router.push('/startups')}>
          <div className="nav-icon-wrap">
            <Rocket size={20} strokeWidth={2} />
          </div>
          <span>Startups</span>
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
              className={`drawer-menu-item ${isHomeActive && !searchParams.get('filter') ? 'active' : ''}`}
              onClick={() => { setIsOpen(false); router.push('/'); }}
            >
              <Home size={20} />
              <span>Home Feed</span>
            </div>

            <div
              className={`drawer-menu-item ${pathname === '/analytics' ? 'active' : ''}`}
              onClick={() => {
                setIsOpen(false);
                if (!session) {
                  setIsAuthOpen(true);
                } else {
                  router.push('/analytics');
                }
              }}
            >
              <BarChart2 size={20} />
              <span>Analytics</span>
            </div>

            <div
              className={`drawer-menu-item ${isStartupsActive ? 'active' : ''}`}
              onClick={() => { setIsOpen(false); router.push('/startups'); }}
            >
              <Rocket size={20} />
              <span>Startups Feed</span>
            </div>

            <div
              className={`drawer-menu-item ${isHomeActive && searchParams.get('filter') === 'saved' ? 'active' : ''}`}
              onClick={() => {
                setIsOpen(false);
                router.push('/?filter=saved');
              }}
            >
              <Bookmark size={20} />
              <span>Saved Posts</span>
            </div>

            <div
              className={`drawer-menu-item ${isHomeActive && searchParams.get('filter') === 'mine' ? 'active' : ''}`}
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
