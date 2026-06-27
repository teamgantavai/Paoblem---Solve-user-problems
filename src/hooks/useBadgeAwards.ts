'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { BadgeCategory, BadgeRarity } from '@/lib/badgeDefinitions';

export interface AwardedBadge {
  slug: string;
  name: string;
  description: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  rep_reward: number;
}

export type BadgeCheckEvent =
  | 'post_created'
  | 'comment_created'
  | 'solution_created'
  | 'upvote_received'
  | 'view_counted'
  | 'profile_visited'
  | 'streak_updated';

export function useBadgeAwards() {
  const [newlyAwarded, setNewlyAwarded] = useState<AwardedBadge[]>([]);
  const [checking, setChecking] = useState(false);

  const checkAndAward = useCallback(async (event?: BadgeCheckEvent) => {
    if (checking) return;

    try {
      setChecking(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/badges/check-awards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ event: event || 'general' }),
      });

      if (!res.ok) return;

      const data = await res.json();
      if (data.newBadges && data.newBadges.length > 0) {
        // Queue them for display one by one
        setNewlyAwarded(prev => [...prev, ...data.newBadges]);
      }
    } catch (_err) {
      // Silently fail — badge checks are non-critical
    } finally {
      setChecking(false);
    }
  }, [checking]);

  const dismissBadge = useCallback((slug: string) => {
    setNewlyAwarded(prev => prev.filter(b => b.slug !== slug));
  }, []);

  const currentBadge = newlyAwarded[0] || null;

  return {
    currentBadge,
    newlyAwarded,
    checking,
    checkAndAward,
    dismissBadge,
  };
}
