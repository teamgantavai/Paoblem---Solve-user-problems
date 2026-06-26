'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Search, Eye, Edit2, Trash2, ShieldAlert, Award, Star,
  Bookmark, Lock, Unlock, TrendingUp, RefreshCw, X,
  AlertTriangle, ChevronLeft, ChevronRight, MoreVertical,
  Flame, Pin, CheckCircle2, AlertOctagon
} from 'lucide-react';
import Link from 'next/link';

export default function PostManagement() {
  const [posts, setPosts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [type, setType] = useState(''); // 'problem', 'idea', or '' (all)
  const [category, setCategory] = useState('');
  const [filter, setFilter] = useState('newest'); // sorting / query types

  // Modal / Action states
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [modalAction, setModalAction] = useState<'edit' | 'delete' | 'hide' | 'restore' | null>(null);
  const [editPayload, setEditPayload] = useState({ title: '', body: '', category: '', tags: [] as string[] });
  const [tagInput, setTagInput] = useState('');

  // UI notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchCategories = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/admin/categories', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const catData = await res.json();
        setCategories(catData.categories || []);
      }
    } catch {
      // Ignored fallback
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams({
        search,
        type,
        category,
        filter,
        page: page.toString(),
        limit: '10',
      });

      const res = await fetch(`/api/admin/posts?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch posts');
      const resData = await res.json();
      setPosts(resData.posts || []);
      setTotal(resData.total || 0);
      setTotalPages(resData.totalPages || 1);
    } catch (err: any) {
      showToast(err.message || 'Error loading posts');
    } finally {
      setLoading(false);
    }
  }, [search, type, category, filter, page]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const closeModal = () => {
    setSelectedPost(null);
    setModalAction(null);
    setActiveMenuPostId(null);
  };

  const openActionModal = (post: any, action: 'edit' | 'delete' | 'hide' | 'restore') => {
    setSelectedPost(post);
    setModalAction(action);
    setActiveMenuPostId(null);
    if (action === 'edit') {
      setEditPayload({
        title: post.title,
        body: post.body,
        category: post.category || '',
        tags: post.tags || [],
      });
      setTagInput((post.tags || []).join(', '));
    }
  };

  // Submit operations
  const handleActionSubmit = async () => {
    if (!selectedPost || !modalAction) return;
    setSubmittingAction(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let payload: any = {};
      if (modalAction === 'edit') {
        const finalTags = tagInput
          .split(',')
          .map(t => t.trim().toLowerCase())
          .filter(t => t !== '');
        payload = { ...editPayload, tags: finalTags };
      }

      // Optimistic updates
      const updatedPosts = posts.map(p => {
        if (p.id === selectedPost.id) {
          if (modalAction === 'edit') return { ...p, ...payload };
          if (modalAction === 'hide') return { ...p, moderation_status: 'rejected' };
          if (modalAction === 'restore') return { ...p, moderation_status: 'approved' };
        }
        return p;
      });

      if (modalAction === 'delete') {
        setPosts(posts.filter(p => p.id !== selectedPost.id));
      } else {
        setPosts(updatedPosts);
      }

      const res = await fetch('/api/admin/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          postId: selectedPost.id,
          action: modalAction,
          payload,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Action failed');
      }

      showToast(`Post updated successfully: ${modalAction}`);
      closeModal();
      fetchPosts();
    } catch (err: any) {
      showToast(err.message || 'Action failed');
      fetchPosts();
    } finally {
      setSubmittingAction(false);
    }
  };

  // Instant toggles
  const handleInstantToggle = async (post: any, action: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Optimistic update
      setPosts(posts.map(p => {
        if (p.id === post.id) {
          if (action === 'feature') return { ...p, is_featured: true };
          if (action === 'unfeature') return { ...p, is_featured: false };
          if (action === 'pin') return { ...p, is_pinned: true };
          if (action === 'unpin') return { ...p, is_pinned: false };
          if (action === 'trending') return { ...p, is_trending: true };
          if (action === 'untrending') return { ...p, is_trending: false };
          if (action === 'lock') return { ...p, locked: true };
          if (action === 'unlock') return { ...p, locked: false };
        }
        return p;
      }));

      const res = await fetch('/api/admin/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          postId: post.id,
          action,
        }),
      });

      if (!res.ok) throw new Error('Toggle action failed');
      showToast(`Action ${action} executed successfully`);
    } catch (err: any) {
      showToast(err.message || 'Action failed');
      fetchPosts();
    }
  };

  const handleRecalculateQuality = async (post: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      showToast(`Recalculating score for post: ${post.title}...`);

      const res = await fetch('/api/admin/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          postId: post.id,
          action: 'recalculate_quality',
        }),
      });

      if (!res.ok) throw new Error('Recalculation failed');
      const dataObj = await res.json();
      
      const newScore = dataObj.new_scores?.[0]?.new_quality_score || 0;
      setPosts(posts.map(p => p.id === post.id ? { ...p, quality_score: newScore } : p));
      
      showToast(`Recalculated Quality Score: ${newScore.toFixed(2)}/10`);
    } catch (err: any) {
      showToast(err.message || 'Recalculation failed');
      fetchPosts();
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
            placeholder="Search post title, authors..."
            value={search}
            onChange={handleSearchChange}
          />
        </div>

        <div className="admin-filters">
          <select className="admin-select" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
            <option value="">All Types</option>
            <option value="problem">❓ Problems</option>
            <option value="idea">💡 Ideas</option>
          </select>

          <select className="admin-select" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
            <option value="">All Categories</option>
            {categories.map((c: any) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          <select className="admin-select" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="most_viewed">Most Viewed</option>
            <option value="most_reported">Most Reported</option>
            <option value="trending">Trending</option>
            <option value="highest_quality">Highest Quality</option>
            <option value="lowest_quality">Lowest Quality</option>
            <option value="featured">Featured</option>
            <option value="pinned">Pinned</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="admin-card" style={{ padding: '0 0 1rem 0', overflow: 'hidden' }}>
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Post Info</th>
                <th>Author</th>
                <th>Category</th>
                <th>Quality Score</th>
                <th>Votes (Up/Down)</th>
                <th>Comments</th>
                <th>Reports</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // Skeletons
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div className="admin-skeleton" style={{ width: '180px', height: '14px' }} />
                        <div className="admin-skeleton" style={{ width: '60px', height: '10px' }} />
                      </div>
                    </td>
                    <td><div className="admin-skeleton" style={{ width: '100px', height: '12px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '80px', height: '12px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '40px', height: '12px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '60px', height: '12px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '30px', height: '12px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '30px', height: '12px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '80px', height: '12px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '24px', height: '24px', float: 'right' }} /></td>
                  </tr>
                ))
              ) : posts.length > 0 ? (
                posts.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className={`badge-status ${p.type}`} style={{ fontSize: '0.62rem', padding: '0 4px' }}>
                            {p.type}
                          </span>
                          {p.title}
                        </span>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                          {p.is_pinned && <span style={{ fontSize: '0.68rem', color: 'var(--accent-warning)', display: 'flex', alignItems: 'center', gap: '2px' }}>📌 Pinned</span>}
                          {p.is_featured && <span style={{ fontSize: '0.68rem', color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: '2px' }}>⭐ Featured</span>}
                          {p.is_trending && <span style={{ fontSize: '0.68rem', color: 'var(--accent-danger)', display: 'flex', alignItems: 'center', gap: '2px' }}>🔥 Trending</span>}
                          {p.locked && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px' }}>🔒 Locked</span>}
                          {p.moderation_status === 'rejected' && <span style={{ fontSize: '0.68rem', color: 'var(--accent-danger)', display: 'flex', alignItems: 'center', gap: '2px' }}>🚫 Hidden</span>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{p.profiles?.full_name || 'Deleted User'}</span>
                      </div>
                    </td>
                    <td><span className="badge-status active" style={{ textTransform: 'none', background: 'var(--bg-hover)' }}>{p.category || 'None'}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: '#8b5cf6' }}>
                        <span>{p.quality_score?.toFixed(2) || '0.00'}</span>
                        <button onClick={() => handleRecalculateQuality(p)} className="btn-admin" style={{ padding: '2px 4px', fontSize: '0.65rem' }} title="Recalculate quality score">
                          <RefreshCw size={10} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: 'var(--accent-success)', fontWeight: 600 }}>▲{p.upvotes}</span> / <span style={{ color: 'var(--accent-danger)', fontWeight: 600 }}>▼{p.downvotes}</span>
                    </td>
                    <td>{p.comments_count}</td>
                    <td>
                      <span style={{ color: p.reports > 0 ? 'var(--accent-danger)' : undefined, fontWeight: p.reports > 0 ? 700 : undefined }}>
                        {p.reports || 0}
                      </span>
                    </td>
                    <td>{new Date(p.created_at).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'right', position: 'relative' }}>
                      <button
                        onClick={() => setActiveMenuPostId(activeMenuPostId === p.id ? null : p.id)}
                        className="btn-admin"
                        style={{ padding: '6px' }}
                      >
                        <MoreVertical size={16} />
                      </button>

                      {/* Dropdown Menu */}
                      {activeMenuPostId === p.id && (
                        <div className="post-overflow-menu" style={{ right: 0, top: '40px', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
                          <Link href={`/post/${p.slug || p.id}`} target="_blank" className="admin-menu-item" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>
                            <Eye size={14} /> View Live Post
                          </Link>
                          <button onClick={() => openActionModal(p, 'edit')} className="admin-menu-item" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>
                            <Edit2 size={14} /> Edit post
                          </button>
                          
                          {/* Featured toggle */}
                          <button onClick={() => handleInstantToggle(p, p.is_featured ? 'unfeature' : 'feature')} className="admin-menu-item" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>
                            <Star size={14} /> {p.is_featured ? 'Unfeature post' : 'Feature post'}
                          </button>

                          {/* Pin toggle */}
                          <button onClick={() => handleInstantToggle(p, p.is_pinned ? 'unpin' : 'pin')} className="admin-menu-item" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>
                            <Pin size={14} /> {p.is_pinned ? 'Unpin announcement' : 'Pin announcement'}
                          </button>

                          {/* Trending toggle */}
                          <button onClick={() => handleInstantToggle(p, p.is_trending ? 'untrending' : 'trending')} className="admin-menu-item" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>
                            <Flame size={14} /> {p.is_trending ? 'Remove trending' : 'Mark as Trending'}
                          </button>

                          {/* Lock comments toggle */}
                          <button onClick={() => handleInstantToggle(p, p.locked ? 'unlock' : 'lock')} className="admin-menu-item" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>
                            {p.locked ? <Unlock size={14} /> : <Lock size={14} />} {p.locked ? 'Unlock comments' : 'Lock comments'}
                          </button>

                          {/* Moderation Status (Hide/Restore) */}
                          {p.moderation_status === 'rejected' ? (
                            <button onClick={() => openActionModal(p, 'restore')} className="admin-menu-item" style={{ fontSize: '0.8rem', padding: '8px 12px', color: 'var(--accent-success)' }}>
                              <CheckCircle2 size={14} /> Restore post
                            </button>
                          ) : (
                            <button onClick={() => openActionModal(p, 'hide')} className="admin-menu-item" style={{ fontSize: '0.8rem', padding: '8px 12px', color: 'var(--accent-danger)' }}>
                              <AlertOctagon size={14} /> Hide / Moderate
                            </button>
                          )}

                          <button onClick={() => openActionModal(p, 'delete')} className="admin-menu-item text-red-500" style={{ fontSize: '0.8rem', padding: '8px 12px', color: 'var(--accent-danger)', borderTop: '1px solid var(--border-color)' }}>
                            <Trash2 size={14} /> Delete post
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                    No posts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="admin-pagination" style={{ padding: '1rem 1.5rem' }}>
            <span>Showing page {page} of {totalPages} (Total: {total} posts)</span>
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

      {/* Modals */}
      {modalAction && selectedPost && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="admin-modal-title">
                {modalAction === 'edit' && 'Edit Post'}
                {modalAction === 'delete' && 'Delete Post Permanently'}
                {modalAction === 'hide' && 'Hide Post Content'}
                {modalAction === 'restore' && 'Restore Post Content'}
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
                    <label>Post Title</label>
                    <input
                      type="text"
                      className="admin-input"
                      value={editPayload.title}
                      onChange={e => setEditPayload({ ...editPayload, title: e.target.value })}
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Category</label>
                    <select
                      className="admin-select"
                      value={editPayload.category}
                      onChange={e => setEditPayload({ ...editPayload, category: e.target.value })}
                    >
                      <option value="">Select Category</option>
                      {categories.map((c: any) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-form-group">
                    <label>Body text</label>
                    <textarea
                      className="admin-textarea"
                      value={editPayload.body}
                      onChange={e => setEditPayload({ ...editPayload, body: e.target.value })}
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Tags (comma separated)</label>
                    <input
                      type="text"
                      className="admin-input"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {modalAction === 'delete' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', color: 'var(--accent-danger)', alignItems: 'center' }}>
                    <AlertTriangle size={20} />
                    <strong>PERMANENT DELETION</strong>
                  </div>
                  <p className="admin-modal-desc">
                    Are you sure you want to permanently delete the post **"{selectedPost.title}"**? 
                    This will delete all solutions, votes, and comments associated with this post. 
                    **This operation cannot be undone.**
                  </p>
                </div>
              )}

              {modalAction === 'hide' && (
                <p className="admin-modal-desc">
                  Are you sure you want to hide **"{selectedPost.title}"**? 
                  This will change its moderation status to 'rejected', hiding it from the public homepage and search index.
                </p>
              )}

              {modalAction === 'restore' && (
                <p className="admin-modal-desc">
                  Are you sure you want to restore **"{selectedPost.title}"**? 
                  This resets its status to 'approved', making it public again.
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="admin-modal-footer">
              <button onClick={closeModal} className="btn-admin" disabled={submittingAction}>
                Cancel
              </button>
              <button
                onClick={handleActionSubmit}
                className={`btn-admin ${modalAction === 'delete' || modalAction === 'hide' ? 'danger' : 'primary'}`}
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
