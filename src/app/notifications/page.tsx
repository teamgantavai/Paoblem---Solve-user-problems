'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Bell, CheckCircle, Trash2, MoreVertical } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import SidebarLeft from '@/components/SidebarLeft';
import SidebarRight from '@/components/SidebarRight';
import NotificationItem from '@/components/NotificationItem';
import { Notification } from '@/lib/types';

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = () => setMenuOpen(false);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [menuOpen]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoadingSession(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoadingSession(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
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
  });

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

  const clearNotifsMutation = useMutation({
    mutationFn: async () => {
      await fetch('/api/notifications', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', session?.access_token] });
    }
  });

  const handleMarkAllRead = () => {
    notifications.forEach(n => {
      if (!n.read) {
        markNotifReadMutation.mutate({ id: n.id, read: true });
      }
    });
  };

  if (loadingSession) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loader2 size={30} className="spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-container">
        <Navbar />
        <div className="main-content" style={{ justifyContent: 'center', padding: '4rem 1rem' }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <Bell size={48} style={{ color: 'var(--text-muted)' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Sign in to view notifications</h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>Stay updated on who upvotes your posts, comment responses, and community activity.</p>
            <button className="btn btn-primary" onClick={() => router.push('/')}>Go to Home</button>
          </div>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="app-container">
      <Navbar />
      <div className="main-content">
        <SidebarLeft />
        
        <div className="center-feed">
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="notif-page-header">
              <div className="notif-page-title-wrap">
                <h2 className="notif-page-title">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="notif-page-badge">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {(unreadCount > 0 || notifications.length > 0) && (
                <div className="action-dropdown-wrapper">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(!menuOpen);
                    }}
                    className="action-dropdown-trigger"
                    aria-label="Notification actions"
                  >
                    <MoreVertical size={20} />
                  </button>
                  {menuOpen && (
                    <div className="action-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => {
                            handleMarkAllRead();
                            setMenuOpen(false);
                          }}
                          className="action-menu-item"
                        >
                          <CheckCircle size={14} />
                          Mark all as read
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          onClick={() => {
                            clearNotifsMutation.mutate();
                            setMenuOpen(false);
                          }}
                          className="action-menu-item danger"
                        >
                          <Trash2 size={14} />
                          Clear all
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {isLoading ? (
              <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                <Loader2 size={24} className="spin" style={{ margin: '0 auto', color: 'var(--text-muted)' }} />
              </div>
            ) : notifications.length === 0 ? (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Bell size={42} style={{ margin: '0 auto 1rem', color: 'var(--text-muted)', opacity: 0.8 }} />
                <p style={{ fontSize: '1.1rem' }}>All caught up! No notifications yet.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} className="card" style={{ padding: '0.5rem' }}>
                  <NotificationItem
                    notification={notif}
                    onMarkAsRead={(id) => markNotifReadMutation.mutate({ id, read: true })}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        <SidebarRight />
      </div>
    </div>
  );
}
