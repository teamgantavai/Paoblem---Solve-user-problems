'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Globe2,
  Hash,
  Image as ImageIcon,
  Lightbulb,
  Link2,
  Loader2,
  Lock,
  Plus,
  Send,
  Users,
  X,
  Sparkles,
  Bold,
  Italic,
  Underline,
  Code,
  List,
  ListOrdered,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import AuthModal from '@/components/AuthModal';
import ImageUploader from '@/components/ImageUploader';
import Avatar from '@/components/Avatar';
import { supabase } from '@/lib/supabase';

type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];
type PostType = 'problem' | 'idea' | null;
type Visibility = 'public' | 'community' | 'private';
type Profile = { username: string | null; full_name: string | null; avatar_url: string | null; reputation?: number | null };

const CATEGORY_CHIPS = ['AI', 'SaaS', 'Education', 'Healthcare', 'Fintech', 'Developer Tools', 'Design', 'Marketing', 'Product', 'Sales', 'Operations', 'Funding'];
const MAX_BODY = 10000;
const DRAFT_KEY = 'paoblem:create-post:draft';

function normalizeTag(value: string) {
  return value.trim().replace(/^#/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function displayName(profile: Profile | null, sessionUser: any) {
  if (profile?.full_name) return profile.full_name;
  if (profile?.username) return `@${profile.username}`;
  const metaName = sessionUser?.user_metadata?.full_name || sessionUser?.user_metadata?.username || sessionUser?.user_metadata?.name;
  if (metaName) return metaName;
  if (sessionUser?.email) return sessionUser.email.split('@')[0];
  return 'Member';
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

function CreatePostForm({ session }: { session: Session }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [postType, setPostType] = useState<PostType>(null);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [externalLink, setExternalLink] = useState('');
  const [linkName, setLinkName] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showSavedStatus, setShowSavedStatus] = useState(false);
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Additional settings panels toggle state
  const [tagsEnabled, setTagsEnabled] = useState(false);
  const [linkEnabled, setLinkEnabled] = useState(false);

  // AI Enhancer state
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [aiPreviewOpen, setAiPreviewOpen] = useState(false);
  const [originalBody, setOriginalBody] = useState<string | null>(null);
  const [enhancedBody, setEnhancedBody] = useState<string | null>(null);
  const [aiEnhancedUsed, setAiEnhancedUsed] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from('profiles')
      .select('username, full_name, avatar_url, reputation')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile((data as Profile) || null));
  }, [session?.user?.id]);

  // Load user-specific draft once session and user ID are determined
  useEffect(() => {
    if (!session?.user?.id) return;
    if (draftLoaded) return;
    
    try {
      const key = `paoblem:create-post:draft:${session.user.id}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const draft = JSON.parse(raw);
        setPostType(draft.postType || null);
        setVisibility(draft.visibility || 'public');
        setTitle(draft.title || '');
        setBody(draft.body || '');
        setExternalLink(draft.externalLink || '');
        setLinkName(draft.linkName || '');
        setSelectedCategory(draft.selectedCategory || null);
        setTags(Array.isArray(draft.tags) ? draft.tags : []);

        if (draft.externalLink) setLinkEnabled(true);
        if (Array.isArray(draft.tags) && draft.tags.length > 0) setTagsEnabled(true);
      }
    } catch {}
    setDraftLoaded(true);
  }, [session?.user?.id, draftLoaded]);

  // Auto-save draft specific to the current logged-in user
  useEffect(() => {
    if (!session?.user?.id) return;
    if (!title && !body && !postType && !selectedCategory) return;
    const id = window.setTimeout(() => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const fullDateStr = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + timeStr;

      const key = `paoblem:create-post:draft:${session.user.id}`;
      localStorage.setItem(key, JSON.stringify({
        postType,
        visibility,
        title,
        body,
        externalLink,
        linkName,
        selectedCategory,
        tags,
        savedAt: fullDateStr
      }));
      setLastSavedAt(timeStr);
    }, 700);
    return () => window.clearTimeout(id);
  }, [postType, visibility, title, body, externalLink, linkName, selectedCategory, tags, session?.user?.id]);

  useEffect(() => {
    if (lastSavedAt) {
      setShowSavedStatus(true);
      const timer = setTimeout(() => {
        setShowSavedStatus(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSavedAt]);

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
  }, [body]);

  const bodyCount = body.trim().length;
  const isValid = Boolean(session && postType && title.trim().length >= 3 && body.trim().length >= 10 && bodyCount <= MAX_BODY);

  const addTag = () => {
    const next = normalizeTag(tagInput);
    if (!next || tags.includes(next) || tags.length >= 5) return;
    setTags((current) => [...current, next]);
    setTagInput('');
  };

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

  const handleAIEnhance = async () => {
    if (aiEnhancedUsed) return;
    if (body.trim().length < 15) {
      setError('Description must be at least 15 characters to use AI Enhance.');
      return;
    }
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
      setAiEnhancedUsed(true);
    } catch (err: any) {
      setError(err.message || 'AI Enhancer failed.');
    } finally {
      setAiEnhancing(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session) return setError('Please sign in to publish.');
    if (!postType) return setError('Please select a Post Type (Problem or Idea).');
    if (!isValid) return setError('Please make sure your title has at least 3 characters and description has at least 10.');

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const link = externalLink.trim();
      const formattedLink = link ? (/^https?:\/\//i.test(link) ? link : `https://${link}`) : null;

      const res = await fetch('/api/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          type: postType,
          image_url: imageUrls.length ? JSON.stringify(imageUrls) : null,
          external_link: formattedLink,
          link_name: linkName.trim() || null,
          category: selectedCategory,
          tags,
          metadata: { visibility, category: selectedCategory, tags },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish.');

      if (data.post) {
        try {
          const postWithProfile = {
            ...data.post,
            category: data.post.category || selectedCategory,
            link_name: data.post.link_name || linkName.trim() || null,
            external_link: data.post.external_link || formattedLink,
            profiles: {
              full_name: displayName(profile, session?.user),
              avatar_url: profile?.avatar_url || session?.user?.user_metadata?.avatar_url || null,
              username: profile?.username || session?.user?.user_metadata?.username || null,
              role: null
            },
            comments_count: 0,
            upvotes: 0,
            downvotes: 0
          };
          const stored = JSON.parse(sessionStorage.getItem('paoblem_newly_created_posts') || '[]');
          sessionStorage.setItem('paoblem_newly_created_posts', JSON.stringify([postWithProfile, ...stored]));
        } catch (e) {
          console.error(e);
        }
      }

      if (session?.user?.id) {
        localStorage.removeItem(`paoblem:create-post:draft:${session.user.id}`);
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setTimeout(() => router.push('/'), 650);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish.');
    } finally {
      setSubmitting(false);
    }
  };

  const userAvatarUrl = profile?.avatar_url || session?.user?.user_metadata?.avatar_url || undefined;
  const userFullName = displayName(profile, session?.user);

  return (
    <div className="app-container">
      <Navbar />
      <main className="create-post-shell">
        <form className="create-post-panel" onSubmit={submit}>
          {/* HEADER SECTION */}
          <header className="cp-modern-header">
            <button className="cp-clean-icon-btn" type="button" onClick={() => router.back()} aria-label="Go back">
              <ArrowLeft size={19} />
            </button>
            <div className="cp-author-block">
              <Avatar src={userAvatarUrl} name={userFullName} size={42} />
              <div>
                <h1>{userFullName}</h1>
              </div>
            </div>
            {showSavedStatus && lastSavedAt ? (
              <div className="cp-draft-meta-top">
                <span>Saved {lastSavedAt}</span>
              </div>
            ) : lastSavedAt ? (
              <button
                type="button"
                className="cp-saved-drafts-btn"
                onClick={() => setDraftModalOpen(true)}
              >
                Saved drafts
              </button>
            ) : null}
          </header>

          {/* MAIN FORM BODY */}
          <div className="cp-form-body">
            {/* POST TITLE */}
            <div className="cp-field-group">
              <label className="cp-input-label">Post Title</label>
              <input
                className="cp-text-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={300}
                placeholder="Give your post a clear title..."
              />
            </div>

            {/* SIDE-BY-SIDE DROPDOWNS */}
            <div className="cp-dropdowns-row">
              {/* POST TYPE DROPDOWN */}
              <div className="cp-field-group">
                <label className="cp-input-label">Post Type</label>
                <select
                  value={postType || ''}
                  onChange={(event) => setPostType((event.target.value as PostType) || null)}
                  className="cp-select-dropdown"
                >
                  <option value="" disabled>Select post type...</option>
                  <option value="problem">Problem</option>
                  <option value="idea">Idea</option>
                </select>
              </div>

              {/* CATEGORY DROPDOWN */}
              <div className="cp-field-group">
                <label className="cp-input-label">Category</label>
                <select
                  value={selectedCategory || ''}
                  onChange={(event) => setSelectedCategory(event.target.value || null)}
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
                        color: (body.trim().length < 15 || aiEnhancedUsed) ? 'var(--text-muted)' : 'var(--accent-primary)',
                        cursor: (body.trim().length < 15 || aiEnhancedUsed) ? 'not-allowed' : 'pointer'
                      }}
                      onClick={handleAIEnhance}
                      disabled={body.trim().length < 15 || aiEnhancedUsed}
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

              {/* DESCRIPTION CHARACTER COUNT (Directly below description) */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span className={bodyCount > MAX_BODY * 0.9 ? 'warn' : ''}>
                  {bodyCount.toLocaleString()} / {MAX_BODY.toLocaleString()} characters
                </span>
              </div>
            </div>



            {/* DRAG AND DROP MEDIA UPLOADER */}
            <div className="cp-field-group cp-media-section">
              <label className="cp-input-label">Add Media</label>
              <ImageUploader imageUrls={imageUrls} onChange={setImageUrls} maxFiles={10} />
            </div>

            {/* OPTIONAL EXPANDABLE SETTINGS (Tags & Link only - Poll option removed) */}
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
                    <input value={externalLink} onChange={(event) => setExternalLink(event.target.value)} placeholder="https://example.com" />
                  </label>
                  <label className="cp-clean-field">
                    <span>Display Label</span>
                    <input value={linkName} onChange={(event) => setLinkName(event.target.value)} maxLength={60} placeholder="e.g. Website URL" />
                  </label>
                </div>
              </div>
            )}

            {/* TAGS ACCORDION PANEL */}
            {tagsEnabled && (
              <div className="cp-collapsible-block">
                <div className="cp-input-label">Post Tags</div>
                <div className="cp-clean-tag-input">
                  <input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
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
          </div>

          {error && <div className="cp-clean-error">{error}</div>}
          {success && <div className="cp-clean-success">Published successfully. Redirecting...</div>}

          {/* FOOTER SECTION */}
          <footer className="cp-modern-footer">
            <div className="cp-clean-actions-right">
              <button className="cp-clean-cancel" type="button" onClick={() => router.back()}>
                Cancel
              </button>
              <button type="submit" className="cp-clean-submit" disabled={!isValid || submitting}>
                {submitting ? <><Loader2 size={16} className="spin" /> Publishing...</> : <><Send size={16} /> Publish</>}
              </button>
            </div>
          </footer>
        </form>
      </main>

      {draftModalOpen && (
        <div className="cp-modal-overlay" onClick={() => setDraftModalOpen(false)}>
          <div className="cp-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="cp-modal-header">
              <h2>Saved Draft</h2>
              <button className="cp-modal-close" type="button" onClick={() => setDraftModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="cp-modal-body">
              {(() => {
                try {
                  const key = session?.user?.id ? `paoblem:create-post:draft:${session.user.id}` : DRAFT_KEY;
                  const raw = localStorage.getItem(key);
                  if (!raw) return <p style={{ color: 'var(--text-muted)' }}>No saved drafts found.</p>;
                  const draft = JSON.parse(raw);
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <strong>Saved on:</strong> {draft.savedAt || lastSavedAt || 'Unknown time'}
                      </div>
                      {draft.title && (
                        <div>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Title:</strong>
                          <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '2px', color: 'var(--text-main)' }}>{draft.title}</div>
                        </div>
                      )}
                      {(draft.postType || draft.selectedCategory) && (
                        <div style={{ display: 'flex', gap: '24px' }}>
                          {draft.postType && (
                            <div>
                              <strong style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Type:</strong>
                              <div style={{ fontSize: '0.9rem', marginTop: '2px', textTransform: 'capitalize', color: 'var(--text-main)' }}>{draft.postType}</div>
                            </div>
                          )}
                          {draft.selectedCategory && (
                            <div>
                              <strong style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Category:</strong>
                              <div style={{ fontSize: '0.9rem', marginTop: '2px', color: 'var(--text-main)' }}>{draft.selectedCategory}</div>
                            </div>
                          )}
                        </div>
                      )}
                      <div>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Description / Text:</strong>
                        <div 
                          style={{ 
                            fontSize: '0.9rem', 
                            marginTop: '4px', 
                            background: 'var(--bg-hover)', 
                            padding: '12px', 
                            borderRadius: '8px', 
                            maxHeight: '200px', 
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-main)'
                          }}
                        >
                          {draft.body ? htmlToPlain(plainToHtml(draft.body)) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Empty description</span>}
                        </div>
                      </div>
                    </div>
                  );
                } catch {
                  return <p style={{ color: 'var(--text-muted)' }}>Failed to parse saved draft.</p>;
                }
              })()}
            </div>
            <div className="cp-modal-footer" style={{ borderTop: '1px solid var(--border-color)', marginTop: '16px', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="cp-clean-cancel" 
                onClick={() => setDraftModalOpen(false)}
                style={{ minHeight: '34px', padding: '0 16px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {aiPreviewOpen && (
        <div className="cp-modal-overlay" onClick={() => setAiPreviewOpen(false)}>
          <div className="cp-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="cp-modal-header">
              <h2>
                <Sparkles size={18} style={{ display: 'inline', marginRight: '6px', color: '#c084fc', verticalAlign: 'middle' }} />
                AI Enhance Preview
              </h2>
              <button className="cp-modal-close" type="button" onClick={() => setAiPreviewOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="cp-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Original Text:</strong>
                <div 
                  style={{ 
                    fontSize: '0.9rem', 
                    marginTop: '4px', 
                    background: 'var(--bg-hover)', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    maxHeight: '120px', 
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-muted)'
                  }}
                >
                  {originalBody}
                </div>
              </div>
              <div>
                <strong style={{ fontSize: '0.85rem', color: '#c084fc' }}>AI Enhanced Text:</strong>
                <div 
                  style={{ 
                    fontSize: '0.9rem', 
                    marginTop: '4px', 
                    background: 'rgba(168, 85, 247, 0.05)', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    maxHeight: '180px', 
                    overflowY: 'auto',
                    border: '1px solid rgba(168, 85, 247, 0.25)',
                    color: 'var(--text-main)'
                  }}
                >
                  {enhancedBody}
                </div>
              </div>
            </div>
            <div className="cp-modal-footer" style={{ borderTop: '1px solid var(--border-color)', marginTop: '16px', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                type="button" 
                className="cp-clean-cancel" 
                onClick={() => setAiPreviewOpen(false)}
                style={{ minHeight: '34px', padding: '0 16px' }}
              >
                Reject
              </button>
              <button 
                type="button" 
                className="cp-clean-submit" 
                onClick={() => { setBody(enhancedBody || ''); setAiPreviewOpen(false); }}
                style={{ minHeight: '34px', padding: '0 16px' }}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreatePostPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Loader2 size={24} className="spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-container">
        <Navbar />
        <main className="create-post-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 120px)', padding: '1.5rem' }}>
          <div style={{
            textAlign: 'center',
            padding: '3.5rem 2.5rem',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-strong)',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            alignItems: 'center',
            borderRadius: '20px',
            maxWidth: '480px',
            width: '100%',
          }}>
            {/* Top accent bar */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #6366f1, #3b82f6, #06b6d4)' }} />

            {/* Icon */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              backgroundColor: 'var(--bg-hover)',
              border: '1px solid var(--border-strong)',
              color: '#818cf8',
              marginBottom: '0.25rem',
            }}>
              <Send size={28} />
            </div>

            {/* Heading */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
              <h2 style={{
                fontSize: '1.45rem',
                fontWeight: 800,
                color: 'var(--text-main)',
                letterSpacing: '-0.025em',
                lineHeight: 1.2,
                margin: 0,
              }}>
                Sign in to post
              </h2>
              <p style={{
                fontSize: '0.88rem',
                color: 'var(--text-muted)',
                lineHeight: '1.6',
                margin: 0,
                maxWidth: '340px',
              }}>
                Share your problems and startup ideas with our developer community. You must be signed in to create a post.
              </p>
            </div>

            {/* Divider */}
            <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }} />

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button
                type="button"
                onClick={() => router.push('/')}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-main)',
                  backgroundColor: 'var(--bg-hover)',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                ← Back to Feed
              </button>
              <button
                type="button"
                onClick={() => setIsAuthOpen(true)}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  borderRadius: '12px',
                  border: 'none',
                  color: '#ffffff',
                  backgroundColor: '#4f46e5',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
                }}
              >
                Sign In / Sign Up
              </button>
            </div>
          </div>
        </main>
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      </div>
    );
  }

  const userId = session?.user?.id || 'anonymous';

  return <CreatePostForm key={userId} session={session} />;
}
