'use client';

import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  useInfiniteQuery, useMutation, useQueryClient,
} from '@tanstack/react-query';
import { MoreHorizontal, CheckCheck, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import SidebarLeft from '@/components/SidebarLeft';
import SidebarRight from '@/components/SidebarRight';
import NotificationItem from '@/components/NotificationItem';
import NotificationSkeleton from '@/components/NotificationSkeleton';
import { Notification } from '@/lib/types';

/* ─────────────────────────────────────────────────────────────────────────────
   CACHE — localStorage, keyed per user, survives tab switches + navigation
   ──────────────────────────────────────────────────────────────────────────── */
const CACHE_VER   = 'nf4';
const STALE_MS    = 3 * 60 * 1000;   // 3 min: no background fetch within this window
const GC_MS       = 15 * 60 * 1000;  // 15 min: TanStack keeps pages in memory

interface NfPage { notifications: Notification[]; nextCursor: string | null; hasMore: boolean; }
interface NfCache { ts: number; page: NfPage; }

const LS = {
  key: (uid: string) => `${CACHE_VER}_${uid}`,
  read(uid: string): NfCache | null {
    try {
      const raw = localStorage.getItem(this.key(uid));
      return raw ? (JSON.parse(raw) as NfCache) : null;
    } catch { return null; }
  },
  write(uid: string, page: NfPage) {
    try { localStorage.setItem(this.key(uid), JSON.stringify({ ts: Date.now(), page })); } catch {}
  },
  drop(uid: string) {
    try { localStorage.removeItem(this.key(uid)); } catch {}
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   SYNCHRONOUS SESSION — read Supabase's own localStorage entry at module level
   so the FIRST render already has the session (no async delay, no spinner)
   ──────────────────────────────────────────────────────────────────────────── */
function readStoredSession(): { access_token: string; user: { id: string } } | null {
  if (typeof window === 'undefined') return null;
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.endsWith('-auth-token')) continue;
      const d = JSON.parse(localStorage.getItem(k) || 'null');
      if (!d?.access_token || !d?.user?.id) continue;
      if (d.expires_at && Math.floor(Date.now() / 1000) > d.expires_at) continue;
      return d;
    }
    return null;
  } catch { return null; }
}

/* ─────────────────────────────────────────────────────────────────────────────
   FILTER
   ──────────────────────────────────────────────────────────────────────────── */
type Tab = 'all' | 'unread' | 'follows' | 'achievements';
const TABS: { key: Tab; label: string }[] = [
  { key: 'all',          label: 'All'          },
  { key: 'unread',       label: 'Unread'       },
  { key: 'follows',      label: 'Follows'      },
  { key: 'achievements', label: 'Achievements' },
];

