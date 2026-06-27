'use client';

import React, { useEffect, useRef } from 'react';

export default function NativeAdCard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (scriptLoaded.current) return;
    
    // Create script element
    const script = document.createElement('script');
    script.src = '//pl30089361.effectivecpmnetwork.com/a6cc06079231ab3343c3f0d768d87cff/invoke.js';
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    
    // Append script to document body or container
    document.body.appendChild(script);
    scriptLoaded.current = true;

    return () => {
      // Avoid clean up that breaks script loading
    };
  }, []);

  return (
    <div className="card native-ad-card" style={{ padding: '1.25rem', overflow: 'hidden', position: 'relative' }}>
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
      
      {/* Container for the Ad banner */}
      <div 
        ref={containerRef} 
        id="container-a6cc06079231ab3343c3f0d768d87cff" 
        style={{ 
          minHeight: '250px', 
          width: '100%', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          background: 'var(--bg-hover, rgba(255,255,255,0.03))',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px dashed var(--border-color, rgba(255,255,255,0.1))'
        }}
      />
    </div>
  );
}
