'use client';

import React from 'react';

export default function NotificationSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="nf-skeleton-feed" role="status" aria-label="Loading notifications">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="nf-skeleton-row">
          <div className="nf-skeleton-avatar" />
          <div className="nf-skeleton-content">
            <div className={`nf-skeleton-line ${i % 2 === 0 ? 'w-65' : 'w-42'}`} />
            {i % 3 !== 2 && <div className="nf-skeleton-line w-42" />}
            <div className="nf-skeleton-line w-22" />
          </div>
        </div>
      ))}
    </div>
  );
}
