'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ClipboardList, Loader2, RefreshCw, ChevronLeft, ChevronRight,
  AlertTriangle, X, Eye, FileJson
} from 'lucide-react';
import Avatar from '@/components/Avatar';

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [migrationsRequired, setMigrationsRequired] = useState(false);

  // Modal detail states
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const showToast = (msg: string) => {
    // Basic fallback logging since logs page is passive
    console.log('[Audit Logs]', msg);
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      });

      const res = await fetch(`/api/admin/performance?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const resData = await res.json();
      setLogs(resData.auditLogs || []);
      setTotal(resData.auditTotal || 0);
      setTotalPages(resData.totalPages || 1);
      setMigrationsRequired(!!resData.migrationsRequired);
    } catch (err: any) {
      showToast(err.message || 'Error loading logs');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div style={{ animation: 'toast-fade-in 0.3s ease' }}>
      {/* Migration Warning */}
      {migrationsRequired && (
        <div className="admin-card" style={{ borderLeft: '4px solid var(--accent-warning)', background: 'rgba(245, 158, 11, 0.04)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <AlertTriangle size={24} style={{ color: 'var(--accent-warning)', flexShrink: 0 }} />
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Audit Logs Table Missing</h3>
              <p style={{ color: 'var(--text-body)', fontSize: '0.85rem', marginTop: '4px', lineHeight: '1.5' }}>
                The database table `admin_audit_logs` does not exist. 
                Please copy the contents of the migration file `supabase/migrations/20260627000000_admin_panel.sql` and execute it in your **Supabase Dashboard SQL Editor** to record and inspect administrative actions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Logs Card */}
      {!migrationsRequired && (
        <div className="admin-card" style={{ padding: '0 0 1rem 0', overflow: 'hidden' }}>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Administrator</th>
                  <th>Action</th>
                  <th>Target Type</th>
                  <th>Target ID</th>
                  <th style={{ textAlign: 'right' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td><div className="admin-skeleton" style={{ width: '130px', height: '12px' }} /></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="admin-skeleton" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                          <div className="admin-skeleton" style={{ width: '80px', height: '12px' }} />
                        </div>
                      </td>
                      <td><div className="admin-skeleton" style={{ width: '100px', height: '12px' }} /></td>
                      <td><div className="admin-skeleton" style={{ width: '60px', height: '12px' }} /></td>
                      <td><div className="admin-skeleton" style={{ width: '150px', height: '12px' }} /></td>
                      <td><div className="admin-skeleton" style={{ width: '40px', height: '24px', float: 'right' }} /></td>
                    </tr>
                  ))
                ) : logs.length > 0 ? (
                  logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar src={log.profiles?.avatar_url} name={log.profiles?.full_name || 'Admin'} size={24} />
                          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            {log.profiles?.full_name || 'Admin'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="badge-status active" style={{ textTransform: 'none', background: 'var(--bg-hover)', fontSize: '0.72rem', fontWeight: 700 }}>
                          {log.action}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', textTransform: 'capitalize' }}>{log.target_type}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {log.target_id}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button onClick={() => setSelectedLog(log)} className="btn-admin" style={{ padding: '6px' }} title="View details JSON">
                          <FileJson size={14} /> Details
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                      No administrative audit logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="admin-pagination" style={{ padding: '1rem 1.5rem' }}>
              <span>Showing page {page} of {totalPages} (Total: {total} logs)</span>
              <div className="admin-pagination-buttons">
                <button disabled={page === 1} onClick={() => setPage(page - 1)} className="btn-admin">
                  <ChevronLeft size={16} /> Prev
                </button>
                <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="btn-admin">
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="admin-modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="admin-modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="admin-modal-title">Audit Log Payload Detail</h3>
              <button onClick={() => setSelectedLog(null)} className="btn-admin" style={{ padding: '4px' }}>
                <X size={16} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
              <div><strong>Log ID:</strong> <span style={{ fontFamily: 'monospace' }}>{selectedLog.id}</span></div>
              <div><strong>Action Name:</strong> <span className="badge-status active" style={{ textTransform: 'none' }}>{selectedLog.action}</span></div>
              <div><strong>Timestamp:</strong> {new Date(selectedLog.created_at).toLocaleString()}</div>
              <div><strong>Target:</strong> {selectedLog.target_type} ({selectedLog.target_id})</div>
              
              <div style={{ marginTop: '0.75rem' }}>
                <strong>Details Object:</strong>
                <pre style={{ margin: '6px 0 0 0', padding: '10px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.78rem', overflowX: 'auto', fontFamily: 'monospace' }}>
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>
            
            <div className="admin-modal-footer">
              <button onClick={() => setSelectedLog(null)} className="btn-admin primary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
