"use client";

import React, { useEffect, useState } from 'react';
import { X, Sun, Moon, Check, ChevronRight, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ADMIN_EMAIL } from '@/lib/adminConstants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const router = useRouter();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [session, setSession] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [originalUsername, setOriginalUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameSuccess, setUsernameSuccess] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
      setTheme('light');
      document.documentElement.classList.add('light-theme');
    } else {
      setTheme('dark');
      document.documentElement.classList.remove('light-theme');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
        setSession(currentSession);
        if (currentSession?.user?.id) {
          fetchProfile(currentSession.user.id);
        }
      });
    }
  }, [isOpen]);

  const fetchProfile = async (userId: string) => {
    try {
      const res = await fetch(`/api/profile?userId=${userId}`);
      const data = await res.json();
      if (data.profile?.username) {
        setUsername(data.profile.username);
        setOriginalUsername(data.profile.username);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!username || username === originalUsername) {
      setUsernameError('');
      setUsernameSuccess('');
      return;
    }

    if (username.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      setUsernameSuccess('');
      return;
    }

    if (/[^a-z0-9_]/.test(username)) {
      setUsernameError('Can only contain lowercase letters, numbers, and underscores');
      setUsernameSuccess('');
      return;
    }

    // Debounce uniqueness check
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/profile?username=${username}`);
        if (res.status === 404) {
          setUsernameSuccess('Username is available!');
          setUsernameError('');
        } else {
          setUsernameError('Username is already taken');
          setUsernameSuccess('');
        }
      } catch (e) {
        console.error(e);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, originalUsername]);

  const handleSaveUsername = async () => {
    if (!session || !username || usernameError) return;
    setSavingUsername(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ username })
      });
      const data = await res.json();
      if (!res.ok) {
        setUsernameError(data.error || 'Failed to update username');
        setUsernameSuccess('');
      } else {
        setOriginalUsername(username);
        setUsernameSuccess('Username updated successfully!');
        setUsernameError('');
      }
    } catch (e) {
      console.error(e);
      setUsernameError('Failed to save username');
      setUsernameSuccess('');
    } finally {
      setSavingUsername(false);
    }
  };

  const applyTheme = (next: 'dark' | 'light') => {
    setTheme(next);
    localStorage.setItem('theme', next);
    if (next === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!isOpen) return null;

  const content = (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px', width: '92%' }}
      >
        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">Settings</h3>
          <button onClick={onClose} className="modal-close-btn" aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '1.25rem 1.5rem 1.5rem' }}>
          <h4 style={{ 
            fontSize: '0.82rem', 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em', 
            color: 'var(--text-muted)',
            fontWeight: 700,
            marginBottom: '0.85rem'
          }}>
            Appearance
          </h4>

          {/* Theme Selector */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {/* Dark Theme Option */}
            <button
              onClick={() => applyTheme('dark')}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '1.25rem 1rem',
                backgroundColor: 'var(--search-bg)',
                border: `2px solid ${theme === 'dark' ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                borderRadius: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              {theme === 'dark' && (
                <div style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  backgroundColor: 'var(--accent-blue)',
                  color: 'white',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Check size={12} strokeWidth={3} />
                </div>
              )}
              
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '50%', 
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-blue)'
              }}>
                <Moon size={22} fill="currentColor" opacity={0.2} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Moon size={13} style={{ color: theme === 'dark' ? 'var(--accent-blue)' : 'var(--text-muted)' }} />
                <span style={{ 
                  fontSize: '0.78rem', 
                  fontWeight: 600, 
                  color: theme === 'dark' ? 'var(--accent-blue)' : 'var(--text-muted)' 
                }}>
                  Dark
                </span>
              </div>
            </button>

            {/* Light Theme Option */}
            <button
              onClick={() => applyTheme('light')}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '1.25rem 1rem',
                backgroundColor: '#ffffff',
                border: `2px solid ${theme === 'light' ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                borderRadius: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              {theme === 'light' && (
                <div style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  backgroundColor: 'var(--accent-blue)',
                  color: 'white',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Check size={12} strokeWidth={3} />
                </div>
              )}
              
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '50%', 
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b'
              }}>
                <Sun size={24} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sun size={13} style={{ color: theme === 'light' ? 'var(--accent-blue)' : 'var(--text-muted)' }} />
                <span style={{ 
                  fontSize: '0.78rem', 
                  fontWeight: 600, 
                  color: theme === 'light' ? 'var(--accent-blue)' : 'var(--text-muted)' 
                }}>
                  Light
                </span>
              </div>
            </button>
          </div>

          {/* Account Settings Section */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
            <p style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '0.9rem'
            }}>
              Account Username
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                  placeholder="username"
                  style={{
                    width: '100%',
                    background: 'var(--bg-hover)',
                    border: usernameError 
                      ? '1px solid #ef4444' 
                      : usernameSuccess 
                        ? '1px solid #22c55e' 
                        : '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '0.55rem 0.75rem 0.55rem 1.6rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-main)',
                    outline: 'none',
                    transition: 'border 0.2s'
                  }}
                  disabled={savingUsername}
                />
              </div>

              {usernameError && (
                <span style={{ fontSize: '0.72rem', color: '#ef4444' }}>{usernameError}</span>
              )}
              {usernameSuccess && (
                <span style={{ fontSize: '0.72rem', color: '#22c55e' }}>{usernameSuccess}</span>
              )}

              {username !== originalUsername && !usernameError && (
                <button
                  onClick={handleSaveUsername}
                  disabled={savingUsername || !!usernameError}
                  style={{
                    marginTop: '0.5rem',
                    background: 'var(--accent-blue)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    opacity: (savingUsername || !!usernameError) ? 0.6 : 1
                  }}
                >
                  {savingUsername ? 'Saving...' : 'Save Username'}
                </button>
              )}
            </div>
          </div>

          {/* Notification Preferences */}
          <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={() => {
                onClose();
                router.push('/settings/notifications');
              }}
              style={{
                width: '100%',
                background: 'var(--search-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '0.65rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-main)',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--search-bg)'; }}
            >
              <span>🔔 Notification Preferences</span>
              <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>

          {/* Admin Panel (If user is the administrator) */}
          {session?.user?.email === ADMIN_EMAIL && (
            <div style={{ marginTop: '1rem' }}>
              <button
                onClick={() => {
                  onClose();
                  router.push('/admin');
                }}
                style={{
                  width: '100%',
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  borderRadius: '10px',
                  padding: '0.65rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59, 130, 246, 0.15)'; }}
                onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59, 130, 246, 0.08)'; }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldAlert size={15} /> View Admin Panel
                </span>
                <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          )}

          {/* Version info */}
          <div style={{ 
            marginTop: '1.75rem', 
            paddingTop: '1.25rem', 
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Paoblem</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>v0.1.0</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (mounted && typeof document !== 'undefined') {
    const { createPortal } = require('react-dom');
    return createPortal(content, document.body);
  }
  return content;
}