function applyFilter(items: Notification[], tab: Tab): Notification[] {
  switch (tab) {
    case 'unread':       return items.filter(n => !n.read);
    case 'follows':      return items.filter(n => n.type === 'follow');
    case 'achievements': return items.filter(n => ['achievement','xp','milestone','solved'].includes(n.type));
    default:             return items;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   MEMOIZED ITEM — prevents re-rendering the whole list when one item changes
   ──────────────────────────────────────────────────────────────────────────── */
const MemoItem = memo(NotificationItem, (prev, next) =>
  prev.notification.id   === next.notification.id &&
  prev.notification.read === next.notification.read &&
  prev.isNew             === next.isNew
);

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE
   ──────────────────────────────────────────────────────────────────────────── */
export default function NotificationsPage() {
  const router       = useRouter();
  const queryClient  = useQueryClient();

  // ① Session is read synchronously — first render has the session immediately
  const [session, setSession] = useState<any>(() => readStoredSession());
  const [sessionChecked, setSessionChecked] = useState(() => !!readStoredSession());

  const userId      = session?.user?.id      as string | undefined;
  const accessToken = session?.access_token  as string | undefined;

  // ② Read the localStorage cache synchronously in a stable ref —
  //    only calculated once per userId
  const cacheRef = useRef<NfCache | null>(null);
  if (userId && cacheRef.current === null) {
    cacheRef.current = LS.read(userId); // may be stale — TanStack decides
  }

  const [activeTab,      setActiveTab]     = useState<Tab>('all');
  const [globalMenuOpen, setGlobalMenuOpen]= useState(false);
  const [localReadIds,   setLocalReadIds]  = useState<Set<string>>(new Set());
  const [hiddenIds,      setHiddenIds]     = useState<Set<string>>(new Set());
  const [newIds,         setNewIds]        = useState<Set<string>>(new Set());

  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── Authoritative async session (updates if token refreshes) ──────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) setSession(s);
      setSessionChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
      setSessionChecked(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Close global menu on outside click ────────────────────────────────────
  useEffect(() => {
    if (!globalMenuOpen) return;
    const close = () => setGlobalMenuOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [globalMenuOpen]);

  /* ───────────────────────────────────────────────────────────────────────────
     QUERY — stable key uses userId (NOT access_token which rotates constantly)
     initialData from localStorage → first render shows data with NO skeleton
     initialDataUpdatedAt lets TanStack decide if background refresh is needed
     ─────────────────────────────────────────────────────────────────────────── */
  const cached = cacheRef.current;

  const {
    data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, isFetching,
  } = useInfiniteQuery({
    queryKey: ['nf', userId],   // stable — does NOT change on token refresh
    queryFn: async ({ pageParam = null }: { pageParam?: string | null }) => {
      if (!accessToken || !userId) {
        return { notifications: [], nextCursor: null, hasMore: false };
      }
      const qs  = pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : '';
      const res = await fetch(`/api/notifications?limit=20${qs}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { notifications: [], nextCursor: null, hasMore: false };
      const json: NfPage = await res.json();
      // Write first page to localStorage (background refresh results included)
      if (!pageParam) LS.write(userId, json);
      return json;
    },
    // Seed TanStack from localStorage → instant render, no skeleton on revisit
    initialData: cached
      ? { pages: [cached.page], pageParams: [null] }
      : undefined,
    // When was this data last written? TanStack uses this to decide if stale.
    initialDataUpdatedAt: cached?.ts,
    initialPageParam:   null as string | null,
    getNextPageParam:   (p: any) => p?.nextCursor ?? null,
    enabled:            !!accessToken && !!userId,
    staleTime:          STALE_MS,           // 3 min fresh window — no fetch within this
    gcTime:             GC_MS,              // 15 min in-memory — survives navigation
    refetchOnMount:     true,               // background refresh if stale (shows cache instantly)
    refetchOnWindowFocus: false,            // no refetch on tab switch
    refetchOnReconnect:   false,            // no refetch on reconnect
  });

  // ── Flatten all pages ──────────────────────────────────────────────────────
  const allItems = useMemo<Notification[]>(
    () => (data?.pages ?? []).flatMap((p: any) => p?.notifications ?? []),
    [data]
  );

  // ── Apply optimistic state ─────────────────────────────────────────────────
  const enriched = useMemo(
    () => allItems.map(n => localReadIds.has(n.id) ? { ...n, read: true } : n),
    [allItems, localReadIds]
  );
  const visible  = useMemo(() => enriched.filter(n => !hiddenIds.has(n.id)), [enriched, hiddenIds]);
  const filtered = useMemo(() => applyFilter(visible, activeTab), [visible, activeTab]);
  const unreadCount = useMemo(() => visible.filter(n => !n.read).length, [visible]);

  /* ───────────────────────────────────────────────────────────────────────────
     REALTIME — prepend new notifications via cache mutation (no full reload)
     ─────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`nf:${userId}`)
      .on('postgres_changes' as any, {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload: any) => {
        const newN = payload.new as Notification;
        if (!newN?.id) return;

        // Prepend to TanStack cache directly — no API call, no reload
        queryClient.setQueryData(['nf', userId], (old: any) => {
          if (!old?.pages?.length) return old;
          const firstPage = old.pages[0];
          const alreadyExists = firstPage.notifications.some((n: Notification) => n.id === newN.id);
          if (alreadyExists) return old;
          const updatedPage = {
            ...firstPage,
            notifications: [newN, ...firstPage.notifications],
          };
          return { ...old, pages: [updatedPage, ...old.pages.slice(1)] };
        });

        // Prepend to localStorage cache
        const c = LS.read(userId);
        if (c) LS.write(userId, { ...c.page, notifications: [newN, ...c.page.notifications] });

        // Brief entry animation
        setNewIds(prev => new Set(prev).add(newN.id));
        setTimeout(() => setNewIds(prev => { const s = new Set(prev); s.delete(newN.id); return s; }), 800);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, queryClient]);

  /* ───────────────────────────────────────────────────────────────────────────
     INFINITE SCROLL
     ─────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage(); },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  /* ───────────────────────────────────────────────────────────────────────────
     MUTATIONS — fire-and-forget; optimistic state handles UI instantly
     ─────────────────────────────────────────────────────────────────────────── */
  const markRead = useMutation({
    mutationFn: async (id: string) => {
      if (!accessToken) return;
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ id, read: true }),
      });
    },
    onMutate: async (id: string) => {
      if (!userId) return;
      await queryClient.cancelQueries({ queryKey: ['nf', userId] });
      const previousData = queryClient.getQueryData(['nf', userId]);

      // Update TanStack Query cache
      queryClient.setQueryData(['nf', userId], (old: any) => {
        if (!old?.pages?.length) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            notifications: page.notifications.map((n: Notification) =>
              n.id === id ? { ...n, read: true } : n
            ),
          })),
        };
      });

      // Update localStorage cache
      const cached = LS.read(userId);
      if (cached) {
        const updatedPage = {
          ...cached.page,
          notifications: cached.page.notifications.map((n: Notification) =>
            n.id === id ? { ...n, read: true } : n
          ),
        };
        LS.write(userId, updatedPage);
      }

      // Invalidate the unread count in Navbar
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });

      return { previousData };
    },
    onError: (err, id, context: any) => {
      if (userId && context?.previousData) {
        queryClient.setQueryData(['nf', userId], context.previousData);
      }
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!accessToken) return;
      await fetch('/api/notifications?markAllRead=true', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    },
    onMutate: async () => {
      if (!userId) return;
      await queryClient.cancelQueries({ queryKey: ['nf', userId] });
      const previousData = queryClient.getQueryData(['nf', userId]);

      // Update TanStack Query cache
      queryClient.setQueryData(['nf', userId], (old: any) => {
        if (!old?.pages?.length) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            notifications: page.notifications.map((n: Notification) => ({ ...n, read: true })),
          })),
        };
      });

      // Update localStorage cache
      const cached = LS.read(userId);
      if (cached) {
        const updatedPage = {
          ...cached.page,
          notifications: cached.page.notifications.map((n: Notification) => ({ ...n, read: true })),
        };
        LS.write(userId, updatedPage);
      }

      // Invalidate the unread count in Navbar
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });

      return { previousData };
    },
    onError: (err, variables, context: any) => {
      if (userId && context?.previousData) {
        queryClient.setQueryData(['nf', userId], context.previousData);
      }
    },
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      if (!accessToken) return;
      await fetch(`/api/notifications?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    },
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      if (!accessToken) return;
      await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    },
    onSuccess: () => {
      if (userId) LS.drop(userId);
      setHiddenIds(new Set(allItems.map(n => n.id)));
      setGlobalMenuOpen(false);
    },
  });

  /* ───────────────────────────────────────────────────────────────────────────
     HANDLERS
     ─────────────────────────────────────────────────────────────────────────── */
  const handleMarkRead = useCallback((id: string) => {
    setLocalReadIds(p => new Set(p).add(id));
    markRead.mutate(id);
  }, [markRead]);

  const handleMarkAllRead = useCallback(() => {
    const unread = new Set(visible.filter(n => !n.read).map(n => n.id));
    setLocalReadIds(p => new Set([...p, ...unread]));
    markAllRead.mutate();
    setGlobalMenuOpen(false);
  }, [visible, markAllRead]);

  const handleDelete = useCallback((id: string) => {
    setHiddenIds(p => new Set(p).add(id));
    deleteOne.mutate(id);
  }, [deleteOne]);

  const handleHide = useCallback((id: string) => {
    setHiddenIds(p => new Set(p).add(id));
  }, []);

  /* ───────────────────────────────────────────────────────────────────────────
     RENDER
     ─────────────────────────────────────────────────────────────────────────── */

  // Skeleton ONLY if no cached data at all (true first visit)
  const showSkeleton = isLoading && !cached;

  // Loading state — brief flicker while async session resolves (< 100ms)
  if (!sessionChecked && !session) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Loader2 size={22} className="nf-spin" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
      </div>
    );
  }

  // Not authenticated
  if (sessionChecked && !session) {
    return (
      <div className="app-container">
        <Navbar />
        <div className="main-content" style={{ justifyContent: 'center', padding: '4rem 1rem' }}>
          <div className="nf-auth-required">
            <div style={{ fontSize: '3rem' }}>🔔</div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Sign in to see notifications
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 260, lineHeight: 1.55, margin: 0 }}>
              Stay updated on likes, comments, and everything happening on your posts.
            </p>
            <button className="nf-empty-cta" onClick={() => router.push('/')}>Go to Home</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar />
      <div className="main-content">
        <SidebarLeft />

        <div className="center-feed">
          <div className="nf-page-wrapper">

            {/* ── Sticky header ── */}
            <div className="nf-header">
              <div className="nf-header-top">
                <div className="nf-title-row">
                  <h1 className="nf-title">Notifications</h1>
                  {unreadCount > 0 && (
                    <span className="nf-unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                  )}
                  {/* Tiny spinner for silent background refresh — NOT a blocker */}
                  {isFetching && !isLoading && !isFetchingNextPage && (
                    <Loader2
                      size={11}
                      className="nf-spin"
                      style={{ color: 'var(--text-muted)', opacity: 0.4, marginLeft: 2 }}
                    />
                  )}
                </div>

                <div className="nf-header-actions">
                  <div className="nf-global-menu-wrapper" onClick={e => e.stopPropagation()}>
                    <button
                      className="nf-header-btn"
                      aria-label="Notification options"
                      onClick={e => { e.stopPropagation(); setGlobalMenuOpen(o => !o); }}
                    >
                      <MoreHorizontal size={18} />
                    </button>

                    {globalMenuOpen && (
                      <div className="nf-global-menu" onClick={e => e.stopPropagation()}>
                        {unreadCount > 0 && (
                          <button className="nf-global-menu-item" onClick={handleMarkAllRead}>
                            <CheckCheck size={14} /> Mark all as read
                          </button>
                        )}
                        {visible.length > 0 && (
                          <button className="nf-global-menu-item danger" onClick={() => clearAll.mutate()}>
                            <Trash2 size={14} /> Clear all
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="nf-filter-tabs" role="tablist">
                {TABS.map(tab => (
                  <button
                    key={tab.key}
                    className={`nf-tab ${activeTab === tab.key ? 'active' : ''}`}
                    role="tab"
                    aria-selected={activeTab === tab.key}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                    {tab.key === 'unread' && unreadCount > 0 && (
                      <span style={{
                        marginLeft: '0.3rem',
                        background: 'var(--accent-primary)', color: '#fff',
                        fontSize: '0.6rem', fontWeight: 700,
                        padding: '0.05rem 0.35rem', borderRadius: '10px',
                      }}>
                        {unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Feed ── */}
            {showSkeleton ? (
              // ONLY shown on true first visit (no cache at all)
              <NotificationSkeleton count={7} />
            ) : filtered.length === 0 ? (
              <div className="nf-empty">
                <div className="nf-empty-icon">
                  {activeTab === 'follows' ? '👤' : activeTab === 'achievements' ? '🏆' : activeTab === 'unread' ? '✅' : '🔔'}
                </div>
                <h2 className="nf-empty-title">
                  {activeTab === 'unread' ? 'All caught up!' : 'No notifications yet'}
                </h2>
                <p className="nf-empty-subtitle">
                  {activeTab === 'unread'
                    ? "You've read everything. Check back later."
                    : "When people interact with your posts, you'll see it here."}
                </p>
                <button className="nf-empty-cta" onClick={() => router.push('/home')}>
                  Explore Feed
                </button>
              </div>
            ) : (
              <>
                <div className="nf-feed" role="list">
                  {filtered.map(notif => (
                    <MemoItem
                      key={notif.id}
                      notification={notif}
                      onMarkAsRead={handleMarkRead}
                      onDelete={handleDelete}
                      onHide={handleHide}
                      isNew={newIds.has(notif.id)}
                    />
                  ))}
                </div>

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="nf-load-more-sentinel">
                  {isFetchingNextPage ? (
                    <><Loader2 size={14} className="nf-spin" /> Loading more…</>
                  ) : hasNextPage ? (
                    <span style={{ opacity: 0 }}>•</span>
                  ) : filtered.length > 4 ? (
                    <span>You're all caught up 🎉</span>
                  ) : null}
                </div>
              </>
            )}

          </div>
        </div>

        <SidebarRight />
      </div>
    </div>
  );
}
