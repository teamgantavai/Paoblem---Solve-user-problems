import React from 'react';
import { Image as ImageIcon, Link2, Wand2, Send, ChevronUp, ChevronDown, MessageCircle, Bookmark, MoreVertical, Mic, Smile } from 'lucide-react';

export default function Feed() {
  return (
    <main className="center-feed">
      <h1 className="feed-title">Paoblems</h1>

      {/* ── Post Composer ── */}
      <div className="card composer-card">
        <div className="composer-top">
          <img
            src="https://i.pravatar.cc/150?u=karim"
            alt="You"
            className="composer-avatar"
          />
          <div className="composer-input-wrap">
            <input
              type="text"
              className="composer-input"
              placeholder="What's your Problem or Idea?"
            />
          </div>
        </div>

        <div className="composer-divider" />

        <div className="composer-actions">
          <div className="composer-action-group">
            <button className="composer-action-btn">
              <ImageIcon size={16} />
              <span>Photo</span>
            </button>
            <button className="composer-action-btn">
              <Link2 size={16} />
              <span>Link</span>
            </button>
            <button className="composer-action-btn">
              <Wand2 size={16} />
              <span>AI Enhance</span>
            </button>
          </div>
          <button className="composer-send-btn">
            <span>Post</span>
            <Send size={14} />
          </button>
        </div>
      </div>

      {/* ── Post Card 1 ── */}
      <div className="card">
        <div className="post-header">
          <div className="post-user">
            <img src="https://i.pravatar.cc/150?u=karim" alt="Karim Saif" className="avatar" />
            <div className="post-user-info">
              <h4 className="flex items-center gap-2" style={{ fontWeight: 600 }}>
                Karim Saif
                <button className="btn" style={{ padding: '0.15rem 0.65rem', fontSize: '0.7rem', height: '20px' }}>Follow</button>
              </h4>
              <p>UI/UX Designer</p>
            </div>
          </div>
          <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <Bookmark size={18} style={{ cursor: 'pointer' }} />
            <MoreVertical size={18} style={{ cursor: 'pointer' }} />
          </div>
        </div>

        <div className="post-content">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.
        </div>

        <div className="post-image-placeholder checkerboard" />

        <div className="post-footer">
          <div className="flex items-center gap-2">
            {/* Upvote Badge Capsule */}
            <div className="vote-container">
              <button className="vote-btn">
                <ChevronUp size={16} />
              </button>
              <span className="vote-label up">+99</span>
            </div>

            {/* Downvote Badge Capsule */}
            <div className="vote-container">
              <button className="vote-btn">
                <ChevronDown size={16} />
              </button>
              <span className="vote-label down">-88</span>
            </div>

            {/* Comment Icon Wrapper */}
            <div style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '0.25rem' }}>
              <MessageCircle size={19} />
              <span className="comment-count-badge">8</span>
            </div>

            <span className="tag-solved">Solved</span>
          </div>

          <button className="btn-summarize">AI Summarize</button>
        </div>

        <div className="comment-input-wrapper">
          <img src="https://i.pravatar.cc/150?u=karim" alt="You" style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          <input type="text" placeholder="Write a comment…" />
          <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <Smile size={16} style={{ cursor: 'pointer' }} />
            <ImageIcon size={16} style={{ cursor: 'pointer' }} />
            <Mic size={16} style={{ cursor: 'pointer' }} />
          </div>
        </div>
      </div>

      {/* ── Post Card 2 ── */}
      <div className="card">
        <div className="post-header">
          <div className="post-user">
            <img src="https://i.pravatar.cc/150?u=nermmen" alt="Nermmen Saif" className="avatar" />
            <div className="post-user-info">
              <h4 className="flex items-center gap-2" style={{ fontWeight: 600 }}>
                Nermmen Jha
                <button className="btn" style={{ padding: '0.15rem 0.65rem', fontSize: '0.7rem', height: '20px' }}>Follow</button>
              </h4>
              <p>UI Designer</p>
            </div>
          </div>
          <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <Bookmark size={18} style={{ cursor: 'pointer' }} />
            <MoreVertical size={18} style={{ cursor: 'pointer' }} />
          </div>
        </div>

        <div className="post-content">
          Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis.
        </div>

        <div className="post-footer">
          <div className="flex items-center gap-2">
            <div className="vote-container">
              <button className="vote-btn">
                <ChevronUp size={16} />
              </button>
              <span className="vote-label up">+42</span>
            </div>

            <div className="vote-container">
              <button className="vote-btn">
                <ChevronDown size={16} />
              </button>
              <span className="vote-label down">-3</span>
            </div>

            <div style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '0.25rem' }}>
              <MessageCircle size={19} />
              <span className="comment-count-badge">2</span>
            </div>
          </div>
          <button className="btn-summarize">AI Summarize</button>
        </div>
      </div>
    </main>
  );
}