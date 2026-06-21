'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlignCenter,
  AlignLeft,
  BarChart3,
  Bold,
  CheckCircle,
  ChevronRight,
  Clock,
  FileText,
  Globe,
  Handshake,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  MoreHorizontal,
  Plus,
  RemoveFormatting,
  Save,
  Sparkles,
  Strikethrough,
  Underline,
  Users,
  X,
  Zap,
  AlertTriangle,
  Lightbulb
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import DraftLeaveModal from '@/components/DraftLeaveModal';
import ImageUploader from '@/components/ImageUploader';

type PostType = 'problem' | 'idea';
type ComposePanel = 'media' | 'link' | 'poll' | null;

const CATEGORY_CHIPS = [
  'AI', 'SaaS', 'Education', 'Healthcare', 'Fintech',
  'Developer Tools', 'Consumer', 'Marketplace', 'Design', 'Productivity',
];

const POLL_DURATIONS = ['1 day', '3 days', '7 days', '14 days'];

const VALIDATION_GOALS = [
  { value: 'Looking for validation', icon: BarChart3 },
  { value: 'Need solution', icon: Zap },
  { value: 'Need users', icon: Users },
  { value: 'Need co-founder', icon: Handshake },
] as const;

/* ─── Rich Text Toolbar ─────────────────────────────────────── */
interface RichToolbarProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  onUpdate?: () => void;
}

