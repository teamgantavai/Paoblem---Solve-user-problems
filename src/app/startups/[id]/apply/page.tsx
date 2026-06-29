'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Send, Loader2, Plus, X, Check, Rocket } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });

function parseFundingStage(value: string | null) {
  if (!value) return { funding_stage: '', hiring_status: 'Hiring', roles_statuses: {} as Record<string, string> };
  try {
    if (value.startsWith('{')) {
      const data = JSON.parse(value);
      return {
        funding_stage: data.funding_stage || '',
        hiring_status: data.hiring_status || 'Hiring',
        roles_statuses: (data.roles_statuses || {}) as Record<string, string>
      };
    }
  } catch (e) {}
  return { funding_stage: value, hiring_status: 'Hiring', roles_statuses: {} as Record<string, string> };
}

// ── Role-specific question config ────────────────────
const ROLE_CONFIG: Record<string, {
  introLabel: string;
  introPlaceholder: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  portfolioLabel: string;
}> = {
  'Developer': {
    introLabel: 'Your technical background',
    introPlaceholder: "I'm a full-stack developer with 4 years in React & Node.js. I've shipped 3 production SaaS products and love solving complex backend challenges...",
    reasonLabel: 'What will you build here?',
    reasonPlaceholder: "I want to build the core API layer and improve performance. I see opportunities to add real-time features and...",
    portfolioLabel: 'GitHub / Portfolio',
  },
  'Designer': {
    introLabel: 'Your design background',
    introPlaceholder: "I'm a product designer with 5+ years in B2B SaaS. I specialise in design systems and turning complex flows into intuitive UX...",
    reasonLabel: 'What will you design here?',
    reasonPlaceholder: "I want to redesign the onboarding flow and build a scalable design system. I believe great UX is what separates good products from great ones...",
    portfolioLabel: 'Portfolio / Dribbble / Behance',
  },
  'Co-founder': {
    introLabel: 'Your founder background',
    introPlaceholder: "I've co-founded two startups — one exited, one pivoted. I bring go-to-market expertise and a strong network in the SaaS space...",
    reasonLabel: 'Why do you want to co-found this?',
    reasonPlaceholder: "This problem space aligns with a gap I identified. I can bring my growth experience and investor network to accelerate traction...",
    portfolioLabel: 'LinkedIn / Pitch deck link',
  },
  'Marketing': {
    introLabel: 'Your marketing background',
    introPlaceholder: "I've led growth at two B2B startups, scaling from 0 to 10k MRR through content, SEO, and paid channels...",
    reasonLabel: 'What is your growth plan here?',
    reasonPlaceholder: "I'll start with an SEO-first content strategy to capture organic demand, then layer in paid and community-led growth...",
    portfolioLabel: 'LinkedIn / Case studies',
  },
  'Sales': {
    introLabel: 'Your sales background',
    introPlaceholder: "I've closed $2M+ ARR at an early-stage SaaS. I'm skilled in outbound, demo, and negotiation for SMB and mid-market...",
    reasonLabel: 'How will you drive revenue?',
    reasonPlaceholder: "I'll build a repeatable outbound motion targeting [ICP] and create a pipeline process from scratch...",
    portfolioLabel: 'LinkedIn profile',
  },
  'Operations': {
    introLabel: 'Your operations background',
    introPlaceholder: "I've built ops from scratch at two startups, setting up hiring, finance, and vendor workflows that scaled to 50 people...",
    reasonLabel: 'What will you fix or build first?',
    reasonPlaceholder: "I'll audit current workflows, identify bottlenecks, and implement lightweight processes that don't slow the team down...",
    portfolioLabel: 'LinkedIn profile',
  },
  'Other': {
    introLabel: 'Tell them who you are',
    introPlaceholder: "Give a brief intro — your background, what you do, and what makes you stand out...",
    reasonLabel: 'Why do you want to join?',
    reasonPlaceholder: "I'm excited about this startup because...",
    portfolioLabel: 'Portfolio / Links (optional)',
  },
};

function getRoleConfig(role: string) {
  return ROLE_CONFIG[role] || ROLE_CONFIG['Other'];
}

const ALL_ROLES = ['Developer', 'Designer', 'Co-founder', 'Marketing', 'Sales', 'Operations', 'Other'];

