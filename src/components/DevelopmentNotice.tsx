'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Hammer, X } from 'lucide-react';

interface DevelopmentNoticeProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
}

export default function DevelopmentNotice({ isOpen, onClose, featureName = 'This feature' }: DevelopmentNoticeProps) {
  const [mounted, setMounted] = useState(false);
  
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen) return null;

  const content = (
    <div className="modal-overlay" style={{ display: 'flex' }}>
      <div className="modal-panel" style={{ maxWidth: '400px', padding: '0' }}>
        <div className="modal-header" style={{ borderBottom: 'none', padding: '1.25rem 1.5rem 0.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Under Construction</h3>
          <button onClick={onClose} className="modal-close-btn" aria-label="Close Notice">
            <X size={18} />
          </button>
        </div>
        
        <div className="modal-body" style={{ textAlign: 'center', padding: '1.5rem 2rem 2.25rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 191, 0, 0.08)',
            color: 'var(--accent-yellow)',
            marginBottom: '1.25rem'
          }}>
            <Hammer size={28} />
          </div>
          
          <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
            Currently Page in Working
          </h4>
          
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 auto 1.5rem' }}>
            We are actively designing and building {featureName.toLowerCase()}. It will be launched in the next platform release!
          </p>
          
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={onClose}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', fontSize: '0.88rem' }}
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );

  if (mounted && typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }

  return content;
}
