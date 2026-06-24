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
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
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

function displayName(profile: Profile | null, fallback?: string | null) {
  return profile?.full_name || profile?.username || fallback || 'Member';
}

export default function CreatePostPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const [session, setSession] = useState<Session>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [postType, setPostType] = useState<PostType>(null);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [externalLink, setExternalLink] = useState('');
  const [linkName, setLinkName] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // AI Enhancer state
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [aiPreviewOpen, setAiPreviewOpen] = useState(false);
  const [originalBody, setOriginalBody] = useState<string | null>(null);
  const [enhancedBody, setEnhancedBody] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from('profiles')
      .select('username, full_name, avatar_url, reputation')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile((data as Profile) || null));
  }, [session?.user?.id]);

  useEffect(() => {
    window.setTimeout(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      setPostType(draft.postType || null);
      setVisibility(draft.visibility || 'public');
      setTitle(draft.title || '');
      setBody(draft.body || '');
      setExternalLink(draft.externalLink || '');
      setLinkName(draft.linkName || '');
      setSelectedCategory(draft.selectedCategory || null);
      setTags(Array.isArray(draft.tags) ? draft.tags : []);
      setPollEnabled(Boolean(draft.pollEnabled));
      setPollQuestion(draft.pollQuestion || '');
      setPollOptions(Array.isArray(draft.pollOptions) && draft.pollOptions.length >= 2 ? draft.pollOptions : ['', '']);
    } catch {}
    }, 0);
  }, []);

  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.style.height = 'auto';
    bodyRef.current.style.height = `${Math.min(bodyRef.current.scrollHeight, 560)}px`;
  }, [body]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        postType,
        visibility,
        title,
        body,
        externalLink,
        linkName,
        selectedCategory,
        tags,
        pollEnabled,
        pollQuestion,
        pollOptions,
      }));
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 700);
    return () => window.clearTimeout(id);
  }, [postType, visibility, title, body, externalLink, linkName, selectedCategory, tags, pollEnabled, pollQuestion, pollOptions]);

  const filteredCategories = useMemo(() => {
    const term = categorySearch.trim().toLowerCase();
    if (!term) return CATEGORY_CHIPS;
    return CATEGORY_CHIPS.filter((category) => category.toLowerCase().includes(term));
  }, [categorySearch]);

  const bodyCount = body.length;
  const pollIsValid = !pollEnabled || (pollQuestion.trim().length >= 3 && pollOptions.filter((option) => option.trim().length >= 1).length >= 2);
  const isValid = Boolean(session && postType && title.trim().length >= 3 && body.trim().length >= 10 && bodyCount <= MAX_BODY && pollIsValid);

  const addTag = () => {
    const next = normalizeTag(tagInput);
    if (!next || tags.includes(next) || tags.length >= 5) return;
    setTags((current) => [...current, next]);
    setTagInput('');
  };

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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session) return setError('Please sign in to publish.');
    if (!isValid || !postType) return setError('Choose Problem or Idea and add enough detail to publish.');

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const link = externalLink.trim();
      const formattedLink = link ? (/^https?:\/\//i.test(link) ? link : `https://${link}`) : null;
      const poll = pollEnabled ? {
        question: pollQuestion.trim(),
        options: pollOptions.map((option) => option.trim()).filter(Boolean).slice(0, 4),
      } : null;

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
          metadata: { visibility, category: selectedCategory, tags, poll },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish.');

      if (data.post) {
        try {
          const postWithProfile = {
            ...data.post,
            profiles: profile ? {
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
              username: profile.username,
              role: null
            } : null,
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

      localStorage.removeItem(DRAFT_KEY);
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setTimeout(() => router.push('/'), 650);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-container">
      <Navbar />
      <main className="create-post-shell">
        <form className="create-post-panel cp-modern-panel" onSubmit={submit}>
          <header className="cp-modern-header">
            <button className="cp-clean-icon-btn" type="button" onClick={() => router.back()} aria-label="Go back">
              <ArrowLeft size={19} />
            </button>
            <div className="cp-author-block">
              <Avatar src={profile?.avatar_url || undefined} name={displayName(profile, session?.user?.email)} size={48} />
              <div>
                <h1>{displayName(profile, session?.user?.email)}</h1>
                <p>{profile?.reputation ? `${profile.reputation} reputation` : 'Community member'}</p>
              </div>
            </div>
            <label className="cp-visibility">
              {visibility === 'public' ? <Globe2 size={15} /> : visibility === 'community' ? <Users size={15} /> : <Lock size={15} />}
              <select value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)} aria-label="Post visibility">
                <option value="public">Public</option>
                <option value="community">Community</option>
                <option value="private">Private draft</option>
              </select>
            </label>
          </header>

          <section className="cp-composer">
            <input
              className="cp-title-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={300}
              placeholder="Give it a clear title"
            />
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={MAX_BODY}
              placeholder="Share a problem, idea, insight, or challenge..."
              rows={7}
            />
            {aiPreviewOpen && (
              <div className="cp-ai-split" style={{ margin: '1rem 0 0' }}>
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
          </section>

          <section className="cp-badge-grid" aria-label="Choose post type">
            <button type="button" className={`cp-type-card problem ${postType === 'problem' ? 'active' : ''}`} onClick={() => setPostType('problem')}>
              <span className="cp-type-icon"><AlertTriangle size={19} /></span>
              <strong>PROBLEM</strong>
              <small>Share a problem you are facing</small>
              {postType === 'problem' && <Check className="cp-type-check" size={17} />}
            </button>
            <button type="button" className={`cp-type-card idea ${postType === 'idea' ? 'active' : ''}`} onClick={() => setPostType('idea')}>
              <span className="cp-type-icon"><Lightbulb size={19} /></span>
              <strong>IDEA</strong>
              <small>Share an idea or opportunity</small>
              {postType === 'idea' && <Check className="cp-type-check" size={17} />}
            </button>
          </section>

          <section className="cp-section">
            <div className="cp-clean-section-title">Category</div>
            <input className="cp-search-input" value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder="Search categories" />
            <div className="cp-clean-chip-row">
              {filteredCategories.map((category) => (
                <button key={category} type="button" className={selectedCategory === category ? 'active' : ''} onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}>
                  {category}
                </button>
              ))}
            </div>
          </section>

          <section className="cp-section cp-media-section">
            <div className="cp-clean-section-title"><ImageIcon size={16} /> Media</div>
            <ImageUploader imageUrls={imageUrls} onChange={setImageUrls} maxFiles={10} />
          </section>

          <section className="cp-actions-row" aria-label="Post actions">
            <button type="button" onClick={() => document.querySelector<HTMLElement>('.uploader-box')?.click()}><ImageIcon size={16} /> Add Media</button>
            <button type="button" className={pollEnabled ? 'active' : ''} onClick={() => setPollEnabled((value) => !value)}><Plus size={16} /> Add Poll</button>
            <button type="button" onClick={() => document.getElementById('cp-tags-input')?.focus()}><Hash size={16} /> Add Tags</button>
            <button type="button" onClick={() => document.getElementById('cp-link-input')?.focus()}><Link2 size={16} /> Add Link</button>
            <button
              type="button"
              className={body.trim().length >= 15 ? 'active' : ''}
              onClick={handleAIEnhance}
              disabled={body.trim().length < 15 || aiEnhancing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                opacity: body.trim().length >= 15 ? 1 : 0.5,
              }}
            >
              {aiEnhancing ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
              AI Enhance
            </button>
          </section>

          {pollEnabled && (
            <section className="cp-section cp-poll-box">
              <div className="cp-clean-section-title">Poll</div>
              <input value={pollQuestion} onChange={(event) => setPollQuestion(event.target.value)} placeholder="Ask a concise poll question" />
              {pollOptions.map((option, index) => (
                <div className="cp-poll-option" key={index}>
                  <input value={option} onChange={(event) => setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Option ${index + 1}`} />
                  {pollOptions.length > 2 && <button type="button" onClick={() => setPollOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove option"><X size={15} /></button>}
                </div>
              ))}
              {pollOptions.length < 4 && <button className="cp-add-option" type="button" onClick={() => setPollOptions((current) => [...current, ''])}>Add option</button>}
            </section>
          )}

          <section className="cp-clean-grid">
            <label className="cp-clean-field">
              <span><Link2 size={14} /> Link</span>
              <input id="cp-link-input" value={externalLink} onChange={(event) => setExternalLink(event.target.value)} placeholder="https://example.com" />
            </label>
            <label className="cp-clean-field">
              <span>Link label</span>
              <input value={linkName} onChange={(event) => setLinkName(event.target.value)} maxLength={60} placeholder="Optional label" />
            </label>
          </section>

          <section className="cp-section">
            <div className="cp-clean-section-title">Tags</div>
            <div className="cp-clean-tag-input">
              <input id="cp-tags-input" value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addTag();
                }
              }} placeholder="Add up to 5 tags" />
              <button type="button" onClick={addTag} disabled={!tagInput.trim() || tags.length >= 5}>Add</button>
            </div>
            {tags.length > 0 && (
              <div className="cp-clean-tag-list">
                {tags.map((tag) => (
                  <span key={tag}>#{tag}<button type="button" onClick={() => setTags((current) => current.filter((item) => item !== tag))} aria-label={`Remove ${tag}`}><X size={12} /></button></span>
                ))}
              </div>
            )}
          </section>

          {error && <div className="cp-clean-error">{error}</div>}
          {success && <div className="cp-clean-success">Published. Redirecting...</div>}

          <footer className="cp-clean-footer cp-modern-footer">
            <div className="cp-draft-meta">
              <span className={bodyCount > MAX_BODY * 0.9 ? 'warn' : ''}>{bodyCount.toLocaleString()} / {MAX_BODY.toLocaleString()}</span>
              <span>{lastSavedAt ? `Draft saved ${lastSavedAt}` : 'Draft autosaves'}</span>
            </div>
            <button type="submit" className="cp-clean-submit" disabled={!isValid || submitting}>
              {submitting ? <><Loader2 size={16} className="spin" /> Publishing...</> : <><Send size={16} /> Post</>}
            </button>
          </footer>
        </form>
      </main>
    </div>
  );
}
