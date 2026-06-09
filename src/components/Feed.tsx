import React from 'react';
import { Image as ImageIcon, Link2, Wand2, Send, ChevronUp, ChevronDown, MessageCircle, Bookmark, MoreVertical, Mic } from 'lucide-react';

export default function Feed() {
  return (
    <main className="center-feed">
      <h1 style={{ fontSize: '2rem', fontWeight: 'normal', fontFamily: 'serif', marginBottom: '0.5rem' }}>Paoblems</h1>

      <div className="card">
        <div className="post-input">
          <img src="https://i.pravatar.cc/150?u=user" alt="You" className="avatar" />
          <input type="text" placeholder="What is your Problem" />
          <div className="action-btn" style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>✎</span>
          </div>
        </div>

        <div className="post-actions">
          <div className="flex items-center gap-4">
            <div className="action-btn">
              <ImageIcon size={18} />
              Photo
            </div>
            <div className="action-btn">
              <Link2 size={18} />
              link
            </div>
            <div className="action-btn">
              <Wand2 size={18} />
              AI Enhance
            </div>
          </div>
          <button className="post-send-btn border-0">
            <Send size={18} color="white" />
          </button>
        </div>
      </div>

      <div className="card">
        <div className="post-header">
          <div className="post-user">
            <img src="https://i.pravatar.cc/150?u=karim" alt="Karim Saif" className="avatar" />
            <div className="post-user-info">
              <h4 className="flex items-center gap-2">
                Karim Saif
                <button className="btn" style={{ padding: '0.1rem 0.5rem', fontSize: '0.7rem' }}>Follow</button>
              </h4>
              <p>UI/UX Designer</p>
            </div>
          </div>
          <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <Bookmark size={20} />
            <MoreVertical size={20} />
          </div>
        </div>

        <div className="post-content">
          -Healthy Tracking App idea ......<span style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>see more</span>
        </div>

        <div className="post-image-placeholder"></div>

        <div className="post-footer">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <ChevronUp size={24} className="stat-up" />
                <span style={{ fontSize: '0.75rem', marginTop: '-4px', color: '#22c55e' }}>+99</span>
              </div>
              <div className="flex flex-col items-center">
                <ChevronDown size={24} className="stat-down" />
                <span style={{ fontSize: '0.75rem', marginTop: '-4px', color: '#ef4444' }}>-88</span>
              </div>
            </div>
            <div className="stat-item">
              <MessageCircle size={20} />
              <span style={{ position: 'relative', top: '-8px', left: '-8px', background: 'white', color: 'black', borderRadius: '50%', padding: '0 4px', fontSize: '0.6rem', fontWeight: 'bold' }}>8</span>
            </div>
            <span className="tag-solved">Solved</span>
          </div>
          <button className="btn-summarize">AI Summarize</button>
        </div>

        <div className="comment-input-wrapper">
          <img src="https://i.pravatar.cc/150?u=user" alt="You" className="avatar" style={{ width: '24px', height: '24px' }} />
          <input type="text" placeholder="Write a comment" />
          <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <Mic size={16} />
            <ImageIcon size={16} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="post-header">
          <div className="post-user">
            <img src="https://i.pravatar.cc/150?u=nermmen" alt="Nermmen Saif" className="avatar" />
            <div className="post-user-info">
              <h4 className="flex items-center gap-2">
                Nermmen Saif
              </h4>
              <p>UI Designer</p>
            </div>
          </div>
          <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <Bookmark size={20} />
            <MoreVertical size={20} />
          </div>
        </div>

        <div className="post-content">
          -Photo is perfect
        </div>
      </div>
    </main>
  );
}
