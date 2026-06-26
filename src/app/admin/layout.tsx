'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Users, FileText, MessageSquare, ShieldAlert,
  FolderHeart, Bell, Settings, Activity, ClipboardList,
  Sun, Moon, Home, LogOut, Loader2, ArrowLeftRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ADMIN_EMAIL } from '@/lib/adminConstants';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Verify theme on load
  useEffect(() => {
    const isLight = document.documentElement.classList.contains('light-theme');
    setTheme(isLight ? 'light' : 'dark');
  }, []);

  const toggleTheme = () => {
    if (theme === 'dark') {
      document.documentElement.classList.add('light-theme');
      localStorage.setItem('theme', 'light');
      setTheme('light');
    } else {
      document.documentElement.classList.remove('light-theme');
      localStorage.setItem('theme', 'dark');
      setTheme('dark');
    }
  };

  // Auth checker logic
  const checkAuth = useCallback(async (currentSession: any) => {
    const isDev = process.env.NODE_ENV === 'development';
    let hasMockBypass = false;
    
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mockAdmin') === 'true' && isDev) {
        localStorage.setItem('mock_admin', 'true');
      }
      hasMockBypass = localStorage.getItem('mock_admin') === 'true';
    }

    if (isDev && hasMockBypass) {
      setSession({
        user: { email: ADMIN_EMAIL },
        access_token: 'mock-admin-token'
      });
      setAuthLoading(false);
      return;
    }

    if (!currentSession) {
      setAuthLoading(false);
      router.replace('/403');
      return;
    }

    const { data: { user }, error } = await supabase.auth.getUser(currentSession.access_token);
    
    if (error || !user || user.email !== ADMIN_EMAIL) {
      setAuthLoading(false);
      router.replace('/403');
      return;
    }

    setSession(currentSession);
    setAuthLoading(false);
  }, [router]);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      checkAuth(s);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      checkAuth(currentSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkAuth]);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    let lastKey = '';
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is typing in input or textarea, skip shortcut
      const activeEl = document.activeElement?.tagName;
      if (activeEl === 'INPUT' || activeEl === 'TEXTAREA') return;

      const key = e.key.toLowerCase();
      if (lastKey === 'g') {
        e.preventDefault();
        lastKey = ''; // Reset
        switch (key) {
          case 'd': router.push('/admin'); break;
          case 'u': router.push('/admin/users'); break;
          case 'p': router.push('/admin/posts'); break;
          case 'c': router.push('/admin/comments'); break;
          case 'm': router.push('/admin/moderation'); break;
          case 't': router.push('/admin/categories'); break;
          case 'n': router.push('/admin/notifications'); break;
          case 's': router.push('/admin/settings'); break;
          case 'h': router.push('/admin/performance'); break;
          case 'l': router.push('/admin/logs'); break;
          default: break;
        }
      } else if (key === 'g') {
        lastKey = 'g';
        // Auto reset lastKey after 1 second if no follow up key is pressed
        setTimeout(() => {
          if (lastKey === 'g') lastKey = '';
        }, 1000);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  // Sidebar Menu Items
  const menuItems = [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { label: 'Users', path: '/admin/users', icon: Users },
    { label: 'Posts', path: '/admin/posts', icon: FileText },
    { label: 'Comments', path: '/admin/comments', icon: MessageSquare },
    { label: 'Moderation Queue', path: '/admin/moderation', icon: ShieldAlert },
    { label: 'Categories', path: '/admin/categories', icon: FolderHeart },
    { label: 'Notifications', path: '/admin/notifications', icon: Bell },
    { label: 'Settings', path: '/admin/settings', icon: Settings },
    { label: 'Performance & Health', path: '/admin/performance', icon: Activity },
    { label: 'Audit Logs', path: '/admin/logs', icon: ClipboardList },
  ];

  // Breadcrumbs title helper
  const getBreadcrumbTitle = () => {
    const currentItem = menuItems.find(item => item.path === pathname);
    return currentItem ? currentItem.label : 'Admin';
  };

  const handleSignOut = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mock_admin');
    }
    await supabase.auth.signOut();
    router.push('/');
  };

  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        color: '#ffffff',
        fontFamily: 'sans-serif'
      }}>
        <Loader2 size={40} className="animate-spin" style={{ color: '#2563eb', marginBottom: '1rem' }} />
        <p style={{ color: '#a3a3a3', fontSize: '0.9rem', fontWeight: 500 }}>Authenticating admin session...</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="admin-container">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <ArrowLeftRight size={24} style={{ color: 'var(--accent-primary)' }} />
          <span>Paoblem</span>
          <span className="admin-badge">Admin</span>
        </div>
        
        <nav className="admin-sidebar-menu">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`admin-menu-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Link href="/" className="admin-menu-item">
            <Home size={18} />
            <span>Go to Live App</span>
          </Link>
          <button onClick={handleSignOut} className="admin-menu-item text-red-500" style={{ color: 'var(--accent-danger)' }}>
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Page Area */}
      <main className="admin-main">
        {/* Sticky Header */}
        <header className="admin-header">
          <div className="admin-breadcrumbs">
            <Link href="/admin">Admin</Link>
            <span className="admin-breadcrumbs-separator">/</span>
            <span className="admin-breadcrumbs-current">{getBreadcrumbTitle()}</span>
          </div>

          <div className="admin-header-actions">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Logged in: <strong>{session.user.email}</strong>
            </span>
            <button
              onClick={toggleTheme}
              className="admin-theme-btn"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* Section Content */}
        <div className="admin-content">
          {children}
        </div>
      </main>
    </div>
  );
}
