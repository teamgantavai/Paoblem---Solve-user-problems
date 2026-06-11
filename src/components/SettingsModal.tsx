"use client";

import React, { useEffect, useState } from 'react';
import { X, Sun, Moon, Monitor, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

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
