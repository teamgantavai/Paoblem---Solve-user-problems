import React from 'react';
import { TrendingUp, BarChart2, Bookmark, Settings, Plus, Star } from 'lucide-react';

export default function SidebarLeft() {
  return (
    <aside className="left-sidebar">

      {/* Profile Card — top of sidebar */}
      <div className="profile-card">
        <div className="profile-banner"></div>
        <div className="profile-body">
          <div className="profile-avatar-wrap">
            <img
              src="https://i.pravatar.cc/150?u=karim"
              alt="Karim Saif"
              className="profile-avatar"
            />
          </div>
          <div className="profile-info">
            <div className="profile-name-row">
              <span className="profile-name">Karim Saif</span>
              <span className="profile-linkedin-badge">in</span>
            </div>
            <p className="profile-role">UI/UX Designer</p>
          </div>
          <div className="profile-progress-row">
            <div className="profile-progress-bar">
              <div className="profile-progress-fill" style={{ width: '90%' }}></div>
            </div>
            <span className="profile-progress-label">90%</span>
          </div>
        </div>
        <div className="profile-footer">
          <Plus size={14} />
          <span>Add another account</span>
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div className="menu-item active">
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
        <div className="menu-item">
          <Star size={20} />
          <span>My Solutions</span>
        </div>
      </div>

      {/* Settings */}
      <div className="card" style={{ padding: '0.75rem 1.25rem' }}>
        <div className="menu-item" style={{ padding: '0' }}>
          <Settings size={20} />
          <span>Settings</span>
        </div>
      </div>

    </aside>
  );
}