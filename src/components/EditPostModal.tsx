'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Sparkles, 
  AlertTriangle, 
  Lightbulb, 
  Link as LinkIcon, 
  Globe, 
  Loader2, 
  Pencil 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Post } from '@/lib/types';
import { useQueryClient } from '@tanstack/react-query';
import ImageUploader from './ImageUploader';
import { decodeHTMLEntities } from '@/lib/htmlDecoder';

interface EditPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  session: any;
}

export default function EditPostModal({ isOpen, onClose, post, session }: EditPostModalProps) {
  const queryClient = useQueryClient();

  // Form states
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<'problem' | 'idea'>('problem');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [externalLink, setExternalLink] = useState('');
  const [linkName, setLinkName] = useState('');
  
  // Controls & Status
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI Enhancer state
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [aiPreviewOpen, setAiPreviewOpen] = useState(false);
  const [originalBody, setOriginalBody] = useState<string | null>(null);
  const [enhancedBody, setEnhancedBody] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && post) {
      setTitle(post.title ? decodeHTMLEntities(post.title) : '');
      setBody(post.body ? decodeHTMLEntities(post.body) : '');
      setType(post.type || 'problem');
      setExternalLink(post.external_link || '');
      setLinkName(post.link_name || '');
      setShowLinkInput(!!post.external_link);
      setError(null);

      // Parse multiple image URLs or fallback to legacy single string
      if (post.image_url) {
        const trimmed = post.image_url.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            setImageUrls(JSON.parse(trimmed));
          } catch {
            setImageUrls([trimmed]);
          }
        } else {
          setImageUrls([trimmed]);
        }
      } else {
        setImageUrls([]);
      }
    }
  }, [isOpen, post]);

  if (!isOpen) return null;

  const charCount = body.trim().length;
  const isEnhanceEnabled = charCount >= 15;

  // AI Enhancer Call
  const handleAIEnhance = async () => {
    if (charCount < 15) return;
    setAiEnhancing(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to enhance.');
      setOriginalBody(body);
      setEnhancedBody(data.enhanced);
      setAiPreviewOpen(true);
    } catch (err: any) {
      setError(err.message || 'AI Enhancer failed.');
    } finally {
      setAiEnhancing(false);
    }
  };

  // Submit edits
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || title.length < 3) {
      setError('Title must be at least 3 characters.');
      return;
    }
    if (!body.trim() || body.length < 10) {
      setError('Body must be at least 10 characters.');
      return;
    }

    setSaving(true);
    setError(null);

    let formattedLink = null;
    if (externalLink) {
      const trimmed = externalLink.trim();
      formattedLink = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    }

    try {
      const res = await fetch('/api/posts/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: post.id,
          title,
          body,
          type,
          image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
          external_link: formattedLink || null,
          link_name: linkName || null,
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save edits.');

      queryClient.invalidateQueries({ queryKey: ['posts'] });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update post.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ display: 'flex' }}>
      <div className="modal-panel" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h3 className="flex items-center gap-2">
            <Pencil size={18} />
            Edit Post
          </h3>
          <button onClick={onClose} className="modal-close-btn" disabled={saving} aria-label="Cancel edits">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="auth-error" style={{ marginBottom: '1.25rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Type Select */}
            <div>
              <span className="cp-field-label">Post type</span>
              <div className="cp-type-row" style={{ marginTop: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setType('problem')}
                  className={`cp-type-chip cp-type-chip--problem ${type === 'problem' ? 'cp-type-chip--active-problem' : ''}`}
                >
                  <AlertTriangle size={13} />
                  Problem
                </button>
                <button
                  type="button"
                  onClick={() => setType('idea')}
                  className={`cp-type-chip cp-type-chip--idea ${type === 'idea' ? 'cp-type-chip--active-idea' : ''}`}
                >
                  <Lightbulb size={13} />
                  Idea
                </button>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="cp-field-label" htmlFor="edit-title">Title</label>
              <input
                id="edit-title"
                type="text"
                className="form-input"
                style={{ width: '100%', marginTop: '0.35rem', backgroundColor: 'var(--search-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem 1rem', color: 'var(--text-main)' }}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={150}
                required
              />
            </div>

            {/* Body */}
            <div>
              <label className="cp-field-label" htmlFor="edit-body">Description</label>
              <textarea
                id="edit-body"
                className="form-textarea"
                style={{ width: '100%', marginTop: '0.35rem', minHeight: '150px', backgroundColor: 'var(--search-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem 1rem', color: 'var(--text-main)', resize: 'vertical' }}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>

            {/* AI Split preview inside modal */}
            {aiPreviewOpen && (
              <div className="cp-ai-split" style={{ margin: '0' }}>
                <div className="cp-ai-split-header">
                  <span className="cp-ai-split-label">AI Enhancement</span>
                  <div className="cp-ai-split-actions">
                    <button type="button" className="cp-ai-btn cp-ai-btn--decline" onClick={() => setAiPreviewOpen(false)}>Decline</button>
                    <button type="button" className="cp-ai-btn cp-ai-btn--accept" onClick={() => { setBody(enhancedBody || ''); setAiPreviewOpen(false); }}>Accept</button>
                  </div>
                </div>
                <div className="split-view">
                  <div className="split-pane" style={{ padding: '0.75rem', fontSize: '0.8rem' }}>{originalBody}</div>
                  <div className="split-pane" style={{ padding: '0.75rem', fontSize: '0.8rem', color: '#a5b4fc' }}>{enhancedBody}</div>
                </div>
              </div>
            )}

            {/* External Links */}
            {showLinkInput && (
              <div>
                <label className="cp-field-label">External link</label>
                <div className="cp-link-row" style={{ marginTop: '0.35rem' }}>
                  <div className="cp-link-input-wrap cp-link-input-wrap--url" style={{ width: '100%' }}>
                    <Globe size={14} className="cp-link-icon" />
                    <input
                      type="url"
                      className="cp-link-input"
                      placeholder="https://example.com"
                      value={externalLink}
                      onChange={(e) => setExternalLink(e.target.value)}
                    />
                  </div>
                  <div className="cp-link-input-wrap cp-link-input-wrap--name" style={{ width: '100%' }}>
                    <input
                      type="text"
                      className="cp-link-input"
                      placeholder="Link label (optional)"
                      value={linkName}
                      onChange={(e) => setLinkName(e.target.value)}
                      maxLength={60}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Reusable Image Uploader for multiple images */}
            <div>
              <span className="cp-field-label">Attachments</span>
              <div style={{ marginTop: '0.35rem' }}>
                <ImageUploader 
                  imageUrls={imageUrls} 
                  onChange={setImageUrls} 
                  maxFiles={10} 
                />
              </div>
            </div>

            {/* Toolbar */}
            <div className="cp-toolbar" style={{ margin: '0', padding: '0.5rem 0 0', borderTop: '1px solid var(--border-color)' }}>
              <div className="cp-toolbar-left">
                <button
                  type="button"
                  className={`cp-tool-btn ${showLinkInput ? 'cp-tool-btn--active' : ''}`}
                  onClick={() => setShowLinkInput(!showLinkInput)}
                >
                  <LinkIcon size={15} />
                  <span>Link</span>
                </button>

                <button
                  type="button"
                  className={`cp-tool-btn cp-tool-btn--ai ${isEnhanceEnabled ? 'cp-tool-btn--ai-active' : ''}`}
                  onClick={handleAIEnhance}
                  disabled={!isEnhanceEnabled || aiEnhancing || saving}
                >
                  <Sparkles size={15} />
                  <span>AI Enhance</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn"
                onClick={onClose}
                disabled={saving}
                style={{ background: 'transparent', color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{ minWidth: '120px' }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
