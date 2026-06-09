import React from 'react';
import { TrendingUp, BarChart2, Bookmark, Settings, Plus } from 'lucide-react';

export default function SidebarLeft() {
  return (
    <aside className="left-sidebar">
      <div className="card">
        <div className="menu-item">
          <TrendingUp size={20} />
          <span>Trending Problems</span>
        </div>
        <div className="menu-item">
          <BarChart2 size={20} />
          <span>Analytics</span>
        </div>
        <div className="menu-item">
          <Bookmark size={20} />
          <span>Saved Problems</span>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'white' }}>People who liked your idea</h3>
        
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="https://i.pravatar.cc/150?u=steve" alt="Steve Jobs" className="avatar" />
              <div>
                <h4 style={{ fontSize: '0.875rem' }}>Steve Jobs</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CEO of Apple</p>
              </div>
            </div>
            <button className="btn">Follow</button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="https://i.pravatar.cc/150?u=ryan" alt="Ryan Roslansky" className="avatar" />
              <div>
                <h4 style={{ fontSize: '0.875rem' }}>Ryan Roslansky</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CEO of LinkedIn</p>
              </div>
            </div>
            <button className="btn">Follow</button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="https://i.pravatar.cc/150?u=dylan" alt="Dylan Field" className="avatar" />
              <div>
                <h4 style={{ fontSize: '0.875rem' }}>Dylan Field</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CEO of Figma</p>
              </div>
            </div>
            <button className="btn">Follow</button>
          </div>
        </div>

        <button style={{ width: '100%', marginTop: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          See All
        </button>
      </div>

      <div className="card">
        <div className="menu-item">
          <Settings size={20} />
          <span>Settings</span>
        </div>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ height: '60px', background: 'repeating-conic-gradient(#27272a 0% 25%, transparent 0% 50%) 50% / 10px 10px' }}></div>
        <div style={{ padding: '1rem', position: 'relative' }}>
          <img src="https://i.pravatar.cc/150?u=karim" alt="Karim Saif" className="avatar" style={{ position: 'absolute', top: '-20px', border: '2px solid var(--bg-card)' }} />
          <div className="flex items-center justify-between" style={{ marginTop: '1rem' }}>
            <div>
              <h4 style={{ fontSize: '0.875rem' }}>Karim Saif <span style={{ color: '#eab308' }}>in</span></h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>UI/UX Designer</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ width: '60px', height: '4px', background: '#3f3f46', borderRadius: '2px', marginBottom: '4px' }}>
                <div style={{ width: '90%', height: '100%', background: '#3b82f6', borderRadius: '2px' }}></div>
              </div>
              <span style={{ fontSize: '0.7rem', color: '#3b82f6' }}>90%</span>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border-color)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <Plus size={16} />
          Add another account
        </div>
      </div>
    </aside>
  );
}
