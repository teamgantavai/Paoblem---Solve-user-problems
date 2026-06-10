import React from 'react';
import { Home, NotebookPen, Bell, MessageCircle, User, Search } from 'lucide-react';

export default function Navbar() {
  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">

          <div className="nav-brand">
            <img src="/logo.svg" alt="Paoblem Logo" style={{ height: '38px', objectFit: 'contain' }} />

          </div>

          <div className="nav-links desktop-only">
            <div className="nav-item active">
              <div className="nav-icon-wrap">
                <Home size={22} strokeWidth={2} />
              </div>
              <span>Home</span>
            </div>
            <div className="nav-item">
              <div className="nav-icon-wrap">
                <NotebookPen size={22} strokeWidth={2} />
              </div>
              <span>Solution</span>
            </div>
            <div className="nav-item">
              <div className="nav-icon-wrap">
                <Bell size={22} strokeWidth={2} />
                <span className="nav-badge">9+</span>
              </div>
              <span>Notifications</span>
            </div>
            <div className="nav-item">
              <div className="nav-icon-wrap">
                <MessageCircle size={22} strokeWidth={2} />
                <span className="nav-badge">6</span>
              </div>
              <span>Chats</span>
            </div>
            <div className="nav-item">
              <div className="nav-icon-wrap">
                <User size={22} strokeWidth={2} />
              </div>
              <span>Me</span>
            </div>
          </div>

          <div className="search-bar desktop-only">
            <input type="text" placeholder="Search for Problems" />
            <button className="search-btn">
              <Search size={16} />
            </button>
          </div>

          <button className="search-btn mobile-only">
            <Search size={16} />
          </button>

        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <div className="mobile-bottom-nav">
        <div className="mobile-nav-item active">
          <div className="nav-icon-wrap">
            <Home size={20} strokeWidth={2} />
          </div>
          <span>Home</span>
        </div>
        <div className="mobile-nav-item">
          <div className="nav-icon-wrap">
            <NotebookPen size={20} strokeWidth={2} />
          </div>
          <span>Solution</span>
        </div>
        <div className="mobile-nav-item">
          <div className="nav-icon-wrap">
            <Bell size={20} strokeWidth={2} />
            <span className="nav-badge">9+</span>
          </div>
          <span>Notifications</span>
        </div>
        <div className="mobile-nav-item">
          <div className="nav-icon-wrap">
            <MessageCircle size={20} strokeWidth={2} />
            <span className="nav-badge">6</span>
          </div>
          <span>Chats</span>
        </div>
        <div className="mobile-nav-item">
          <div className="nav-icon-wrap">
            <User size={20} strokeWidth={2} />
          </div>
          <span>Me</span>
        </div>
      </div>
    </>
  );
}