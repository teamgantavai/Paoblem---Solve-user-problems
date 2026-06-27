'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Plus, Edit2, Trash2, Award, Search,
  ToggleLeft, ToggleRight, Users, Loader2, X
} from 'lucide-react';
import BadgeArtwork from '@/components/badges/BadgeArtwork';
import {
  RARITY_CONFIG,
  CATEGORY_CONFIG,
  type BadgeRarity,
  type BadgeCategory
} from '@/lib/badgeDefinitions';

interface BadgeDef {
  id: string;
  slug: string;
  name: string;
  description: string;
  hint_text: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  rep_reward: number;
  is_hidden: boolean;
  is_active: boolean;
  is_limited: boolean;
  expires_at: string | null;
  unlock_condition: any;
  sort_order: number;
  earn_count: number;
}

const CATEGORIES: BadgeCategory[] = ['creator', 'community', 'popularity', 'consistency', 'founder', 'knowledge', 'special', 'hidden'];
const RARITIES: BadgeRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

const emptyForm = {
  name: '',
  slug: '',
  description: '',
  hint_text: 'Keep exploring...',
  category: 'creator' as BadgeCategory,
  rarity: 'common' as BadgeRarity,
  rep_reward: 10,
  is_hidden: false,
  is_active: true,
  is_limited: false,
  expires_at: '',
  unlock_condition: '{"type":"post_count","threshold":1}',
  sort_order: 0,
};

