'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import AreaChart from '@/components/analytics/AreaChart';
import BarChart from '@/components/analytics/BarChart';
import {
  Users, FileText, Lightbulb, HelpCircle, MessageSquare,
  ThumbsUp, Award, Flame, ShieldAlert, TrendingUp, AlertTriangle,
  Loader2, RefreshCw
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('No active session found.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/admin/dashboard', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch dashboard data');
      }

      const resData = await res.json();
      setData(resData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 size={36} className="animate-spin" style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading dashboard analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-card" style={{ borderLeft: '4px solid var(--accent-danger)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertTriangle size={24} style={{ color: 'var(--accent-danger)' }} />
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Failed to Load Dashboard</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>{error}</p>
          </div>
        </div>
        <button onClick={handleRefresh} className="btn-admin primary" style={{ marginTop: '1.25rem' }}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const { cards, charts, trendingPosts, migrationsRequired } = data || {};

  // Formatter helpers for charting
  const usersChartData = (charts?.dailyNewUsers || []).map((item: any) => ({
    label: new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    value: item.count,
  }));

  const postsChartData = (charts?.dailyPosts || []).map((item: any) => ({
    label: new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    value: item.count,
  }));

  const categoriesChartData = (charts?.topCategories || []).map((item: any) => ({
    label: item.name,
    value: item.count,
  }));

  return (
    <div style={{ animation: 'toast-fade-in 0.3s ease' }}>
      {/* Alert Banner if Database Migrations are missing */}
      {migrationsRequired && (
        <div className="admin-card" style={{ borderLeft: '4px solid var(--accent-warning)', background: 'rgba(245, 158, 11, 0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <AlertTriangle size={24} style={{ color: 'var(--accent-warning)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Database Migration Required</h3>
              <p style={{ color: 'var(--text-body)', fontSize: '0.85rem', marginTop: '4px', lineHeight: '1.5' }}>
                The custom tables for **reports**, **categories**, and **admin audit logs** are missing from the schema. 
                Please copy the contents of the migration file `supabase/migrations/20260627000000_admin_panel.sql` and run it in the **Supabase Dashboard SQL Editor** to unlock all features.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Overview Title and Refresh controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Live Platform Analytics</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px' }}>Real-time overview of the Paoblem ecosystem.</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh Stats'}
        </button>
      </div>

      {/* Numeric Stats Grid */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon-wrapper" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#3b82f6' }}>
            <Users size={20} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Total Users</span>
            <span className="admin-stat-value">{cards?.totalUsers}</span>
            <span className={`admin-stat-growth ${cards?.growthThisWeek?.count >= 0 ? 'positive' : 'negative'}`}>
              {cards?.growthThisWeek?.count >= 0 ? '+' : ''}{cards?.growthThisWeek?.count} ({cards?.growthThisWeek?.percentage}%) this week
            </span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon-wrapper" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-main)' }}>
            <FileText size={20} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Total Posts</span>
            <span className="admin-stat-value">{cards?.totalPosts}</span>
            <span style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
              <span>💡 {cards?.ideas} Ideas</span>
              <span>•</span>
              <span>❓ {cards?.problems} Problems</span>
            </span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)' }}>
            <MessageSquare size={20} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Comments</span>
            <span className="admin-stat-value">{cards?.totalComments}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Across all publications</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-warning)' }}>
            <ThumbsUp size={20} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Total Votes</span>
            <span className="admin-stat-value">{cards?.totalVotes}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Upvotes and downvotes</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon-wrapper" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
            <Award size={20} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Avg Quality</span>
            <span className="admin-stat-value">{cards?.avgQualityScore} / 10</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Bayesian scaled score</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)' }}>
            <ShieldAlert size={20} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Pending Reports</span>
            <span className="admin-stat-value" style={{ color: cards?.pendingReports > 0 ? 'var(--accent-danger)' : undefined }}>
              {cards?.pendingReports}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {cards?.pendingReports > 0 ? 'Action required in Moderation' : 'All clear'}
            </span>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="admin-charts-grid">
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Daily New Registrations (Last 14 Days)</h3>
          </div>
          {usersChartData.length > 0 ? (
            <AreaChart data={usersChartData} height={200} color="#3b82f6" />
          ) : (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No user growth data available.
            </div>
          )}
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">New Publications</h3>
          </div>
          {postsChartData.length > 0 ? (
            <AreaChart data={postsChartData} height={200} color="var(--accent-warning)" />
          ) : (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No publication growth data available.
            </div>
          )}
        </div>
      </div>

      <div className="admin-charts-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Categories Distribution */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Top Post Categories</h3>
          </div>
          {categoriesChartData.length > 0 ? (
            <BarChart data={categoriesChartData} />
          ) : (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No category data available.
            </div>
          )}
        </div>

        {/* Trending Posts Queue */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">
              <Flame size={16} style={{ color: 'var(--accent-danger)' }} />
              Highest Rated Content (Trending)
            </h3>
            <Link href="/admin/posts?filter=highest_quality" className="btn-admin" style={{ fontSize: '0.7rem', padding: '4px 8px' }}>
              View All
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {trendingPosts && trendingPosts.length > 0 ? (
              trendingPosts.map((post: any) => (
                <div key={post.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-hover)',
                  border: '1px solid var(--border-color)',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, paddingRight: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {post.title}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                      <span className={`badge-status ${post.type}`} style={{ padding: '0px 4px', fontSize: '0.62rem' }}>
                        {post.type}
                      </span>
                      <span>🔺 {post.upvotes} upvotes</span>
                      <span>💬 {post.comments_count} comments</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#8b5cf6' }}>
                      ⭐ {post.quality_score?.toFixed(1) || '0.0'}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No trending posts found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
