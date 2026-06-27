'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  Search, ShieldCheck, ShieldAlert, MoreVertical, Edit2,
  Trash2, Award, UserCheck, UserX, Clock, User, Eye,
  Loader2, RefreshCw, X, AlertTriangle, ChevronLeft, ChevronRight
} from 'lucide-react';
import Avatar from '@/components/Avatar';

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('joined');
  const [sortOrder, setSortOrder] = useState('desc');

  // Modal / Action states
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [modalAction, setModalAction] = useState<'edit' | 'ban' | 'unban' | 'suspend' | 'delete' | 'reset_reputation' | null>(null);
  const [editPayload, setEditPayload] = useState({ full_name: '', username: '', role: '' });
  const [suspendHours, setSuspendHours] = useState('24');
  
  // Feedback states
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams({
        search,
        sortBy,
        sortOrder,
        page: page.toString(),
        limit: '10',
      });

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch users');
      const resData = await res.json();
      setUsers(resData.users || []);
      setTotal(resData.total || 0);
      setTotalPages(resData.totalPages || 1);
    } catch (err: any) {
      showToast(err.message || 'Error loading users');
    } finally {
      setLoading(false);
    }
  }, [search, sortBy, sortOrder, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Search input debounce helper
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1); // Reset page to 1
  };

  // Close all modals
  const closeModal = () => {
    setSelectedUser(null);
    setModalAction(null);
    setActiveMenuUserId(null);
  };

  // Open action modal
  const openActionModal = (user: any, action: 'edit' | 'ban' | 'unban' | 'suspend' | 'delete' | 'reset_reputation') => {
    setSelectedUser(user);
    setModalAction(action);
    setActiveMenuUserId(null);
    if (action === 'edit') {
      setEditPayload({
        full_name: user.full_name,
        username: user.username,
        role: user.role,
      });
    }
  };

  // Submit action to backend API
  const handleActionSubmit = async () => {
    if (!selectedUser || !modalAction) return;
    setSubmittingAction(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let payload: any = {};
      if (modalAction === 'edit') payload = editPayload;
      if (modalAction === 'suspend') payload = { hours: suspendHours };

      // Optimistic UI updates
      const updatedUsers = users.map(u => {
        if (u.id === selectedUser.id) {
          if (modalAction === 'ban') return { ...u, is_banned: true, suspended_until: null };
          if (modalAction === 'unban') return { ...u, is_banned: false, suspended_until: null };
          if (modalAction === 'reset_reputation') return { ...u, reputation: 0 };
          if (modalAction === 'edit') return { ...u, ...editPayload };
          if (modalAction === 'suspend') {
            const until = new Date(Date.now() + parseInt(suspendHours, 10) * 60 * 60 * 1000).toISOString();
            return { ...u, suspended_until: until, is_banned: false };
          }
        }
        return u;
      });

      if (modalAction === 'delete') {
        setUsers(users.filter(u => u.id !== selectedUser.id));
      } else {
        setUsers(updatedUsers);
      }

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          action: modalAction,
          payload,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Action failed');
      }

      showToast(`User ${selectedUser.username || selectedUser.full_name} updated: ${modalAction}`);
      closeModal();
      fetchUsers(); // Refresh database state
    } catch (err: any) {
      showToast(err.message || 'Action failed');
      fetchUsers(); // Revert on failure
    } finally {
      setSubmittingAction(false);
    }
  };

  // Toggle Verification status instantly
  const handleToggleVerification = async (user: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const nextStatus = !user.is_verified;
      
      // Optimistic update
      setUsers(users.map(u => u.id === user.id ? { ...u, is_verified: nextStatus } : u));

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          action: nextStatus ? 'verify' : 'unverify',
        }),
      });

      if (!res.ok) throw new Error('Verification toggle failed');
      showToast(`User ${user.username} verification toggled`);
    } catch (err: any) {
      showToast(err.message || 'Toggle failed');
      fetchUsers();
    }
  };

  const getStatusText = (u: any) => {
    if (u.is_banned) return <span className="badge-status banned">Banned</span>;
    if (u.suspended_until && new Date(u.suspended_until) > new Date()) {
      return <span className="badge-status banned" style={{ color: 'var(--accent-warning)', background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.2)' }}>Suspended</span>;
    }
    if (u.is_verified) return <span className="badge-status verified">Verified</span>;
    return <span className="badge-status active">Active</span>;
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
            placeholder="Search username, name, email..."
            value={search}
            onChange={handleSearchChange}
          />
        </div>

        <div className="admin-filters">
          <select className="admin-select" value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }}>
            <option value="joined">Join Date</option>
            <option value="active">Last Active</option>
            <option value="posts">Total Posts</option>
            <option value="comments">Total Comments</option>
            <option value="reputation">Trust Score</option>
          </select>

          <select className="admin-select" value={sortOrder} onChange={(e) => { setSortOrder(e.target.value); setPage(1); }}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="admin-card" style={{ padding: '0 0 1rem 0', overflow: 'hidden' }}>
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User Details</th>
                <th>Email</th>
                <th>Joined</th>
                <th>Last Active</th>
                <th>Posts / Comments</th>
                <th>Trust Score</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // Skeletons
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="admin-skeleton" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div className="admin-skeleton" style={{ width: '100px', height: '14px' }} />
                          <div className="admin-skeleton" style={{ width: '60px', height: '10px' }} />
                        </div>
                      </div>
                    </td>
                    <td><div className="admin-skeleton" style={{ width: '120px', height: '12px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '80px', height: '12px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '80px', height: '12px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '60px', height: '12px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '40px', height: '12px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '60px', height: '16px', borderRadius: '10px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '24px', height: '24px', float: 'right' }} /></td>
                  </tr>
                ))
              ) : users.length > 0 ? (
                users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="admin-table-profile">
                        <Avatar src={u.avatar_url} name={u.full_name || u.username || 'User'} size={36} />
                        <div>
                          <div className="admin-table-p-name">{u.full_name}</div>
                          <div className="admin-table-p-sub">@{u.username} • {u.role}</div>
                        </div>
                      </div>
                    </td>
                    <td><span style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>{u.email}</span></td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>{new Date(u.last_seen).toLocaleDateString()}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{u.totalPosts}</span> posts / <span style={{ fontWeight: 600 }}>{u.totalComments}</span> comments
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: u.reputation > 50 ? 'var(--accent-success)' : undefined }}>
                        <Award size={14} />
                        <span>{u.reputation}</span>
                      </div>
                    </td>
                    <td>{getStatusText(u)}</td>
                    <td style={{ textAlign: 'right', position: 'relative' }}>
                      <button
                        onClick={() => setActiveMenuUserId(activeMenuUserId === u.id ? null : u.id)}
                        className="btn-admin"
                        style={{ padding: '6px' }}
                      >
                        <MoreVertical size={16} />
                      </button>

                      {/* Floating actions menu */}
                      {activeMenuUserId === u.id && (
                        <div className="post-overflow-menu" style={{ right: 0, top: '40px', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
                          <Link href={`/user/${u.username}`} target="_blank" className="admin-menu-item" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>
                            <Eye size={14} /> View Profile
                          </Link>
                          <button onClick={() => openActionModal(u, 'edit')} className="admin-menu-item" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>
                            <Edit2 size={14} /> Edit details
                          </button>
                          <button onClick={() => handleToggleVerification(u)} className="admin-menu-item" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>
                            <UserCheck size={14} /> {u.is_verified ? 'Unverify user' : 'Verify user'}
                          </button>
                          <button onClick={() => openActionModal(u, 'reset_reputation')} className="admin-menu-item" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>
                            <Award size={14} /> Reset Trust Score
                          </button>
                          <button onClick={() => openActionModal(u, 'suspend')} className="admin-menu-item" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>
                            <Clock size={14} /> Suspend user
                          </button>
                          {u.is_banned ? (
                            <button onClick={() => openActionModal(u, 'unban')} className="admin-menu-item" style={{ fontSize: '0.8rem', padding: '8px 12px', color: 'var(--accent-success)' }}>
                              <UserCheck size={14} /> Unban account
                            </button>
                          ) : (
                            <button onClick={() => openActionModal(u, 'ban')} className="admin-menu-item text-red-500" style={{ fontSize: '0.8rem', padding: '8px 12px', color: 'var(--accent-danger)' }}>
                              <UserX size={14} /> Ban account
                            </button>
                          )}
                          <button onClick={() => openActionModal(u, 'delete')} className="admin-menu-item text-red-500" style={{ fontSize: '0.8rem', padding: '8px 12px', color: 'var(--accent-danger)', borderTop: '1px solid var(--border-color)' }}>
                            <Trash2 size={14} /> Delete Account
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                    No users found matching query parameters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="admin-pagination" style={{ padding: '1rem 1.5rem' }}>
            <span>Showing page {page} of {totalPages} (Total: {total} users)</span>
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

      {/* Confirmation / Form Modal */}
      {modalAction && selectedUser && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="admin-modal-title">
                {modalAction === 'edit' && 'Edit User Details'}
                {modalAction === 'ban' && 'Ban User Account'}
                {modalAction === 'unban' && 'Unban User Account'}
                {modalAction === 'suspend' && 'Suspend User Temporarily'}
                {modalAction === 'reset_reputation' && 'Reset Trust Score'}
                {modalAction === 'delete' && 'Delete User Account'}
              </h3>
              <button onClick={closeModal} className="btn-admin" style={{ padding: '4px' }}>
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div>
              {modalAction === 'edit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="admin-form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      className="admin-input"
                      value={editPayload.full_name}
                      onChange={e => setEditPayload({ ...editPayload, full_name: e.target.value })}
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Username</label>
                    <input
                      type="text"
                      className="admin-input"
                      value={editPayload.username}
                      onChange={e => setEditPayload({ ...editPayload, username: e.target.value })}
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Role</label>
                    <select
                      className="admin-select"
                      value={editPayload.role}
                      onChange={e => setEditPayload({ ...editPayload, role: e.target.value })}
                    >
                      <option value="Innovator">Innovator</option>
                      <option value="Founder">Founder</option>
                      <option value="Investor">Investor</option>
                      <option value="Operator">Operator</option>
                    </select>
                  </div>
                </div>
              )}

              {modalAction === 'suspend' && (
                <div>
                  <p className="admin-modal-desc">
                    Specify the suspension duration for **@{selectedUser.username}**. During suspension, the user cannot publish posts or write comments.
                  </p>
                  <div className="admin-form-group">
                    <label>Suspension Duration</label>
                    <select
                      className="admin-select"
                      value={suspendHours}
                      onChange={e => setSuspendHours(e.target.value)}
                    >
                      <option value="24">24 Hours</option>
                      <option value="72">72 Hours</option>
                      <option value="168">1 Week (7 Days)</option>
                      <option value="720">30 Days</option>
                    </select>
                  </div>
                </div>
              )}

              {modalAction === 'ban' && (
                <p className="admin-modal-desc">
                  Are you sure you want to ban **@{selectedUser.username}**? This will permanently disable their auth login and suspend public access immediately.
                </p>
              )}

              {modalAction === 'unban' && (
                <p className="admin-modal-desc">
                  Are you sure you want to restore access for **@{selectedUser.username}**? This restores GoTrue auth login immediately.
                </p>
              )}

              {modalAction === 'reset_reputation' && (
                <p className="admin-modal-desc">
                  Are you sure you want to reset **@{selectedUser.username}**'s Trust Score to **0**? This cannot be undone.
                </p>
              )}

              {modalAction === 'delete' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', color: 'var(--accent-danger)', alignItems: 'center' }}>
                    <AlertTriangle size={20} />
                    <strong style={{ fontSize: '0.9rem' }}>CRITICAL DESTRUCTIVE ACTION</strong>
                  </div>
                  <p className="admin-modal-desc">
                    Are you sure you want to permanently delete **@{selectedUser.username}**'s account? 
                    This will delete all their authentication records, posts, solutions, votes, and messages from the platform. 
                    **This operation is irreversible.**
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
                className={`btn-admin ${modalAction === 'delete' || modalAction === 'ban' ? 'danger' : 'primary'}`}
                disabled={submittingAction}
              >
                {submittingAction ? (
                  <>
                    <Loader2 size={12} className="animate-spin" /> Submitting...
                  </>
                ) : (
                  'Confirm Action'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