export default function AdminBadgesPage() {
  const [badges, setBadges] = useState<BadgeDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<BadgeCategory | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editBadge, setEditBadge] = useState<BadgeDef | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [awardModal, setAwardModal] = useState<BadgeDef | null>(null);
  const [awardUsername, setAwardUsername] = useState('');
  const [awardLoading, setAwardLoading] = useState(false);
  const [awardMsg, setAwardMsg] = useState('');

  const loadBadges = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/admin/badges', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to load badges');
      const data = await res.json();
      setBadges(data.badges || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBadges(); }, [loadBadges]);

  const openCreate = () => {
    setEditBadge(null);
    setForm(emptyForm);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (badge: BadgeDef) => {
    setEditBadge(badge);
    setForm({
      name: badge.name,
      slug: badge.slug,
      description: badge.description,
      hint_text: badge.hint_text,
      category: badge.category,
      rarity: badge.rarity,
      rep_reward: badge.rep_reward,
      is_hidden: badge.is_hidden,
      is_active: badge.is_active,
      is_limited: badge.is_limited,
      expires_at: badge.expires_at || '',
      unlock_condition: JSON.stringify(badge.unlock_condition, null, 2),
      sort_order: badge.sort_order,
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleFormChange = (key: string, value: any) => {
    setForm(prev => {
      const updated = { ...prev, [key]: value };
      // Auto-generate slug from name
      if (key === 'name') {
        updated.slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    setFormError(null);
    setSubmitting(true);
    try {
      // Validate JSON condition
      let parsedCondition;
      try {
        parsedCondition = JSON.parse(form.unlock_condition);
      } catch {
        throw new Error('Invalid JSON in unlock condition');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const payload = {
        ...form,
        unlock_condition: parsedCondition,
        expires_at: form.expires_at || null,
        ...(editBadge ? { id: editBadge.id } : {}),
      };

      const res = await fetch('/api/admin/badges', {
        method: editBadge ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save badge');
      }

      setShowModal(false);
      loadBadges();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch('/api/admin/badges', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id }),
      });
      setDeleteConfirm(null);
      loadBadges();
    } catch (_err) {}
  };

  const handleToggleActive = async (badge: BadgeDef) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch('/api/admin/badges', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: badge.id, is_active: !badge.is_active }),
      });
      loadBadges();
    } catch (_err) {}
  };

  const handleManualAward = async () => {
    if (!awardModal || !awardUsername) return;
    setAwardLoading(true);
    setAwardMsg('');
    try {
      // This would require a more complex admin endpoint.
      // For now, show a placeholder message.
      setAwardMsg('Manual award feature coming soon. Use the Supabase dashboard for now.');
    } finally {
      setAwardLoading(false);
    }
  };

  const filtered = badges.filter(b => {
    const matchCat = activeCategory === 'all' || b.category === activeCategory;
    const matchSearch = !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.slug.includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={24} style={{ color: '#fbbf24' }} /> Badge Management
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.3rem 0 0' }}>
            {badges.length} total badges · {badges.filter(b => b.is_active).length} active
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: 'var(--accent-primary)', color: 'white',
            border: 'none', borderRadius: '10px', padding: '0.55rem 1.1rem',
            fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          <Plus size={16} /> New Badge
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '180px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search badges..."
            style={{
              width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)',
              borderRadius: '10px', padding: '0.45rem 0.75rem 0.45rem 2rem',
              color: 'var(--text-main)', fontSize: '0.82rem', fontFamily: 'Outfit, sans-serif', outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {(['all', ...CATEGORIES] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700,
                cursor: 'pointer', border: '1px solid var(--border-color)',
                background: activeCategory === cat ? 'var(--accent-primary)' : 'var(--bg-card)',
                color: activeCategory === cat ? 'white' : 'var(--text-muted)',
                fontFamily: 'Outfit, sans-serif', transition: 'all 0.2s',
              }}
            >
              {cat === 'all' ? 'All' : CATEGORY_CONFIG[cat].icon + ' ' + CATEGORY_CONFIG[cat].label}
            </button>
          ))}
        </div>
      </div>

      {/* Badge List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <Loader2 size={30} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)', marginBottom: '0.75rem' }} />
          <p style={{ fontSize: '0.85rem' }}>Loading badges...</p>
        </div>
      ) : error ? (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '1rem', color: 'var(--accent-danger)' }}>
          {error}
        </div>
      ) : (
        <div className="admin-badges-grid">
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No badges found
            </div>
          ) : filtered.map(badge => {
            const rConf = RARITY_CONFIG[badge.rarity];
            return (
              <div key={badge.id} className="admin-badge-row">
                {/* Preview */}
                <BadgeArtwork
                  slug={badge.slug}
                  rarity={badge.rarity}
                  category={badge.category}
                  size={48}
                  locked={false}
                  animated={false}
                />

                {/* Meta */}
                <div className="admin-badge-meta">
                  <div className="admin-badge-name">{badge.name}</div>
                  <div className="admin-badge-slug">{badge.slug}</div>
                  <div className="admin-badge-pills">
                    <span
                      className="admin-badge-pill"
                      style={{ color: rConf.textColor, background: rConf.bg, borderColor: rConf.color }}
                    >{rConf.label}</span>
                    <span
                      className="admin-badge-pill"
                      style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)', borderColor: 'var(--border-color)' }}
                    >{CATEGORY_CONFIG[badge.category].icon} {CATEGORY_CONFIG[badge.category].label}</span>
                    {badge.is_hidden && (
                      <span className="admin-badge-pill" style={{ color: '#c084fc', background: 'rgba(192,132,252,0.1)', borderColor: '#a855f7' }}>
                        Hidden
                      </span>
                    )}
                    {badge.is_limited && (
                      <span className="admin-badge-pill" style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.1)', borderColor: '#f59e0b' }}>
                        Limited
                      </span>
                    )}
                  </div>
                </div>

                {/* Earn count */}
                <div className="admin-badge-earn-count">
                  <strong>{badge.earn_count}</strong>
                  <span>earned</span>
                </div>

                {/* Active dot */}
                <div
                  className="admin-badge-status-dot"
                  style={{ background: badge.is_active ? '#10b981' : '#6b7280' }}
                  title={badge.is_active ? 'Active' : 'Disabled'}
                />

                {/* Actions */}
                <div className="admin-badge-actions">
                  <button
                    onClick={() => handleToggleActive(badge)}
                    title={badge.is_active ? 'Disable badge' : 'Enable badge'}
                    style={{
                      padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.72rem',
                      border: '1px solid var(--border-color)', background: 'var(--bg-hover)',
                      color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                    }}
                  >
                    {badge.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  </button>
                  <button
                    onClick={() => { setAwardModal(badge); setAwardUsername(''); setAwardMsg(''); }}
                    title="Award to user"
                    style={{
                      padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.72rem',
                      border: '1px solid var(--border-color)', background: 'var(--bg-hover)',
                      color: 'var(--text-muted)', cursor: 'pointer',
                    }}
                  >
                    <Users size={16} />
                  </button>
                  <button
                    onClick={() => openEdit(badge)}
                    title="Edit"
                    style={{
                      padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.72rem',
                      border: '1px solid var(--border-color)', background: 'var(--bg-hover)',
                      color: 'var(--accent-primary)', cursor: 'pointer',
                    }}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(badge.id)}
                    title="Delete"
                    style={{
                      padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.72rem',
                      border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)',
                      color: 'var(--accent-danger)', cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          backdropFilter: 'blur(6px)',
        }} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
            borderRadius: '20px', padding: '2rem', maxWidth: '600px', width: '100%',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                {editBadge ? 'Edit Badge' : 'Create New Badge'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '0.75rem', color: 'var(--accent-danger)', fontSize: '0.82rem', marginBottom: '1rem' }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Name + Slug */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Badge Name *</label>
                  <input value={form.name} onChange={e => handleFormChange('name', e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 0.75rem', color: 'var(--text-main)', fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Slug (auto) *</label>
                  <input value={form.slug} onChange={e => handleFormChange('slug', e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 0.75rem', color: 'var(--text-main)', fontSize: '0.85rem', fontFamily: 'monospace', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Category + Rarity */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Category *</label>
                  <select value={form.category} onChange={e => handleFormChange('category', e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 0.75rem', color: 'var(--text-main)', fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif', outline: 'none' }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_CONFIG[c].label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Rarity *</label>
                  <select value={form.rarity} onChange={e => handleFormChange('rarity', e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 0.75rem', color: RARITY_CONFIG[form.rarity].textColor, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif', outline: 'none' }}>
                    {RARITIES.map(r => <option key={r} value={r}>{RARITY_CONFIG[r].label}</option>)}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Description *</label>
                <textarea value={form.description} onChange={e => handleFormChange('description', e.target.value)} rows={2}
                  style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 0.75rem', color: 'var(--text-main)', fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif', outline: 'none', resize: 'vertical' }}
                />
              </div>

              {/* Hint */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Hint Text (shown to locked users)</label>
                <input value={form.hint_text} onChange={e => handleFormChange('hint_text', e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 0.75rem', color: 'var(--text-main)', fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif', outline: 'none' }}
                />
              </div>

              {/* Rep + Sort */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Rep Reward</label>
                  <input type="number" value={form.rep_reward} onChange={e => handleFormChange('rep_reward', parseInt(e.target.value) || 0)}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 0.75rem', color: 'var(--text-main)', fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Sort Order</label>
                  <input type="number" value={form.sort_order} onChange={e => handleFormChange('sort_order', parseInt(e.target.value) || 0)}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 0.75rem', color: 'var(--text-main)', fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Toggles */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {[
                  { key: 'is_active', label: 'Active' },
                  { key: 'is_hidden', label: 'Hidden (secret)' },
                  { key: 'is_limited', label: 'Limited time' },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-body)' }}>
                    <input type="checkbox" checked={(form as any)[key]} onChange={e => handleFormChange(key, e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
                    />
                    {label}
                  </label>
                ))}
              </div>

              {/* Expires at */}
              {form.is_limited && (
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Expires At (ISO date)</label>
                  <input value={form.expires_at} onChange={e => handleFormChange('expires_at', e.target.value)} placeholder="2025-12-31T23:59:59Z"
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 0.75rem', color: 'var(--text-main)', fontSize: '0.85rem', fontFamily: 'monospace', outline: 'none' }}
                  />
                </div>
              )}

              {/* Unlock condition JSON */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Unlock Condition (JSON) *
                </label>
                <textarea value={form.unlock_condition} onChange={e => handleFormChange('unlock_condition', e.target.value)} rows={4}
                  style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 0.75rem', color: 'var(--text-main)', fontSize: '0.78rem', fontFamily: 'monospace', outline: 'none', resize: 'vertical' }}
                />
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  Example: {`{"type":"post_count","threshold":10,"post_type":"problem"}`}
                </div>
              </div>
            </div>

            {/* Preview */}
            <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'var(--bg-hover)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <BadgeArtwork
                slug={form.slug || 'preview'}
                rarity={form.rarity}
                category={form.category}
                size={64}
                locked={false}
                animated={false}
              />
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>{form.name || 'Badge Name'}</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: RARITY_CONFIG[form.rarity].textColor }}>{RARITY_CONFIG[form.rarity].label}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>+{form.rep_reward} rep</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)}
                style={{ padding: '0.55rem 1.2rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-hover)', color: 'var(--text-body)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                style={{ padding: '0.55rem 1.4rem', borderRadius: '10px', border: 'none', background: 'var(--accent-primary)', color: 'white', cursor: 'pointer', fontWeight: 700, fontFamily: 'Outfit, sans-serif', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Saving...' : editBadge ? 'Save Changes' : 'Create Badge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem', maxWidth: '380px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠️</div>
            <h3 style={{ margin: '0 0 0.5rem', fontWeight: 800 }}>Delete Badge?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              This will also remove this badge from all users who earned it. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ padding: '0.5rem 1.2rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-hover)', color: 'var(--text-body)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                style={{ padding: '0.5rem 1.2rem', borderRadius: '10px', border: 'none', background: 'var(--accent-danger)', color: 'white', cursor: 'pointer', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Award to User Modal */}
      {awardModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem', maxWidth: '400px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontWeight: 800 }}>Award Badge</h3>
              <button onClick={() => setAwardModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-hover)', borderRadius: '10px' }}>
              <BadgeArtwork slug={awardModal.slug} rarity={awardModal.rarity} category={awardModal.category} size={40} locked={false} animated={false} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{awardModal.name}</div>
                <div style={{ fontSize: '0.72rem', color: RARITY_CONFIG[awardModal.rarity].textColor }}>{RARITY_CONFIG[awardModal.rarity].label}</div>
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Username</label>
              <input value={awardUsername} onChange={e => setAwardUsername(e.target.value)} placeholder="@username"
                style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 0.75rem', color: 'var(--text-main)', fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif', outline: 'none' }}
              />
            </div>
            {awardMsg && <div style={{ padding: '0.6rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--accent-success)', marginBottom: '0.75rem' }}>{awardMsg}</div>}
            <button onClick={handleManualAward} disabled={awardLoading || !awardUsername}
              style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: 'none', background: 'var(--accent-primary)', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', opacity: (!awardUsername || awardLoading) ? 0.6 : 1 }}>
              {awardLoading ? 'Awarding...' : 'Award Badge'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
