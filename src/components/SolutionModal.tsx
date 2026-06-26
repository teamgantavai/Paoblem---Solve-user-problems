'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Rocket, Code2, Globe, Link2, AlertCircle, Check, Loader2, Sparkles } from 'lucide-react';
import ImageUploader from './ImageUploader';
import { decodeHTMLEntities } from '@/lib/htmlDecoder';

interface SolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  problemId: string;
  problemTitle: string;
  session: any;
  onSubmitted: (solution: any) => void;
  editingSolution?: {
    id: string;
    title: string;
    body: string;
    image_url: string | null;
    external_link: string | null;
    link_name: string | null;
  } | null;
}

export default function SolutionModal({
  isOpen,
  onClose,
  problemId,
  problemTitle,
  session,
  onSubmitted,
  editingSolution = null,
}: SolutionModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [status, setStatus] = useState<'building' | 'launched'>('launched');
  const [activeTab, setActiveTab] = useState<'details' | 'media' | 'links'>('details');
  const panelRef = useRef<HTMLDivElement>(null);

  // AI Enhancer state
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [aiPreviewOpen, setAiPreviewOpen] = useState(false);
  const [originalBody, setOriginalBody] = useState<string | null>(null);
  const [enhancedBody, setEnhancedBody] = useState<string | null>(null);

  const TITLE_MAX = 120;
  const BODY_MAX = 5000;

  useEffect(() => {
    if (editingSolution) {
      setTitle(decodeHTMLEntities(editingSolution.title));
      setBody(decodeHTMLEntities(editingSolution.body));
      setWebsiteUrl(editingSolution.external_link || '');
      try {
        const parsed = editingSolution.image_url ? JSON.parse(editingSolution.image_url) : [];
        setImageUrls(Array.isArray(parsed) ? parsed : []);
      } catch {
        setImageUrls(editingSolution.image_url ? [editingSolution.image_url] : []);
      }
    } else {
      setTitle('');
      setBody('');
      setImageUrls([]);
      setVideoUrl('');
      setWebsiteUrl('');
      setGithubUrl('');
      setStatus('launched');
    }
    setError(null);
    setSuccess(false);
    setActiveTab('details');
  }, [isOpen, editingSolution]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleAIEnhance = async () => {
    if (body.trim().length < 15) return;
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

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim()) { setError('Solution title is required.'); return; }
    if (body.trim().length < 10) { setError('Please write a more detailed description (at least 10 characters).'); return; }

    setIsSubmitting(true);
    try {
      const formatUrl = (url: string) => {
        if (!url.trim()) return null;
        return /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
      };

      const primaryLink = formatUrl(websiteUrl) || formatUrl(githubUrl);
      const primaryLinkName = primaryLink
        ? (formatUrl(websiteUrl) ? 'Website' : 'GitHub Repository')
        : null;

      const payload: Record<string, any> = {
        title: title.trim(),
        body: body.trim(),
        image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
        external_link: primaryLink,
        link_name: primaryLinkName,
        status: status,
      };

      if (editingSolution) {
        payload.id = editingSolution.id;
      } else {
        payload.problem_id = problemId;
      }

      const res = await fetch('/api/solutions', {
        method: editingSolution ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit solution');

      setSuccess(true);
      setTimeout(() => {
        onSubmitted(data.solution);
      }, 800);
    } catch (err: any) {
      setError(err.message || 'Failed to submit solution');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="sol-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sol-modal-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Submit Solution">

        {/* Header */}
        <div className="sol-modal-header">
          <div>
            <h2 className="sol-modal-title">
              {editingSolution ? 'Edit Solution' : '🚀 Submit Solution'}
            </h2>
            <p className="sol-modal-subtitle">Share your approach to solving this problem</p>
          </div>
          <button className="sol-modal-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Problem reference banner */}
        <div className="sol-modal-problem-banner">
          <span className="sol-modal-problem-eyebrow">Solving</span>
          <span className="sol-modal-problem-title">{decodeHTMLEntities(problemTitle)}</span>
        </div>

        {/* Tabs */}
        <div className="sol-modal-tabs">
          {(['details', 'media', 'links'] as const).map((tab) => (
            <button
              key={tab}
              className={`sol-modal-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'details' && 'Details'}
              {tab === 'media' && 'Media'}
              {tab === 'links' && 'Links'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="sol-modal-body">

          {activeTab === 'details' && (
            <div className="sol-modal-section">
              {/* Status Selector */}
              {!editingSolution && (
                <div className="sol-modal-field" style={{ marginBottom: '1.25rem' }}>
                  <label className="sol-modal-label">
                    Your Status
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', marginTop: '0.4rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="solution-status"
                        checked={status === 'building'}
                        onChange={() => setStatus('building')}
                        style={{ accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
                      />
                      <span>🛠️ I'm actively working on solving this (building)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="solution-status"
                        checked={status === 'launched'}
                        onChange={() => setStatus('launched')}
                        style={{ accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
                      />
                      <span>🚀 I built this for you (launched)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Title field */}
              <div className="sol-modal-field">
                <label className="sol-modal-label">
                  Solution Title <span className="sol-modal-required">*</span>
                </label>
                <div className="sol-modal-input-wrap">
                  <input
                    className="sol-modal-input"
                    type="text"
                    placeholder="A clear, descriptive title for your solution…"
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
                    maxLength={TITLE_MAX}
                    autoFocus
                  />
                  <span className={`sol-modal-char-count ${title.length > TITLE_MAX * 0.9 ? 'warn' : ''}`}>
                    {title.length}/{TITLE_MAX}
                  </span>
                </div>
              </div>

              {/* Description field */}
              <div className="sol-modal-field">
                <label className="sol-modal-label">
                  Solution Description <span className="sol-modal-required">*</span>
                </label>
                <div className="sol-modal-textarea-wrap">
                  <textarea
                    className="sol-modal-textarea"
                    placeholder="Describe your solution in detail. How does it work? What problem does it address? What makes it effective?&#10;&#10;You can include steps, code snippets, or explanations…"
                    value={body}
                    onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
                    maxLength={BODY_MAX}
                    rows={7}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={handleAIEnhance}
                      disabled={body.trim().length < 15 || aiEnhancing}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.78rem',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: body.trim().length >= 15 ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-hover)',
                        color: body.trim().length >= 15 ? '#6366f1' : 'var(--text-muted)',
                        cursor: body.trim().length >= 15 ? 'pointer' : 'default',
                        fontWeight: 600,
                        transition: 'all 0.2s',
                      }}
                    >
                      {aiEnhancing ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
                      AI Enhance
                    </button>
                    <span className={`sol-modal-char-count ${body.length > BODY_MAX * 0.9 ? 'warn' : ''}`}>
                      {body.length}/{BODY_MAX}
                    </span>
                  </div>
                </div>
              </div>
              {aiPreviewOpen && (
                <div className="cp-ai-split" style={{ margin: '0.75rem 0 1.25rem' }}>
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
            </div>
          )}

          {activeTab === 'media' && (
            <div className="sol-modal-section">
              <div className="sol-modal-field">
                <label className="sol-modal-label">Images</label>
                <p className="sol-modal-field-hint">Upload screenshots, diagrams, or mockups of your solution</p>
                <ImageUploader
                  imageUrls={imageUrls}
                  onChange={setImageUrls}
                  maxFiles={6}
                />
              </div>

              <div className="sol-modal-field">
                <label className="sol-modal-label">Video URL <span className="sol-modal-optional">(optional)</span></label>
                <div className="sol-modal-input-wrap">
                  <input
                    className="sol-modal-input"
                    type="url"
                    placeholder="https://youtube.com/watch?v=..."
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'links' && (
            <div className="sol-modal-section">
              <div className="sol-modal-field">
                <label className="sol-modal-label">
                  <Globe size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  Website URL <span className="sol-modal-optional">(optional)</span>
                </label>
                <div className="sol-modal-input-wrap">
                  <input
                    className="sol-modal-input"
                    type="url"
                    placeholder="https://your-solution.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="sol-modal-field">
                <label className="sol-modal-label">
                  <Code2 size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  GitHub Repository <span className="sol-modal-optional">(optional)</span>
                </label>
                <div className="sol-modal-input-wrap">
                  <input
                    className="sol-modal-input"
                    type="url"
                    placeholder="https://github.com/username/repo"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="sol-modal-error">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Progress indicator dots */}

        </div>

        {/* Footer actions */}
        <div className="sol-modal-footer">
          <button className="sol-modal-cancel-btn" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>

          <button
            className={`sol-modal-submit-btn ${success ? 'success' : ''}`}
            onClick={handleSubmit}
            disabled={isSubmitting || success || !title.trim() || body.trim().length < 10}
          >
            {success ? (
              <><Check size={15} /> Published!</>
            ) : isSubmitting ? (
              <><Loader2 size={15} className="spin" /> Publishing…</>
            ) : (
              <><Rocket size={15} /> {editingSolution ? 'Update Solution' : 'Publish Solution'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
