'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  X,
  Loader2,
  CheckCircle,
  Save,
  Globe,
  FileText,
  Image as ImageIcon,
  Link2,
  TriangleIcon,
  MessageCircle,
  Plus,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { useQueryClient } from '@tanstack/react-query';
import DraftLeaveModal from '@/components/DraftLeaveModal';
import ImageUploader from '@/components/ImageUploader';
import ImageGallery from '@/components/ImageGallery';

type PostTab = 'post' | 'media' | 'link';

const FLAIR_OPTIONS = [
  { value: 'problem', label: 'Problem', icon: AlertTriangle },
  { value: 'idea', label: 'Idea', icon: Lightbulb },
] as const;

const PREVIEW_COMMENTS = [
  {
    id: 'preview-1',
    author: 'Community Member',
    body: 'This looks like a great discussion starter!',
    replies: [
      { id: 'preview-1-1', author: 'You', body: 'Thanks — looking forward to the feedback.' },
    ],
  },
];

export default function CreatePost() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'problem' | 'idea'>('problem');
  const [body, setBody] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [externalLink, setExternalLink] = useState('');
  const [linkName, setLinkName] = useState('');
  const [activeTab, setActiveTab] = useState<PostTab>('post');
  const [tagFlags, setTagFlags] = useState({ oc: false, spoiler: false, nsfw: false });
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [previewVote, setPreviewVote] = useState<'up' | 'down' | null>(null);
  const [previewUpvotes, setPreviewUpvotes] = useState(0);
  const [previewDownvotes, setPreviewDownvotes] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);

  const [showAiTooltip, setShowAiTooltip] = useState(false);
  const [isDraftLeaveOpen, setIsDraftLeaveOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const uploaderRef = useRef<HTMLDivElement>(null);

  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [aiPreviewOpen, setAiPreviewOpen] = useState(false);
  const [originalBody, setOriginalBody] = useState<string | null>(null);
  const [enhancedBody, setEnhancedBody] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (!currentSession) setError('You must be logged in to create a post.');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession) setError(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [body, activeTab]);

  useEffect(() => {
    const savedDraft = localStorage.getItem('paoblem-post-draft');
    if (!savedDraft) return;
    try {
      const parsed = JSON.parse(savedDraft);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.type) setType(parsed.type);
      if (parsed.body) setBody(parsed.body);
      if (parsed.externalLink) setExternalLink(parsed.externalLink);
      if (parsed.linkName) setLinkName(parsed.linkName);
      if (parsed.activeTab) setActiveTab(parsed.activeTab);
      if (parsed.tagFlags) setTagFlags(parsed.tagFlags);
      if (parsed.customTags) setCustomTags(parsed.customTags);
      if (parsed.imageUrls) setImageUrls(parsed.imageUrls);
      else if (parsed.imageUrl) setImageUrls([parsed.imageUrl]);
      if (parsed.timestamp) {
        setLastSaved(new Date(parsed.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (e) {
      console.error('Failed to parse saved draft', e);
    }
  }, []);

  useEffect(() => {
    if (!title && !body && !externalLink && imageUrls.length === 0) return;
    const delayDebounceFn = setTimeout(() => {
      const draft = {
        title,
        type,
        body,
        externalLink,
        linkName,
        imageUrls,
        activeTab,
        tagFlags,
        customTags,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem('paoblem-post-draft', JSON.stringify(draft));
      setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearTimeout(delayDebounceFn);
  }, [title, type, body, externalLink, linkName, imageUrls, activeTab, tagFlags, customTags]);

  const charCount = body.trim().length;
  const isEnhanceEnabled = charCount >= 15;
  const activeFlair = FLAIR_OPTIONS.find((f) => f.value === type)!;

  const toggleTagFlag = (key: keyof typeof tagFlags) => {
    setTagFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const addCustomTag = () => {
    const cleaned = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (!cleaned || customTags.includes(cleaned) || customTags.length >= 5) return;
    setCustomTags((prev) => [...prev, cleaned]);
    setTagInput('');
  };

  const removeCustomTag = (tag: string) => {
    setCustomTags((prev) => prev.filter((t) => t !== tag));
  };

  const handlePreviewVote = (voteType: 'up' | 'down') => {
    if (previewVote === voteType) {
      setPreviewVote(null);
      if (voteType === 'up') setPreviewUpvotes(0);
      else setPreviewDownvotes(0);
      return;
    }
    if (previewVote === 'up') setPreviewUpvotes(0);
    if (previewVote === 'down') setPreviewDownvotes(0);
    setPreviewVote(voteType);
    if (voteType === 'up') setPreviewUpvotes(1);
    else setPreviewDownvotes(1);
  };

  const buildBodyWithTags = (rawBody: string) => {
    const hashtags = customTags.map((t) => `#${t}`).join(' ');
    if (!hashtags) return rawBody;
    return `${rawBody.trim()}\n\n${hashtags}`;
  };

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
      if (!res.ok) throw new Error(data.error || 'Failed to enhance text.');
      setOriginalBody(body);
      setEnhancedBody(data.enhanced);
      setAiPreviewOpen(true);
    } catch (err: any) {
      setError(err.message || 'AI Enhancer failed.');
    } finally {
      setAiEnhancing(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!session) {
      setError('You must be logged in to post.');
      return;
    }
    if (!title.trim() || title.length < 3) {
      setError('Title must be at least 3 characters long.');
      return;
    }
    if (activeTab !== 'link' && (!body.trim() || body.length < 10)) {
      setError('Body must be at least 10 characters long.');
      return;
    }
    if (activeTab === 'link' && !externalLink.trim()) {
      setError('Please add a link URL.');
      return;
    }

    setSubmitting(true);
    setError(null);

    let formattedLink = null;
    if (externalLink) {
      const trimmed = externalLink.trim();
      formattedLink = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    }

    const finalBody =
      activeTab === 'link' && !body.trim()
        ? buildBodyWithTags(`Shared link: ${linkName || formattedLink}`)
        : buildBodyWithTags(body);

    try {
      const res = await fetch('/api/posts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: tagFlags.spoiler ? `[Spoiler] ${title}` : title,
          body: finalBody,
          type,
          image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
          external_link: formattedLink || null,
          link_name: linkName || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');

      setSuccess(true);
      localStorage.removeItem('paoblem-post-draft');
      queryClient.invalidateQueries({ queryKey: ['posts'] });

      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to create post.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackClick = () => {
    const hasUnsavedChanges = title.trim() || body.trim() || imageUrls.length > 0 || externalLink;
    if (hasUnsavedChanges) setIsDraftLeaveOpen(true);
    else router.push('/');
  };

  const isFormValid =
    title.trim().length >= 3 &&
    session &&
    (activeTab === 'link' ? externalLink.trim().length > 0 : body.trim().length >= 10);

  const previewTags = [
    ...(tagFlags.oc ? ['OC'] : []),
    ...(tagFlags.spoiler ? ['Spoiler'] : []),
    ...(tagFlags.nsfw ? ['NSFW'] : []),
    ...customTags.map((t) => `#${t}`),
  ];

  return (
    <div className="app-container">
      <Navbar />

      <div className="cp-wrapper">
        <div className="cp-header">
          <div className="cp-header-left">
            <button className="cp-back-btn" onClick={handleBackClick} aria-label="Go Back">
              <ArrowLeft size={16} />
            </button>
            <div className="cp-header-title-block">
              <h1 className="cp-page-title">Create Post</h1>
              {lastSaved && (
                <span className="cp-draft-badge">
                  <Save size={10} />
                  Saved {lastSaved}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            className={`cp-publish-btn mobile-only ${!isFormValid ? 'cp-publish-btn--disabled' : ''}`}
            disabled={!isFormValid || submitting}
            onClick={() => handleSubmit()}
          >
            {submitting ? <Loader2 size={14} className="spin" /> : 'Post'}
          </button>
          <button
            type="button"
            className={`cp-publish-btn desktop-only ${!isFormValid ? 'cp-publish-btn--disabled' : ''}`}
            disabled={!isFormValid || submitting}
            onClick={() => handleSubmit()}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="spin" /> Publishing
              </>
            ) : success ? (
              <>
                <CheckCircle size={14} /> Done
              </>
            ) : (
              'Post'
            )}
          </button>
        </div>

        {error && <div className="cp-alert cp-alert--error">{error}</div>}
        {success && (
          <div className="cp-alert cp-alert--success">
            <CheckCircle size={16} />
            Post published! Redirecting…
          </div>
        )}

        <div className="create-post-grid">
          <div className="cp-composer-card cp-composer-card--reddit">
            <form onSubmit={handleSubmit}>
              <div className="cp-tab-bar" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'post'}
                  className={`cp-tab ${activeTab === 'post' ? 'cp-tab--active' : ''}`}
                  onClick={() => setActiveTab('post')}
                >
                  <FileText size={16} />
                  <span>Post</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'media'}
                  className={`cp-tab ${activeTab === 'media' ? 'cp-tab--active' : ''}`}
                  onClick={() => setActiveTab('media')}
                >
                  <ImageIcon size={16} />
                  <span>Images &amp; Video</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'link'}
                  className={`cp-tab ${activeTab === 'link' ? 'cp-tab--active' : ''}`}
                  onClick={() => setActiveTab('link')}
                >
                  <Link2 size={16} />
                  <span>Link</span>
                </button>
              </div>

              <div className="cp-title-row">
                <input
                  ref={titleInputRef}
                  id="post-title"
                  className="cp-title-input cp-title-input--reddit"
                  placeholder="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={submitting}
                  maxLength={300}
                  required
                />
                <span className="cp-char-count cp-char-count--title">{title.length}/300</span>
              </div>

              <div className="cp-category-row">
                <span className="cp-category-label">Category</span>
                <div className="cp-category-options">
                  {FLAIR_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`cp-category-btn ${type === option.value ? `cp-category-btn--active cp-category-btn--${option.value}` : ''}`}
                      onClick={() => setType(option.value)}
                    >
                      <option.icon size={14} />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {activeTab === 'post' && (
                <div className="cp-editor-wrap">
                  <textarea
                    ref={textareaRef}
                    id="post-body"
                    className="cp-body-textarea cp-body-textarea--reddit"
                    placeholder="Text (optional)"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              )}

              {activeTab === 'media' && (
                <div className="cp-tab-panel" ref={uploaderRef}>
                  <p className="cp-tab-panel-hint">Upload up to 10 images for your post.</p>
                  <ImageUploader imageUrls={imageUrls} onChange={setImageUrls} maxFiles={10} />
                  <textarea
                    ref={textareaRef}
                    className="cp-body-textarea cp-body-textarea--reddit cp-body-textarea--caption"
                    placeholder="Add a caption (optional)"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    disabled={submitting}
                    rows={3}
                  />
                </div>
              )}

              {activeTab === 'link' && (
                <div className="cp-tab-panel">
                  <div className="cp-link-row">
                    <div className="cp-link-input-wrap cp-link-input-wrap--url">
                      <Globe size={14} className="cp-link-icon" />
                      <input
                        type="url"
                        className="cp-link-input"
                        placeholder="https://example.com"
                        value={externalLink}
                        onChange={(e) => setExternalLink(e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                    <div className="cp-link-input-wrap cp-link-input-wrap--name">
                      <input
                        type="text"
                        className="cp-link-input cp-link-input--plain"
                        placeholder="Link label (optional)"
                        value={linkName}
                        onChange={(e) => setLinkName(e.target.value)}
                        disabled={submitting}
                        maxLength={60}
                      />
                    </div>
                  </div>
                  <textarea
                    ref={textareaRef}
                    className="cp-body-textarea cp-body-textarea--reddit"
                    placeholder="Add context about this link (optional)"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    disabled={submitting}
                    rows={4}
                  />
                </div>
              )}

              {aiPreviewOpen && (
                <div className="cp-ai-split">
                  <div className="cp-ai-split-header">
                    <span className="cp-ai-split-label">AI Enhancement Preview</span>
                    <div className="cp-ai-split-actions">
                      <button type="button" className="cp-ai-btn cp-ai-btn--decline" onClick={() => setAiPreviewOpen(false)}>
                        Decline
                      </button>
                      <button
                        type="button"
                        className="cp-ai-btn cp-ai-btn--accept"
                        onClick={() => {
                          if (enhancedBody) setBody(enhancedBody);
                          setAiPreviewOpen(false);
                        }}
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                  <div className="split-view">
                    <div className="split-pane">
                      <span className="split-label">Original</span>
                      {originalBody}
                    </div>
                    <div className="split-pane">
                      <span className="split-label" style={{ color: '#818cf8' }}>
                        Enhanced
                      </span>
                      {enhancedBody}
                    </div>
                  </div>
                </div>
              )}

              <div className="cp-tags-footer">
                <div className="cp-tags-row">
                  <button
                    type="button"
                    className={`cp-tag-pill ${tagFlags.oc ? 'cp-tag-pill--active' : ''}`}
                    onClick={() => toggleTagFlag('oc')}
                  >
                    <Plus size={12} />
                    OC
                  </button>
                  <button
                    type="button"
                    className={`cp-tag-pill ${tagFlags.spoiler ? 'cp-tag-pill--active' : ''}`}
                    onClick={() => toggleTagFlag('spoiler')}
                  >
                    <Plus size={12} />
                    Spoiler
                  </button>
                  <button
                    type="button"
                    className={`cp-tag-pill ${tagFlags.nsfw ? 'cp-tag-pill--active' : ''}`}
                    onClick={() => toggleTagFlag('nsfw')}
                  >
                    <Plus size={12} />
                    NSFW
                  </button>
                  <span className={`sticker-tag ${type} cp-tags-category-badge`}>{activeFlair.label}</span>
                </div>

                <div className="cp-custom-tags">
                  <div className="cp-custom-tags-input-row">
                    <input
                      type="text"
                      className="cp-custom-tag-input"
                      placeholder="Add tag (e.g. startup)"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomTag();
                        }
                      }}
                      maxLength={24}
                    />
                    <button type="button" className="cp-custom-tag-add" onClick={addCustomTag} disabled={!tagInput.trim()}>
                      Add
                    </button>
                  </div>
                  {customTags.length > 0 && (
                    <div className="cp-custom-tags-list">
                      {customTags.map((tag) => (
                        <span key={tag} className="cp-custom-tag-chip">
                          #{tag}
                          <button type="button" onClick={() => removeCustomTag(tag)} aria-label={`Remove ${tag}`}>
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="cp-toolbar">
                <div className="cp-toolbar-left">
                  {activeTab !== 'media' && (
                    <button
                      type="button"
                      className="cp-tool-btn"
                      onClick={() => {
                        setActiveTab('media');
                        setTimeout(() => uploaderRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                      }}
                    >
                      <ImageIcon size={15} />
                      <span>Media</span>
                    </button>
                  )}

                  <div
                    className="cp-ai-tooltip-wrap"
                    onMouseEnter={() => setShowAiTooltip(true)}
                    onMouseLeave={() => setShowAiTooltip(false)}
                  >
                    <button
                      type="button"
                      className={`cp-tool-btn cp-tool-btn--ai ${isEnhanceEnabled ? 'cp-tool-btn--ai-active' : ''}`}
                      onClick={handleAIEnhance}
                      disabled={!isEnhanceEnabled || aiEnhancing || submitting}
                    >
                      {aiEnhancing ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                      <span>AI Enhance</span>
                    </button>
                    {showAiTooltip && !isEnhanceEnabled && (
                      <div className="cp-tooltip">
                        {15 - charCount} more character{15 - charCount !== 1 ? 's' : ''} to unlock
                      </div>
                    )}
                  </div>
                </div>

                <span className="cp-char-count cp-char-count--body">{body.length.toLocaleString()} / 10,000</span>
              </div>
            </form>
          </div>

          <div className="sticky-preview">
            <p className="cp-preview-label">Live Preview</p>
            <div className="cp-preview-card cp-preview-card--reddit">
              <div className="cp-preview-header">
                <div className="cp-preview-user">
                  <img
                    src={
                      session?.user?.user_metadata?.avatar_url ||
                      'https://api.dicebear.com/7.x/bottts/svg?seed=preview'
                    }
                    alt="You"
                    className="cp-preview-avatar"
                  />
                  <div>
                    <p className="cp-preview-name">{session?.user?.user_metadata?.full_name || 'You'}</p>
                    {session?.user?.user_metadata?.username && (
                      <p className="cp-preview-username">@{session.user.user_metadata.username}</p>
                    )}
                    <p className="cp-preview-time">Just now · {type === 'problem' ? 'Problems' : 'Ideas'}</p>
                  </div>
                </div>
                <span className={`sticker-tag ${type}`}>{activeFlair.label}</span>
              </div>

              {previewTags.length > 0 && (
                <div className="cp-preview-tags">
                  {previewTags.map((tag) => (
                    <span key={tag} className="cp-preview-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <h4 className="cp-preview-title">{title || 'Your title will appear here'}</h4>

              {externalLink && (
                <div className="cp-preview-link">
                  <Globe size={11} />
                  <span>{linkName || externalLink}</span>
                </div>
              )}

              <p className="cp-preview-body">
                {body.slice(0, 280) || 'Your description will appear here…'}
                {body.length > 280 && '…'}
              </p>

              {imageUrls.length > 0 && (
                <div className="cp-preview-image-wrap">
                  <ImageGallery imageUrlsString={JSON.stringify(imageUrls)} />
                </div>
              )}

              <div className="cp-preview-vote-row">
                <div
                  className="vote-container"
                  style={{
                    borderColor: previewVote === 'up' ? 'var(--accent-blue)' : undefined,
                    background: previewVote === 'up' ? 'rgba(0, 132, 255, 0.08)' : undefined,
                  }}
                >
                  <button
                    type="button"
                    className="vote-btn"
                    aria-label="Upvote preview"
                    onClick={() => handlePreviewVote('up')}
                    style={{ color: previewVote === 'up' ? 'var(--accent-blue)' : undefined }}
                  >
                    <TriangleIcon size={16} />
                  </button>
                  <span
                    className="vote-label up"
                    style={{ color: previewVote === 'up' ? 'var(--accent-blue)' : undefined }}
                  >
                    +{previewUpvotes}
                  </span>
                </div>
                <div
                  className="vote-container"
                  style={{
                    borderColor: previewVote === 'down' ? '#ef4444' : undefined,
                    background: previewVote === 'down' ? 'rgba(239, 68, 68, 0.08)' : undefined,
                  }}
                >
                  <button
                    type="button"
                    className="vote-btn"
                    aria-label="Downvote preview"
                    onClick={() => handlePreviewVote('down')}
                    style={{ color: previewVote === 'down' ? '#ef4444' : undefined }}
                  >
                    <TriangleIcon size={16} style={{ transform: 'rotate(180deg)' }} />
                  </button>
                  <span className="vote-label down">-{previewDownvotes}</span>
                </div>
                <div className="cp-preview-comment-count">
                  <MessageCircle size={17} />
                  <span>0</span>
                </div>
              </div>

              <div className="cp-preview-comments">
                <p className="cp-preview-comments-label">Comment thread preview</p>
                {PREVIEW_COMMENTS.map((comment) => (
                  <div key={comment.id} className="cp-preview-comment">
                    <div className="cp-preview-comment-line">
                      <span className="cp-preview-comment-author">{comment.author}</span>
                      <span className="cp-preview-comment-text">{comment.body}</span>
                    </div>
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="cp-preview-comment cp-preview-comment--reply">
                        <div className="cp-preview-comment-line">
                          <span className="cp-preview-comment-author">{reply.author}</span>
                          <span className="cp-preview-comment-text">{reply.body}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mobile-only cp-mobile-preview">
        <div className="cp-mobile-preview-inner">
          <span className={`sticker-tag ${type}`}>{activeFlair.label}</span>
          <p className="cp-mobile-preview-title">{title || 'Untitled post'}</p>
          <div className="cp-mobile-preview-votes">
            <div
              className="vote-container"
              style={{
                borderColor: previewVote === 'up' ? 'var(--accent-blue)' : undefined,
                background: previewVote === 'up' ? 'rgba(0, 132, 255, 0.08)' : undefined,
              }}
            >
              <button type="button" className="vote-btn" onClick={() => handlePreviewVote('up')} aria-label="Preview upvote">
                <TriangleIcon size={14} />
              </button>
              <span className="vote-label up">+{previewUpvotes}</span>
            </div>
            <div
              className="vote-container"
              style={{
                borderColor: previewVote === 'down' ? '#ef4444' : undefined,
                background: previewVote === 'down' ? 'rgba(239, 68, 68, 0.08)' : undefined,
              }}
            >
              <button type="button" className="vote-btn" onClick={() => handlePreviewVote('down')} aria-label="Preview downvote">
                <TriangleIcon size={14} style={{ transform: 'rotate(180deg)' }} />
              </button>
              <span className="vote-label down">-{previewDownvotes}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mobile-only cp-mobile-footer">
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={!isFormValid || submitting}
          className={`cp-publish-btn cp-publish-btn--full ${!isFormValid ? 'cp-publish-btn--disabled' : ''}`}
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="spin" /> Publishing…
            </>
          ) : success ? (
            <>
              <CheckCircle size={16} /> Published!
            </>
          ) : (
            'Post'
          )}
        </button>
      </div>

      <DraftLeaveModal
        isOpen={isDraftLeaveOpen}
        onClose={() => setIsDraftLeaveOpen(false)}
        onSaveDraft={() => {
          localStorage.setItem(
            'paoblem-post-draft',
            JSON.stringify({
              title,
              type,
              body,
              externalLink,
              linkName,
              imageUrls,
              activeTab,
              tagFlags,
              customTags,
              timestamp: new Date().toISOString(),
            })
          );
          setIsDraftLeaveOpen(false);
          router.push('/');
        }}
        onDiscard={() => {
          localStorage.removeItem('paoblem-post-draft');
          setIsDraftLeaveOpen(false);
          router.push('/');
        }}
      />
    </div>
  );
}
