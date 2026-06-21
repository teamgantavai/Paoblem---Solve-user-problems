'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DraftLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveDraft: () => void;
  onDiscard: () => void;
}

export default function DraftLeaveModal({ isOpen, onClose, onSaveDraft, onDiscard }: DraftLeaveModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ display: 'flex' }}>
      <div className="modal-panel" style={{ maxWidth: '400px' }}>
        <div className="modal-header" style={{ borderBottom: 'none' }}>
          <h3 className="flex items-center gap-2" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
            <AlertTriangle size={18} />
            Unsaved Changes
          </h3>
          <button onClick={onClose} className="modal-close-btn" aria-label="Cancel leaving">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '0 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0' }}>
            You have unsaved changes in this post. Would you like to save it as a draft, discard it, or continue editing?
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn"
              onClick={onSaveDraft}
              style={{ width: '100%', padding: '0.7rem', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.9)', color: '#000', fontWeight: 600, border: 'none' }}
            >
              Save Draft
            </button>
            <button
              type="button"
              className="btn"
              onClick={onDiscard}
              style={{
                width: '100%',
                padding: '0.7rem',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                color: 'rgba(255, 255, 255, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.2s ease',
              }}
            >
              Discard Post
            </button>
            <button
              type="button"
              className="btn"
              onClick={onClose}
              style={{
                width: '100%',
                padding: '0.7rem',
                borderRadius: '12px',
                background: 'transparent',
                color: 'var(--text-muted)',
              }}
            >
              Keep Editing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
