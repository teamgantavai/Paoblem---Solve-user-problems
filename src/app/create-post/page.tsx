'use client';
// app/create-post/page.tsx  — complete rewrite

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlignCenter, AlignLeft, BarChart3, Bold, Calendar, CheckCircle,
  ChevronRight, Clock, FileText, Globe, Handshake, Image as ImageIcon,
  Italic, Link2, List, ListOrdered, Loader2, MoreHorizontal, Plus,
  RemoveFormatting, Save, Sparkles, Strikethrough, Underline, Users,
  X, Zap, AlertTriangle, Lightbulb, Trash2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import DraftLeaveModal from '@/components/DraftLeaveModal';
import ImageUploader from '@/components/ImageUploader';

// ─── Types ────────────────────────────────────────────────────────────────────
type PostType    = 'problem' | 'idea';
type PostMode    = 'post' | 'poll';
type ComposePanel = 'media' | 'link' | null;   // 'poll' removed — poll has its own form

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORY_CHIPS = [
  'AI', 'SaaS', 'Education', 'Healthcare', 'Fintech',
  'Developer Tools', 'Consumer', 'Marketplace', 'Design', 'Productivity',
];

const POLL_DURATIONS = [
  { label: '1 day',   value: '1 day'   },
  { label: '3 days',  value: '3 days'  },
  { label: '7 days',  value: '7 days'  },
  { label: '14 days', value: '14 days' },
  { label: '30 days', value: '30 days' },
  { label: 'Custom',  value: 'custom'  },
];

const DURATION_TO_DAYS: Record<string, number> = {
  '1 day': 1, '3 days': 3, '7 days': 7, '14 days': 14, '30 days': 30,
};

function computeExpiresAt(duration: string, customDate: string): string {
  if (duration === 'custom' && customDate) {
    return new Date(customDate).toISOString();
  }
  const days = DURATION_TO_DAYS[duration] ?? 3;
  const d    = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ─── RichToolbar ──────────────────────────────────────────────────────────────
interface RichToolbarProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  onUpdate? : () => void;
}

