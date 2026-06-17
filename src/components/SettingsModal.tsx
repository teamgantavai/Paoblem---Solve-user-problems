"use client";

import React, { useEffect, useState } from 'react';
import { X, Sun, Moon, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px', width: '92%' }}
      >
        {/* Header */}
        <div className="modal-header">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Settings
          </h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem' }}>

          {/* Appearance Section */}
          <p style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '0.9rem'
          }}>
            Appearance
          </p>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {/* Dark Mode Option */}
            <button
              onClick={() => applyTheme('dark')}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '1rem 0.75rem',
                borderRadius: '14px',
                border: theme === 'dark'
                  ? '2px solid var(--accent-blue)'
                  : '1.5px solid var(--border-color)',
                background: theme === 'dark'
                  ? 'rgba(0, 132, 255, 0.06)'
                  : 'var(--bg-hover)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
            >
              {theme === 'dark' && (
                <span style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: 'var(--accent-blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Check size={10} color="white" strokeWidth={3} />
                </span>
              )}
              {/* Dark mode preview */}
              <div style={{
                width: '100%',
                height: '56px',
                borderRadius: '8px',
                background: '#0a0a0c',
                border: '1px solid #2a2a2e',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{ height: '10px', background: '#111113', borderBottom: '1px solid #1e1e21' }} />
                <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ height: '5px', width: '60%', background: '#2a2a2e', borderRadius: '3px' }} />
                  <div style={{ height: '4px', width: '80%', background: '#1e1e21', borderRadius: '3px' }} />
                  <div style={{ height: '4px', width: '40%', background: '#1e1e21', borderRadius: '3px' }} />
                </div>
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

            {/* Light Mode Option */}
            <button
              onClick={() => applyTheme('light')}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '1rem 0.75rem',
                borderRadius: '14px',
                border: theme === 'light'
                  ? '2px solid var(--accent-blue)'
                  : '1.5px solid var(--border-color)',
                background: theme === 'light'
                  ? 'rgba(0, 132, 255, 0.06)'
                  : 'var(--bg-hover)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
            >
              {theme === 'light' && (
                <span style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: 'var(--accent-blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Check size={10} color="white" strokeWidth={3} />
                </span>
              )}
              {/* Light mode preview */}
              <div style={{
                width: '100%',
                height: '56px',
                borderRadius: '8px',
                background: '#f8f9fa',
                border: '1px solid #e5e7eb',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{ height: '10px', background: '#ffffff', borderBottom: '1px solid #e5e7eb' }} />
                <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ height: '5px', width: '60%', background: '#d1d5db', borderRadius: '3px' }} />
                  <div style={{ height: '4px', width: '80%', background: '#e5e7eb', borderRadius: '3px' }} />
                  <div style={{ height: '4px', width: '40%', background: '#e5e7eb', borderRadius: '3px' }} />
                </div>
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
}
