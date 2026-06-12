'use client';

import React from 'react';
import { Trash2, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  isPending?: boolean;
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Delete Post',
  description = 'Are you sure you want to delete this post? This action is permanent and cannot be undone.',
  isPending = false,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ display: 'flex' }}>
      <div className="modal-panel" style={{ maxWidth: '400px' }}>
        <div className="modal-header" style={{ borderBottom: 'none' }}>
          <h3 className="flex items-center gap-2" style={{ color: '#ef4444' }}>
            <Trash2 size={18} />
            {title}
          </h3>
          <button onClick={onClose} className="modal-close-btn" disabled={isPending} aria-label="Cancel delete">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '0 1.5rem 1.5rem' }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '1.5rem' }}>
            {description}
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn"
              onClick={onClose}
              disabled={isPending}
              style={{ background: 'transparent', color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              onClick={onConfirm}
              disabled={isPending}
              style={{ backgroundColor: '#ef4444', color: 'white', minWidth: '100px' }}
            >
              {isPending ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