export default function ApplyPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedRole = searchParams.get('role') || '';

  const [startupId, setStartupId] = useState('');
  const [startup, setStartup] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [step, setStep] = useState<'role' | 'form'>(preselectedRole ? 'form' : 'role');
  const [selectedRole, setSelectedRole] = useState(preselectedRole);
  const [intro, setIntro] = useState('');
  const [reason, setReason] = useState('');
  const [portfolioLinks, setPortfolioLinks] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const { roles_statuses } = parseFundingStage(startup?.funding_stage || null);
  const isRoleFilledOrClosed = selectedRole ? (roles_statuses[selectedRole] === 'Filled' || roles_statuses[selectedRole] === 'Closed') : false;

  // Resolve params
  useEffect(() => {
    params.then(({ id }) => setStartupId(id));
  }, [params]);

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (!s) setIsAuthOpen(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // Fetch startup
  useEffect(() => {
    if (!startupId) return;
    fetch(`/api/startups/${startupId}`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        setStartup(d?.startup || null);
        setLoading(false);
      });
  }, [startupId, session?.access_token]);

  const cfg = getRoleConfig(selectedRole);

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role);
    setStep('form');
  };

  const handleSubmit = async () => {
    if (!session) { setIsAuthOpen(true); return; }
    if (!intro.trim() && !reason.trim()) {
      setError('Please fill in at least one field before submitting.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const validLinks = portfolioLinks.filter((l) => l.trim());
      const res = await fetch(`/api/startups/${startupId}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          intro: `[Applying as: ${selectedRole}]\n${intro}`,
          reason,
          portfolio_links: validLinks,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to submit application');
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const addLink = () => { if (portfolioLinks.length < 3) setPortfolioLinks((p) => [...p, '']); };
  const removeLink = (i: number) => setPortfolioLinks((p) => p.filter((_, idx) => idx !== i));
  const updateLink = (i: number, v: string) => setPortfolioLinks((p) => p.map((l, idx) => idx === i ? v : l));

  // ── Success screen ───────────────────────────────
  if (submitted) {
    return (
      <>
        <Navbar />
        <div className="apply-page-wrapper">
          <div className="apply-page-card">
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}>
                <Check size={28} style={{ color: '#22c55e' }} />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                Application Sent!
              </h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: '1.75rem' }}>
                Your application to <strong style={{ color: 'var(--text-main)' }}>{startup?.name}</strong> as{' '}
                <strong style={{ color: 'var(--text-main)' }}>{selectedRole}</strong> has been submitted.
                The founder will review it and get back to you.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href={`/startups/${startupId}`} className="sc-view-btn">
                  View Startup
                </Link>
                <Link href="/startups" className="sc-view-btn">
                  Explore More
                </Link>
              </div>
            </div>
          </div>
        </div>
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      </>
    );
  }

  // ── Loading ──────────────────────────────────────
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="apply-page-wrapper">
          <div className="apply-page-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
            <Loader2 size={24} className="spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        </div>
      </>
    );
  }

  if (!startup) {
    return (
      <>
        <Navbar />
        <div className="apply-page-wrapper">
          <div className="apply-page-card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <Rocket size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
            <p style={{ color: 'var(--text-muted)' }}>Startup not found.</p>
            <Link href="/startups" className="sc-view-btn" style={{ marginTop: '1rem', display: 'inline-block' }}>← Back</Link>
          </div>
        </div>
      </>
    );
  }

  // ── Main page ────────────────────────────────────
  const lookingFor = startup.looking_for || [];
  const otherRoles = ALL_ROLES.filter((r) => !lookingFor.includes(r));

  return (
    <>
      <Navbar />
      <div className="apply-page-wrapper">
        <div className="apply-page-card">

          {/* Back nav */}
          <div className="apply-page-back">
            <button
              type="button"
              onClick={() => step === 'form' ? setStep('role') : router.back()}
              className="apply-page-back-btn"
            >
              <ArrowLeft size={15} />
              {step === 'form' ? 'Change role' : 'Back'}
            </button>
          </div>

          {/* Startup header */}
          <div className="apply-page-header">
            <div className="apply-page-logo">
              {startup.logo_url
                ? <img src={startup.logo_url} alt={startup.name} />
                : <span>{startup.name.charAt(0).toUpperCase()}</span>
              }
            </div>
            <div>
              <h1 className="apply-page-startup-name">
                {step === 'role' ? `Apply to ${startup.name}` : `Apply as ${selectedRole}`}
              </h1>
              {startup.tagline && (
                <p className="apply-page-startup-tagline">{startup.tagline}</p>
              )}
            </div>
          </div>

          {/* Progress dots */}
          <div className="apply-page-progress">
            <div className={`apply-progress-dot ${step === 'role' ? 'active' : 'done'}`} />
            <div className="apply-progress-line" />
            <div className={`apply-progress-dot ${step === 'form' ? 'active' : ''}`} />
          </div>
          <div className="apply-page-progress-labels">
            <span style={{ color: step === 'role' ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '0.72rem' }}>Select Role</span>
            <span style={{ color: step === 'form' ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '0.72rem' }}>Your Application</span>
          </div>

          {/* ── STEP 1: Role Selection ── */}
          {step === 'role' && (
            <div className="apply-page-body">
              <p className="apply-page-hint">What role are you applying for?</p>

              {lookingFor.length > 0 && (
                <div className="apply-roles-section">
                  <div className="apply-roles-section-label apply-roles-section-label--accent">
                    👋 They're actively looking for
                  </div>
                  {lookingFor.map((role: string) => {
                    const status = roles_statuses[role] || 'Open';
                    const isFilledOrClosed = status === 'Filled' || status === 'Closed';
                    return (
                      <button
                        key={role}
                        type="button"
                        className="apply-role-row apply-role-row--priority"
                        style={isFilledOrClosed ? { opacity: 0.55, cursor: 'not-allowed', background: 'var(--bg-hover)' } : undefined}
                        onClick={() => !isFilledOrClosed && handleRoleSelect(role)}
                      >
                        <div>
                          <div className="apply-role-row-title">
                            {role}
                            {isFilledOrClosed && (
                              <span style={{ marginLeft: '0.5rem', fontSize: '0.65rem', fontWeight: 700, padding: '0.12rem 0.35rem', borderRadius: '4px', background: status === 'Filled' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: status === 'Filled' ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                                {status}
                              </span>
                            )}
                          </div>
                          <div className="apply-role-row-meta">
                            {startup.compensation_type} · {startup.work_type}
                          </div>
                        </div>
                        {isFilledOrClosed ? (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Filled</span>
                        ) : (
                          <ChevronRight size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Application Form ── */}
          {step === 'form' && (
            <div className="apply-page-body">
              {/* Selected role badge */}
              <div className="apply-selected-role-badge">
                <span>Applying as <strong>{selectedRole}</strong></span>
                <button type="button" onClick={() => setStep('role')} className="apply-change-role-btn">
                  Change
                </button>
              </div>

              {isRoleFilledOrClosed && (
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', color: 'var(--accent-danger)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1rem' }}>
                  This position has already been filled.
                </div>
              )}

              {/* Intro */}
              <div className="apply-field">
                <label className="apply-label" htmlFor="apply-intro">{cfg.introLabel}</label>
                <textarea
                  id="apply-intro"
                  className="apply-textarea"
                  placeholder={cfg.introPlaceholder}
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  maxLength={500}
                  rows={4}
                />
                <div className="apply-char-count">{intro.length}/500</div>
              </div>

              {/* Reason */}
              <div className="apply-field">
                <label className="apply-label" htmlFor="apply-reason">{cfg.reasonLabel}</label>
                <textarea
                  id="apply-reason"
                  className="apply-textarea"
                  placeholder={cfg.reasonPlaceholder}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={800}
                  rows={4}
                />
                <div className="apply-char-count">{reason.length}/800</div>
              </div>

              {/* Portfolio */}
              <div className="apply-field">
                <label className="apply-label">{cfg.portfolioLabel}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {portfolioLinks.map((link, i) => (
                    <div key={i} className="apply-portfolio-row">
                      <input
                        type="url"
                        className="apply-portfolio-input"
                        placeholder={
                          selectedRole === 'Developer' ? 'https://github.com/you' :
                          selectedRole === 'Designer' ? 'https://dribbble.com/you' :
                          'https://linkedin.com/in/you'
                        }
                        value={link}
                        onChange={(e) => updateLink(i, e.target.value)}
                      />
                      <button type="button" className="apply-portfolio-remove" onClick={() => removeLink(i)} aria-label="Remove">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {portfolioLinks.length < 3 && (
                    <button type="button" className="apply-add-portfolio" onClick={addLink}>
                      <Plus size={14} /> Add Link
                    </button>
                  )}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="apply-error-msg">{error}</div>
              )}

              {/* Submit */}
              <button
                type="button"
                className="apply-submit-btn"
                onClick={handleSubmit}
                disabled={submitting || isRoleFilledOrClosed}
                style={isRoleFilledOrClosed ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                {submitting
                  ? <><Loader2 size={16} className="spin" /> Submitting…</>
                  : <><Send size={15} /> Submit Application</>
                }
              </button>

              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                Your profile and application will be shared with the founder.
              </p>
            </div>
          )}

        </div>
      </div>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}
