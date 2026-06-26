'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Sparkles, 
  Loader2, 
  Bold,
  Italic,
  Underline,
  Code,
  List,
  ListOrdered,
  Link2,
  Plus,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Post } from '@/lib/types';
import ImageUploader from './ImageUploader';
import { decodeHTMLEntities } from '@/lib/htmlDecoder';
import Avatar from './Avatar';

const CATEGORY_CHIPS = ['AI', 'SaaS', 'Education', 'Healthcare', 'Fintech', 'Developer Tools', 'Design', 'Marketing', 'Product', 'Sales', 'Operations', 'Funding'];
const MAX_BODY = 10000;

interface EditPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  session: any;
  onSuccess?: (updatedPost: Post) => void;
}

function normalizeTag(value: string) {
  return value.trim().replace(/^#/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function plainToHtml(text: string): string {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;u&gt;/gi, '<u>')
    .replace(/&lt;\/u&gt;/gi, '</u>');

  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function htmlToPlain(html: string): string {
  if (!html) return '';
  let text = html;
  
  // Replace non-breaking spaces with standard spaces
  text = text.replace(/&nbsp;/gi, ' ').replace(/\u00a0/g, ' ');

  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/div><div>/gi, '\n');
  text = text.replace(/<div>/gi, '');
  text = text.replace(/<\/div>/gi, '');
  text = text.replace(/<p>/gi, '');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<strong\b[^>]*>(.*?)<\/strong>/gi, '**$1**');
  text = text.replace(/<b\b[^>]*>(.*?)<\/b>/gi, '**$1**');
  text = text.replace(/<em\b[^>]*>(.*?)<\/em>/gi, '*$1*');
  text = text.replace(/<i\b[^>]*>(.*?)<\/i>/gi, '*$1*');
  text = text.replace(/<u\b[^>]*>(.*?)<\/u>/gi, '<u>$1</u>');
  text = text.replace(/<code\b[^>]*>(.*?)<\/code>/gi, '`$1`');
  text = text.replace(/<li\b[^>]*>(.*?)<\/li>/gi, '- $1\n');
  text = text.replace(/<ul\b[^>]*>/gi, '');
  text = text.replace(/<\/ul>/gi, '\n');
  text = text.replace(/<ol\b[^>]*>/gi, '');
  text = text.replace(/<\/ol>/gi, '\n');
  
  // Strip all other unsupported HTML tags (like <font>, <span>, style attrs, etc.)
  text = text.replace(/<\/?(?!strong\b|b\b|em\b|i\b|u\b|code\b|li\b|ul\b|ol\b)\w+[^>]*>/gi, '');
  
  text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return text;
}

