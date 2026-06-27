'use client';

import React, { useEffect } from 'react';

declare global {
  interface Window {
    ezstandalone?: any;
  }
}

export default function NativeAdCard() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.ezstandalone = window.ezstandalone || {};
      window.ezstandalone.cmd = window.ezstandalone.cmd || [];
      window.ezstandalone.cmd.push(function () {
        if (typeof window.ezstandalone.showAds === 'function') {
          window.ezstandalone.showAds(101);
        }
      });
    }

    // Cleanup placeholder when component unmounts to prevent unpredictable ad behavior
    return () => {
      if (typeof window !== 'undefined' && window.ezstandalone) {
        window.ezstandalone.cmd.push(function () {
          if (typeof window.ezstandalone.destroyPlaceholders === 'function') {
            window.ezstandalone.destroyPlaceholders(101);
          }
        });
      }
    };
  }, []);

  return (
    <div className="card native-ad-card" style={{ padding: '1.25rem', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-primary, #6366f1) 0%, #3b82f6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 700,
            fontSize: '0.8rem',
            boxShadow: '0 2px 8px rgba(99,102,241,0.25)'
          }}>
            Ad
          </div>
          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
              Partner Announcement
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sponsored</span>
          </div>
        </div>
      </div>

      {/* Ezoic placeholder element */}
      <div id="ezoic-pub-ad-placeholder-101"></div>
    </div>
  );
}
