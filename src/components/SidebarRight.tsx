'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertTriangle, Lightbulb } from 'lucide-react';
import { Post } from '@/lib/types';

export default function SidebarRight() {
  const router = useRouter();

  // Fetch trending/recent problems from the API
  const { data: postsData, isLoading } = useQuery<{ posts: Post[] }>({
    queryKey: ['trending-sidebar'],
    queryFn: async () => {
      const res = await fetch('/api/posts/list?type=all');
      if (!res.ok) throw new Error('Failed to load trending');
      return res.json();
    },
  });

  const trendingPosts = postsData?.posts?.slice(0, 3) || [];

  const handleNavigatePost = (postId: string) => {
    router.push(`/?post=${postId}`);
  };

  return (
    <aside className="right-sidebar">
      {/* Try Premium Card */}
      <div className="card promo-card promo-card-premium" style={{ padding: '1.25rem', borderRadius: '18px' }}>
        <h3 className="promo-title" style={{ marginTop: '0.25rem' }}>
          Try Premium<br />
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ color: '#ffbf00' }}>🌙</span> for free <span style={{ color: '#ffbf00' }}>🌙</span>
          </span>
        </h3>
        <p className="promo-subtitle" style={{ display: 'flex', alignItems: 'center', marginTop: '0.4rem' }}>
          ~One month free <span className="promo-arrow">➜</span>
        </p>
        <button className="btn btn-primary" style={{ marginTop: '1.25rem', padding: '0.45rem 1.25rem', fontSize: '0.78rem', borderRadius: '30px' }}>
          Try free
        </button>
        <svg className="promo-illustration" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="65" cy="65" r="20" fill="url(#handGrad)" />
          <path d="M50 75C50 75 53 52 68 52C83 52 85 68 85 75" stroke="#ffbf00" strokeWidth="3.5" strokeLinecap="round" />
          <polygon points="68,24 71,32 80,32 73,38 75,47 68,41 61,47 63,38 56,32 65,32" fill="#ffbf00" />
          <circle cx="35" cy="35" r="5" fill="#818cf8" opacity="0.6" />
          <circle cx="85" cy="35" r="3.5" fill="#60a5fa" opacity="0.8" />
          <polygon points="32,60 33.5,64 37.5,64 34,66 35,70 32,68 29,70 30,66 26.5,64 30.5,64" fill="#ffbf00" opacity="0.9" />
          <defs>
            <linearGradient id="handGrad" x1="45" y1="45" x2="85" y2="85" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ec4899" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Dynamic Trending Problems Card */}
      <div className="card">
        <h3 style={{ fontSize: '0.85rem', marginBottom: '1.25rem', color: 'var(--text-main)', fontWeight: 600 }}>
          Trending Discussions
        </h3>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
            <Loader2 size={18} className="spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : trendingPosts.length === 0 ? (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
            No discussions found.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {trendingPosts.map((post) => {
              const authorName = post.profiles?.full_name || 'Member';
              const authorAvatar = post.profiles?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.user_id}`;
              const authorRole = post.profiles?.role || 'Innovator';

              return (
                <div key={post.id} className="flex items-start justify-between" style={{ gap: '0.5rem' }}>
                  <div className="flex gap-3" style={{ flex: 1, minWidth: 0 }}>
                    <img
                      src={authorAvatar}
                      alt={authorName}
                      className="avatar"
                      style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h4 style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {authorName} • {authorRole}
                      </h4>
                      <p style={{ fontSize: '0.82rem', marginTop: '2px', fontWeight: 600, lineHeight: '1.3', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {post.title}
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn"
                    style={{ padding: '0.2rem 0.65rem', fontSize: '0.72rem', height: 'fit-content' }}
                    onClick={() => handleNavigatePost(post.id)}
                  >
                    View
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <button className="btn-see-all" onClick={() => router.push('/')} style={{ width: '100%', marginTop: '1rem' }}>See All</button>
      </div>

      {/* Download App Card */}
      <div className="card promo-card promo-card-reddit" style={{ padding: '1.25rem', borderRadius: '18px' }}>
        <h3 className="promo-title" style={{ marginTop: '0.25rem' }}>
          Download Paoblem
        </h3>
        <p className="promo-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.35rem' }}>
          <span style={{ color: '#ffbf00' }}>🌙</span> <span style={{ color: '#ffbf00' }}>🌙</span>
        </p>
        <p className="promo-subtitle" style={{ display: 'flex', alignItems: 'center', marginTop: '0.4rem' }}>
          ~Always free <span className="promo-arrow">➜</span>
        </p>
        <button className="btn btn-primary" style={{ marginTop: '1.25rem', padding: '0.45rem 1.25rem', fontSize: '0.78rem', borderRadius: '30px' }}>
          Install
        </button>
        <svg className="promo-illustration" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="70" cy="70" r="16" fill="url(#redditGrad)" />
          <polygon points="70,30 72,37 79,37 74,42 75,49 70,45 65,49 66,42 61,37 68,37" fill="#ffbf00" />
          <polygon points="40,55 41.5,59 45.5,59 42,61 43,65 40,63 37,65 38,61 34.5,59 38.5,59" fill="#ffbf00" opacity="0.8" />
          <defs>
            <linearGradient id="redditGrad" x1="54" y1="54" x2="86" y2="86" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3b82f6" />
              <stop offset="1" stopColor="#1d4ed8" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </aside>
  );
}
