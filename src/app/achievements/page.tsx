'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import BadgeCard from '@/components/badges/BadgeCard';
import BadgeShowcaseModal from '@/components/badges/BadgeShowcaseModal';
import {
  BADGE_DEFINITIONS,
  RARITY_CONFIG,
  CATEGORY_CONFIG,
  type BadgeCategory,
  type BadgeRarity,
} from '@/lib/badgeDefinitions';
import Navbar from '@/components/Navbar';

// Score weightings for Aura calculation
const RARITY_POINTS: Record<BadgeRarity, number> = {
  common: 10,
  uncommon: 25,
  rare: 60,
  epic: 120,
  legendary: 250,
  mythic: 600,
};

function getBadgeProgress(badge: any, stats: any, isEarned?: boolean) {
  const cond = badge.unlock_condition;
  if (!cond) return { current: 0, target: 0 };

  const threshold = cond.threshold || 0;
  if (isEarned) {
    return { current: threshold, target: threshold };
  }

  const currentStats = stats || {};

  switch (cond.type) {
    case 'post_count':
      if (cond.post_type === 'problem') return { current: currentStats.problemCount || 0, target: threshold };
      if (cond.post_type === 'idea') return { current: currentStats.ideaCount || 0, target: threshold };
      if (cond.post_type === 'startup') return { current: currentStats.startupCount || 0, target: threshold };
      return { current: currentStats.postCount || 0, target: threshold };
    case 'comment_count':
      return { current: currentStats.commentCount || 0, target: threshold };
    case 'solution_count':
      return { current: currentStats.solutionCount || 0, target: threshold };
    case 'upvotes_received':
      return { current: currentStats.totalUpvotes || 0, target: threshold };
    case 'views_count':
      return { current: currentStats.totalViews || 0, target: threshold };
    case 'streak_days':
      return { current: currentStats.streakDays || 0, target: threshold };
    case 'special':
      return { current: 0, target: threshold || 1 };
    default:
      return { current: 0, target: threshold };
  }
}

function getProgressUnit(badge: any) {
  const cond = badge.unlock_condition;
  if (!cond) return '';
  const threshold = cond.threshold || 0;
  const isPlural = threshold !== 1;

  switch (cond.type) {
    case 'post_count':
      return isPlural ? 'posts' : 'post';
    case 'comment_count':
      return isPlural ? 'comments' : 'comment';
    case 'solution_count':
      return isPlural ? 'solutions' : 'solution';
    case 'upvotes_received':
      return isPlural ? 'upvotes' : 'upvote';
    case 'views_count':
      return isPlural ? 'views' : 'view';
    case 'streak_days':
      return isPlural ? 'days' : 'day';
    default:
      return '';
  }
}

export default function AchievementsPage() {
  return (
    <Suspense fallback={null}>
      <AchievementsPageContent />
    </Suspense>
  );
}

function AchievementsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [userBadges, setUserBadges] = useState<Record<string, { earned_at: string; is_featured: boolean }>>({});
  const [userStats, setUserStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [earnedFilter, setEarnedFilter] = useState<'all' | 'earned' | 'locked'>('all');
  const [selectedRarity, setSelectedRarity] = useState<BadgeRarity | 'all'>('all');

  // Interactive details modal
  const [selectedBadge, setSelectedBadge] = useState<any | null>(null);



  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/');
        return;
      }
      setUserId(session.user.id);
    });
  }, [router]);

  // Load earned badges and user stats
  const loadBadges = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/badges/user/${userId}`);
      if (!res.ok) return;
      const data = await res.json();

      const map: Record<string, { earned_at: string; is_featured: boolean }> = {};
      (data.badges || []).forEach((ub: any) => {
        if (ub.badge_definitions) {
          map[ub.badge_definitions.slug] = {
            earned_at: ub.earned_at,
            is_featured: ub.is_featured,
          };
        }
      });
      setUserBadges(map);
      if (data.stats) {
        setUserStats(data.stats);
      }
    } catch (_err) {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      loadBadges();
    }
  }, [userId, loadBadges]);

  // Auto-open showcase modal if `badge` query param exists in the URL
  useEffect(() => {
    if (loading || Object.keys(userBadges).length === 0) return;
    const badgeSlug = searchParams.get('badge');
    if (badgeSlug) {
      const match = BADGE_DEFINITIONS.find(b => b.slug === badgeSlug);
      if (match) {
        const isEarned = !!userBadges[badgeSlug];
        const { current, target } = getBadgeProgress(match, userStats, isEarned);
        setSelectedBadge({
          ...match,
          earned: isEarned,
          earned_at: isEarned ? userBadges[badgeSlug].earned_at : null,
          progressCurrent: current,
          progressTarget: target,
          progressUnit: getProgressUnit(match),
        });
      }
    }
  }, [searchParams, userBadges, loading, userStats]);

  // Derived statistics
  const totalBadgesCount = BADGE_DEFINITIONS.length;
  const earnedCount = Object.keys(userBadges).length;

  const prestigeScore = useMemo(() => {
    return BADGE_DEFINITIONS.reduce((total, b) => {
      if (userBadges[b.slug]) {
        return total + (b.rep_reward || 0);
      }
      return total;
    }, 0);
  }, [userBadges]);

  const categoriesList = ['creator', 'community', 'consistency', 'popularity', 'knowledge', 'founder', 'special', 'hidden'] as BadgeCategory[];

  if (loading) {
    return (
      <>
        <Navbar />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🏆</div>
            <div>Loading achievements...</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="achievements-container">
        <div className="achievements-content-inner">

          {/* ── Page Header ────────────────────────────────────────────── */}
          <div className="achievements-page-header">
            <h1 className="achievements-page-title">Achievements</h1>
          </div>

          {/* ── Summary Stats Strip ────────────────────────────────────── */}
          <div className="achievements-summary-strip">
            <div className="summary-stat-group">
              <span className="summary-stat-label">Unlocked</span>
              <span className="summary-stat-value">{earnedCount} / {totalBadgesCount}</span>
            </div>
            <div className="summary-stat-group">
              <span className="summary-stat-label">Trust Score</span>
              <span className="summary-stat-value">{prestigeScore}</span>
            </div>
            <div className="summary-stat-group">
              <span className="summary-stat-label">Completion</span>
              <span className="summary-stat-value">{Math.round((earnedCount / totalBadgesCount) * 100)}%</span>
            </div>
          </div>

          {/* ── Category Lists ─────────────────────────────────────────── */}
          <div className="achievements-category-rows">
            {categoriesList.map(cat => {
              const config = CATEGORY_CONFIG[cat];
              let wingBadges = BADGE_DEFINITIONS.filter(b => b.category === cat);

              // Apply Filters
              if (selectedRarity !== 'all') {
                wingBadges = wingBadges.filter(b => b.rarity === selectedRarity);
              }
              if (earnedFilter === 'earned') {
                wingBadges = wingBadges.filter(b => !!userBadges[b.slug]);
              } else if (earnedFilter === 'locked') {
                wingBadges = wingBadges.filter(b => !userBadges[b.slug]);
              }
              if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                wingBadges = wingBadges.filter(b => {
                  const isHiddenLocked = b.is_hidden && !userBadges[b.slug];
                  if (isHiddenLocked) return false;
                  return b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q);
                });
              }

              // Skip display if category has no matches
              if (wingBadges.length === 0) return null;

              const totalInWing = BADGE_DEFINITIONS.filter(b => b.category === cat).length;
              const earnedInWing = BADGE_DEFINITIONS.filter(b => b.category === cat && !!userBadges[b.slug]).length;

              return (
                <div key={cat} className="achievement-category-row">
                  <div className="achievement-category-header">
                    <div className="category-header-left">
                      <h2 className="category-row-title">
                        {config.label}
                      </h2>
                      <span className="category-row-count">
                        {earnedInWing} of {totalInWing} unlocked
                      </span>
                    </div>
                  </div>

                  <div className="category-badges-horizontal">
                    {wingBadges.map(badge => {
                      const isEarned = !!userBadges[badge.slug];
                      const { current, target } = getBadgeProgress(badge, userStats, isEarned);

                      return (
                        <BadgeCard
                          key={badge.slug}
                          {...badge}
                          earned={isEarned}
                          earned_at={userBadges[badge.slug]?.earned_at || null}
                          progressCurrent={current}
                          progressTarget={target}
                          progressUnit={getProgressUnit(badge)}
                          onClick={() => setSelectedBadge({
                            ...badge,
                            earned: isEarned,
                            earned_at: userBadges[badge.slug]?.earned_at || null,
                            progressCurrent: current,
                            progressTarget: target,
                            progressUnit: getProgressUnit(badge),
                          })}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>



      {/* Premium showcase details modal */}
      <BadgeShowcaseModal
        badge={selectedBadge}
        onClose={() => {
          setSelectedBadge(null);
          if (searchParams.get('badge')) {
            const params = new URLSearchParams(window.location.search);
            params.delete('badge');
            const newSearch = params.toString();
            router.replace(`${window.location.pathname}${newSearch ? '?' + newSearch : ''}`);
          }
        }}
      />
    </>
  );
}