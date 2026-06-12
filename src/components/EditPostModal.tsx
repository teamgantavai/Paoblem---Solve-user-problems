'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Sparkles, 
  AlertTriangle, 
  Lightbulb, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Globe, 
  Loader2, 
  Pencil 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Post } from '@/lib/types';
import { useQueryClient } from '@tanstack/react-query';
import PhotoEditorModal from './PhotoEditorModal';
import { compressImage } from '@/app/lib/imageCompression';

interface EditPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  session: any;
}

export default function EditPostModal({ isOpen, onClose, post, session }: EditPostModalProps) {
  const queryClient = useQueryClient();

  // Form states
  const [title, setTitle] = useState(post.title || '');
  const [body, setBody] = useState(post.body || '');
  const [type, setType] = useState<'problem' | 'idea'>(post.type || 'problem');
  const [imageUrl, setImageUrl] = useState<string | null>(post.image_url || null);
  const [externalLink, setExternalLink] = useState(post.external_link || '');
  const [linkName, setLinkName] = useState(post.link_name || '');
  
  // Controls & Status
  const [showLinkInput, setShowLinkInput] = useState(!!post.external_link);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI Enhancer state
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [aiPreviewOpen, setAiPreviewOpen] = useState(false);
  const [originalBody, setOriginalBody] = useState<string | null>(null);
  const [enhancedBody, setEnhancedBody] = useState<string | null>(null);

  // Photo Editor Modal state
  const [isPhotoEditorOpen, setIsPhotoEditorOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && post) {
      setTitle(post.title || '');
      setBody(post.body || '');
      setType(post.type || 'problem');
      setImageUrl(post.image_url || null);
      setExternalLink(post.external_link || '');
      setLinkName(post.link_name || '');
      setShowLinkInput(!!post.external_link);
      setError(null);
    }
  }, [isOpen, post]);

  if (!isOpen) return null;

  const charCount = body.trim().length;
  const isEnhanceEnabled = charCount >= 15;

  // File Upload & Compression
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      let file = e.target.files[0];
      setUploading(true);
      setError(null);

      try {
        // Apply Client-Side Image Compression first!
        if (file.type !== 'image/gif') {
          const compressedBlob = await compressImage(file, 0.75, 1200, 1200);
          file = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
            type: 'image/jpeg'
          });
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `post-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(filePath, file);

        if (uploadError) throw new Error(uploadError.message);

        const { data: { publicUrl } } = supabase.storage
          .from('post-images')
          .getPublicUrl(filePath);

        setImageUrl(publicUrl);
      } catch (err: any) {
        console.error('Upload failed:', err);
        setError(err.message || 'Error uploading image.');
      } finally {
        setUploading(false);
      }
    }
  };

  // Edited photo save callback
  const handleEditedPhotoSave = async (editedBlob: Blob, editedDataUrl: string) => {
    setUploading(true);
    setError(null);
    try {
      const fileName = `edited-${Math.random().toString(36).substring(2)}-${Date.now()}.jpg`;
      const filePath = `post-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(filePath, editedBlob, { contentType: 'image/jpeg' });

      if (uploadError) throw new Error(uploadError.message);

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath);

      setImageUrl(publicUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to save edited photo.');
    } finally {
      setUploading(false);
    }
  };

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
          image_url: imageUrl,
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
    <>
      <div className="modal-overlay" style={{ display: 'flex' }}>
        <div className="modal-panel" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
          <div className="modal-header">
            <h3 className="flex items-center gap-2">
              <Pencil size={18} />
              Edit Post
            </h3>
            <button onClick={onClose} className="modal-close-btn" disabled={saving || uploading} aria-label="Cancel edits">
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

              {/* Image previews and Photo editing trigger */}
              {imageUrl && (
                <div>
                  <span className="cp-field-label">Attachment</span>
                  <div className="preview-container" style={{ marginTop: '0.35rem', position: 'relative' }}>
                    <img src={imageUrl} alt="Attachment" className="image-preview" style={{ maxHeight: '200px', objectFit: 'cover', width: '100%', borderRadius: '12px' }} />
                    
                    <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setIsPhotoEditorOpen(true)}
                        style={{ fontSize: '0.72rem', padding: '0.35rem 0.65rem', background: 'rgba(0,0,0,0.75)', color: 'white', border: 'none' }}
                      >
                        Edit Photo
                      </button>
                      <button
                        type="button"
                        className="remove-img-btn"
                        style={{ position: 'static', backgroundColor: 'rgba(0, 0, 0, 0.75)' }}
                        onClick={() => setImageUrl(null)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
                accept="image/png, image/jpeg, image/gif, image/webp"
              />

              {/* Toolbar */}
              <div className="cp-toolbar" style={{ margin: '0', padding: '0.5rem 0 0', borderTop: '1px solid var(--border-color)' }}>
                <div className="cp-toolbar-left">
                  <button
                    type="button"
                    className="cp-tool-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || saving}
                  >
                    {uploading ? <Loader2 size={15} className="spin" /> : <ImageIcon size={15} />}
                    <span>Image</span>
                  </button>

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
                    {aiEnhancing ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
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
                  disabled={saving || uploading}
                  style={{ background: 'transparent', color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || uploading}
                  style={{ minWidth: '120px' }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {imageUrl && (
        <PhotoEditorModal
          isOpen={isPhotoEditorOpen}
          onClose={() => setIsPhotoEditorOpen(false)}
          imageUrl={imageUrl}
          onSave={handleEditedPhotoSave}
        />
      )}
    </>
  );
}
