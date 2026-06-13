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
  Globe
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { useQueryClient } from '@tanstack/react-query';
import DraftLeaveModal from '@/components/DraftLeaveModal';
import ImageUploader from '@/components/ImageUploader';
import ImageGallery from '@/components/ImageGallery';

export default function CreatePost() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'problem' | 'idea'>('problem');
  const [body, setBody] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [externalLink, setExternalLink] = useState('');
  const [linkName, setLinkName] = useState('');

  // Status State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);

  // Custom Controls State
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showAiTooltip, setShowAiTooltip] = useState(false);
  const [isDraftLeaveOpen, setIsDraftLeaveOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const uploaderRef = useRef<HTMLDivElement>(null);

  // AI Enhancer State
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [aiPreviewOpen, setAiPreviewOpen] = useState(false);
  const [originalBody, setOriginalBody] = useState<string | null>(null);
  const [enhancedBody, setEnhancedBody] = useState<string | null>(null);

  // Load Auth Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (!currentSession) {
        setError('You must be logged in to create a post.');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession) {
        setError(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Autofocus title on mount
  useEffect(() => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.focus();
    }
  }, []);

  // Auto-expand title textarea height
  useEffect(() => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = 'auto';
      titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`;
    }
  }, [title]);

  // Auto-expand textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [body]);

  // Restore Draft on Mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('paoblem-post-draft');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.type) setType(parsed.type);
        if (parsed.body) setBody(parsed.body);
        if (parsed.externalLink) {
          setExternalLink(parsed.externalLink);
          setShowLinkInput(true);
        }
        if (parsed.linkName) setLinkName(parsed.linkName);
        
        // Handle restoring multiple images or single legacy image
        if (parsed.imageUrls) {
          setImageUrls(parsed.imageUrls);
        } else if (parsed.imageUrl) {
          setImageUrls([parsed.imageUrl]);
        }
        
        if (parsed.timestamp) {
          const date = new Date(parsed.timestamp);
          setLastSaved(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      } catch (e) {
        console.error('Failed to parse saved draft', e);
      }
    }
  }, []);

  // Auto-Save Draft to Local Storage
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
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('paoblem-post-draft', JSON.stringify(draft));
      setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000); // 1-second debounce

    return () => clearTimeout(delayDebounceFn);
  }, [title, type, body, externalLink, linkName, imageUrls]);

  // Character Counter for AI unlock
  const charCount = body.trim().length;
  const isEnhanceEnabled = charCount >= 15;

  // Focus on image uploader
  const handleScrollToUploader = () => {
    uploaderRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // AI Enhancer Logic
  const handleAIEnhance = async () => {
    if (charCount < 15) return;

    setAiEnhancing(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: body }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to enhance text.');
      }

      setOriginalBody(body);
      setEnhancedBody(data.enhanced);
      setAiPreviewOpen(true);
    } catch (err: any) {
      setError(err.message || 'AI Enhancer failed.');
    } finally {
      setAiEnhancing(false);
    }
  };

  const acceptAIEnhance = () => {
    if (enhancedBody) {
      setBody(enhancedBody);
    }
    setAiPreviewOpen(false);
    setOriginalBody(null);
    setEnhancedBody(null);
  };

  const declineAIEnhance = () => {
    setAiPreviewOpen(false);
    setOriginalBody(null);
    setEnhancedBody(null);
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session) {
      setError('You must be logged in to post.');
      return;
    }

    if (!title.trim() || title.length < 3) {
      setError('Title must be at least 3 characters long.');
      return;
    }

    if (!body.trim() || body.length < 10) {
      setError('Body must be at least 10 characters long.');
      return;
    }

    setSubmitting(true);
    setError(null);

    let formattedLink = null;
    if (externalLink) {
      const trimmed = externalLink.trim();
      formattedLink = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    }

    try {
      const res = await fetch('/api/posts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title,
          body,
          type,
          image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
          external_link: formattedLink || null,
          link_name: linkName || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong.');
      }

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
    if (hasUnsavedChanges) {
      setIsDraftLeaveOpen(true);
    } else {
      router.push('/');
    }
  };

  const handleSaveDraftAndExit = () => {
    const draft = {
      title,
      type,
      body,
      externalLink,
      linkName,
      imageUrls,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('paoblem-post-draft', JSON.stringify(draft));
    setIsDraftLeaveOpen(false);
    router.push('/');
  };

  const handleDiscardAndExit = () => {
    localStorage.removeItem('paoblem-post-draft');
    setIsDraftLeaveOpen(false);
    router.push('/');
  };

  const isFormValid = title.trim().length >= 3 && body.trim().length >= 10 && session;

  return (
    <div className="app-container">
      <Navbar />

      <div className="cp-wrapper">

        {/* HEADER */}
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
            className={`cp-publish-btn desktop-only ${!isFormValid ? 'cp-publish-btn--disabled' : ''}`}
            disabled={!isFormValid || submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <><Loader2 size={14} className="spin" /> Publishing</>
            ) : success ? (
              <><CheckCircle size={14} /> Done</>
            ) : (
              'Publish'
            )}
          </button>
        </div>

        {error && (
          <div className="cp-alert cp-alert--error">
            {error}
          </div>
        )}
        {success && (
          <div className="cp-alert cp-alert--success">
            <CheckCircle size={16} />
            Post published! Redirecting…
          </div>
        )}

        <div className="create-post-grid">
          {/* LEFT COLUMN: COMPOSER */}
          <div className="cp-composer-card">
            <form onSubmit={handleSubmit}>

              {/* TYPE SELECTOR */}
              <div className="cp-field">
                <span className="cp-field-label">Post type</span>
                <div className="cp-type-row">
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

              {/* TITLE */}
              <div className="cp-field">
                <textarea
                  ref={titleTextareaRef}
                  id="post-title"
                  className="cp-title-input"
                  placeholder="What's your problem or idea?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={submitting}
                  maxLength={150}
                  rows={1}
                  required
                />
                <div className="cp-char-count">{title.length}/150</div>
              </div>

              {/* DIVIDER */}
              <div className="cp-divider" />

              {/* BODY */}
              <div className="cp-field">
                <textarea
                  ref={textareaRef}
                  id="post-body"
                  className="cp-body-textarea"
                  placeholder="Describe in detail — the more context you share, the better the responses."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              {/* AI SPLIT VIEW */}
              {aiPreviewOpen && (
                <div className="cp-ai-split">
                  <div className="cp-ai-split-header">
                    <span className="cp-ai-split-label">AI Enhancement Preview</span>
                    <div className="cp-ai-split-actions">
                      <button type="button" className="cp-ai-btn cp-ai-btn--decline" onClick={declineAIEnhance}>
                        Decline
                      </button>
                      <button type="button" className="cp-ai-btn cp-ai-btn--accept" onClick={acceptAIEnhance}>
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
                      <span className="split-label" style={{ color: '#818cf8' }}>Enhanced</span>
                      {enhancedBody}
                    </div>
                  </div>
                </div>
              )}

              {/* LINK INPUT */}
              {showLinkInput && (
                <div className="cp-field cp-link-field">
                  <label className="cp-field-label">External link</label>
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
                      {externalLink && (
                        <button
                          type="button"
                          className="cp-link-clear"
                          onClick={() => { setExternalLink(''); setLinkName(''); setShowLinkInput(false); }}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <div className="cp-link-input-wrap cp-link-input-wrap--name">
                      <input
                        type="text"
                        className="cp-link-input"
                        placeholder="Link label (optional)"
                        value={linkName}
                        onChange={(e) => setLinkName(e.target.value)}
                        disabled={submitting}
                        maxLength={60}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* REUSABLE MULTIPLE IMAGE UPLOADER */}
              <div className="cp-field" ref={uploaderRef}>
                <span className="cp-field-label">Attachments</span>
                <ImageUploader 
                  imageUrls={imageUrls} 
                  onChange={setImageUrls} 
                  maxFiles={10} 
                />
              </div>

              {/* TOOLBAR */}
              <div className="cp-toolbar">
                <div className="cp-toolbar-left">
                  <button
                    type="button"
                    className="cp-tool-btn"
                    onClick={handleScrollToUploader}
                    disabled={submitting}
                    title="Scroll to uploader"
                  >
                    <span>Add Images</span>
                  </button>

                  <button
                    type="button"
                    className={`cp-tool-btn ${showLinkInput ? 'cp-tool-btn--active' : ''}`}
                    onClick={() => setShowLinkInput(!showLinkInput)}
                    title="Add link"
                  >
                    <span>Link</span>
                  </button>

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

                <span className="cp-char-count cp-char-count--body">
                  {body.length.toLocaleString()} / 10,000
                </span>
              </div>

            </form>
          </div>

          {/* RIGHT COLUMN: LIVE PREVIEW */}
          <div className="sticky-preview">
            <p className="cp-preview-label">Preview</p>
            <div className="cp-preview-card">
              <div className="cp-preview-header">
                <div className="cp-preview-user">
                  <img
                    src={session?.user?.user_metadata?.avatar_url || "https://api.dicebear.com/7.x/bottts/svg?seed=preview"}
                    alt="You"
                    className="cp-preview-avatar"
                  />
                  <div>
                    <p className="cp-preview-name">{session?.user?.user_metadata?.full_name || 'You'}</p>
                    <p className="cp-preview-time">Just now</p>
                  </div>
                </div>
                <span className={`sticker-tag ${type}`}>
                  {type === 'problem' ? 'Problem' : 'Idea'}
                </span>
              </div>

              <h4 className="cp-preview-title">
                {title || 'Your title will appear here'}
              </h4>
              <p className="cp-preview-body">
                {body.slice(0, 200) || 'Your description will appear here…'}
                {body.length > 200 && '…'}
              </p>

              {/* Gallery Preview */}
              {imageUrls.length > 0 && (
                <div className="cp-preview-image-wrap" style={{ marginTop: '0.75rem' }}>
                  <ImageGallery imageUrlsString={JSON.stringify(imageUrls)} />
                </div>
              )}

              {externalLink && (
                <div className="cp-preview-link">
                  <Globe size={11} />
                  <span>{linkName || externalLink}</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* MOBILE STICKY FOOTER */}
      <div className="mobile-only cp-mobile-footer">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isFormValid || submitting}
          className={`cp-publish-btn cp-publish-btn--full ${!isFormValid ? 'cp-publish-btn--disabled' : ''}`}
        >
          {submitting ? (
            <><Loader2 size={16} className="spin" /> Publishing…</>
          ) : success ? (
            <><CheckCircle size={16} /> Published!</>
          ) : (
            'Publish Post'
          )}
        </button>
      </div>

      <DraftLeaveModal
        isOpen={isDraftLeaveOpen}
        onClose={() => setIsDraftLeaveOpen(false)}
        onSaveDraft={handleSaveDraftAndExit}
        onDiscard={handleDiscardAndExit}
      />
    </div>
  );
}