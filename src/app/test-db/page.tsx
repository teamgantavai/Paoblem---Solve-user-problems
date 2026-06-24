'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TestDBPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
      <p>Redirecting...</p>
    </div>
  );
}
