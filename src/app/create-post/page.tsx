'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Globe,
  Handshake,
  Image as ImageIcon,
  Lightbulb,
  Link2,
  ListChecks,
  Loader2,
  Plus,
  Save,
  ShieldAlert,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import DraftLeaveModal from '@/components/DraftLeaveModal';
import ImageUploader from '@/components/ImageUploader';

type PostType = 'problem' | 'idea';
type ComposePanel = 'media' | 'link' | 'poll' | null;

const FLAIR_OPTIONS = [
  { value: 'problem', label: 'Problem', icon: AlertTriangle },
  { value: 'idea', label: 'Idea', icon: Lightbulb },
] as const;

const CATEGORY_CHIPS = [
  'AI',
  'SaaS',
  'Education',
  'Healthcare',
  'Fintech',
  'Developer Tools',
  'Consumer',
  'Marketplace',
  'Design',
  'Productivity',
];

const SEVERITY_OPTIONS = ['Minor', 'Moderate', 'Critical'] as const;

const VALIDATION_GOALS = [
  { value: 'Looking for validation', icon: BarChart3 },
  { value: 'Need solution', icon: Zap },
  { value: 'Need users', icon: Users },
  { value: 'Need co-founder', icon: Handshake },
] as const;

export default function CreatePost() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<PostType>('problem');
  const [body, setBody] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [externalLink, setExternalLink] = useState('');
  const [linkName, setLinkName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('AI');
  const [severity, setSeverity] = useState<(typeof SEVERITY_OPTIONS)[number]>('Moderate');
  const [validationGoal, setValidationGoal] = useState<(typeof VALIDATION_GOALS)[number]['value']>('Looking for validation');
  const [openPanel, setOpenPanel] = useState<ComposePanel>(null);
  const [pollOptions, setPollOptions] = useState(['Yes', 'No']);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [showAiTooltip, setShowAiTooltip] = useState(false);
  const [isDraftLeaveOpen, setIsDraftLeaveOpen] = useState(false);
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [aiPreviewOpen, setAiPreviewOpen] = useState(false);
  const [originalBody, setOriginalBody] = useState<string | null>(null);
  const [enhancedBody, setEnhancedBody] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

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
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [body]);

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
      if (parsed.imageUrls) setImageUrls(parsed.imageUrls);
      else if (parsed.imageUrl) setImageUrls([parsed.imageUrl]);
      if (parsed.selectedCategory) setSelectedCategory(parsed.selectedCategory);
      if (parsed.severity) setSeverity(parsed.severity);
      if (parsed.validationGoal) setValidationGoal(parsed.validationGoal);
      if (parsed.pollOptions) setPollOptions(parsed.pollOptions);
      if (parsed.customTags) setCustomTags(parsed.customTags);
      if (parsed.openPanel) setOpenPanel(parsed.openPanel);
      if (parsed.timestamp) {
        setLastSaved(new Date(parsed.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (err) {
      console.error('Failed to parse saved draft', err);
    }
  }, []);

  useEffect(() => {
    if (!title && !body && !externalLink && imageUrls.length === 0) return;
    const timer = setTimeout(() => {
      localStorage.setItem('paoblem-post-draft', JSON.stringify(getDraftPayload()));
      setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearTimeout(timer);
  }, [title, type, body, externalLink, linkName, imageUrls, selectedCategory, severity, validationGoal, pollOptions, customTags, openPanel]);

  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
  const isEnhanceEnabled = wordCount >= 15;
  const isFormValid = Boolean(session && body.trim().length >= 10);

  function getDraftPayload() {
    return {
      title,
      type,
      body,
      externalLink,
      linkName,
      imageUrls,
      selectedCategory,
      severity,
      validationGoal,
      pollOptions,
      customTags,
      openPanel,
      timestamp: new Date().toISOString(),
    };
  }

  function normalizeTag(value: string) {
    return value.trim().replace(/^#/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function addCustomTag() {
    const cleaned = normalizeTag(tagInput);
    if (!cleaned || customTags.includes(cleaned) || customTags.length >= 5) return;
    setCustomTags((current) => [...current, cleaned]);
    setTagInput('');
  }

  function removeCustomTag(tag: string) {
    setCustomTags((current) => current.filter((item) => item !== tag));
  }

  function buildBodyWithMetadata(rawBody: string) {
    const metadataTags = [
      selectedCategory,
      severity,
      validationGoal,
      ...customTags,
    ].map((tag) => `#${normalizeTag(tag)}`).join(' ');

    const pollText = openPanel === 'poll' && pollOptions.some((option) => option.trim())
      ? `\n\nPoll: ${pollOptions.filter((option) => option.trim()).join(' / ')}`
      : '';

    return `${rawBody.trim()}${pollText}\n\n${metadataTags}`;
  }

  async function handleAIEnhance() {
    if (!isEnhanceEnabled) return;
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
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!session) {
      setError('You must be logged in to post.');
      return;
    }
    if (body.trim().length < 10) {
      setError('Describe the problem in at least 10 characters.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const trimmedLink = externalLink.trim();
    const formattedLink = trimmedLink ? (/^https?:\/\//i.test(trimmedLink) ? trimmedLink : `https://${trimmedLink}`) : null;
    const derivedTitle = title.trim() || body.trim().split(/\s+/).slice(0, 9).join(' ');

    try {
      const res = await fetch('/api/posts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: derivedTitle,
          body: buildBodyWithMetadata(body),
          type,
          image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
          external_link: formattedLink,
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
      }, 900);
    } catch (err: any) {
      setError(err.message || 'Failed to create post.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleBackClick() {
    const hasUnsavedChanges = title.trim() || body.trim() || imageUrls.length > 0 || externalLink;
    if (hasUnsavedChanges) setIsDraftLeaveOpen(true);
    else router.push('/');
  }

  return (
    <div className="app-container cp-modal-page">
      <Navbar />

      <div className="cp-modal-backdrop" aria-hidden="true">
        <div className="cp-modal-feed-shell">
          <div className="cp-modal-feed-compose">
            <span className="cp-modal-feed-avatar" />
            <span>What's new?</span>
            <button type="button">Post</button>
          </div>
          <div className="cp-modal-feed-line" />
          <div className="cp-modal-feed-post" />
          <div className="cp-modal-feed-post cp-modal-feed-post--short" />
        </div>
      </div>

      <main className="cp-modal-stage" role="presentation">
        <section className="cp-thread-modal" role="dialog" aria-modal="true" aria-labelledby="create-post-title">
          <form onSubmit={handleSubmit}>
            <header className="cp-thread-header">
              <button type="button" className="cp-thread-cancel" onClick={handleBackClick}>
                Cancel
              </button>
              <div className="cp-thread-title-wrap">
                <h1 id="create-post-title">New thread</h1>
                {lastSaved && (
                  <span>
                    <Save size={10} />
                    Saved {lastSaved}
                  </span>
                )}
              </div>
              <div className="cp-thread-header-actions">
                <button type="button" aria-label="Drafts">
                  <Save size={24} />
                </button>
                <button type="button" aria-label="More options">
                  <ListChecks size={24} />
                </button>
              </div>
            </header>

            {(error || success) && (
              <div className={`cp-thread-alert ${success ? 'cp-thread-alert--success' : ''}`}>
                {success ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
                {success ? 'Post published. Redirecting...' : error}
              </div>
            )}

            <div className="cp-thread-body">
              <div className="cp-thread-avatar-column">
                <img
                  src={session?.user?.user_metadata?.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=preview'}
                  alt="You"
                  className="cp-thread-avatar"
                />
                <span className="cp-thread-line" />
                <span className="cp-thread-small-avatar" />
              </div>

              <div className="cp-thread-main">
                <div className="cp-thread-identity">
                  <strong>{session?.user?.user_metadata?.full_name || 'You'}</strong>
                  <span>Community or topic</span>
                </div>

                <input
                  ref={titleInputRef}
                  className="cp-thread-title-input"
                  placeholder="Optional title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={submitting}
                  maxLength={300}
                />

                <textarea
                  ref={textareaRef}
                  className="cp-thread-textarea"
                  placeholder="What's the problem you're facing?"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  disabled={submitting}
                  maxLength={10000}
                />

                <div className="cp-thread-actions" aria-label="Inline actions">
                  {[
                    { key: 'media' as const, label: 'Media', icon: ImageIcon },
                    { key: 'link' as const, label: 'Link', icon: Link2 },
                    { key: 'poll' as const, label: 'Poll', icon: ListChecks },
                  ].map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      className={openPanel === action.key ? 'active' : ''}
                      onClick={() => setOpenPanel(openPanel === action.key ? null : action.key)}
                      aria-label={action.label}
                      title={action.label}
                    >
                      <action.icon size={20} />
                      <span>{action.label}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className={isEnhanceEnabled ? 'active' : ''}
                    onClick={handleAIEnhance}
                    disabled={!isEnhanceEnabled || aiEnhancing || submitting}
                    onMouseEnter={() => setShowAiTooltip(true)}
                    onMouseLeave={() => setShowAiTooltip(false)}
                    aria-label="AI Enhance"
                    title="AI Enhance"
                  >
                    {aiEnhancing ? <Loader2 size={20} className="spin" /> : <Sparkles size={20} />}
                    <span>AI Enhance</span>
                  </button>
                  {showAiTooltip && !isEnhanceEnabled && (
                    <div className="cp-tooltip cp-thread-tooltip">Write 15+ words to unlock AI improve</div>
                  )}
                </div>

                {isEnhanceEnabled && (
                  <button
                    type="button"
                    className="cp-thread-floating-ai"
                    onClick={handleAIEnhance}
                    disabled={aiEnhancing || submitting}
                  >
                    {aiEnhancing ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                    Improve
                  </button>
                )}
              </div>
            </div>

            {openPanel === 'media' && (
              <div className="cp-thread-panel">
                <ImageUploader imageUrls={imageUrls} onChange={setImageUrls} maxFiles={10} />
              </div>
            )}

            {openPanel === 'link' && (
              <div className="cp-thread-panel cp-thread-link-panel">
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
            )}

            {openPanel === 'poll' && (
              <div className="cp-thread-panel cp-thread-poll">
                {pollOptions.map((option, index) => (
                  <input
                    key={index}
                    className="cp-modern-poll-input"
                    value={option}
                    onChange={(e) => setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? e.target.value : item))}
                    placeholder={`Option ${index + 1}`}
                  />
                ))}
                {pollOptions.length < 4 && (
                  <button type="button" className="cp-modern-add-option" onClick={() => setPollOptions((current) => [...current, ''])}>
                    <Plus size={14} />
                    Add another option
                  </button>
                )}
              </div>
            )}

            <section className="cp-thread-options">
              <button type="button" className="cp-thread-options-title">
                <ListChecks size={19} />
                <span>Post Options</span>
              </button>

              <div className="cp-thread-type-row" role="group" aria-label="Problem or idea">
                {FLAIR_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${type === option.value ? 'active' : ''} cp-thread-type-${option.value}`}
                    onClick={() => setType(option.value)}
                  >
                    <option.icon size={15} />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>

              <div className="cp-thread-chip-scroll">
                {CATEGORY_CHIPS.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={selectedCategory === category ? 'active' : ''}
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="cp-thread-meta">
                <div>
                  <span>Severity</span>
                  <div className="cp-thread-mini-row">
                    {SEVERITY_OPTIONS.map((option) => (
                      <button key={option} type="button" className={severity === option ? 'active' : ''} onClick={() => setSeverity(option)}>
                        {option === 'Critical' && <ShieldAlert size={13} />}
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span>Validation goal</span>
                  <div className="cp-thread-goals">
                    {VALIDATION_GOALS.map((goal) => (
                      <button key={goal.value} type="button" className={validationGoal === goal.value ? 'active' : ''} onClick={() => setValidationGoal(goal.value)}>
                        <goal.icon size={14} />
                        {goal.value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="cp-thread-tags">
                <input
                  type="text"
                  placeholder="Add tag"
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
                <button type="button" onClick={addCustomTag} disabled={!tagInput.trim()}>
                  Add
                </button>
              </div>
              {customTags.length > 0 && (
                <div className="cp-custom-tags-list cp-thread-custom-tags">
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
            </section>

            {aiPreviewOpen && (
              <div className="cp-ai-split cp-thread-ai-split">
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
                    <span className="split-label">Enhanced</span>
                    {enhancedBody}
                  </div>
                </div>
              </div>
            )}

            <footer className="cp-thread-footer">
              <div>
                <span>{wordCount} words</span>
                <span>{body.length.toLocaleString()} / 10,000</span>
              </div>
              <button
                type="submit"
                disabled={!isFormValid || submitting}
                className={`cp-thread-post-btn ${!isFormValid ? 'disabled' : ''}`}
              >
                {submitting ? 'Posting' : success ? 'Posted' : 'Post'}
              </button>
            </footer>
          </form>
        </section>
      </main>

      <DraftLeaveModal
        isOpen={isDraftLeaveOpen}
        onClose={() => setIsDraftLeaveOpen(false)}
        onSaveDraft={() => {
          localStorage.setItem('paoblem-post-draft', JSON.stringify(getDraftPayload()));
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
