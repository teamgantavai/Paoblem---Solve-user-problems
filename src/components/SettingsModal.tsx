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
