'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Activity, Database, Cpu, HardDrive, ShieldAlert,
  Loader2, RefreshCw, CheckCircle2, AlertTriangle, AlertOctagon
} from 'lucide-react';

export default function PerformanceDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchPerformanceStats = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/admin/performance?page=1&limit=1', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to load performance stats');
      const resData = await res.json();
      setData(resData);
    } catch (err: any) {
      showToast(err.message || 'Error loading stats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPerformanceStats();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPerformanceStats();
  };

  if (loading && !refreshing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 size={36} className="animate-spin" style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading platform performance metrics...</p>
      </div>
    );
  }

  const { health, systemErrorLogs, migrationsRequired } = data || {};

  const getStatusIcon = (status: string) => {
    if (status === 'healthy') return <CheckCircle2 size={18} style={{ color: 'var(--accent-success)' }} />;
    if (status === 'degraded') return <AlertTriangle size={18} style={{ color: 'var(--accent-warning)' }} />;
    return <AlertOctagon size={18} style={{ color: 'var(--accent-danger)' }} />;
  };

  const getStatusColorClass = (status: string) => {
    if (status === 'healthy') return 'rgba(16, 185, 129, 0.05)';
    if (status === 'degraded') return 'rgba(245, 158, 11, 0.05)';
    return 'rgba(239, 68, 68, 0.05)';
  };

  return (
    <div style={{ animation: 'toast-fade-in 0.3s ease' }}>
      {/* Toast Feed */}
      {toastMessage && (
        <div className="admin-toast">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Performance & System Health</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px' }}>Real-time telemetry and database connection checks.</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh Status'}
        </button>
      </div>

      {/* Grid of Health Statuses */}
      <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        
        {/* Database telemetry */}
        <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: `4px solid ${health?.database?.status === 'healthy' ? 'var(--accent-success)' : 'var(--accent-danger)'}`, backgroundColor: getStatusColorClass(health?.database?.status) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem' }}>
              <Database size={18} style={{ color: 'var(--accent-primary)' }} />
              Supabase SQL Database
            </span>
            {getStatusIcon(health?.database?.status)}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status</span>
              <strong style={{ textTransform: 'uppercase' }}>{health?.database?.status}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>DB Response Latency</span>
              <strong>{health?.database?.latency} ms</strong>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '8px', lineHeight: '1.4' }}>
              {health?.database?.message}
            </div>
          </div>
        </div>

        {/* Cache Telemetry (Redis) */}
        <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: `4px solid ${health?.cache?.status === 'healthy' ? 'var(--accent-success)' : health?.cache?.status === 'degraded' ? 'var(--accent-warning)' : 'var(--accent-danger)'}`, backgroundColor: getStatusColorClass(health?.cache?.status) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem' }}>
              <Cpu size={18} style={{ color: 'var(--accent-primary)' }} />
              Redis Cache
            </span>
            {getStatusIcon(health?.cache?.status)}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status</span>
              <strong style={{ textTransform: 'uppercase' }}>{health?.cache?.status}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Ping Latency</span>
              <strong>{health?.cache?.latency} ms</strong>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '8px', lineHeight: '1.4' }}>
              {health?.cache?.message}
            </div>
          </div>
        </div>

        {/* Background Queues */}
        <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: `4px solid var(--accent-primary)` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem' }}>
              <Activity size={18} style={{ color: 'var(--accent-primary)' }} />
              Background Jobs Queue
            </span>
            <span className="badge-status active" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
              ONLINE
            </span>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Pending jobs</span>
              <strong style={{ color: health?.backgroundJobs?.pending > 0 ? 'var(--accent-warning)' : undefined }}>
                {health?.backgroundJobs?.pending || 0}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Failed jobs</span>
              <strong style={{ color: health?.backgroundJobs?.failed > 0 ? 'var(--accent-danger)' : undefined }}>
                {health?.backgroundJobs?.failed || 0}
              </strong>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '8px', lineHeight: '1.4' }}>
              Manages async email delivery, notifications, and analytics batching queues.
            </div>
          </div>
        </div>

        {/* Storage buckets */}
        <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: `4px solid var(--accent-success)` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem' }}>
              <HardDrive size={18} style={{ color: 'var(--accent-primary)' }} />
              Supabase Storage Size
            </span>
            {getStatusIcon(health?.storage?.status)}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Active Bucket</span>
              <strong>{health?.storage?.bucketName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Provider</span>
              <strong>{health?.storage?.provider}</strong>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '8px', lineHeight: '1.4' }}>
              Post media uploads, covers, and attachments storage are healthy.
            </div>
          </div>
        </div>

      </div>

      {/* System Error Logs listing */}
      <div className="admin-card" style={{ padding: '1.25rem' }}>
        <div className="admin-card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <h3 className="admin-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} style={{ color: 'var(--accent-danger)' }} />
            System Warning & Error Logs
          </h3>
        </div>

        {migrationsRequired ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Audit log table missing. Apply migrations to visualize error logs.
          </div>
        ) : systemErrorLogs && systemErrorLogs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {systemErrorLogs.map((log: any) => (
              <div key={log.id} style={{
                padding: '10px 12px',
                borderRadius: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.03)',
                border: '1px solid rgba(239, 68, 68, 0.1)',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: 700 }}>
                  <span style={{ color: 'var(--accent-danger)' }}>{log.action}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleString()}</span>
                </div>
                <div style={{ color: 'var(--text-body)' }}>
                  Target: {log.target_type} ({log.target_id})
                </div>
                {log.details && (
                  <pre style={{ margin: '6px 0 0 0', padding: '6px', background: 'var(--bg-dark)', borderRadius: '6px', fontSize: '0.72rem', overflowX: 'auto' }}>
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No platform errors recorded in audit trails.
          </div>
        )}
      </div>
    </div>
  );
}