function RichToolbar({ editorRef, onUpdate }: RichToolbarProps) {
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});
  const [isLinkPanelOpen, setIsLinkPanelOpen] = useState(false);
  const [linkHref, setLinkHref] = useState('');
  const [linkText, setLinkText] = useState('');
  const [linkError, setLinkError] = useState('');

  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value ?? undefined);
    refreshState();
    onUpdate?.();
  };

  const refreshState = () => {
    setActiveFormats({
      bold              : document.queryCommandState('bold'),
      italic            : document.queryCommandState('italic'),
      underline         : document.queryCommandState('underline'),
      strikeThrough     : document.queryCommandState('strikeThrough'),
      insertOrderedList : document.queryCommandState('insertOrderedList'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
    });
  };

  const showLinkPopup = () => {
    const selection = document.getSelection()?.toString() ?? '';
    setLinkText(selection);
    setLinkHref('');
    setLinkError('');
    setIsLinkPanelOpen(true);
  };

  const applyLink = () => {
    const trimmed = linkHref.trim();
    if (!trimmed) { setLinkError('Please enter a valid URL.'); return; }
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (linkText.trim()) {
      editorRef.current?.focus();
      document.execCommand('insertHTML', false,
        `<a href="${normalized}" target="_blank" rel="noreferrer noopener">${linkText.trim()}</a>`);
      refreshState();
      onUpdate?.();
    } else {
      exec('createLink', normalized);
    }
    setIsLinkPanelOpen(false);
    setLinkHref('');
    setLinkText('');
    setLinkError('');
  };

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const h = () => refreshState();
    el.addEventListener('keyup',           h);
    el.addEventListener('mouseup',         h);
    el.addEventListener('selectionchange', h);
    return () => {
      el.removeEventListener('keyup',           h);
      el.removeEventListener('mouseup',         h);
      el.removeEventListener('selectionchange', h);
    };
  }, [editorRef]);

  const ToolBtn = ({
    cmd, label, children, onClick,
  }: { cmd?: string; label: string; children: React.ReactNode; onClick?: () => void }) => (
    <button
      type="button" title={label} aria-label={label}
      className={`cp-rt-btn ${cmd && activeFormats[cmd] ? 'active' : ''}`}
      onMouseDown={(e) => { e.preventDefault(); onClick ? onClick() : cmd && exec(cmd); }}
    >
      {children}
    </button>
  );

  return (
    <>
      <div className="cp-rt-toolbar" role="toolbar" aria-label="Text formatting">
        <ToolBtn cmd="bold"               label="Bold"           ><Bold size={13} /></ToolBtn>
        <ToolBtn cmd="italic"             label="Italic"         ><Italic size={13} /></ToolBtn>
        <ToolBtn cmd="underline"          label="Underline"      ><Underline size={13} /></ToolBtn>
        <ToolBtn cmd="strikeThrough"      label="Strikethrough"  ><Strikethrough size={13} /></ToolBtn>
        <span className="cp-rt-sep" aria-hidden="true" />
        <ToolBtn cmd="insertOrderedList"  label="Numbered list"  ><ListOrdered size={13} /></ToolBtn>
        <ToolBtn cmd="insertUnorderedList" label="Bullet list"   ><List size={13} /></ToolBtn>
        <span className="cp-rt-sep" aria-hidden="true" />
        <ToolBtn cmd="justifyLeft"        label="Align left"     ><AlignLeft size={13} /></ToolBtn>
        <ToolBtn cmd="justifyCenter"      label="Align centre"   ><AlignCenter size={13} /></ToolBtn>
        <span className="cp-rt-sep" aria-hidden="true" />
        <ToolBtn label="Insert link"      onClick={showLinkPopup} ><Link2 size={13} /></ToolBtn>
        <ToolBtn label="Clear formatting" onClick={() => exec('removeFormat')} ><RemoveFormatting size={13} /></ToolBtn>
      </div>
      {isLinkPanelOpen && (
        <div className="cp-rich-link-panel">
          <div className="cp-rich-link-row">
            <input type="text" className="cp-rich-link-input"
              placeholder="URL — https://example.com" value={linkHref}
              onChange={(e) => setLinkHref(e.target.value)} />
          </div>
          <div className="cp-rich-link-row">
            <input type="text" className="cp-rich-link-input"
              placeholder="Link text (optional)" value={linkText}
              onChange={(e) => setLinkText(e.target.value)} />
          </div>
          {linkError && <div className="cp-rich-link-error">{linkError}</div>}
          <div className="cp-rich-link-actions">
            <button type="button" className="cp-rich-link-cancel"
              onClick={() => { setIsLinkPanelOpen(false); setLinkHref(''); setLinkText(''); setLinkError(''); }}>
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

// ─── Poll Inline Form ─────────────────────────────────────────────────────────
//  Completely self-contained — shares NO state with the post editor.
interface PollInlineFormProps {
  question       : string;
  onQuestionChange: (v: string) => void;
  options        : string[];
  onOptionChange : (idx: number, v: string) => void;
  onAddOption    : () => void;
  onRemoveOption : (idx: number) => void;
  duration       : string;
  onDurationChange: (v: string) => void;
  customDate     : string;
  onCustomDateChange: (v: string) => void;
  imageUrls      : string[];
  onImagesChange : (urls: string[]) => void;
  errors         : Record<string, string>;
  disabled       : boolean;
}

function PollInlineForm({
  question, onQuestionChange,
  options, onOptionChange, onAddOption, onRemoveOption,
  duration, onDurationChange,
  customDate, onCustomDateChange,
  imageUrls, onImagesChange,
  errors, disabled,
}: PollInlineFormProps) {
  const filledCount = options.filter(o => o.trim()).length;
  const minCustomDate = (() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    return d.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
  })();

  return (
    <div className="cp-poll-form">
      {/* ── Question ── */}
      <div className="cp-poll-form-field">
        <label className="cp-poll-form-label">
          Poll question <span aria-hidden="true" style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          className={`cp-poll-form-input ${errors.question ? 'cp-poll-form-input--err' : ''}`}
          placeholder="e.g. Which approach do you prefer?"
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          maxLength={500}
          disabled={disabled}
        />
        {errors.question && (
          <span className="cp-poll-form-err">{errors.question}</span>
        )}
        <span className="cp-poll-form-hint">{question.length}/500</span>
      </div>

      {/* ── Options ── */}
      <div className="cp-poll-form-field">
        <label className="cp-poll-form-label">
          Options
          <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: '0.4rem' }}>
            ({filledCount} filled · min 2 · max 10)
          </span>
        </label>

        <div className="cp-poll-options-list">
          {options.map((opt, idx) => (
            <div key={idx} className="cp-poll-option-row">
              <span className="cp-poll-option-num">{idx + 1}</span>
              <input
                className="cp-poll-form-input cp-poll-option-input"
                placeholder={`Option ${idx + 1}${idx >= 2 ? ' (optional)' : ''}`}
                value={opt}
                onChange={(e) => onOptionChange(idx, e.target.value)}
                maxLength={100}
                disabled={disabled}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  className="cp-poll-option-remove"
                  onClick={() => onRemoveOption(idx)}
                  disabled={disabled}
                  aria-label={`Remove option ${idx + 1}`}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        {errors.options && (
          <span className="cp-poll-form-err">{errors.options}</span>
        )}

        {options.length < 10 && (
          <button
            type="button"
            className="cp-poll-add-option-btn"
            onClick={onAddOption}
            disabled={disabled}
          >
            <Plus size={13} /> Add option
          </button>
        )}
      </div>

      {/* ── Duration ── */}
      <div className="cp-poll-form-field">
        <label className="cp-poll-form-label">
          <Clock size={12} style={{ display: 'inline', marginRight: '0.3rem', verticalAlign: 'middle' }} />
          Duration <span aria-hidden="true" style={{ color: '#ef4444' }}>*</span>
        </label>

        <div className="cp-poll-duration-chips">
          {POLL_DURATIONS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              className={`cp-poll-dur-chip ${duration === value ? 'active' : ''}`}
              onClick={() => onDurationChange(value)}
              disabled={disabled}
            >
              {value === 'custom' ? <Calendar size={11} style={{ marginRight: '0.25rem' }} /> : null}
              {label}
            </button>
          ))}
        </div>

        {duration === 'custom' && (
          <input
            type="datetime-local"
            className={`cp-poll-form-input cp-poll-custom-date ${errors.duration ? 'cp-poll-form-input--err' : ''}`}
            value={customDate}
            onChange={(e) => onCustomDateChange(e.target.value)}
            min={minCustomDate}
            disabled={disabled}
            style={{ marginTop: '0.5rem' }}
          />
        )}
        {errors.duration && (
          <span className="cp-poll-form-err">{errors.duration}</span>
        )}

        {/* Expiry preview */}
        {(duration !== 'custom' || customDate) && (
          <span className="cp-poll-form-hint" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <CheckCircle size={11} style={{ color: '#22c55e' }} />
            Ends:{' '}
            {new Date(computeExpiresAt(duration, customDate)).toLocaleString([], {
              month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
        )}
      </div>

      {/* ── Optional image ── */}
      <div className="cp-poll-form-field">
        <label className="cp-poll-form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <ImageIcon size={12} /> Image (optional)
        </label>
        <ImageUploader imageUrls={imageUrls} onChange={onImagesChange} maxFiles={1} />
      </div>

      {/* ── Preview pill ── */}
      {question.trim() && filledCount >= 2 && (
        <div className="cp-poll-preview-pill">
          <BarChart3 size={12} />
          <span>
            <strong>Preview:</strong> "{question.trim()}" · {filledCount} options ·{' '}
            {duration === 'custom' ? 'custom date' : duration}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Draft Sidebar ────────────────────────────────────────────────────────────
interface Draft {
  id       : string;
  title    : string;
  body     : string;
  type     : PostType;
  timestamp: string;
}

interface DraftSidebarProps {
  drafts   : Draft[];
  onLoad   : (d: Draft) => void;
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
            <button type="button" className="cp-draft-item-discard"
              onClick={(e) => { e.stopPropagation(); onDiscard(i); }}
              aria-label="Discard draft">
              <X size={11} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CreatePost() {
  const router       = useRouter();
  const queryClient  = useQueryClient();

  // ── Mode — completely isolated ──────────────────────────────────────────
  const [postMode, setPostMode] = useState<PostMode>('post');

  // ── Post-specific state ─────────────────────────────────────────────────
  const [title,            setTitle]            = useState('');
  const [type,             setType]             = useState<PostType>('problem');
  const [draftId,          setDraftId]          = useState('');
  const [externalLink,     setExternalLink]     = useState('');
  const [linkName,         setLinkName]         = useState('');
  const [imageUrls,        setImageUrls]        = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('AI');
  const [openPanel,        setOpenPanel]        = useState<ComposePanel>(null);
  const [customTags,       setCustomTags]       = useState<string[]>([]);
  const [tagInput,         setTagInput]         = useState('');
  const [showTagInput,     setShowTagInput]     = useState(false);
  const [bodyText,         setBodyText]         = useState('');

  // ── Poll-specific state (100% isolated — never touches post fields) ─────
  const [pollQuestion,      setPollQuestion]      = useState('');
  const [pollOptions,       setPollOptions]       = useState<string[]>(['', '']);
  const [pollDuration,      setPollDuration]      = useState('3 days');
  const [pollCustomDate,    setPollCustomDate]    = useState('');
  const [pollImageUrls,     setPollImageUrls]     = useState<string[]>([]);
  const [pollErrors,        setPollErrors]        = useState<Record<string, string>>({});

  // ── Shared UI state ─────────────────────────────────────────────────────
  const [submitting,       setSubmitting]       = useState(false);
  const [error,            setError]            = useState<string | null>(null);
  const [success,          setSuccess]          = useState(false);
  const [lastSaved,        setLastSaved]        = useState<string | null>(null);
  const [session,          setSession]          = useState<any>(null);
  const [showAiTooltip,    setShowAiTooltip]    = useState(false);
  const [isDraftLeaveOpen, setIsDraftLeaveOpen] = useState(false);
  const [aiEnhancing,      setAiEnhancing]      = useState(false);
  const [aiPreviewOpen,    setAiPreviewOpen]    = useState(false);
  const [originalBody,     setOriginalBody]     = useState<string | null>(null);
  const [enhancedBody,     setEnhancedBody]     = useState<string | null>(null);
  const [showDraftPanel,   setShowDraftPanel]   = useState(false);
  const [savedDrafts,      setSavedDrafts]      = useState<Draft[]>([]);

  const bodyEditorRef  = useRef<HTMLDivElement>(null);
  const titleInputRef  = useRef<HTMLInputElement>(null);

  // ── Auth ────────────────────────────────────────────────────────────────
  useEffect(() => {
    setDraftId(crypto.randomUUID());
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

  useEffect(() => { bodyEditorRef.current?.focus(); }, []);

  useEffect(() => {
    const editor = bodyEditorRef.current;
    if (!editor) return;
    const update = () => setBodyText(editor.innerText);
    update();
    editor.addEventListener('input', update);
    return () => editor.removeEventListener('input', update);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('paoblem-drafts');
      if (raw) setSavedDrafts(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // ── Mode switch — resets only the TARGET mode's fields ─────────────────
  function switchMode(mode: PostMode) {
    if (mode === postMode) return;
    if (mode === 'poll') {
      // Enter poll mode: reset poll fields fresh
      setPollQuestion('');
      setPollOptions(['', '']);
      setPollDuration('3 days');
      setPollCustomDate('');
      setPollImageUrls([]);
      setPollErrors({});
      // Close any post panels
      setOpenPanel(null);
      setAiPreviewOpen(false);
    } else {
      // Back to post mode: clear poll fields
      setPollQuestion('');
      setPollOptions(['', '']);
      setPollDuration('3 days');
      setPollCustomDate('');
      setPollImageUrls([]);
      setPollErrors({});
    }
    setError(null);
    setPostMode(mode);
  }

  // ── Poll option helpers ─────────────────────────────────────────────────
  const addPollOption    = () => { if (pollOptions.length < 10) setPollOptions(o => [...o, '']); };
  const removePollOption = (idx: number) => {
    if (pollOptions.length > 2) setPollOptions(o => o.filter((_, i) => i !== idx));
  };
  const setPollOption    = (idx: number, val: string) =>
    setPollOptions(o => o.map((v, i) => (i === idx ? val : v)));

  // ── Auto-save (post mode only) ─────────────────────────────────────────
  const getBodyHtml = () => bodyEditorRef.current?.innerHTML  ?? '';
  const getBodyText = () => bodyEditorRef.current?.innerText  ?? '';

  const saveDraft = useCallback(() => {
    if (!title && !bodyText) return;
    const id = draftId || crypto.randomUUID();
    if (!draftId) setDraftId(id);
    const draft: Draft = {
      id, title, body: bodyText, type,
      timestamp: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };
    const existing: Draft[] = (() => {
      try { return JSON.parse(localStorage.getItem('paoblem-drafts') ?? '[]'); } catch { return []; }
    })();
    const idx = existing.findIndex(d => d.id === id);
    if (idx >= 0) existing[idx] = draft; else existing.unshift(draft);
    localStorage.setItem('paoblem-drafts', JSON.stringify(existing.slice(0, 10)));
    setSavedDrafts(existing.slice(0, 10));
    setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, [title, type, bodyText, draftId]);

  useEffect(() => {
    if (postMode !== 'post') return;
    const t = setTimeout(saveDraft, 1500);
    return () => clearTimeout(t);
  }, [title, type, saveDraft, postMode]);

  // ── Helpers ─────────────────────────────────────────────────────────────
  const wordCount       = bodyText.trim().split(/\s+/).filter(Boolean).length;
  const charCount       = bodyText.length;
  const isEnhanceEnabled = wordCount >= 15;

  const filledPollOptions = pollOptions.filter(o => o.trim());

  const isPostFormValid = Boolean(
    session && title.trim().length > 0 && bodyText.trim().length >= 10,
  );
  const isPollFormValid = Boolean(
    session &&
    pollQuestion.trim().length >= 3 &&
    filledPollOptions.length >= 2 &&
    (pollDuration !== 'custom' || pollCustomDate),
  );
  const isFormValid = postMode === 'poll' ? isPollFormValid : isPostFormValid;

  function normalizeTag(v: string) {
    return v.trim().replace(/^#/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function addCustomTag() {
    const cleaned = normalizeTag(tagInput);
    if (!cleaned || customTags.includes(cleaned) || customTags.length >= 5) return;
    setCustomTags(t => [...t, cleaned]);
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

  // ── AI Enhance ──────────────────────────────────────────────────────────
  async function handleAIEnhance() {
    if (!isEnhanceEnabled) return;
    setAiEnhancing(true);
    setError(null);
    try {
      const res  = await fetch('/api/ai/enhance', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ text: getBodyHtml() }),
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

  // ── Post submit ─────────────────────────────────────────────────────────
  async function handlePostSubmit() {
    if (!session) { setError('You must be logged in to post.'); return; }
    const bodyHtml = getBodyHtml();
    if (bodyText.trim().length < 10) { setError('Describe in at least 10 characters.'); return; }
    if (!title.trim()) { setError('Please add a title.'); return; }

    setSubmitting(true);
    setError(null);

    const trimmedLink   = externalLink.trim();
    const formattedLink = trimmedLink
      ? (/^https?:\/\//i.test(trimmedLink) ? trimmedLink : `https://${trimmedLink}`)
      : null;

    try {
      const res = await fetch('/api/posts/create', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body   : JSON.stringify({
          title         : title.trim(),
          body          : bodyHtml,
          type,
          image_url     : imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
          external_link : formattedLink,
          link_name     : linkName || null,
          category      : selectedCategory,
          tags          : customTags,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');

      setSuccess(true);
      // Clean up draft
      const remaining = savedDrafts.filter(d => d.id !== draftId);
      localStorage.setItem('paoblem-drafts', JSON.stringify(remaining));
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setTimeout(() => { router.push('/'); router.refresh(); }, 900);
    } catch (err: any) {
      setError(err.message || 'Failed to create post.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Poll submit ─────────────────────────────────────────────────────────
  async function handlePollSubmit() {
    if (!session) { setError('You must be logged in to create a poll.'); return; }

    const errs: Record<string, string> = {};
    if (!pollQuestion.trim())           errs.question = 'Poll question is required.';
    else if (pollQuestion.trim().length < 3) errs.question = 'Question must be at least 3 characters.';
    if (filledPollOptions.length < 2)   errs.options  = 'At least 2 options are required.';
    if (pollDuration === 'custom' && !pollCustomDate) errs.duration = 'Please pick a custom end date.';

    if (Object.keys(errs).length > 0) {
      setPollErrors(errs);
      return;
    }
    setPollErrors({});

    setSubmitting(true);
    setError(null);

    const expires_at = computeExpiresAt(pollDuration, pollCustomDate);

    try {
      const res = await fetch('/api/posts/create', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body   : JSON.stringify({
          title        : pollQuestion.trim(),
          body         : filledPollOptions.map((o, i) => `${i + 1}. ${o}`).join('\n'),
          type,
          image_url    : pollImageUrls.length > 0 ? JSON.stringify(pollImageUrls) : null,
          poll_question: pollQuestion.trim(),
          category     : selectedCategory,
          tags         : customTags,
          poll_data    : {
            question       : pollQuestion.trim(),
            options        : filledPollOptions,
            duration       : pollDuration,
            expires_at,
            multiple_choice: false,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create poll.');

      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setTimeout(() => { router.push('/'); router.refresh(); }, 900);
    } catch (err: any) {
      setError(err.message || 'Failed to create poll.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Unified submit ──────────────────────────────────────────────────────
  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (postMode === 'poll') {
      await handlePollSubmit();
    } else {
      await handlePostSubmit();
    }
  }

  function handleBackClick() {
    const hasChanges = title.trim() || getBodyText().trim() || imageUrls.length > 0 || externalLink ||
      pollQuestion.trim() || pollOptions.some(o => o.trim());
    if (hasChanges) setIsDraftLeaveOpen(true);
    else router.push('/');
  }

  // ─── Render ───────────────────────────────────────────────────────────────
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
                <h1 id="cp-modal-title">
                  {postMode === 'poll' ? 'New poll' : 'New post'}
                </h1>
                {postMode === 'post' && lastSaved && (
                  <span className="cp-thread-saved">
                    <Save size={10} /> Saved {lastSaved}
                  </span>
                )}
              </div>
              <div className="cp-thread-header-actions">
                {/* Drafts icon (post mode only) */}
                {postMode === 'post' && (
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className={`cp-thread-icon-btn ${showDraftPanel ? 'cp-thread-icon-btn--active' : ''}`}
                      aria-label="Saved drafts"
                      onClick={() => setShowDraftPanel(v => !v)}
                    >
                      <FileText size={18} />
                      {savedDrafts.length > 0 && <span className="cp-draft-dot" aria-hidden="true" />}
                    </button>
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
                )}
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
                  {success ? 'Published! Redirecting…' : error}
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
                  {/* Identity row */}
                  <div className="cp-thread-identity">
                    <strong>{session?.user?.user_metadata?.full_name || 'You'}</strong>
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

                  {/* ── MODE TABS ── */}
                  <div className="cp-mode-tabs" role="tablist" aria-label="Content type">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={postMode === 'post'}
                      className={`cp-mode-tab ${postMode === 'post' ? 'active' : ''}`}
                      onClick={() => switchMode('post')}
                      disabled={submitting}
                    >
                      <FileText size={13} /> Post
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={postMode === 'poll'}
                      className={`cp-mode-tab ${postMode === 'poll' ? 'active' : ''}`}
                      onClick={() => switchMode('poll')}
                      disabled={submitting}
                    >
                      <BarChart3 size={13} /> Poll
                    </button>
                  </div>

                  {/* ══ POST FORM ══ */}
                  {postMode === 'post' && (
                    <>
                      <input
                        ref={titleInputRef}
                        className="cp-thread-title-input"
                        placeholder="Add a title (required)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={submitting}
                        maxLength={300}
                      />

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
                          {([
                            { key: 'media' as const, label: 'Media', icon: ImageIcon },
                            { key: 'link'  as const, label: 'Link',  icon: Link2    },
                          ]).map((action) => (
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
                            {aiEnhancing
                              ? <Loader2 size={13} className="cp-spin" />
                              : <Sparkles size={13} />}
                            <span>AI Enhance</span>
                          </button>
                          {showAiTooltip && !isEnhanceEnabled && (
                            <div className="cp-tooltip cp-thread-tooltip">
                              Write 15+ words to unlock AI enhance
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* ══ POLL FORM ══ */}
                  {postMode === 'poll' && (
                    <PollInlineForm
                      question={pollQuestion}
                      onQuestionChange={setPollQuestion}
                      options={pollOptions}
                      onOptionChange={setPollOption}
                      onAddOption={addPollOption}
                      onRemoveOption={removePollOption}
                      duration={pollDuration}
                      onDurationChange={setPollDuration}
                      customDate={pollCustomDate}
                      onCustomDateChange={setPollCustomDate}
                      imageUrls={pollImageUrls}
                      onImagesChange={setPollImageUrls}
                      errors={pollErrors}
                      disabled={submitting}
                    />
                  )}
                </div>
              </div>

              {/* ── Media panel (post mode) ── */}
              {postMode === 'post' && openPanel === 'media' && (
                <div className="cp-thread-panel">
                  <ImageUploader imageUrls={imageUrls} onChange={setImageUrls} maxFiles={10} />
                </div>
              )}

              {/* ── Link panel (post mode) ── */}
              {postMode === 'post' && openPanel === 'link' && (
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

              {/* ── AI preview (post mode) ── */}
              {postMode === 'post' && aiPreviewOpen && (
                <div className="cp-ai-split cp-thread-ai-split">
                  <div className="cp-ai-split-header">
                    <span className="cp-ai-split-label">AI Enhancement Preview</span>
                    <div className="cp-ai-split-actions">
                      <button type="button" className="cp-ai-btn cp-ai-btn--decline"
                        onClick={() => setAiPreviewOpen(false)}>
                        Decline
                      </button>
                      <button type="button" className="cp-ai-btn cp-ai-btn--accept"
                        onClick={() => {
                          if (enhancedBody && bodyEditorRef.current)
                            bodyEditorRef.current.innerHTML = enhancedBody;
                          setAiPreviewOpen(false);
                        }}>
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

              {/* ── Category chips & custom tags (both modes) ── */}
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
                      background : 'rgba(255,255,255,0.02)',
                      border     : '1px dashed rgba(255,255,255,0.2)',
                      color      : 'rgba(255,255,255,0.6)',
                      display    : 'inline-flex',
                      alignItems : 'center',
                      gap        : '4px',
                      padding    : '0 12px',
                    }}
                  >
                    <Plus size={12} /> Add tag
                  </button>
                ) : (
                  <div className="cp-thread-tags" style={{ margin: 0, display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder="Type tag…"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); }
                        else if (e.key === 'Escape') { setShowTagInput(false); setTagInput(''); }
                      }}
                      maxLength={24}
                      disabled={submitting}
                      autoFocus
                      style={{ minHeight: '30px', padding: '0 10px', fontSize: '0.75rem', borderRadius: '999px', width: '120px' }}
                    />
                    <button
                      type="button"
                      onClick={() => { addCustomTag(); setShowTagInput(false); }}
                      disabled={!tagInput.trim() || submitting}
                      style={{ minHeight: '30px', padding: '0 12px', fontSize: '0.75rem', borderRadius: '999px' }}
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
                      <button type="button"
                        onClick={() => setCustomTags(t => t.filter(x => x !== tag))}
                        disabled={submitting}
                        aria-label={`Remove ${tag}`}>
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <footer className="cp-thread-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              {postMode === 'post' && (
                <button
                  type="button"
                  onClick={() => { saveDraft(); router.push('/'); }}
                  disabled={submitting || (!title.trim() && !bodyText.trim())}
                  className="cp-thread-draft-btn"
                >
                  Save as draft
                </button>
              )}
              <button
                type="submit"
                disabled={!isFormValid || submitting}
                className={`cp-thread-post-btn ${!isFormValid ? 'disabled' : ''}`}
              >
                {submitting ? (
                  <><Loader2 size={13} className="cp-spin" /> Posting…</>
                ) : success ? 'Posted!' : postMode === 'poll' ? 'Create Poll' : 'Post'}
              </button>
            </footer>
          </form>
        </section>
      </main>

      {/* ── Draft Leave Modal ── */}
      <DraftLeaveModal
        isOpen={isDraftLeaveOpen}
        onClose={() => setIsDraftLeaveOpen(false)}
        onSaveDraft={() => { saveDraft(); setIsDraftLeaveOpen(false); router.push('/'); }}
        onDiscard={() => {
          const remaining = savedDrafts.filter(d => d.id !== draftId);
          localStorage.setItem('paoblem-drafts', JSON.stringify(remaining));
          setIsDraftLeaveOpen(false);
          router.push('/');
        }}
      />
    </div>
  );
}