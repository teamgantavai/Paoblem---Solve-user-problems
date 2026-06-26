'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  FolderPlus, Edit2, Trash2, ArrowUpDown, ChevronUp, ChevronDown,
  Merge, Eye, EyeOff, Loader2, RefreshCw, X, AlertTriangle, Plus
} from 'lucide-react';

export default function CategoryManagement() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationsRequired, setMigrationsRequired] = useState(false);

  // Modal / Form states
  const [newCatName, setNewCatName] = useState('');
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [editCatName, setEditCatName] = useState('');
  
  // Merge Wizard states
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [sourceMerge, setSourceMerge] = useState('');
  const [targetMerge, setTargetMerge] = useState('');
  const [deleteSourceAfterMerge, setDeleteSourceAfterMerge] = useState(true);

  // UI notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/admin/categories', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch categories');
      const resData = await res.json();
      setCategories(resData.categories || []);
      setMigrationsRequired(!!resData.migrationsRequired);
    } catch (err: any) {
      showToast(err.message || 'Error loading categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setSubmittingAction(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const nextSortOrder = categories.length > 0 
        ? Math.max(...categories.map(c => c.sort_order || 0)) + 1 
        : 1;

      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'create',
          payload: {
            name: newCatName.trim(),
            sort_order: nextSortOrder,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create category');
      }

      showToast(`Category '${newCatName}' created successfully.`);
      setNewCatName('');
      fetchCategories();
    } catch (err: any) {
      showToast(err.message || 'Create failed');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Edit category name
  const handleEditSubmit = async () => {
    if (!editingCategory || !editCatName.trim()) return;
    setSubmittingAction(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'edit',
          payload: {
            id: editingCategory.id,
            name: editCatName.trim(),
          },
        }),
      });

      if (!res.ok) throw new Error('Edit failed');
      showToast(`Category renamed to '${editCatName}'`);
      setEditingCategory(null);
      fetchCategories();
    } catch (err: any) {
      showToast(err.message || 'Edit failed');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Toggle active/disabled
  const handleToggleStatus = async (cat: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const nextDisabled = !cat.disabled;
      
      // Optimistic update
      setCategories(categories.map(c => c.id === cat.id ? { ...c, disabled: nextDisabled } : c));

      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'toggle_disable',
          payload: {
            id: cat.id,
            disabled: nextDisabled,
          },
        }),
      });

      if (!res.ok) throw new Error('Toggle status failed');
      showToast(`Category status updated`);
      fetchCategories();
    } catch (err: any) {
      showToast(err.message || 'Toggle failed');
      fetchCategories();
    }
  };

  // Reorder category (up or down index swap)
  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === categories.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newCategories = [...categories];

    // Swap sort orders
    const temp = newCategories[index].sort_order;
    newCategories[index].sort_order = newCategories[targetIndex].sort_order;
    newCategories[targetIndex].sort_order = temp;

    // Swap elements in local array for immediate rendering
    const tempEl = newCategories[index];
    newCategories[index] = newCategories[targetIndex];
    newCategories[targetIndex] = tempEl;

    setCategories(newCategories);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const orders = newCategories.map(c => ({ id: c.id, sort_order: c.sort_order }));

      await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'reorder',
          payload: { orders },
        }),
      });
    } catch (err: any) {
      showToast(err.message || 'Reordering failed');
      fetchCategories();
    }
  };

  // Delete category
  const handleDeleteCategory = async (cat: any) => {
    if (migrationsRequired) {
      showToast('Action unavailable in fallback mode.');
      return;
    }

    if (!confirm(`Are you sure you want to delete category '${cat.name}'? Existing posts will keep their category tags but they won't list under active categories.`)) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setCategories(categories.filter(c => c.id !== cat.id));

      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'delete',
          payload: {
            id: cat.id,
            name: cat.name,
          },
        }),
      });

      if (!res.ok) throw new Error('Deletion failed');
      showToast(`Category '${cat.name}' deleted.`);
      fetchCategories();
    } catch (err: any) {
      showToast(err.message || 'Deletion failed');
      fetchCategories();
    }
  };

  // Merge categories submit
  const handleMergeSubmit = async () => {
    if (!sourceMerge || !targetMerge || sourceMerge === targetMerge) {
      showToast('Please select two distinct categories to merge.');
      return;
    }
    setSubmittingAction(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const sourceCatObj = categories.find(c => c.name === sourceMerge);

      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'merge',
          payload: {
            sourceName: sourceMerge,
            targetName: targetMerge,
            deleteSourceId: deleteSourceAfterMerge ? sourceCatObj?.id : null,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Merge failed');
      }

      showToast(`Successfully merged '${sourceMerge}' into '${targetMerge}'`);
      setShowMergeModal(false);
      setSourceMerge('');
      setTargetMerge('');
      fetchCategories();
    } catch (err: any) {
      showToast(err.message || 'Merge failed');
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

      {/* Fallback Notice */}
      {migrationsRequired && (
        <div className="admin-card" style={{ borderLeft: '4px solid var(--accent-warning)', background: 'rgba(245, 158, 11, 0.04)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <AlertTriangle size={24} style={{ color: 'var(--accent-warning)', flexShrink: 0 }} />
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Dynamic Categories Unavailable</h3>
              <p style={{ color: 'var(--text-body)', fontSize: '0.85rem', marginTop: '4px', lineHeight: '1.5' }}>
                The database table `categories` was not found. The app is falling back to a static list. 
                Please apply the migration file `supabase/migrations/20260627000000_admin_panel.sql` to customize and reorder categories.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add New Category form & Merge button */}
      {!migrationsRequired && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <form onSubmit={handleCreateCategory} className="admin-card" style={{ flex: 1, minWidth: '280px', marginBottom: 0, padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>Create Category</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="admin-input"
                style={{ flex: 1, fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
                placeholder="Category name (e.g. AI, SaaS)..."
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                disabled={submittingAction}
              />
              <button type="submit" className="btn-admin primary" disabled={submittingAction || !newCatName.trim()}>
                <Plus size={14} /> Add
              </button>
            </div>
          </form>

          <div className="admin-card" style={{ width: '280px', marginBottom: 0, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Relocate & Merge</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Merge two categories and update all existing posts automatically in a single transaction.
            </p>
            <button onClick={() => setShowMergeModal(true)} className="btn-admin" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '4px' }}>
              <Merge size={14} /> Open Merge Wizard
            </button>
          </div>
        </div>
      )}

      {/* Categories Listing Table */}
      <div className="admin-card" style={{ padding: '0 0 1rem 0', overflow: 'hidden' }}>
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Order</th>
                <th>Category Name</th>
                <th>Status</th>
                {!migrationsRequired && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td><div className="admin-skeleton" style={{ width: '30px', height: '14px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '150px', height: '14px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '60px', height: '16px', borderRadius: '10px' }} /></td>
                    <td><div className="admin-skeleton" style={{ width: '100px', height: '24px', float: 'right' }} /></td>
                  </tr>
                ))
              ) : categories.length > 0 ? (
                categories.map((c, index) => (
                  <tr key={c.id}>
                    <td>
                      {!migrationsRequired ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '24px' }}>
                          <button disabled={index === 0} onClick={() => handleMoveOrder(index, 'up')} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }} title="Move Up">
                            <ChevronUp size={14} />
                          </button>
                          <button disabled={index === categories.length - 1} onClick={() => handleMoveOrder(index, 'down')} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }} title="Move Down">
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>{c.sort_order}</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{c.name}</span>
                    </td>
                    <td>
                      {c.disabled ? (
                        <span className="badge-status banned">Disabled</span>
                      ) : (
                        <span className="badge-status active">Active</span>
                      )}
                    </td>
                    {!migrationsRequired && (
                      <td style={{ textAlign: 'right' }}>
                        <div className="admin-actions" style={{ justifyContent: 'flex-end' }}>
                          <button onClick={() => { setEditingCategory(c); setEditCatName(c.name); }} className="btn-admin" title="Edit Category Name">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => handleToggleStatus(c)} className="btn-admin" title={c.disabled ? 'Enable Category' : 'Disable Category'}>
                            {c.disabled ? <Eye size={13} style={{ color: 'var(--accent-success)' }} /> : <EyeOff size={13} />}
                          </button>
                          <button onClick={() => handleDeleteCategory(c)} className="btn-admin danger" title="Delete Category">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                    No categories found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="admin-modal-overlay" onClick={() => setEditingCategory(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="admin-modal-title">Rename Category</h3>
              <button onClick={() => setEditingCategory(null)} className="btn-admin" style={{ padding: '4px' }}>
                <X size={16} />
              </button>
            </div>
            <div className="admin-form-group">
              <label>Category Name</label>
              <input
                type="text"
                className="admin-input"
                value={editCatName}
                onChange={e => setEditCatName(e.target.value)}
                disabled={submittingAction}
              />
            </div>
            <div className="admin-modal-footer">
              <button onClick={() => setEditingCategory(null)} className="btn-admin" disabled={submittingAction}>
                Cancel
              </button>
              <button onClick={handleEditSubmit} className="btn-admin primary" disabled={submittingAction || !editCatName.trim()}>
                {submittingAction ? <Loader2 size={12} className="animate-spin" /> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Wizard Modal */}
      {showMergeModal && (
        <div className="admin-modal-overlay" onClick={() => setShowMergeModal(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="admin-modal-title">Merge Category Wizard</h3>
              <button onClick={() => setShowMergeModal(false)} className="btn-admin" style={{ padding: '4px' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="admin-form-group">
                <label>Source Category (To Merge From)</label>
                <select className="admin-select" value={sourceMerge} onChange={e => setSourceMerge(e.target.value)}>
                  <option value="">Select Category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="admin-form-group">
                <label>Target Category (To Merge Into)</label>
                <select className="admin-select" value={targetMerge} onChange={e => setTargetMerge(e.target.value)}>
                  <option value="">Select Category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', margin: '4px 0 10px 0' }}>
                <input
                  type="checkbox"
                  id="deleteCheck"
                  checked={deleteSourceAfterMerge}
                  onChange={e => setDeleteSourceAfterMerge(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="deleteCheck" style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Delete source category from database table after merge completes.
                </label>
              </div>

              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                * All platform publications currently categorised as **"{sourceMerge || 'Source'}"** will be relocated to **"{targetMerge || 'Target'}"**. This ensures no posts are left uncategorized.
              </p>
            </div>

            <div className="admin-modal-footer">
              <button onClick={() => setShowMergeModal(false)} className="btn-admin" disabled={submittingAction}>
                Cancel
              </button>
              <button onClick={handleMergeSubmit} className="btn-admin primary" disabled={submittingAction || !sourceMerge || !targetMerge || sourceMerge === targetMerge}>
                {submittingAction ? <Loader2 size={12} className="animate-spin" /> : 'Execute Merge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
