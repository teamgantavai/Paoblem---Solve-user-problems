'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function AdRefresher() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ezstandalone) {
      window.ezstandalone.cmd = window.ezstandalone.cmd || [];
      window.ezstandalone.cmd.push(function () {
        if (typeof window.ezstandalone.showAds === 'function') {
          window.ezstandalone.showAds();
        }
      });
    }
  }, [pathname]);

  return null;
}
