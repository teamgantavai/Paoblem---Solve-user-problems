'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Settings, Save, RefreshCw, Loader2, AlertTriangle, ShieldCheck,
  ToggleLeft, ToggleRight, Scale, Brain, Mail, Wrench
} from 'lucide-react';

export default function PlatformSettings() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/admin/settings', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to load settings');
      const resData = await res.json();
      setSettings(resData.settings);
    } catch (err: any) {
      showToast(err.message || 'Error fetching settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ settings }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update settings');
      }

      const resData = await res.json();
      setSettings(resData.settings);
      showToast('Settings saved successfully!');
    } catch (err: any) {
      showToast(err.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 size={36} className="animate-spin" style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading platform configuration...</p>
      </div>
    );
  }

  return (
    <div style={{ animation: 'toast-fade-in 0.3s ease', maxWidth: '900px', margin: '0 auto' }}>
      {/* Toast Feed */}
      {toastMessage && (
        <div className="admin-toast">
          <span>{toastMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave}>
        
        {/* General App branding Settings */}
        <div className="admin-card">
          <div className="admin-card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h3 className="admin-card-title">
              <Wrench size={18} style={{ color: 'var(--accent-primary)' }} />
              Branding & App Preferences
            </h3>
          </div>
          
          <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="admin-form-group">
              <label>Platform Name</label>
              <input
                type="text"
                className="admin-input"
                value={settings.platformName}
                onChange={e => setSettings({ ...settings, platformName: e.target.value })}
                required
              />
            </div>

            <div className="admin-form-group">
              <label>Logo Asset URL</label>
              <input
                type="text"
                className="admin-input"
                value={settings.logoUrl}
                onChange={e => setSettings({ ...settings, logoUrl: e.target.value })}
                required
              />
            </div>

            <div className="admin-form-group">
              <label>Favicon Asset URL</label>
              <input
                type="text"
                className="admin-input"
                value={settings.faviconUrl}
                onChange={e => setSettings({ ...settings, faviconUrl: e.target.value })}
                required
              />
            </div>

            <div className="admin-form-group" style={{ justifyContent: 'center' }}>
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', userSelect: 'none', height: '100%', marginTop: '12px' }}>
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={e => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 700 }}>Enable Maintenance Mode</span>
              </label>
            </div>
          </div>
        </div>

        {/* Quality Score parameters */}
        <div className="admin-card">
          <div className="admin-card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h3 className="admin-card-title">
              <Scale size={18} style={{ color: 'var(--accent-primary)' }} />
              AI Quality Score Weights
            </h3>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.4' }}>
            These weights control the Bayesian scaling quality scores mapped to platform posts. Modifying these values updates post weights on recalculation runs.
          </p>

          <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
            <div className="admin-form-group">
              <label>Upvote Weight</label>
              <input
                type="number"
                step="0.1"
                className="admin-input"
                value={settings.defaultQualityScoreSettings.upvoteWeight}
                onChange={e => setSettings({
                  ...settings,
                  defaultQualityScoreSettings: {
                    ...settings.defaultQualityScoreSettings,
                    upvoteWeight: parseFloat(e.target.value) || 0
                  }
                })}
              />
            </div>

            <div className="admin-form-group">
              <label>Comment Weight</label>
              <input
                type="number"
                step="0.1"
                className="admin-input"
                value={settings.defaultQualityScoreSettings.commentWeight}
                onChange={e => setSettings({
                  ...settings,
                  defaultQualityScoreSettings: {
                    ...settings.defaultQualityScoreSettings,
                    commentWeight: parseFloat(e.target.value) || 0
                  }
                })}
              />
            </div>

            <div className="admin-form-group">
              <label>Save Weight</label>
              <input
                type="number"
                step="0.1"
                className="admin-input"
                value={settings.defaultQualityScoreSettings.saveWeight}
                onChange={e => setSettings({
                  ...settings,
                  defaultQualityScoreSettings: {
                    ...settings.defaultQualityScoreSettings,
                    saveWeight: parseFloat(e.target.value) || 0
                  }
                })}
              />
            </div>

            <div className="admin-form-group">
              <label>Share Weight</label>
              <input
                type="number"
                step="0.1"
                className="admin-input"
                value={settings.defaultQualityScoreSettings.shareWeight}
                onChange={e => setSettings({
                  ...settings,
                  defaultQualityScoreSettings: {
                    ...settings.defaultQualityScoreSettings,
                    shareWeight: parseFloat(e.target.value) || 0
                  }
                })}
              />
            </div>

            <div className="admin-form-group">
              <label>Report Penalty Weight</label>
              <input
                type="number"
                step="0.1"
                className="admin-input"
                value={settings.defaultQualityScoreSettings.reportWeight}
                onChange={e => setSettings({
                  ...settings,
                  defaultQualityScoreSettings: {
                    ...settings.defaultQualityScoreSettings,
                    reportWeight: parseFloat(e.target.value) || 0
                  }
                })}
              />
            </div>
          </div>
        </div>

        {/* AI Moderation & Models */}
        <div className="admin-card">
          <div className="admin-card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h3 className="admin-card-title">
              <Brain size={18} style={{ color: 'var(--accent-primary)' }} />
              AI Moderation & Model Configurations
            </h3>
          </div>

          <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="admin-form-group">
              <label>OpenAI Model Reference</label>
              <input
                type="text"
                className="admin-input"
                value={settings.aiModerationSettings.openaiModel}
                onChange={e => setSettings({
                  ...settings,
                  aiModerationSettings: {
                    ...settings.aiModerationSettings,
                    openaiModel: e.target.value
                  }
                })}
              />
            </div>

            <div className="admin-form-group">
              <label>Content Flag threshold</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                className="admin-input"
                value={settings.aiModerationSettings.flagThreshold}
                onChange={e => setSettings({
                  ...settings,
                  aiModerationSettings: {
                    ...settings.aiModerationSettings,
                    flagThreshold: parseFloat(e.target.value) || 0.75
                  }
                })}
              />
            </div>

            <div className="admin-form-group" style={{ gridColumn: 'span 2' }}>
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={settings.aiModerationSettings.autoModerate}
                  onChange={e => setSettings({
                    ...settings,
                    aiModerationSettings: {
                      ...settings.aiModerationSettings,
                      autoModerate: e.target.checked
                    }
                  })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 700 }}>Enable Automated Pre-Moderation Scan (Flag and hide content violating safety score thresholds)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Feature Flags */}
        <div className="admin-card">
          <div className="admin-card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h3 className="admin-card-title">
              <Settings size={18} style={{ color: 'var(--accent-primary)' }} />
              Platform Feature Flags
            </h3>
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={settings.featureFlags.allowNewSignups}
                onChange={e => setSettings({
                  ...settings,
                  featureFlags: {
                    ...settings.featureFlags,
                    allowNewSignups: e.target.checked
                  }
                })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Allow new user signups</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={settings.featureFlags.chatEnabled}
                onChange={e => setSettings({
                  ...settings,
                  featureFlags: {
                    ...settings.featureFlags,
                    chatEnabled: e.target.checked
                  }
                })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Enable In-App Direct Messaging chat system</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={settings.featureFlags.qualityBadgesVisible}
                onChange={e => setSettings({
                  ...settings,
                  featureFlags: {
                    ...settings.featureFlags,
                    qualityBadgesVisible: e.target.checked
                  }
                })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Show quality score badge on posts globally</span>
            </label>
          </div>
        </div>

        {/* Submit Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '3rem' }}>
          <button type="button" onClick={fetchSettings} className="btn-admin" disabled={submitting}>
            Reset Settings
          </button>
          <button type="submit" className="btn-admin primary" disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontWeight: 700 }}>
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save size={16} /> Save Settings Config
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
