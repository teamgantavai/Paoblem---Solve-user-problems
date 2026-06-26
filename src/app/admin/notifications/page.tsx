'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  BellRing, Mail, CheckCircle2, AlertTriangle, Loader2,
  Send, Users, Award, FolderHeart, UserPlus
} from 'lucide-react';

export default function NotificationCenter() {
  const [categories, setCategories] = useState<any[]>([]);
  
  // Form states
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('all'); // 'all', 'verified', 'category', 'selected'
  const [channel, setChannel] = useState('both'); // 'in_app', 'email', 'both'
  const [categoryName, setCategoryName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState(''); // comma-separated

  // Feedback states
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      fetch('/api/admin/categories', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
        .then(res => res.json())
        .then(data => setCategories(data.categories || []))
        .catch(() => {});
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const finalUserIds = selectedUserIds
        .split(',')
        .map(id => id.trim())
        .filter(id => id !== '');

      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          textBody: body.trim(),
          target,
          channel,
          categoryName: target === 'category' ? categoryName : null,
          userIds: target === 'selected' ? finalUserIds : null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to dispatch notifications');
      }

      const dataObj = await res.json();
      showToast(dataObj.message || 'Bulk notification dispatched successfully.');
      
      // Reset form on success
      setTitle('');
      setBody('');
      setSelectedUserIds('');
    } catch (err: any) {
      showToast(err.message || 'Notification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ animation: 'toast-fade-in 0.3s ease', maxWidth: '800px', margin: '0 auto' }}>
      {/* Toast Feed */}
      {toastMessage && (
        <div className="admin-toast">
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="admin-card">
        <div className="admin-card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <h2 className="admin-card-title">
            <BellRing size={20} style={{ color: 'var(--accent-primary)' }} />
            Notification Dispatcher Center
          </h2>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Target Audience Section */}
          <div className="admin-form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={16} /> Target Audience Group
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                className={`btn-admin ${target === 'all' ? 'primary' : ''}`}
                onClick={() => setTarget('all')}
                style={{ height: '44px' }}
              >
                All Platform Users
              </button>

              <button
                type="button"
                className={`btn-admin ${target === 'verified' ? 'primary' : ''}`}
                onClick={() => setTarget('verified')}
                style={{ height: '44px' }}
              >
                Verified Users Only
              </button>

              <button
                type="button"
                className={`btn-admin ${target === 'category' ? 'primary' : ''}`}
                onClick={() => setTarget('category')}
                style={{ height: '44px' }}
              >
                Users in Category
              </button>

              <button
                type="button"
                className={`btn-admin ${target === 'selected' ? 'primary' : ''}`}
                onClick={() => setTarget('selected')}
                style={{ height: '44px' }}
              >
                Specific User IDs
              </button>
            </div>
          </div>

          {/* Contextual Target Inputs */}
          {target === 'category' && (
            <div className="admin-form-group" style={{ animation: 'toast-fade-in 0.15s ease' }}>
              <label>Select Target Category</label>
              <select
                className="admin-select"
                value={categoryName}
                onChange={e => setCategoryName(e.target.value)}
                required
              >
                <option value="">Choose Category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Sends notifications to all users who have written publications in this category.
              </span>
            </div>
          )}

          {target === 'selected' && (
            <div className="admin-form-group" style={{ animation: 'toast-fade-in 0.15s ease' }}>
              <label>User IDs (Comma Separated)</label>
              <input
                type="text"
                className="admin-input"
                placeholder="e.g. 23171a40-32a6-411b-a1d5-649aa607b868, fe87512a-d019-4eef-b099-cb1350b8b2cf"
                value={selectedUserIds}
                onChange={e => setSelectedUserIds(e.target.value)}
                required
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Paste Supabase UUIDs of target profiles.
              </span>
            </div>
          )}

          {/* Delivery Channels */}
          <div className="admin-form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={16} /> Delivery Channel
            </label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="channel"
                  checked={channel === 'in_app'}
                  onChange={() => setChannel('in_app')}
                  style={{ cursor: 'pointer' }}
                />
                In-App Feed notification only
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="channel"
                  checked={channel === 'email'}
                  onChange={() => setChannel('email')}
                  style={{ cursor: 'pointer' }}
                />
                Email delivery only (via Resend)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="channel"
                  checked={channel === 'both'}
                  onChange={() => setChannel('both')}
                  style={{ cursor: 'pointer' }}
                />
                Both (Email and In-App)
              </label>
            </div>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

          {/* Message Content */}
          <div className="admin-form-group">
            <label>Notification Subject / Email Title</label>
            <input
              type="text"
              className="admin-input"
              placeholder="e.g. 📢 Platform Updates & Scheduled Maintenance"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="admin-form-group">
            <label>Message Content (Text/HTML supported in email)</label>
            <textarea
              className="admin-textarea"
              placeholder="Write the message text to be dispatched..."
              value={body}
              onChange={e => setBody(e.target.value)}
              required
              disabled={loading}
              style={{ minHeight: '180px' }}
            />
          </div>

          <button
            type="submit"
            className="btn-admin primary"
            style={{
              height: '46px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.92rem',
              fontWeight: 700,
              gap: '8px',
              marginTop: '1rem',
            }}
            disabled={loading || !title.trim() || !body.trim()}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Dispatching Notifications...
              </>
            ) : (
              <>
                <Send size={16} /> Send Announcement
              </>
            )}
          </button>

        </form>
      </div>
    </div>
  );
}
