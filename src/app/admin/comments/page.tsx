'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Search, Trash2, Eye, Pin, CheckCircle2, AlertOctagon,
  Loader2, RefreshCw, X, ChevronLeft, ChevronRight, MessageSquare
} from 'lucide-react';
import Link from 'next/link';

export default function CommentManagement() {
  const [comments, setComments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [postId, setPostId] = useState('');

  // UI state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams({
        search,
        postId,
        page: page.toString(),
        limit: '10',
      });

      const res = await fetch(`/api/admin/comments?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch comments');
      const resData = await res.json();
      setComments(resData.comments || []);
      setTotal(resData.total || 0);
      setTotalPages(resData.totalPages || 1);
    } catch (err: any) {
      showToast(err.message || 'Error loading comments');
    } finally {
      setLoading(false);
    }
  }, [search, postId, page]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleCommentAction = async (commentId: string, action: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Optimistic update
      setComments(comments.map(c => {
        if (c.id === commentId) {
          if (action === 'hide') return { ...c, is_hidden: true };
          if (action === 'restore') return { ...c, is_hidden: false };
          if (action === 'pin') return { ...c, is_pinned: true };
          if (action === 'unpin') return { ...c, is_pinned: false };
        }
        return c;
      }));

      const res = await fetch('/api/admin/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          commentId,
          action,
        }),
      });

      if (!res.ok) throw new Error('Action failed');
      showToast(`Comment updated: ${action}`);
      fetchComments();
    } catch (err: any) {
      showToast(err.message || 'Action failed');
      fetchComments();
    }
  };

  const handleDeleteSubmit = async () => {
    if (!confirmDeleteId) return;
    setSubmittingAction(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setComments(comments.filter(c => c.id !== confirmDeleteId));

      const res = await fetch('/api/admin/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          commentId: confirmDeleteId,
          action: 'delete',
        }),
      });

      if (!res.ok) throw new Error('Deletion failed');
      showToast('Comment deleted permanently.');
      setConfirmDeleteId(null);
      fetchComments();
    } catch (err: any) {
      showToast(err.message || 'Deletion failed');
      fetchComments();
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

      {/* Header controls */}
      <div className="admin-controls">
        <div className="admin-search-wrapper">
          <Search size={16} className="admin-search-icon" />
          <input
            type="text"
            className="admin-search-input"
            placeholder="Search comment body, author, posts..."
            value={search}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      {/* Comments List */}
      <div className="admin-card" style={{ padding: '0 0 1rem 0', overflow: 'hidden' }}>
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Comment Content</th>
                <th>Author</th>
                <th>Parent Post</th>
                <th>Created</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td><div className="admin-skeleton" style={{ width: '240px', height: '14px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '100px', height: '12px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '150px', height: '12px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '80px', height: '12px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '60px', height: '16px', borderRadius: '10px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '80px', height: '24px', float: 'right' }} /></td>
                  </tr>
                ))
              ) : comments.length > 0 ? (
                comments.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontStyle: c.is_hidden ? 'italic' : undefined, textDecoration: c.is_hidden ? 'line-through' : undefined, minWidth: '220px' }}>
                        "{c.body}"
                      </div>
                      {c.is_pinned && <span style={{ fontSize: '0.68rem', color: 'var(--accent-warning)', display: 'inline-flex', alignItems: 'center', gap: '2px', marginTop: '4px' }}>📌 Pinned Comment</span>}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{c.profiles?.full_name || 'Deleted User'}</span>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>@{c.profiles?.username}</div>
                    </td>
                    <td>
                      {c.posts ? (
                        <Link href={`/post/${c.posts.slug || c.posts.id}`} target="_blank" style={{ fontSize: '0.82rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
                          {c.posts.title}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Deleted Post</span>
                      )}
                    </td>
                    <td>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td>
                      {c.is_hidden ? (
                        <span className="badge-status banned">Hidden</span>
                      ) : (
                        <span className="badge-status active">Active</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="admin-actions" style={{ justifyContent: 'flex-end' }}>
                        {c.is_hidden ? (
                          <button onClick={() => handleCommentAction(c.id, 'restore')} className="btn-admin success" title="Restore comment visibility">
                            <CheckCircle2 size={13} />
                          </button>
                        ) : (
                          <button onClick={() => handleCommentAction(c.id, 'hide')} className="btn-admin" title="Hide comment visibility">
                            <AlertOctagon size={13} />
                          </button>
                        )}
                        <button onClick={() => handleCommentAction(c.id, c.is_pinned ? 'unpin' : 'pin')} className="btn-admin" title={c.is_pinned ? 'Unpin' : 'Pin'}>
                          <Pin size={13} style={{ transform: c.is_pinned ? 'rotate(-45deg)' : undefined }} />
                        </button>
                        <button onClick={() => setConfirmDeleteId(c.id)} className="btn-admin danger" title="Delete comment permanently">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                    No comments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="admin-pagination" style={{ padding: '1rem 1.5rem' }}>
            <span>Showing page {page} of {totalPages} (Total: {total} comments)</span>
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

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="admin-modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h3 className="admin-modal-title" style={{ color: 'var(--accent-danger)' }}>Delete Comment Permanently</h3>
            <p className="admin-modal-desc">
              Are you sure you want to permanently delete this comment? 
              All replies nested under this comment thread will also be deleted from the database. 
              **This action is irreversible.**
            </p>
            <div className="admin-modal-footer">
              <button onClick={() => setConfirmDeleteId(null)} className="btn-admin" disabled={submittingAction}>
                Cancel
              </button>
              <button onClick={handleDeleteSubmit} className="btn-admin danger" disabled={submittingAction}>
                {submittingAction ? <Loader2 size={12} className="animate-spin" /> : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
