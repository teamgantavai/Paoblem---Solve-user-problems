'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Rocket, SlidersHorizontal, Sparkles, TrendingUp, Clock,
  Plus, X, Loader2, Search, Users
} from 'lucide-react';

import Navbar from '@/components/Navbar';
import SidebarLeft from '@/components/SidebarLeft';
import SidebarRight from '@/components/SidebarRight';
import StartupCard from '@/components/StartupCard';
import ApplyToStartupModal from '@/components/ApplyToStartupModal';
import AuthModal from '@/components/AuthModal';
import Avatar from '@/components/Avatar';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { Startup } from '@/lib/types';
import {
  STARTUP_STAGES, LOOKING_FOR_OPTIONS,
  INDUSTRY_OPTIONS
} from '@/lib/startupMatching';

const ShareModal = dynamic(() => import('./ShareModal'), { ssr: false });
const ShareInAppChatsModal = dynamic(() => import('./ShareInAppChatsModal'), { ssr: false });



type SortMode = 'newest' | 'trending' | 'ai';
type FilterState = {
  stage: string;
  industry: string;
  role: string;
  skills: string[];
  compensation: string;
  work_type: string;
  hiring_status: string;
};

const DEFAULT_FILTERS: FilterState = {
  stage: '', industry: '', role: '', skills: [], compensation: '', work_type: '', hiring_status: '',
};

function SkeletonCard() {
  return (
    <div className="startup-skeleton">
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.875rem' }}>
        <div className="skel-avatar" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div className="skel-line" style={{ height: 12, width: '45%' }} />
          <div className="skel-line" style={{ height: 10, width: '28%' }} />
        </div>
        <div className="skel-line" style={{ height: 22, width: 60, borderRadius: 20 }} />
      </div>
      <div className="skel-line" style={{ height: 18, width: '70%', marginBottom: '0.4rem' }} />
      <div className="skel-line" style={{ height: 12, width: '90%', marginBottom: '0.875rem' }} />
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skel-line" style={{ height: 24, width: 80, borderRadius: 20 }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skel-line" style={{ height: 22, width: 60, borderRadius: 6 }} />
        ))}
      </div>
    </div>
  );
}

