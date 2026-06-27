'use client';

import React, { useEffect } from 'react';
import BadgeUnlockModal from '@/components/badges/BadgeUnlockModal';
import { useBadgeAwards } from '@/hooks/useBadgeAwards';
import { useRouter, usePathname } from 'next/navigation';

export default function GlobalBadgeManager() {
  const router = useRouter();
  const pathname = usePathname();
  const { currentBadge, checkAndAward, dismissBadge } = useBadgeAwards();

  // 1. Pathname navigation triggers check
  useEffect(() => {
    checkAndAward();
  }, [pathname, checkAndAward]);

  // 2. Intercept actions: fetch calls to comments, posts, solutions trigger checks
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);
      
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && 'url' in args[0] ? args[0].url : '');
      if (url && (
        url.includes('/api/posts') || 
        url.includes('/api/solutions') || 
        url.includes('/api/comments') ||
        url.includes('/api/profile')
      )) {
        // Wait 700ms to allow action database transaction to complete, then check
        setTimeout(() => {
          checkAndAward();
        }, 700);
      }
      
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [checkAndAward]);

  return (
    <BadgeUnlockModal
      badge={currentBadge}
      onClose={() => currentBadge && dismissBadge(currentBadge.slug)}
      onViewCollection={() => router.push('/achievements')}
    />
  );
}