function RichToolbar({ editorRef, onUpdate }: RichToolbarProps) {
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});

  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value ?? undefined);
    refreshState();
    onUpdate?.();
  };

  const refreshState = () => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
    });
  };

  const [isLinkPanelOpen, setIsLinkPanelOpen] = useState(false);
  const [linkHref, setLinkHref] = useState('');
  const [linkText, setLinkText] = useState('');
  const [linkError, setLinkError] = useState('');

  const showLinkPopup = () => {
    const selection = document.getSelection()?.toString() ?? '';
    setLinkText(selection);
    setLinkHref('');
    setLinkError('');
    setIsLinkPanelOpen(true);
  };

  const applyLink = () => {
    const trimmed = linkHref.trim();
    if (!trimmed) {
      setLinkError('Please enter a valid URL.');
      return;
    }
    const normalizedUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (linkText.trim()) {
      editorRef.current?.focus();
      document.execCommand('insertHTML', false, `<a href="${normalizedUrl}" target="_blank" rel="noreferrer noopener">${linkText.trim()}</a>`);
      refreshState();
      onUpdate?.();
    } else {
      exec('createLink', normalizedUrl);
    }
    setIsLinkPanelOpen(false);
    setLinkHref('');
    setLinkText('');
    setLinkError('');
  };

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const handler = () => refreshState();
    el.addEventListener('keyup', handler);
    el.addEventListener('mouseup', handler);
    el.addEventListener('selectionchange', handler);
    return () => {
      el.removeEventListener('keyup', handler);
      el.removeEventListener('mouseup', handler);
      el.removeEventListener('selectionchange', handler);
    };
  }, [editorRef]);

  const ToolBtn = ({
    cmd, label, children, onClick,
  }: { cmd?: string; label: string; children: React.ReactNode; onClick?: () => void }) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`cp-rt-btn ${cmd && activeFormats[cmd] ? 'active' : ''}`}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick ? onClick() : cmd && exec(cmd);
      }}
    >
      {children}
    </button>
  );

  return (
    <>
      <div className="cp-rt-toolbar" role="toolbar" aria-label="Text formatting">
        <ToolBtn cmd="bold" label="Bold"><Bold size={13} /></ToolBtn>
        <ToolBtn cmd="italic" label="Italic"><Italic size={13} /></ToolBtn>
        <ToolBtn cmd="underline" label="Underline"><Underline size={13} /></ToolBtn>
        <ToolBtn cmd="strikeThrough" label="Strikethrough"><Strikethrough size={13} /></ToolBtn>
        <span className="cp-rt-sep" aria-hidden="true" />
        <ToolBtn cmd="insertOrderedList" label="Numbered list"><ListOrdered size={13} /></ToolBtn>
        <ToolBtn cmd="insertUnorderedList" label="Bullet list"><List size={13} /></ToolBtn>
        <span className="cp-rt-sep" aria-hidden="true" />
        <ToolBtn cmd="justifyLeft" label="Align left"><AlignLeft size={13} /></ToolBtn>
        <ToolBtn cmd="justifyCenter" label="Align centre"><AlignCenter size={13} /></ToolBtn>
        <span className="cp-rt-sep" aria-hidden="true" />
        <ToolBtn label="Insert link" onClick={showLinkPopup}><Link2 size={13} /></ToolBtn>
        <ToolBtn label="Clear formatting" onClick={() => exec('removeFormat')}><RemoveFormatting size={13} /></ToolBtn>
      </div>
      {isLinkPanelOpen && (
        <div className="cp-rich-link-panel">
          <div className="cp-rich-link-row">
            <input
              type="text"
              className="cp-rich-link-input"
              placeholder="URL — https://example.com"
              value={linkHref}
              onChange={(e) => setLinkHref(e.target.value)}
            />
          </div>
          <div className="cp-rich-link-row">
            <input
              type="text"
              className="cp-rich-link-input"
              placeholder="Link text (optional)"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
            />
          </div>
          {linkError && <div className="cp-rich-link-error">{linkError}</div>}
          <div className="cp-rich-link-actions">
            <button type="button" className="cp-rich-link-cancel" onClick={() => { setIsLinkPanelOpen(false); setLinkHref(''); setLinkText(''); setLinkError(''); }}>
              Cancel
            </button>
            <button type="button" className="cp-rich-link-apply" onClick={applyLink}>
              Insert link
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Poll Modal ────────────────────────────────────────────── */
interface PollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePoll: (question: string, options: string[], duration: string) => void;
  disabled?: boolean;
}

function PollModal({ isOpen, onClose, onCreatePoll, disabled }: PollModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['Yes', 'No', '']);
  const [duration, setDuration] = useState('3 days');
  const [questionErr, setQuestionErr] = useState(false);
  const descEditorRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const addOption = () => {
    if (options.length < 4) setOptions((o) => [...o, '']);
  };

  const setOption = (idx: number, val: string) => {
    setOptions((o) => o.map((x, i) => (i === idx ? val : x)));
  };

  const handleCreate = () => {
    if (!question.trim()) { setQuestionErr(true); return; }
    const filled = options.filter((o) => o.trim());
    if (filled.length < 2) return;
    onCreatePoll(question.trim(), filled, duration);
    setQuestion('');
    setOptions(['Yes', 'No', '']);
    onClose();
  };

  return (
    <div className="cp-poll-overlay" role="dialog" aria-modal="true" aria-label="Create a poll">
      <div className="cp-poll-modal">
        {/* Header */}
        <div className="cp-poll-header">
          <div className="cp-poll-header-left">
            <BarChart3 size={15} className="cp-poll-icon" />
            <span>Create a Poll</span>
          </div>
          <button type="button" className="cp-poll-close" onClick={onClose} disabled={disabled}>
            <X size={14} />
          </button>
        </div>

        <div className="cp-poll-body">
          {/* Question – required */}
          <div className="cp-poll-field">
            <label className="cp-poll-label">
              Question <span className="cp-poll-req">*</span>
            </label>
            <input
              className={`cp-poll-input ${questionErr ? 'cp-poll-input--err' : ''}`}
              placeholder="e.g. Which solution do you prefer?"
              value={question}
              onChange={(e) => { setQuestion(e.target.value); setQuestionErr(false); }}
              disabled={disabled}
            />
            {questionErr && <p className="cp-poll-err-msg">Question is required</p>}
          </div>

          {/* Options */}
          <div className="cp-poll-field">
            <label className="cp-poll-label">Options</label>
            <div className="cp-poll-options">
              {options.map((opt, i) => (
                <div key={i} className="cp-poll-opt-row">
                  <span className="cp-poll-opt-num">{i + 1}</span>
                  <input
                    className="cp-poll-input cp-poll-input--opt"
                    placeholder={`Option ${i + 1}${i >= 2 ? ' (optional)' : ''}`}
                    value={opt}
                    onChange={(e) => setOption(i, e.target.value)}
                    disabled={disabled}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="cp-poll-field">
            <label className="cp-poll-label">
              <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
              Duration
            </label>
            <div className="cp-poll-duration-row">
              {POLL_DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`cp-poll-dur-chip ${duration === d ? 'active' : ''}`}
                  onClick={() => setDuration(d)}
                  disabled={disabled}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="cp-poll-footer">
          {options.length < 4 && (
            <button type="button" className="cp-poll-add-opt" onClick={addOption} disabled={disabled}>
              <Plus size={12} />
              Add option
            </button>
          )}
          <div className="cp-poll-footer-right">
            <button type="button" className="cp-poll-cancel-btn" onClick={onClose} disabled={disabled}>
              Cancel
            </button>
            <button type="button" className="cp-poll-create-btn" onClick={handleCreate} disabled={disabled}>
              Create Poll
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Draft Sidebar ─────────────────────────────────────────── */
interface Draft {
  id: string;
  title: string;
  body: string;
  type: PostType;
  timestamp: string;
}

interface DraftSidebarProps {
  drafts: Draft[];
  onLoad: (draft: Draft) => void;
  onDiscard: (idx: number) => void;
}

function DraftSidebar({ drafts, onLoad, onDiscard }: DraftSidebarProps) {
  if (drafts.length === 0) {
    return (
      <div className="cp-draft-empty">
        <FileText size={22} className="cp-draft-empty-icon" />
        <p>No saved drafts</p>
      </div>
    );
  }
  return (
    <div className="cp-draft-list">
      {drafts.map((d, i) => (
        <div key={i} className="cp-draft-item" onClick={() => onLoad(d)}>
          <div className="cp-draft-item-top">
            <p className="cp-draft-item-title">{d.title || 'Untitled draft'}</p>
            <span className={`cp-draft-item-badge cp-draft-item-badge--${d.type}`}>
              {d.type === 'problem' ? '⚠ Problem' : '💡 Idea'}
            </span>
          </div>
          <p className="cp-draft-item-body">{d.body}</p>
          <div className="cp-draft-item-foot">
            <span className="cp-draft-item-time">{d.timestamp}</span>
            <button
              type="button"
              className="cp-draft-item-discard"
              onClick={(e) => { e.stopPropagation(); onDiscard(i); }}
              aria-label="Discard draft"
            >
              <X size={11} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────── */
export default function CreatePost() {
  const router = useRouter();
  const queryClient = useQueryClient();

  /* ── State ── */
  const [title, setTitle] = useState('');
  const [type, setType] = useState<PostType>('problem');
  const [draftId, setDraftId] = useState<string>('');

  // Set initial draft ID
  useEffect(() => {
    setDraftId(crypto.randomUUID());
  }, []);
  const [externalLink, setExternalLink] = useState('');
  const [linkName, setLinkName] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('AI');
  const [openPanel, setOpenPanel] = useState<ComposePanel>(null);
  const [pollQuestion, setPollQuestion] = useState('');
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [bodyText, setBodyText] = useState('');
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
  const [showDraftPanel, setShowDraftPanel] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState<Draft[]>([]);

  /* Rich text editor refs */
  const bodyEditorRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  /* ── Auth ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (!s) setError('You must be logged in to create a post.');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) setError(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  /* ── Focus ── */
  useEffect(() => { bodyEditorRef.current?.focus(); }, []);

  /* ── Track body editor text for live counters and validation ─ */
  useEffect(() => {
    const editor = bodyEditorRef.current;
    if (!editor) return;
    const updateText = () => setBodyText(editor.innerText);
    updateText();
    editor.addEventListener('input', updateText);
    return () => editor.removeEventListener('input', updateText);
  }, []);

  /* ── Load drafts from localStorage ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem('paoblem-drafts');
      if (raw) setSavedDrafts(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  /* ── Auto-save ── */
  const getBodyHtml = () => bodyEditorRef.current?.innerHTML ?? '';
  const getBodyText = () => bodyEditorRef.current?.innerText ?? '';

  const saveDraft = useCallback(() => {
    const currentBody = bodyText;
    if (!title && !currentBody) return;
    const currentDraftId = draftId || crypto.randomUUID();
    if (!draftId) setDraftId(currentDraftId);

    const draft: Draft = {
      id: currentDraftId,
      title,
      body: currentBody,
      type,
      timestamp: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };
    const existing: Draft[] = (() => {
      try { return JSON.parse(localStorage.getItem('paoblem-drafts') ?? '[]'); } catch { return []; }
    })();
    // Replace current draft by id, or prepend
    const idx = existing.findIndex((d) => d.id === currentDraftId);
    if (idx >= 0) existing[idx] = draft; else existing.unshift(draft);
    localStorage.setItem('paoblem-drafts', JSON.stringify(existing.slice(0, 10)));
    setSavedDrafts(existing.slice(0, 10));
    setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, [title, type, bodyText, draftId]);

  useEffect(() => {
    const timer = setTimeout(saveDraft, 1500);
    return () => clearTimeout(timer);
  }, [title, type, saveDraft]);

  /* ── Helpers ── */
  const wordCount = bodyText.trim().split(/\s+/).filter(Boolean).length;
  const charCount = bodyText.length;
  const isEnhanceEnabled = wordCount >= 15;
  const isFormValid = Boolean(session && title.trim().length > 0 && bodyText.trim().length >= 10);

  function normalizeTag(v: string) {
    return v.trim().replace(/^#/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function addCustomTag() {
    const cleaned = normalizeTag(tagInput);
    if (!cleaned || customTags.includes(cleaned) || customTags.length >= 5) return;
    setCustomTags((t) => [...t, cleaned]);
    setTagInput('');
  }

  function handleLoadDraft(draft: Draft) {
    setDraftId(draft.id || crypto.randomUUID());
    setTitle(draft.title);
    setType(draft.type);
    if (bodyEditorRef.current) bodyEditorRef.current.innerText = draft.body;
    setBodyText(draft.body);
    setShowDraftPanel(false);
  }

  function handleDiscardDraft(idx: number) {
    const next = savedDrafts.filter((_, i) => i !== idx);
    setSavedDrafts(next);
    localStorage.setItem('paoblem-drafts', JSON.stringify(next));
  }

  function handlePollCreate(question: string, options: string[], duration: string) {
    setPollQuestion(question);
    setOpenPanel('poll');
    const pollBody = `${question}\n\n${options.map((option, index) => `${index + 1}. ${option}`).join('\n')}\n\nDuration: ${duration}`;
    if (!title.trim()) setTitle(question);
    if (!bodyEditorRef.current || !bodyEditorRef.current.innerText.trim()) {
      bodyEditorRef.current && (bodyEditorRef.current.innerText = pollBody);
      setBodyText(pollBody);
    }
    setCustomTags((tags) => tags);
    setShowPollModal(false);
  }

  async function handleAIEnhance() {
    if (!isEnhanceEnabled) return;
    setAiEnhancing(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: getBodyHtml() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to enhance text.');
      setOriginalBody(getBodyHtml());
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
    if (!session) { setError('You must be logged in to post.'); return; }
    const bodyHtml = getBodyHtml();
    const isPollPost = openPanel === 'poll';
    if (!isPollPost && bodyText.trim().length < 10) { setError('Describe the problem in at least 10 characters.'); return; }
    if (!isPollPost && !title.trim()) { setError('Please add a title.'); return; }
    if (isPollPost && !pollQuestion.trim()) { setError('Please add a poll question.'); return; }

    setSubmitting(true);
    setError(null);

    const trimmedLink = externalLink.trim();
    const formattedLink = trimmedLink
      ? (/^https?:\/\//i.test(trimmedLink) ? trimmedLink : `https://${trimmedLink}`)
      : null;

    const pollOptions = isPollPost
      ? bodyText
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => /^[0-9]+\.\s+/.test(line))
          .map((line) => line.replace(/^[0-9]+\.\s+/, '').trim())
      : [];

    try {
      const res = await fetch('/api/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          title: isPollPost ? pollQuestion.trim() : title.trim(),
          body: isPollPost
            ? `${pollQuestion.trim()}\n\n${pollOptions.map((option, index) => `${index + 1}. ${option}`).join('\n')}`
            : bodyHtml,
          type,
          image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
          external_link: formattedLink,
          link_name: linkName || null,
          poll_question: isPollPost ? pollQuestion.trim() : null,
          metadata: isPollPost ? { poll: pollOptions } : undefined,
          category: selectedCategory,
          tags: customTags,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setSuccess(true);
      const remainingDrafts = savedDrafts.filter(d => d.id !== draftId);
      localStorage.setItem('paoblem-drafts', JSON.stringify(remainingDrafts));
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setTimeout(() => { router.push('/'); router.refresh(); }, 900);
    } catch (err: any) {
      setError(err.message || 'Failed to create post.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleBackClick() {
    const hasChanges = title.trim() || getBodyText().trim() || imageUrls.length > 0 || externalLink;
    if (hasChanges) setIsDraftLeaveOpen(true);
    else router.push('/');
  }

  /* ─── Render ────────────────────────────────────────────────── */
  return (
    <div className="app-container cp-modal-page">
      <Navbar />

      {/* Blurred feed backdrop */}
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

      {/* Modal stage */}
      <main className="cp-modal-stage" role="presentation">
        <section className="cp-thread-modal" role="dialog" aria-modal="true" aria-labelledby="cp-modal-title">
          <form onSubmit={handleSubmit}>

            {/* ── Header ── */}
            <header className="cp-thread-header">
              <button type="button" className="cp-thread-cancel" onClick={handleBackClick}>Cancel</button>
              <div className="cp-thread-title-wrap">
                <h1 id="cp-modal-title">New post</h1>
                {lastSaved && (
                  <span className="cp-thread-saved">
                    <Save size={10} />
                    Saved {lastSaved}
                  </span>
                )}
              </div>
              <div className="cp-thread-header-actions">
                {/* Drafts icon */}
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className={`cp-thread-icon-btn ${showDraftPanel ? 'cp-thread-icon-btn--active' : ''}`}
                    aria-label="Saved drafts"
                    onClick={() => setShowDraftPanel((v) => !v)}
                  >
                    <FileText size={18} />
                    {savedDrafts.length > 0 && <span className="cp-draft-dot" aria-hidden="true" />}
                  </button>

                  {/* Draft dropdown */}
                  {showDraftPanel && (
                    <div className="cp-draft-dropdown">
                      <div className="cp-draft-dropdown-header">
                        <span>Saved Drafts</span>
                        <span className="cp-draft-count">{savedDrafts.length}</span>
                      </div>
                      <DraftSidebar
                        drafts={savedDrafts}
                        onLoad={handleLoadDraft}
                        onDiscard={handleDiscardDraft}
                      />
                    </div>
                  )}
                </div>

                <button type="button" className="cp-thread-icon-btn" aria-label="More options">
                  <MoreHorizontal size={18} />
                </button>
              </div>
            </header>

            {/* ── Scrollable body ── */}
            <div className="cp-thread-scroll">
              {(error || success) && (
                <div className={`cp-thread-alert ${success ? 'cp-thread-alert--success' : ''}`}>
                  <CheckCircle size={14} />
                  {success ? 'Post published. Redirecting…' : error}
                </div>
              )}

              <div className="cp-thread-body">
                {/* Avatar column */}
                <div className="cp-thread-avatar-column">
                  <img
                    src={session?.user?.user_metadata?.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=preview'}
                    alt="You"
                    className="cp-thread-avatar"
                  />
                  <span className="cp-thread-line" />
                  <span className="cp-thread-small-avatar" />
                </div>

                {/* Main compose area */}
                <div className="cp-thread-main">
                  {/* Identity row with type tags */}
                  <div className="cp-thread-identity">
                    <strong>{session?.user?.user_metadata?.full_name || 'You'}</strong>
                    {/* Problem / Idea tags – right side of identity row */}
                    <div className="cp-type-tag-row">
                      <button
                        type="button"
                        className={`cp-type-tag cp-type-tag--problem ${type === 'problem' ? 'active' : ''}`}
                        onClick={() => setType('problem')}
                        disabled={submitting}
                      >
                        <AlertTriangle size={14} /> Problem
                      </button>
                      <button
                        type="button"
                        className={`cp-type-tag cp-type-tag--idea ${type === 'idea' ? 'active' : ''}`}
                        onClick={() => setType('idea')}
                        disabled={submitting}
                      >
                        <Lightbulb size={14} /> Idea
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <input
                    ref={titleInputRef}
                    className="cp-thread-title-input"
                    placeholder="Add a title (required)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={submitting}
                    maxLength={300}
                  />

                  {/* ── Rich text body editor ── */}
                  <div className="cp-rich-wrap cp-rich-wrap--body">
                    <RichToolbar editorRef={bodyEditorRef} />
                    <div
                      ref={bodyEditorRef}
                      className="cp-rich-editor cp-rich-editor--body"
                      contentEditable={!submitting}
                      suppressContentEditableWarning
                      data-placeholder="What's the problem you're facing?"
                      aria-label="Post body"
                      aria-multiline="true"
                    />
                  </div>

                  <div className="cp-thread-editor-stats">
                    <span>{wordCount} words</span>
                    <span>{charCount.toLocaleString()} / 10,000</span>
                  </div>

                  {/* Action row */}
                  <div className="cp-thread-actions-row">
                    <div className="cp-thread-actions" aria-label="Attachments">
                      {[
                        { key: 'media' as const, label: 'Media', icon: ImageIcon },
                        { key: 'link' as const, label: 'Link', icon: Link2 },
                      ].map((action) => (
                        <button
                          key={action.key}
                          type="button"
                          className={openPanel === action.key ? 'active' : ''}
                          onClick={() => setOpenPanel(openPanel === action.key ? null : action.key)}
                          disabled={submitting}
                          aria-label={action.label}
                          title={action.label}
                        >
                          <action.icon size={20} />
                        </button>
                      ))}
                      <button
                        type="button"
                        className={openPanel === 'poll' ? 'active' : ''}
                        onClick={() => setShowPollModal(true)}
                        disabled={submitting}
                        aria-label="Poll"
                        title="Poll"
                      >
                        <BarChart3 size={20} />
                      </button>
                    </div>

                    {/* AI Enhance */}
                    <div className="cp-thread-ai-wrap">
                      <button
                        type="button"
                        className={`cp-thread-ai-pill ${isEnhanceEnabled ? 'is-ready' : ''}`}
                        onClick={handleAIEnhance}
                        disabled={!isEnhanceEnabled || aiEnhancing || submitting}
                        onMouseEnter={() => setShowAiTooltip(true)}
                        onMouseLeave={() => setShowAiTooltip(false)}
                      >
                        {aiEnhancing ? <Loader2 size={13} className="cp-spin" /> : <Sparkles size={13} />}
                        <span>AI Enhance</span>
                      </button>
                      {showAiTooltip && !isEnhanceEnabled && (
                        <div className="cp-tooltip cp-thread-tooltip">Write 15+ words to unlock AI enhance</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Media panel ── */}
              {openPanel === 'media' && (
                <div className="cp-thread-panel">
                  <ImageUploader imageUrls={imageUrls} onChange={setImageUrls} maxFiles={10} />
                </div>
              )}

              {/* ── Link panel ── */}
              {openPanel === 'link' && (
                <div className="cp-thread-panel cp-thread-link-panel">
                  <div className="cp-link-input-wrap cp-link-input-wrap--url">
                    <Globe size={13} className="cp-link-icon" />
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

              {/* ── Poll preview chip ── */}
              {openPanel === 'poll' && pollQuestion && (
                <div className="cp-thread-panel cp-poll-chip">
                  <BarChart3 size={14} />
                  <span>{pollQuestion}</span>
                  <button
                    type="button"
                    onClick={() => { setOpenPanel(null); setPollQuestion(''); }}
                    disabled={submitting}
                    aria-label="Remove poll"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* ── Category chips & Custom Tags ── */}
              <div className="cp-thread-cat-row">
                {CATEGORY_CHIPS.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`cp-thread-cat-chip ${selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                    disabled={submitting}
                  >
                    {cat}
                  </button>
                ))}

                {!showTagInput ? (
                  <button 
                    type="button" 
                    className="cp-add-tag-toggle-btn cp-thread-cat-chip"
                    onClick={() => setShowTagInput(true)}
                    disabled={submitting}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px dashed rgba(255, 255, 255, 0.2)',
                      color: 'rgba(255, 255, 255, 0.6)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '0 12px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                    }}
                  >
                    <Plus size={12} /> Add tag
                  </button>
                ) : (
                  <div className="cp-thread-tags" style={{ margin: 0, display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder="Type tag..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { 
                        if (e.key === 'Enter') { 
                          e.preventDefault(); 
                          addCustomTag(); 
                        } else if (e.key === 'Escape') {
                          setShowTagInput(false);
                          setTagInput('');
                        }
                      }}
                      maxLength={24}
                      disabled={submitting}
                      autoFocus
                      style={{
                        minHeight: '30px',
                        padding: '0 10px',
                        fontSize: '0.75rem',
                        borderRadius: '999px',
                        width: '120px'
                      }}
                    />
                    <button 
                      type="button" 
                      onClick={() => {
                        addCustomTag();
                        setShowTagInput(false);
                      }} 
                      disabled={!tagInput.trim() || submitting}
                      style={{
                        minHeight: '30px',
                        padding: '0 12px',
                        fontSize: '0.75rem',
                        borderRadius: '999px'
                      }}
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
              {customTags.length > 0 && (
                <div className="cp-custom-tags-list cp-thread-custom-tags">
                  {customTags.map((tag) => (
                    <span key={tag} className="cp-custom-tag-chip">
                      #{tag}
                      <button
                        type="button"
                        onClick={() => setCustomTags((t) => t.filter((x) => x !== tag))}
                        disabled={submitting}
                        aria-label={`Remove ${tag}`}
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* ── AI preview ── */}
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
                          if (enhancedBody && bodyEditorRef.current) {
                            bodyEditorRef.current.innerHTML = enhancedBody;
                          }
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
                      <div dangerouslySetInnerHTML={{ __html: originalBody ?? '' }} />
                    </div>
                    <div className="split-pane">
                      <span className="split-label">Enhanced</span>
                      <div dangerouslySetInnerHTML={{ __html: enhancedBody ?? '' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <footer className="cp-thread-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  saveDraft();
                  router.push('/');
                }}
                disabled={submitting || (!title.trim() && !bodyText.trim())}
                className="cp-thread-draft-btn"
              >
                Save as draft
              </button>
              <button
                type="submit"
                disabled={!isFormValid || submitting}
                className={`cp-thread-post-btn ${!isFormValid ? 'disabled' : ''}`}
              >
                {submitting ? (
                  <><Loader2 size={13} className="cp-spin" /> Posting</>
                ) : success ? 'Posted' : 'Post'}
              </button>
            </footer>
          </form>
        </section>
      </main>

      {/* ── Poll Modal ── */}
      <PollModal
        isOpen={showPollModal}
        onClose={() => setShowPollModal(false)}
        onCreatePoll={handlePollCreate}
        disabled={submitting}
      />

      {/* ── Draft Leave Modal ── */}
      <DraftLeaveModal
        isOpen={isDraftLeaveOpen}
        onClose={() => setIsDraftLeaveOpen(false)}
        onSaveDraft={() => { saveDraft(); setIsDraftLeaveOpen(false); router.push('/'); }}
        onDiscard={() => { 
          const remainingDrafts = savedDrafts.filter(d => d.id !== draftId);
          localStorage.setItem('paoblem-drafts', JSON.stringify(remainingDrafts));
          setIsDraftLeaveOpen(false); 
          router.push('/'); 
        }}
      />
    </div>
  );
}