export default function StartupsPageClient() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [startups, setStartups] = useState<Startup[]>([]);
  const [recommended, setRecommended] = useState<Startup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [applyStartup, setApplyStartup] = useState<Startup | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [selectedShareStartup, setSelectedShareStartup] = useState<Startup | null>(null);
  const [selectedChatShareStartup, setSelectedChatShareStartup] = useState<Startup | null>(null);
  const searchParams = useSearchParams();
  const urlQuery = searchParams?.get('q') || '';
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [profile, setProfile] = useState<any>(null);

  // Auth & Profile
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user?.id) {
        supabase
          .from('profiles')
          .select('avatar_url, full_name, username')
          .eq('id', s.user.id)
          .single()
          .then(({ data }) => {
            if (data) setProfile(data);
          });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      if (s?.user?.id) {
        supabase
          .from('profiles')
          .select('avatar_url, full_name, username')
          .eq('id', s.user.id)
          .single()
          .then(({ data }) => {
            if (data) setProfile(data);
          });
      } else {
        setProfile(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch feed
  const fetchStartups = useCallback(async (cursor: string | null = null, append = false) => {
    if (append) setIsFetchingMore(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      params.set('sort', sortMode);
      if (urlQuery) params.set('q', urlQuery);
      if (filters.stage) params.set('stage', filters.stage);
      if (filters.industry) params.set('industry', filters.industry);
      if (filters.role) params.set('role', filters.role);
      if (filters.skills.length > 0) params.set('skills', filters.skills.join(','));
      if (filters.compensation) params.set('compensation', filters.compensation);
      if (filters.work_type) params.set('work_type', filters.work_type);
      if (filters.hiring_status) params.set('hiring_status', filters.hiring_status);

      const res = await fetch(`/api/startups?${params}`, {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });

      if (!res.ok) throw new Error('Failed to load startups');
      const data = await res.json();

      if (append) {
        setStartups((prev) => [...prev, ...(data.startups || [])]);
      } else {
        setStartups(data.startups || []);
        if (data.recommended?.length > 0) {
          setRecommended(data.recommended);
        }
      }
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  }, [session?.access_token, sortMode, filters, urlQuery]);

  useEffect(() => {
    fetchStartups(null, false);
  }, [fetchStartups]);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !isFetchingMore && hasMore) fetchStartups(nextCursor, true); },
      { threshold: 0.1 }
    );
    obs.observe(loadMoreRef.current);
    return () => obs.disconnect();
  }, [hasMore, isFetchingMore, nextCursor, fetchStartups]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleApply = async (startup: Startup, intro: string, reason: string, portfolioLinks: string[]) => {
    if (!session?.access_token) { setIsAuthOpen(true); return; }
    const res = await fetch(`/api/startups/${startup.id}/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ intro, reason, portfolio_links: portfolioLinks }),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error || 'Failed to apply');
    }
    setStartups((prev) =>
      prev.map((s) => s.id === startup.id ? { ...s, has_applied: true } : s)
    );
    setApplyStartup(null);
    showToast('✓ Application submitted!');
  };

  const setFilter = (key: keyof FilterState, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    router.push('/startups');
  };

  const hasActiveFilters = Object.values(filters).some((v) =>
    Array.isArray(v) ? v.length > 0 : !!v
  ) || !!urlQuery;

  return (
    <>
      <Navbar />
      <div className="main-content">
        <SidebarLeft />
        <div className="center-feed">
          <div className="startups-layout">



            {/* Startup Composer Box */}
            {session && (
              <div className="card composer-card" onClick={() => router.push('/startups/create')} style={{ cursor: 'pointer', marginBottom: '0.85rem' }}>
                <div className="composer-top">
                  <Avatar src={profile?.avatar_url || session?.user?.user_metadata?.avatar_url} name="You" className="composer-avatar" size={36} />
                  <div className="composer-input-wrap">
                    <div className="composer-input" style={{ color: 'var(--text-muted)', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      What&apos;s your Startup?
                    </div>
                  </div>
                </div>
                <div className="composer-divider" />
                <div className="composer-actions">
                  <div className="composer-action-group">
                    <div className="composer-action-btn">
                      <Rocket size={16} color="var(--text-muted)" />
                      <span>Stage</span>
                    </div>
                    <div className="composer-action-btn">
                      <Users size={16} color="var(--text-muted)" />
                      <span>Teammates</span>
                    </div>
                    <div className="composer-action-btn">
                      <Sparkles size={16} color="var(--text-muted)" />
                      <span>AI Match</span>
                    </div>
                  </div>
                  <button className="composer-send-btn" type="button">
                    <span>Launch</span><Plus size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Sort Tabs */}
            <div className="flex gap-2" style={{ margin: '0.5rem 0 1rem 0', padding: '0.25rem 0', overflowX: 'auto', whiteSpace: 'nowrap', maxWidth: '100%', scrollbarWidth: 'none', display: 'flex', gap: '0.45rem' }}>
              {([
                { key: 'newest', label: 'Newest', icon: <Clock size={13} /> },
                { key: 'trending', label: 'Trending', icon: <TrendingUp size={13} /> },
                { key: 'ai', label: 'AI Match', icon: <Sparkles size={13} /> },
              ] as const).map(({ key, label, icon }) => (
                <button
                  key={key}
                  className={`btn ${sortMode === key ? 'btn-primary' : ''}`}
                  style={{
                    background: sortMode === key ? 'linear-gradient(135deg, var(--accent-primary) 0%, #1d4ed8 100%)' : 'var(--bg-card)',
                    color: sortMode === key ? 'white' : 'var(--text-muted)',
                    border: '1px solid ' + (sortMode === key ? 'transparent' : 'var(--border-color)'),
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.5rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    boxShadow: sortMode === key ? '0 4px 10px rgba(37, 99, 235, 0.2)' : 'none',
                    transition: 'all 200ms ease'
                  }}
                  onClick={() => setSortMode(key)}
                >
                  {icon} {label}
                </button>
              ))}
              
              <button
                className={`btn ${showFilters || hasActiveFilters ? 'btn-primary' : ''}`}
                style={{
                  background: (showFilters || hasActiveFilters) ? 'linear-gradient(135deg, var(--accent-primary) 0%, #1d4ed8 100%)' : 'var(--bg-card)',
                  color: (showFilters || hasActiveFilters) ? 'white' : 'var(--text-muted)',
                  border: '1px solid ' + ((showFilters || hasActiveFilters) ? 'transparent' : 'var(--border-color)'),
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '10px',
                  marginLeft: 'auto',
                  cursor: 'pointer',
                  boxShadow: (showFilters || hasActiveFilters) ? '0 4px 10px rgba(37, 99, 235, 0.2)' : 'none',
                  transition: 'all 200ms ease'
                }}
                onClick={() => setShowFilters(true)}
              >
                <SlidersHorizontal size={13} />
                Filters
                {hasActiveFilters && (
                  <span style={{
                    background: (showFilters || hasActiveFilters) ? 'rgba(255, 255, 255, 0.25)' : 'var(--accent-primary)',
                    color: 'white',
                    borderRadius: '50%', width: 16, height: 16,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.65rem', fontWeight: 700, flexShrink: 0, marginLeft: '0.2rem'
                  }}>!</span>
                )}
              </button>
            </div>

            {/* ── AI Recommended Banner ── */}
            {sortMode === 'ai' && session && recommended.length > 0 && !isLoading && (
              <div className="recommended-for-you" style={{ marginTop: '0.75rem' }}>
                <div className="rfy-title">
                  <Sparkles size={13} /> Recommended For You
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Based on your skills, interests, and profile — startups most likely to be a great fit.
                </p>
              </div>
            )}

            {/* ── Feed ── */}
            {isLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : startups.length === 0 ? (
              <div className="startups-empty">
                <div className="startups-empty-icon">
                  <Rocket size={26} />
                </div>
                <h3>No Startups Found</h3>
                <p>
                  {hasActiveFilters
                    ? 'No startups match your current filters. Try adjusting them.'
                    : 'Be the first to post your startup and find your dream team.'}
                </p>
                {hasActiveFilters ? (
                  <button type="button" className="sc-view-btn" onClick={clearFilters}>
                    Clear Filters
                  </button>
                ) : (
                  <button
                    type="button"
                    className="startups-create-btn"
                    onClick={() => {
                      if (!session) { setIsAuthOpen(true); return; }
                      router.push('/startups/create');
                    }}
                  >
                    <Plus size={14} /> Post Your Startup
                  </button>
                )}
              </div>
            ) : (
              <>
                {startups.map((startup) => (
                  <StartupCard
                    key={startup.id}
                    startup={startup}
                    onApply={(s) => setApplyStartup(s)}
                    session={session}
                    onAuthRequired={() => setIsAuthOpen(true)}
                    searchQuery={urlQuery}
                    onShareClick={(s) => setSelectedShareStartup(s)}
                    onChatShareClick={(s) => setSelectedChatShareStartup(s)}
                  />
                ))}

                {/* Load more trigger */}
                <div ref={loadMoreRef} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isFetchingMore && <Loader2 size={20} className="spin" style={{ color: 'var(--text-muted)' }} />}
                </div>

                {!hasMore && startups.length > 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', padding: '1rem', marginBottom: '4rem' }}>
                    You&apos;ve seen all startups 🚀
                  </p>
                )}
              </>
            )}

          </div>
        </div>
        <SidebarRight />
      </div>

      {/* Apply Modal */}
      {applyStartup && (
        <ApplyToStartupModal
          startup={applyStartup}
          onClose={() => setApplyStartup(null)}
          onSubmit={(intro, reason, links) => handleApply(applyStartup, intro, reason, links)}
        />
      )}

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      {/* Filter Modal */}
      {showFilters && (
        <div className="filter-modal-backdrop" onClick={() => setShowFilters(false)}>
          <div className="filter-modal" onClick={(e) => e.stopPropagation()}>
            <div className="filter-modal-header">
              <div>
                <h3 className="filter-modal-title">Filter Startups</h3>
                <p className="filter-modal-subtitle">Narrow down startup opportunities</p>
              </div>
              <button className="filter-modal-close" onClick={() => setShowFilters(false)}>
                <X size={18} />
              </button>
            </div>
            
            <div className="filter-modal-body">
              {/* Stage */}
              <div>
                <div className="filter-section-title">Stage</div>
                <div className="startups-filter-bar" style={{ padding: '0', borderBottom: 'none' }}>
                  {STARTUP_STAGES.map((s) => (
                    <button
                      key={s}
                      className={`sf-chip ${filters.stage === s ? 'active' : ''}`}
                      onClick={() => setFilter('stage', filters.stage === s ? '' : s)}
                      type="button"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Industry */}
              <div>
                <div className="filter-section-title">Industry</div>
                <div className="startups-filter-bar" style={{ padding: '0', borderBottom: 'none' }}>
                  {INDUSTRY_OPTIONS.map((ind) => (
                    <button
                      key={ind}
                      className={`sf-chip ${filters.industry === ind ? 'active' : ''}`}
                      onClick={() => setFilter('industry', filters.industry === ind ? '' : ind)}
                      type="button"
                    >
                      {ind}
                    </button>
                  ))}
                </div>
              </div>

              {/* Looking For */}
              <div>
                <div className="filter-section-title">Looking For</div>
                <div className="startups-filter-bar" style={{ padding: '0', borderBottom: 'none' }}>
                  {LOOKING_FOR_OPTIONS.slice(0, 8).map((role) => (
                    <button
                      key={role}
                      className={`sf-chip ${filters.role === role ? 'active' : ''}`}
                      onClick={() => setFilter('role', filters.role === role ? '' : role)}
                      type="button"
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compensation */}
              <div>
                <div className="filter-section-title">Compensation</div>
                <div className="startups-filter-bar" style={{ padding: '0', borderBottom: 'none' }}>
                  {['Equity', 'Paid', 'Internship', 'Volunteer', 'Revenue Share'].map((comp) => (
                    <button
                      key={comp}
                      className={`sf-chip ${filters.compensation === comp ? 'active' : ''}`}
                      onClick={() => setFilter('compensation', filters.compensation === comp ? '' : comp)}
                      type="button"
                    >
                      {comp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Work Type */}
              <div>
                <div className="filter-section-title">Work Type</div>
                <div className="startups-filter-bar" style={{ padding: '0', borderBottom: 'none' }}>
                  {['Remote', 'Hybrid', 'On-site'].map((wt) => (
                    <button
                      key={wt}
                      className={`sf-chip ${filters.work_type === wt ? 'active' : ''}`}
                      onClick={() => setFilter('work_type', filters.work_type === wt ? '' : wt)}
                      type="button"
                    >
                      {wt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hiring Status */}
              <div>
                <div className="filter-section-title">Hiring Status</div>
                <div className="startups-filter-bar" style={{ padding: '0', borderBottom: 'none' }}>
                  {['Hiring', 'Urgent Hiring', 'Hiring Soon', 'Positions Filled', 'Not Hiring', 'Always Hiring'].map((status) => (
                    <button
                      key={status}
                      className={`sf-chip ${filters.hiring_status === status ? 'active' : ''}`}
                      onClick={() => setFilter('hiring_status', filters.hiring_status === status ? '' : status)}
                      type="button"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="filter-modal-footer">
              {hasActiveFilters && (
                <button type="button" className="filter-modal-clear-btn" onClick={clearFilters}>
                  Clear All
                </button>
              )}
              <button type="button" className="filter-modal-apply-btn" onClick={() => setShowFilters(false)}>
                Show Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="startup-toast">{toast}</div>}

      {selectedShareStartup && (
        <ShareModal
          isOpen={!!selectedShareStartup}
          onClose={() => setSelectedShareStartup(null)}
          post={{
            id: selectedShareStartup.id,
            title: selectedShareStartup.name,
            body: selectedShareStartup.tagline || selectedShareStartup.description || '',
            slug: undefined,
            user_id: selectedShareStartup.founder_id,
            profiles: selectedShareStartup.profiles,
            type: 'startup'
          } as any}
          session={session}
        />
      )}

      {selectedChatShareStartup && (
        <ShareInAppChatsModal
          isOpen={!!selectedChatShareStartup}
          onClose={() => setSelectedChatShareStartup(null)}
          post={{
            id: selectedChatShareStartup.id,
            title: selectedChatShareStartup.name,
            body: selectedChatShareStartup.tagline || selectedChatShareStartup.description || '',
            slug: undefined,
            user_id: selectedChatShareStartup.founder_id,
            profiles: selectedChatShareStartup.profiles,
            type: 'startup'
          } as any}
          session={session}
        />
      )}
    </>
  );
}
