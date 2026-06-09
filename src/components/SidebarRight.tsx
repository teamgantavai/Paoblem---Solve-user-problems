import React from 'react';

export default function SidebarRight() {
  return (
    <aside className="right-sidebar">
      <div className="card promo-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
        <h3 style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>
          Try Premium<br />
          <span style={{ color: '#eab308' }}>moon</span> for free <span style={{ color: '#eab308' }}>moon</span>
        </h3>
        <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>~One month free</p>
        <button className="btn btn-primary" style={{ marginTop: '1rem', padding: '0.5rem 1.5rem' }}>Try free</button>
        <div className="promo-image"></div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'white' }}>Trending Problems</h3>
        
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div className="flex gap-2">
              <img src="https://i.pravatar.cc/150?u=dylan2" alt="Dylan Field" className="avatar" style={{ width: '32px', height: '32px' }} />
              <div>
                <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CEO of Figma</h4>
                <p style={{ fontSize: '0.875rem', marginTop: '2px' }}>Why designing<br/>Sucks!!!</p>
              </div>
            </div>
            <button className="btn" style={{ padding: '0.2rem 0.8rem', fontSize: '0.75rem' }}>View</button>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex gap-2">
              <img src="https://i.pravatar.cc/150?u=ryan2" alt="Ryan Roslansky" className="avatar" style={{ width: '32px', height: '32px' }} />
              <div>
                <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CEO of LinkedIn</h4>
                <p style={{ fontSize: '0.875rem', marginTop: '2px' }}>Why designing<br/>Sucks!!!</p>
              </div>
            </div>
            <button className="btn" style={{ padding: '0.2rem 0.8rem', fontSize: '0.75rem' }}>View</button>
          </div>
        </div>

        <button style={{ width: '100%', marginTop: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          See All
        </button>
      </div>

      <div className="card promo-card" style={{ padding: '1.5rem', borderRadius: '16px', background: 'linear-gradient(135deg, #e2e8f0 0%, #f1f5f9 100%)' }}>
        <h3 style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>
          Download Reddit
        </h3>
        <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>~One month free</p>
        <button className="btn btn-primary" style={{ marginTop: '1rem', padding: '0.5rem 1.5rem' }}>Try free</button>
      </div>
    </aside>
  );
}
