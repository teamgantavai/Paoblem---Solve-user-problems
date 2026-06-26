'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  AlertTriangle, ShieldCheck, ShieldAlert, Trash2, UserX,
  BellRing, Check, Eye, X, Loader2, RefreshCw, ChevronLeft,
  ChevronRight, ExternalLink
} from 'lucide-react';
import Link from 'next/link';

export default function ModerationQueue() {
  const [reports, setReports] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [migrationsRequired, setMigrationsRequired] = useState(false);

  // Filters
  const [status, setStatus] = useState('pending');
  const [contentType, setContentType] = useState('');

  // Modal actions
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [modalAction, setModalAction] = useState<'ignore' | 'resolve' | 'delete_content' | 'warn_user' | 'ban_user' | null>(null);
  const [warningText, setWarningText] = useState('Violating community safety guidelines.');

  // UI notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams({
        status,
        contentType,
        page: page.toString(),
        limit: '10',
      });

      const res = await fetch(`/api/admin/moderation?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch reports');
      const resData = await res.json();
      
      setMigrationsRequired(!!resData.migrationsRequired);
      setReports(resData.reports || []);
      setTotal(resData.total || 0);
      setTotalPages(resData.totalPages || 1);
    } catch (err: any) {
      showToast(err.message || 'Error loading moderation queue');
    } finally {
      setLoading(false);
    }
  }, [status, contentType, page]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const closeModal = () => {
    setSelectedReport(null);
    setModalAction(null);
  };

  const openActionModal = (report: any, action: 'ignore' | 'resolve' | 'delete_content' | 'warn_user' | 'ban_user') => {
    setSelectedReport(report);
    setModalAction(action);
    if (action === 'warn_user') {
      setWarningText('Violating community safety guidelines regarding appropriate post content.');
    }
  };

  const handleActionSubmit = async () => {
    if (!selectedReport || !modalAction) return;
    setSubmittingAction(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let payload: any = {};
      if (modalAction === 'warn_user') {
        payload = { warning: warningText };
      }

      // Optimistic updates
      setReports(reports.filter(r => r.id !== selectedReport.id));

      const res = await fetch('/api/admin/moderation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          reportId: selectedReport.id,
          action: modalAction,
          payload,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Action failed');
      }

      showToast(`Report updated successfully: ${modalAction}`);
      closeModal();
      fetchReports();
    } catch (err: any) {
      showToast(err.message || 'Action failed');
      fetchReports();
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div style={{ animation: 'toast-fade-in 0.3s ease' }}>
      {/* Toast Feed */}
      {toastMessage && (
        <div className="admin-toast">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Migration Notice */}
      {migrationsRequired && (
        <div className="admin-card" style={{ borderLeft: '4px solid var(--accent-warning)', background: 'rgba(245, 158, 11, 0.04)' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <AlertTriangle size={24} style={{ color: 'var(--accent-warning)', flexShrink: 0 }} />
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Moderation Tables Missing</h3>
              <p style={{ color: 'var(--text-body)', fontSize: '0.85rem', marginTop: '4px', lineHeight: '1.5' }}>
                The database tables for moderation queue tracking do not exist yet. 
                Please copy the contents of the migration file `supabase/migrations/20260627000000_admin_panel.sql` and execute it in your **Supabase Dashboard SQL Editor** to enable reports queue tracking.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header controls */}
      {!migrationsRequired && (
        <div className="admin-controls">
          <div style={{ display: 'flex', gap: '8px' }}>
            <select className="admin-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="pending">⏳ Pending Reviews</option>
              <option value="resolved">✅ Resolved Reports</option>
              <option value="ignored">👁️ Ignored Reports</option>
              <option value="">All Reports</option>
            </select>

            <select className="admin-select" value={contentType} onChange={(e) => { setContentType(e.target.value); setPage(1); }}>
              <option value="">All Content</option>
              <option value="post">Posts</option>
              <option value="comment">Comments</option>
            </select>
          </div>
        </div>
      )}

      {/* Reports Queue */}
      {!migrationsRequired && (
        <div className="admin-card" style={{ padding: '0 0 1rem 0', overflow: 'hidden' }}>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Report Details</th>
                  <th>Content Type</th>
                  <th>Reason</th>
                  <th>Reporter</th>
                  <th>Reported User</th>
                  <th>Reported Content Preview</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td><div className="admin-skeleton" style={{ width: '80px', height: '12px' }} /></td>
                      <td><div className="admin-skeleton" style={{ width: '60px', height: '14px', borderRadius: '8px' }} /></td>
                      <td><div className="admin-skeleton" style={{ width: '150px', height: '12px' }} /></td>
                      <td><div className="admin-skeleton" style={{ width: '100px', height: '12px' }} /></td>
                      <td><div className="admin-skeleton" style={{ width: '100px', height: '12px' }} /></td>
                      <td><div className="admin-skeleton" style={{ width: '200px', height: '12px' }} /></td>
                      <td><div className="admin-skeleton" style={{ width: '80px', height: '12px' }} /></td>
                      <td><div className="admin-skeleton" style={{ width: '100px', height: '24px', float: 'right' }} /></td>
                    </tr>
                  ))
                ) : reports.length > 0 ? (
                  reports.map(r => (
                    <tr key={r.id}>
                      <td>
                        <span style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                          #{r.id.slice(0, 8)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge-status ${r.content_type === 'post' ? 'problem' : 'active'}`} style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                          {r.content_type}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.reason}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem' }}>
                          {r.reporter?.full_name || 'Anonymous'} (@{r.reporter?.username || 'anonymous'})
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-danger)' }}>
                          {r.reported_user?.full_name || 'Deleted User'} (@{r.reported_user?.username || 'deleted'})
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '300px' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.content_details?.title || r.content_details?.snippet}
                          </span>
                          {r.content_details?.slug && (
                            <Link href={`/post/${r.content_details.slug}`} target="_blank" style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}>
                              View Content <ExternalLink size={10} />
                            </Link>
                          )}
                        </div>
                      </td>
                      <td>{new Date(r.created_at).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        {r.status === 'pending' ? (
                          <div className="admin-actions" style={{ justifyContent: 'flex-end' }}>
                            <button onClick={() => openActionModal(r, 'resolve')} className="btn-admin success" title="Resolve Report (Keep Content)">
                              <Check size={14} /> Keep
                            </button>
                            <button onClick={() => openActionModal(r, 'delete_content')} className="btn-admin danger" title="Delete Reported Content">
                              <Trash2 size={14} /> Remove
                            </button>
                            <button onClick={() => openActionModal(r, 'warn_user')} className="btn-admin" title="Warn Reported User">
                              <BellRing size={14} /> Warn
                            </button>
                            <button onClick={() => openActionModal(r, 'ban_user')} className="btn-admin danger" style={{ background: 'var(--accent-danger)', color: 'white', border: 'none' }} title="Ban Reported User">
                              <UserX size={14} /> Ban
                            </button>
                            <button onClick={() => openActionModal(r, 'ignore')} className="btn-admin" title="Ignore Report">
                              <X size={14} /> Ignore
                            </button>
                          </div>
                        ) : (
                          <span className={`badge-status ${r.status === 'resolved' ? 'active' : 'banned'}`} style={{ fontSize: '0.65rem' }}>
                            {r.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                      Moderation queue is empty.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="admin-pagination" style={{ padding: '1rem 1.5rem' }}>
              <span>Showing page {page} of {totalPages} (Total: {total} reports)</span>
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

      {/* Action Modals */}
      {modalAction && selectedReport && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="admin-modal-title">
                {modalAction === 'ignore' && 'Ignore Moderation Report'}
                {modalAction === 'resolve' && 'Resolve Moderation Report'}
                {modalAction === 'delete_content' && 'Delete Reported Content'}
                {modalAction === 'warn_user' && 'Issue User Warning'}
                {modalAction === 'ban_user' && 'Ban Reported User'}
              </h3>
              <button onClick={closeModal} className="btn-admin" style={{ padding: '4px' }}>
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div>
              {modalAction === 'ignore' && (
                <p className="admin-modal-desc">
                  Are you sure you want to ignore this report? No content will be deleted, and the report status will change to 'ignored'.
                </p>
              )}

              {modalAction === 'resolve' && (
                <p className="admin-modal-desc">
                  Resolve this report as safe? The content will remain public, and the report will be archived as resolved.
                </p>
              )}

              {modalAction === 'delete_content' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', color: 'var(--accent-danger)', alignItems: 'center' }}>
                    <AlertTriangle size={20} />
                    <strong>PERMANENT REMOVAL</strong>
                  </div>
                  <p className="admin-modal-desc">
                    Are you sure you want to delete this reported {selectedReport.content_type}? 
                    It will be deleted permanently from the database.
                  </p>
                </div>
              )}

              {modalAction === 'warn_user' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p className="admin-modal-desc">
                    Send an in-app system warning to **@{selectedReport.reported_user?.username}**? Describe the violation reason.
                  </p>
                  <div className="admin-form-group">
                    <label>Warning Message / Reason</label>
                    <textarea
                      className="admin-textarea"
                      value={warningText}
                      onChange={e => setWarningText(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {modalAction === 'ban_user' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', color: 'var(--accent-danger)', alignItems: 'center' }}>
                    <AlertTriangle size={20} />
                    <strong>PERMANENT USER BAN</strong>
                  </div>
                  <p className="admin-modal-desc">
                    Are you sure you want to permanently ban **@{selectedReport.reported_user?.username}**? 
                    This resolves the report and blocks their access immediately.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="admin-modal-footer">
              <button onClick={closeModal} className="btn-admin" disabled={submittingAction}>
                Cancel
              </button>
              <button
                onClick={handleActionSubmit}
                className={`btn-admin ${modalAction === 'delete_content' || modalAction === 'ban_user' ? 'danger' : 'primary'}`}
                disabled={submittingAction}
              >
                {submittingAction ? (
                  <>
                    <Loader2 size={12} className="animate-spin" /> Submitting...
                  </>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
