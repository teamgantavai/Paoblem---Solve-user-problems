'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Rocket, ArrowLeft, Loader2, Check,
  Plus, X
} from 'lucide-react';

import Navbar from '@/components/Navbar';
import Avatar from '@/components/Avatar';
import ImageUploader from '@/components/ImageUploader';
import { supabase } from '@/lib/supabase';
import { CreateStartupPayload, StartupStage, CompensationType, WorkType } from '@/lib/types';
import {
  STARTUP_STAGES, LOOKING_FOR_OPTIONS, SKILL_OPTIONS,
  INDUSTRY_OPTIONS, STAGE_COLORS
} from '@/lib/startupMatching';

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
  } catch (e) { }
  return { funding_stage: value, hiring_status: 'Hiring', roles_statuses: {} as Record<string, string> };
}

export default function CreateStartupClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get('edit');

  const [session, setSession] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [stage, setStage] = useState<StartupStage>('Idea');
  const [industry, setIndustry] = useState('');
  const [fundingStage, setFundingStage] = useState('');
  const [hiringStatus, setHiringStatus] = useState('Hiring');
  const [rolesStatuses, setRolesStatuses] = useState<Record<string, string>>({});
  const [website, setWebsite] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [compensationType, setCompensationType] = useState<CompensationType>('Equity');
  const [workType, setWorkType] = useState<WorkType>('Remote');
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [deadline, setDeadline] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [customSkill, setCustomSkill] = useState('');
  const [customIndustry, setCustomIndustry] = useState('');

  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (!s) {
        router.push('/');
        return;
      }
      supabase
        .from('profiles')
        .select('avatar_url, full_name, username')
        .eq('id', s.user.id)
        .single()
        .then(({ data }) => {
          if (data) setProfile(data);
        });
    });
  }, [router]);

  useEffect(() => {
    if (!editId || !session?.access_token) return;
    fetch(`/api/startups/${editId}`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.startup) {
          const s = data.startup;
          setName(s.name || '');
          setTagline(s.tagline || '');
          setDescription(s.description || '');
          setStage(s.stage || 'Idea');

          if (s.industry && !INDUSTRY_OPTIONS.includes(s.industry)) {
            setIndustry('Other');
            setCustomIndustry(s.industry);
          } else {
            setIndustry(s.industry || '');
          }

          if (s.funding_stage) {
            const parsed = parseFundingStage(s.funding_stage);
            setFundingStage(parsed.funding_stage);
            setHiringStatus(parsed.hiring_status);
            setRolesStatuses(parsed.roles_statuses);
          } else {
            setFundingStage('');
            setHiringStatus('Hiring');
            setRolesStatuses({});
          }
          setWebsite(s.website || '');
          setLogoUrl(s.logo_url || '');
          setCompensationType(s.compensation_type || 'Equity');
          setWorkType(s.work_type || 'Remote');
          setLookingFor(s.looking_for || []);
          setRequiredSkills(s.required_skills || []);
          setDeadline(s.deadline ? s.deadline.split('T')[0] : '');
        }
      })
      .catch((err) => console.error('Error fetching startup for editing:', err));
  }, [editId, session?.access_token]);

  const toggleLookingFor = (role: string) => {
    setLookingFor((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const toggleSkill = (skill: string) => {
    setRequiredSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const addCustomRole = () => {
    const r = customRole.trim();
    if (r && !lookingFor.includes(r)) setLookingFor((p) => [...p, r]);
    setCustomRole('');
  };

  const addCustomSkill = () => {
    const s = customSkill.trim();
    if (s && !requiredSkills.includes(s)) setRequiredSkills((p) => [...p, s]);
    setCustomSkill('');
  };

  const handleSubmit = async () => {
    if (!session?.access_token) { router.push('/'); return; }
    if (!name.trim()) { setError('Startup name is required'); return; }
    if (!stage) { setError('Please select a stage'); return; }
    if (lookingFor.length === 0) { setError('Add at least one role you are looking for'); return; }

    setError('');
    setSubmitting(true);

    const packagedFundingStage = JSON.stringify({
      funding_stage: fundingStage?.trim() || '',
      hiring_status: hiringStatus,
      roles_statuses: rolesStatuses
    });

    const payload: CreateStartupPayload = {
      name: name.trim(),
      tagline: tagline.trim(),
      description: description.trim(),
      stage,
      industry: industry === 'Other' ? customIndustry.trim() : (industry || undefined),
      funding_stage: packagedFundingStage,
      website: website.trim() || undefined,
      logo_url: logoUrl || undefined,
      banner_url: undefined,
      compensation_type: compensationType,
      work_type: workType,
      looking_for: lookingFor,
      required_skills: requiredSkills,
      deadline: deadline || undefined,
    };

    try {
      const method = editId ? 'PATCH' : 'POST';
      const url = editId ? `/api/startups/${editId}` : '/api/startups';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create startup');
      }

      const data = await res.json();
      setSuccess(true);
      setTimeout(() => {
        router.push(`/startups/${data.startup?.id || ''}`);
      }, 1200);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const userFullName = profile?.full_name || profile?.username || session?.user?.email?.split('@')[0] || 'Founder';
  const userAvatarUrl = profile?.avatar_url || session?.user?.user_metadata?.avatar_url;

  if (!session) {
    return (
      <>
        <Navbar />
        <main className="create-post-shell">
          <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="spin" />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="create-post-shell">
        <form className="create-post-panel" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>

          {/* HEADER SECTION */}
          <header className="cp-modern-header">
            <button className="cp-clean-icon-btn" type="button" onClick={() => router.back()} aria-label="Go back">
              <ArrowLeft size={19} />
            </button>
            <div className="cp-author-block">
              <Avatar src={userAvatarUrl} name={userFullName} size={42} />
              <div>
                <h1 style={{ fontSize: '1.05rem', fontWeight: 800 }}>{editId ? 'Edit Startup' : 'Create a Startup'}</h1>
                <p>by {userFullName}</p>
              </div>
            </div>
          </header>

          {/* MAIN FORM BODY */}
          <div className="cp-form-body">

            {/* ── Basic Info ── */}
            <div style={{ marginTop: '0.25rem', marginBottom: '0.25rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Basic Information</h3>
            </div>

            <div className="cp-field-group">
              <label className="cp-input-label" htmlFor="startup-name">Startup Name *</label>
              <input
                id="startup-name"
                type="text"
                className="cp-text-input"
                placeholder="e.g. Paoblem, Stripe, Figma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
              />
            </div>

            <div className="cp-field-group">
              <label className="cp-input-label" htmlFor="startup-tagline">One-line Tagline</label>
              <input
                id="startup-tagline"
                type="text"
                className="cp-text-input"
                placeholder="e.g. The problem-solving platform for builders"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                maxLength={200}
              />
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '-4px' }}>
                {tagline.length}/200
              </div>
            </div>

            <div className="cp-field-group">
              <label className="cp-input-label" htmlFor="startup-description">Description</label>
              <textarea
                id="startup-description"
                className="cp-text-input"
                style={{ minHeight: '120px', padding: '12px 16px', resize: 'vertical' }}
                placeholder="Tell potential team members about your vision, what problem you're solving, and what makes your startup exciting..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
              />
            </div>

            {/* Website & Industry */}
            <div className="cp-dropdowns-row">
              <div className="cp-field-group">
                <label className="cp-input-label" htmlFor="startup-website">Website URL</label>
                <input
                  id="startup-website"
                  type="text"
                  className="cp-text-input"
                  placeholder="https://yourstartup.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
              <div className="cp-field-group">
                <label className="cp-input-label" htmlFor="startup-industry">Industry</label>
                <select
                  id="startup-industry"
                  className="cp-select-dropdown"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                >
                  <option value="" disabled>Select industry...</option>
                  {INDUSTRY_OPTIONS.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
            </div>

            {industry === 'Other' && (
              <div className="cp-field-group" style={{ animation: 'fadeIn 200ms ease' }}>
                <label className="cp-input-label" htmlFor="startup-custom-industry">Which Industry?</label>
                <input
                  id="startup-custom-industry"
                  type="text"
                  className="cp-text-input"
                  placeholder="Please specify your industry..."
                  value={customIndustry}
                  onChange={(e) => setCustomIndustry(e.target.value)}
                  required
                />
              </div>
            )}

            {/* Stage & Compensation */}
            <div className="cp-dropdowns-row">
              <div className="cp-field-group">
                <label className="cp-input-label" htmlFor="startup-stage">Stage</label>
                <select
                  id="startup-stage"
                  className="cp-select-dropdown"
                  value={stage}
                  onChange={(e) => setStage(e.target.value as StartupStage)}
                >
                  {STARTUP_STAGES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="cp-field-group">
                <label className="cp-input-label" htmlFor="startup-compensation">Compensation</label>
                <select
                  id="startup-compensation"
                  className="cp-select-dropdown"
                  value={compensationType}
                  onChange={(e) => setCompensationType(e.target.value as CompensationType)}
                >
                  {['Equity', 'Paid', 'Internship', 'Volunteer', 'Revenue Share'].map((comp) => (
                    <option key={comp} value={comp}>{comp}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Work Preference */}
            <div className="cp-field-group">
              <label className="cp-input-label" htmlFor="startup-work-type">Work Preference</label>
              <select
                id="startup-work-type"
                className="cp-select-dropdown"
                value={workType}
                onChange={(e) => setWorkType(e.target.value as WorkType)}
              >
                {['Remote', 'Hybrid', 'On-site'].map((wt) => (
                  <option key={wt} value={wt}>{wt}</option>
                ))}
              </select>
            </div>

            {/* ── Funding & Hiring ── */}
            <div style={{ marginTop: '0.75rem', marginBottom: '0.25rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Funding & Recruitment</h3>
            </div>

            <div className="cp-dropdowns-row" style={{ marginBottom: '1rem' }}>
              <div className="cp-field-group">
                <label className="cp-input-label" htmlFor="startup-funding-stage">Funding Stage</label>
                <input
                  id="startup-funding-stage"
                  type="text"
                  className="cp-text-input"
                  placeholder="e.g. Pre-seed, Seed, Bootstrapped"
                  value={fundingStage}
                  onChange={(e) => setFundingStage(e.target.value)}
                />
              </div>
              <div className="cp-field-group">
                <label className="cp-input-label" htmlFor="startup-hiring-status">Hiring Status</label>
                <select
                  id="startup-hiring-status"
                  className="cp-select-dropdown"
                  value={hiringStatus}
                  onChange={(e) => setHiringStatus(e.target.value)}
                >
                  <option value="Hiring">Hiring</option>
                  <option value="Urgent Hiring">Urgent Hiring</option>
                  <option value="Hiring Soon">Hiring Soon</option>
                  <option value="Positions Filled">Positions Filled</option>
                  <option value="Not Hiring">Not Hiring</option>
                  <option value="Always Hiring">Always Hiring</option>
                </select>
              </div>
            </div>

            {/* ── Team Requirements ── */}
            <div style={{ marginTop: '0.75rem', marginBottom: '0.25rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Team Requirements</h3>
            </div>

            <div className="cp-field-group">
              <label className="cp-input-label">Roles You Are Looking For *</label>
              <div className="sc-chips-row" style={{ flexWrap: 'wrap', gap: '0.35rem', margin: '0.25rem 0 0.5rem 0' }}>
                {LOOKING_FOR_OPTIONS.map((role) => (
                  <button
                    key={role}
                    type="button"
                    className={`csf-option-chip ${lookingFor.includes(role) ? 'selected' : ''}`}
                    onClick={() => toggleLookingFor(role)}
                  >
                    {lookingFor.includes(role) && <Check size={11} style={{ marginRight: '0.2rem', display: 'inline', verticalAlign: 'middle' }} />}
                    {role}
                  </button>
                ))}
              </div>

              {/* Custom Role Input */}
              <div style={{ display: 'flex', gap: '0.45rem' }}>
                <input
                  type="text"
                  className="cp-text-input"
                  placeholder="Add custom role..."
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomRole(); } }}
                  style={{ flex: 1, minHeight: '38px', borderRadius: '8px' }}
                />
                <button type="button" className="sc-view-btn" onClick={addCustomRole} style={{ flexShrink: 0, padding: '0 0.85rem' }}>
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>

            <div className="cp-field-group">
              <label className="cp-input-label">Required Skills</label>
              <div className="sc-chips-row" style={{ flexWrap: 'wrap', gap: '0.35rem', margin: '0.25rem 0 0.5rem 0' }}>
                {SKILL_OPTIONS.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    className={`csf-option-chip ${requiredSkills.includes(skill) ? 'selected' : ''}`}
                    onClick={() => toggleSkill(skill)}
                  >
                    {requiredSkills.includes(skill) && <Check size={11} style={{ marginRight: '0.2rem', display: 'inline', verticalAlign: 'middle' }} />}
                    {skill}
                  </button>
                ))}
              </div>

              {/* Custom Skill Input */}
              <div style={{ display: 'flex', gap: '0.45rem' }}>
                <input
                  type="text"
                  className="cp-text-input"
                  placeholder="Add custom skill..."
                  value={customSkill}
                  onChange={(e) => setCustomSkill(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill(); } }}
                  style={{ flex: 1, minHeight: '38px', borderRadius: '8px' }}
                />
                <button type="button" className="sc-view-btn" onClick={addCustomSkill} style={{ flexShrink: 0, padding: '0 0.85rem' }}>
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>

            {/* ── Branding ── */}
            <div style={{ marginTop: '0.75rem', marginBottom: '0.25rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Branding (Optional)</h3>
            </div>

            <div className="cp-field-group">
              <label className="cp-input-label" htmlFor="startup-logo">Logo Image</label>
              <div style={{ marginTop: '0.25rem' }}>
                <ImageUploader
                  imageUrls={logoUrl ? [logoUrl] : []}
                  onChange={(urls) => setLogoUrl(urls[0] || '')}
                  maxFiles={1}
                />
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <input
                  id="startup-logo"
                  type="url"
                  className="cp-text-input"
                  placeholder="Or paste direct logo URL (https://yourstartup.com/logo.png)..."
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
              </div>
            </div>

            {/* Error and Actions */}
            <div className="cp-field-group" style={{ marginTop: '1.25rem' }}>
              {error && (
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', color: 'var(--accent-danger)', fontSize: '0.83rem', marginBottom: '1rem' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || success}
                style={{
                  width: '100%',
                  minHeight: '48px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, var(--accent-primary) 0%, #1d4ed8 100%)',
                  color: 'white',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: (submitting || success) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
                  transition: 'all 200ms ease',
                  opacity: (submitting || success) ? 0.75 : 1
                }}
              >
                {success ? (
                  <><Check size={16} /> Startup Created!</>
                ) : submitting ? (
                  <><Loader2 size={16} className="spin" /> Publishing…</>
                ) : (
                  <><Rocket size={16} /> {editId ? 'Save Changes' : 'Launch Startup'}</>
                )}
              </button>
            </div>

          </div>
        </form>
      </main>
    </>
  );
}
