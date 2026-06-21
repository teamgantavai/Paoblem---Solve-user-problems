'use client';

import React, { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BarChart2, Loader2, Eye, ThumbsUp, MessageCircle, UserPlus,
  ArrowLeft, TriangleIcon, Monitor, Globe, Smartphone, TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AnalyticsGridResponse, PostAnalyticsDetailResponse } from '@/lib/types';
import { decodeHTMLEntities } from '@/lib/htmlDecoder';

function getPostThumb(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  try {
    const parsed = JSON.parse(imageUrl);
    return Array.isArray(parsed) ? parsed[0] : imageUrl;
  } catch {
    return imageUrl;
  }
}

function AnalyticsDashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedPostId = searchParams.get('postId');

  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [gridData, setGridData] = useState<AnalyticsGridResponse | null>(null);
  const [detailData, setDetailData] = useState<PostAnalyticsDetailResponse | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) setSession({ access_token: s.access_token });
      else setLoading(false);
    });
  }, []);

  const fetchGrid = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch('/api/analytics/overview', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setGridData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [session]);

  const fetchDetail = useCallback(async (postId: string) => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/post?postId=${postId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        setDetailData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    if (selectedPostId) {
      fetchDetail(selectedPostId);
    } else {
      setDetailData(null);
      fetchGrid();
    }
  }, [session, selectedPostId, fetchGrid, fetchDetail]);

  const openPost = (postId: string) => {
    router.push(`/analytics?postId=${postId}`);
  };

  const goBack = () => {
    router.push('/analytics');
  };

  if (!session && !loading) {
    return (
      <div className="analytics-empty">
        <BarChart2 size={48} />
        <h2>Sign in to view analytics</h2>
        <p>Track how your posts perform across views, votes, and comments.</p>
        <button className="analytics-btn primary" onClick={() => router.push('/')}>Go to Home</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="analytics-loading">
        <Loader2 size={32} className="spin" />
        <span>Loading analytics…</span>
      </div>
    );
  }

  /* ── Post Detail View ── */
  if (selectedPostId && detailData) {
    const { post, stats, voters, demographics } = detailData;
    const thumb = getPostThumb(post.image_url);

    return (
      <div className="analytics-dashboard">
        <button className="analytics-back-btn" onClick={goBack}>
          <ArrowLeft size={18} />
          Back to all posts
        </button>

        <div className="analytics-detail-header">
          {thumb && (
            <img src={thumb} alt="" className="analytics-detail-thumb" />
          )}
          <div>
            <span className={`analytics-type-badge ${post.type}`}>
              {post.type === 'problem' ? 'Problem' : post.type === 'idea' ? 'Idea' : 'Solution'}
            </span>
            <h1>{decodeHTMLEntities(post.title)}</h1>
            <p className="analytics-detail-date">
              Posted {new Date(post.created_at).toLocaleDateString(undefined, {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
            </p>
          </div>
        </div>

        <div className="analytics-stats-row">
          <StatBox icon={<Eye size={20} />} label="Views" value={stats.views} />
          <StatBox icon={<TrendingUp size={20} />} label="Impressions" value={stats.impressions} accent="#8b5cf6" />
          <StatBox icon={<TriangleIcon size={20} />} label="Upvotes" value={stats.upvotes} accent="#10b981" />
          <StatBox icon={<TriangleIcon size={20} style={{ transform: 'rotate(180deg)' }} />} label="Downvotes" value={stats.downvotes} accent="#ef4444" />
          <StatBox icon={<MessageCircle size={20} />} label="Comments" value={stats.comments} accent="#06b6d4" />
          <StatBox icon={<UserPlus size={20} />} label="Followers Gained" value={stats.followsGained} accent="var(--accent-yellow)" />
        </div>

        <div className="analytics-detail-grid">
          {/* Who Voted */}
          <section className="analytics-panel">
            <h2>Who Voted ({voters.length})</h2>
            {voters.length === 0 ? (
              <p className="analytics-panel-empty">No votes yet on this post.</p>
            ) : (
              <ul className="analytics-voter-list">
                {voters.map(v => (
                  <li key={`${v.user_id}-${v.created_at}`} className="analytics-voter-item">
                    <img
                      src={v.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${v.user_id}`}
                      alt=""
                      className="analytics-voter-avatar"
                    />
                    <div className="analytics-voter-info">
                      <span className="analytics-voter-name">{v.full_name}</span>
                      <span className="analytics-voter-date">
                        {new Date(v.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <span className={`analytics-vote-badge ${v.vote_type}`}>
                      {v.vote_type === 'up' ? '▲ Up' : '▼ Down'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Demographics */}
          <section className="analytics-panel">
            <h2>Audience Demographics</h2>
            <DemographicSection icon={<Smartphone size={16} />} title="Devices" items={demographics.devices} />
            <DemographicSection icon={<Monitor size={16} />} title="Browsers" items={demographics.browsers} />
            <DemographicSection icon={<Globe size={16} />} title="Countries / Sources" items={demographics.countries} />
          </section>
        </div>
      </div>
    );
  }

  /* ── Posts Grid View ── */
  const { totals, posts } = gridData ?? { totals: { views: 0, votes: 0, comments: 0, followsGained: 0 }, posts: [] };

  return (
    <div className="analytics-dashboard">
      <header className="analytics-header">
        <h1 className="analytics-title">
          <BarChart2 size={24} />
          My Post Analytics
        </h1>
      </header>

      <div className="analytics-totals-row">
        <TotalCard icon={<Eye size={22} />} label="Total Views" value={totals.views} />
        <TotalCard icon={<TriangleIcon size={22} />} label="Total Votes" value={totals.votes} />
        <TotalCard icon={<MessageCircle size={22} />} label="Total Comments" value={totals.comments} />
        <TotalCard icon={<UserPlus size={22} />} label="Followers Gained" value={totals.followsGained} />
      </div>

      {posts.length === 0 ? (
        <div className="analytics-empty" style={{ minHeight: '40vh' }}>
          <p>You haven&apos;t created any posts yet.</p>
          <button className="analytics-btn primary" onClick={() => router.push('/create-post')}>
            Create a Post
          </button>
        </div>
      ) : (
        <>
          <h2 className="analytics-section-heading">Your Posts ({posts.length})</h2>
          <div className="analytics-posts-grid">
            {posts.map(post => {
              const thumb = getPostThumb(post.image_url);
              return (
                <button
                  key={post.id}
                  className="analytics-post-card"
                  onClick={() => openPost(post.id)}
                >
                  {thumb ? (
                    <img src={thumb} alt="" className="analytics-post-card-img" />
                  ) : (
                    <div className="analytics-post-card-placeholder">
                      <BarChart2 size={28} />
                    </div>
                  )}
                  <div className="analytics-post-card-body">
                    <span className={`analytics-type-badge ${post.type}`}>
                      {post.type === 'problem' ? 'Problem' : post.type === 'idea' ? 'Idea' : 'Solution'}
                    </span>
                    <h3>{decodeHTMLEntities(post.title)}</h3>
                    <div className="analytics-post-card-stats">
                      <span><Eye size={13} /> {post.views.toLocaleString()}</span>
                      <span><TriangleIcon size={13} /> {post.votes.toLocaleString()}</span>
                      <span><MessageCircle size={13} /> {post.comments.toLocaleString()}</span>
                      <span><UserPlus size={13} /> {post.followsGained.toLocaleString()}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function TotalCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="analytics-total-card">
      <div className="analytics-total-icon">{icon}</div>
      <div>
        <span className="analytics-total-value">{value.toLocaleString()}</span>
        <span className="analytics-total-label">{label}</span>
      </div>
    </div>
  );
}

function StatBox({
  icon, label, value, accent = 'var(--accent-blue)',
}: {
  icon: React.ReactNode; label: string; value: number; accent?: string;
}) {
  return (
    <div className="analytics-stat-box">
      <div className="analytics-stat-icon" style={{ color: accent }}>{icon}</div>
      <span className="analytics-stat-value">{value.toLocaleString()}</span>
      <span className="analytics-stat-label">{label}</span>
    </div>
  );
}

function DemographicSection({
  icon, title, items,
}: {
  icon: React.ReactNode;
  title: string;
  items: { name: string; count: number }[];
}) {
  const max = Math.max(...items.map(i => i.count), 1);

  return (
    <div className="analytics-demo-section">
      <h3>{icon} {title}</h3>
      {items.every(i => i.count === 0) ? (
        <p className="analytics-panel-empty">No data yet — demographics appear as users interact.</p>
      ) : (
        <div className="analytics-demo-bars">
          {items.map(item => (
            <div key={item.name} className="analytics-demo-row">
              <span className="analytics-demo-name">{item.name}</span>
              <div className="analytics-demo-track">
                <div
                  className="analytics-demo-fill"
                  style={{ width: `${(item.count / max) * 100}%` }}
                />
              </div>
              <span className="analytics-demo-count">{item.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AnalyticsDashboard() {
  return (
    <Suspense fallback={
      <div className="analytics-loading">
        <Loader2 size={32} className="spin" />
      </div>
    }>
      <AnalyticsDashboardInner />
    </Suspense>
  );
}