export default function EditPostModal({ isOpen, onClose, post, session, onSuccess }: EditPostModalProps) {
  const queryClient = useQueryClient();
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<'problem' | 'idea'>('problem');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [externalLink, setExternalLink] = useState('');
  const [linkName, setLinkName] = useState('');
  
  // Category & Tags States
  const [category, setCategory] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Accordion Toggles
  const [tagsEnabled, setTagsEnabled] = useState(false);
  const [linkEnabled, setLinkEnabled] = useState(false);

  // Controls & Status
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
      setCategory(post.category || null);
      setTags(Array.isArray(post.tags) ? post.tags : []);
      
      setLinkEnabled(!!post.external_link);
      setTagsEnabled(Array.isArray(post.tags) && post.tags.length > 0);
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

  // Block screen scrolling behind modal when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Synchronize body state to editor innerHTML
  useEffect(() => {
    if (bodyRef.current) {
      const currentHtml = bodyRef.current.innerHTML;
      const currentPlain = htmlToPlain(currentHtml);
      
      const normCurrent = currentPlain.replace(/\r?\n/g, '').trim();
      const normBody = body.replace(/\r?\n/g, '').trim();
      
      if (normCurrent !== normBody) {
        bodyRef.current.innerHTML = plainToHtml(body);
      }
    }
  }, [body, isOpen]);

  if (!isOpen) return null;

  const bodyCount = body.trim().length;
  const isEnhanceEnabled = bodyCount >= 15;

  const insertFormat = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (bodyRef.current) {
      setBody(htmlToPlain(bodyRef.current.innerHTML));
    }
  };

  const insertCode = () => {
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      document.execCommand('insertHTML', false, `<code>${selection.toString()}</code>`);
    } else {
      document.execCommand('insertHTML', false, '<code>code</code>');
    }
    if (bodyRef.current) {
      setBody(htmlToPlain(bodyRef.current.innerHTML));
    }
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      document.execCommand('createLink', false, url);
      if (bodyRef.current) {
        setBody(htmlToPlain(bodyRef.current.innerHTML));
      }
    }
  };

  const addTag = () => {
    const next = normalizeTag(tagInput);
    if (!next || tags.includes(next) || tags.length >= 5) return;
    setTags((current) => [...current, next]);
    setTagInput('');
  };

  // AI Enhancer Call
  const handleAIEnhance = async () => {
    if (bodyCount < 15) return;
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
          title: title.trim(),
          body: body.trim(),
          type,
          image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
          external_link: formattedLink || null,
          link_name: linkName.trim() || null,
          category: category || null,
          tags: tags || [],
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save edits.');

      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
      queryClient.invalidateQueries({ queryKey: ['profile-saved-posts'] });

      if (onSuccess) {
        onSuccess(data.post);
      }
      
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update post.');
    } finally {
      setSaving(false);
    }
  };

  const authorName = post.profiles?.full_name || 'Member';
  const authorAvatar = post.profiles?.avatar_url || undefined;

  return (
    <div className="cp-modal-overlay" style={{ display: 'flex' }}>
      <div className="create-post-panel" style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
        <header className="cp-modern-header">
          <div className="cp-author-block">
            <Avatar src={authorAvatar} name={authorName} size={42} />
            <div>
              <h1>{authorName}</h1>
              <p style={{ margin: '1px 0 0', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 500 }}>Editing Post</p>
            </div>
          </div>
          <button onClick={onClose} className="cp-modal-close" disabled={saving} aria-label="Cancel edits">
            <X size={18} />
          </button>
        </header>

        <div className="cp-form-body">
          {error && <div className="cp-clean-error">{error}</div>}

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* POST TITLE */}
            <div className="cp-field-group">
              <label className="cp-input-label">Post Title</label>
              <input
                className="cp-text-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={300}
                placeholder="Give your post a clear title..."
                required
              />
            </div>

            {/* SIDE-BY-SIDE DROPDOWNS */}
            <div className="cp-dropdowns-row">
              {/* POST TYPE DROPDOWN */}
              <div className="cp-field-group">
                <label className="cp-input-label">Post Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'problem' | 'idea')}
                  className="cp-select-dropdown"
                >
                  <option value="problem">Problem</option>
                  <option value="idea">Idea</option>
                </select>
              </div>

              {/* CATEGORY DROPDOWN */}
              <div className="cp-field-group">
                <label className="cp-input-label">Category</label>
                <select
                  value={category || ''}
                  onChange={(e) => setCategory(e.target.value || null)}
                  className="cp-select-dropdown"
                >
                  <option value="" disabled>Select category...</option>
                  {CATEGORY_CHIPS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* DESCRIPTION WYSIWYG EDITOR */}
            <div className="cp-field-group">
              <label className="cp-input-label">Description</label>
              <div className="cp-editor-container">
                {/* TOOLBAR */}
                <div className="cp-editor-toolbar">
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertFormat('bold')} title="Bold" className="cp-toolbar-btn">
                    <Bold size={15} />
                  </button>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertFormat('italic')} title="Italic" className="cp-toolbar-btn">
                    <Italic size={15} />
                  </button>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertFormat('underline')} title="Underline" className="cp-toolbar-btn">
                    <Underline size={15} />
                  </button>
                  
                  <span className="cp-toolbar-divider" />
                  
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={insertCode} title="Code" className="cp-toolbar-btn">
                    <Code size={15} />
                  </button>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertFormat('insertUnorderedList')} title="Bullet List" className="cp-toolbar-btn">
                    <List size={15} />
                  </button>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertFormat('insertOrderedList')} title="Numbered List" className="cp-toolbar-btn">
                    <ListOrdered size={15} />
                  </button>
                  
                  <span className="cp-toolbar-divider" />
                  
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={insertLink} title="Link" className="cp-toolbar-btn">
                    <Link2 size={15} />
                  </button>

                  {aiEnhancing ? (
                    <div 
                      style={{ 
                        marginLeft: 'auto', 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '4px', 
                        width: '100px',
                        paddingRight: '8px'
                      }}
                    >
                      <span style={{ fontSize: '0.65rem', color: 'var(--accent-primary)', fontWeight: 600 }}>Enhancing...</span>
                      <div style={{ width: '100%', height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
                        <div className="cp-progress-bar-fill" />
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="cp-toolbar-btn"
                      style={{ 
                        marginLeft: 'auto', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        width: 'auto', 
                        padding: '0 8px', 
                        fontSize: '0.75rem', 
                        fontWeight: 600, 
                        color: !isEnhanceEnabled ? 'var(--text-muted)' : 'var(--accent-primary)',
                        cursor: !isEnhanceEnabled ? 'not-allowed' : 'pointer'
                      }}
                      onClick={handleAIEnhance}
                      disabled={!isEnhanceEnabled}
                    >
                      <Sparkles size={13} />
                      AI Enhance
                    </button>
                  )}
                </div>

                {/* TEXTAREA */}
                <div
                  ref={bodyRef}
                  contentEditable
                  onInput={(e) => setBody(htmlToPlain(e.currentTarget.innerHTML))}
                  data-placeholder="Write something..."
                  className="cp-editor-textarea cp-editor-contenteditable"
                  style={{
                    minHeight: '180px',
                    outline: 'none',
                    overflowY: 'auto'
                  }}
                />
              </div>

              {/* CHARACTER COUNT */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span className={bodyCount > MAX_BODY * 0.9 ? 'warn' : ''}>
                  {bodyCount.toLocaleString()} / {MAX_BODY.toLocaleString()} characters
                </span>
              </div>
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

            {/* DRAG AND DROP MEDIA UPLOADER */}
            <div className="cp-field-group cp-media-section">
              <label className="cp-input-label">Attachments</label>
              <ImageUploader imageUrls={imageUrls} onChange={setImageUrls} maxFiles={10} />
            </div>

            {/* OPTIONAL EXPANDABLE SETTINGS (Tags & Link) */}
            <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <button
                type="button"
                className="cp-section-toggle"
                onClick={() => setTagsEnabled(!tagsEnabled)}
              >
                <Plus size={14} /> {tagsEnabled ? 'Hide Tags' : 'Add Tags'}
              </button>
              <button
                type="button"
                className="cp-section-toggle"
                onClick={() => setLinkEnabled(!linkEnabled)}
              >
                <Plus size={14} /> {linkEnabled ? 'Hide Link' : 'Add Link'}
              </button>
            </div>

            {/* LINK ACCORDION PANEL */}
            {linkEnabled && (
              <div className="cp-collapsible-block">
                <div className="cp-input-label">Attach External Link</div>
                <div className="cp-clean-grid">
                  <label className="cp-clean-field">
                    <span>URL</span>
                    <input value={externalLink} onChange={(e) => setExternalLink(e.target.value)} placeholder="https://example.com" />
                  </label>
                  <label className="cp-clean-field">
                    <span>Display Label</span>
                    <input value={linkName} onChange={(e) => setLinkName(e.target.value)} maxLength={60} placeholder="e.g. Website URL" />
                  </label>
                </div>
              </div>
            )}

            {/* TAGS ACCORDION PANEL */}
            {tagsEnabled && (
              <div className="cp-collapsible-block">
                <div className="cp-input-label">Post Tags</div>
                <div className="cp-clean-tag-input">
                  <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }} placeholder="Add tags (e.g. startup) and press Enter" />
                  <button type="button" onClick={addTag} disabled={!tagInput.trim() || tags.length >= 5}>Add</button>
                </div>
                {tags.length > 0 && (
                  <div className="cp-clean-tag-list">
                    {tags.map((tag) => (
                      <span key={tag}>
                        #{tag}
                        <button type="button" onClick={() => setTags((current) => current.filter((item) => item !== tag))} aria-label={`Remove ${tag}`}><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ACTION BUTTONS (Footer style) */}
            <footer className="cp-modern-footer" style={{ margin: '0 -24px -20px', borderRadius: '0 0 20px 20px' }}>
              <div className="cp-clean-actions-right">
                <button
                  type="button"
                  className="cp-clean-cancel"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cp-clean-submit"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </footer>
          </form>
        </div>
      </div>
    </div>
  );
}
