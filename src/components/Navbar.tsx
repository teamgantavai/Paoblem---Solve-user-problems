import React from 'react';
import { Home, Lightbulb, Bell, MessageCircle, User, Search } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">

        <div className="nav-brand" style={{ justifyContent: 'flex-start' }}>
          <img src="/logo.png" alt="Paoblem Logo" style={{ height: '36px', objectFit: 'contain' }} />
        </div>

        <div className="nav-links">
          <div className="nav-item active">
            <Home size={22} strokeWidth={2} />
            <span>Home</span>
          </div>
          <div className="nav-item">
            <Lightbulb size={22} strokeWidth={2} />
            <span>Solution</span>
          </div>
          <div className="nav-item" style={{ position: 'relative' }}>
            <Bell size={22} strokeWidth={2} />
            <span>Notifications</span>
            <span className="nav-badge">94+</span>
          </div>
          <div className="nav-item" style={{ position: 'relative' }}>
            <MessageCircle size={22} strokeWidth={2} />
            <span>Chats</span>
            <span className="nav-badge">6</span>
          </div>
          <div className="nav-item">
            <User size={22} strokeWidth={2} />
            <span>Me</span>
          </div>
        </div>

        <div className="search-bar" style={{ width: '320px' }}>
          <input type="text" placeholder="Search for Problems" />
          <Search size={18} color="#8c8c8c" style={{ marginLeft: '0.5rem' }} />
        </div>

      </div>
    </nav>
  );
}
