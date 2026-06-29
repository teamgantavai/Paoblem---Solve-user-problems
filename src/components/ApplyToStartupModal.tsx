'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, ChevronRight, Briefcase, MapPin, Globe, Award, FileText } from 'lucide-react';
import { Startup } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

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

interface Props {
  startup: Pick<Startup, 'id' | 'name' | 'tagline' | 'looking_for' | 'required_skills' | 'compensation_type' | 'work_type' | 'funding_stage'>;
  initialRole?: string;
  onClose: () => void;
  onSubmit: (intro: string, reason: string, portfolioLinks: string[], extraData?: any) => Promise<void>;
}

export default function ApplyToStartupModal({ startup, initialRole, onClose, onSubmit }: Props) {
  const [step, setStep] = useState<number>(initialRole ? 2 : 1);
  const [selectedRole, setSelectedRole] = useState(initialRole || '');
  
  // Form fields
  const [yearsExp, setYearsExp] = useState('');
  const [aboutYou, setAboutYou] = useState('');
  const [projects, setProjects] = useState('');
  const [github, setGithub] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [website, setWebsite] = useState('');
  const [resume, setResume] = useState('');
  const [availability, setAvailability] = useState('Full Time');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const { roles_statuses } = parseFundingStage(startup.funding_stage || null);
  const isRoleFilledOrClosed = selectedRole ? (roles_statuses[selectedRole] === 'Filled' || roles_statuses[selectedRole] === 'Closed') : false;

  // Auto-select role if there's only one open role in the startup and no initialRole is set
  const availableRoles = startup.looking_for || [];

  useEffect(() => {
    if (!initialRole && availableRoles.length === 1) {
      const singleRole = availableRoles[0];
      const rStatus = roles_statuses[singleRole] || 'Open';
      if (rStatus !== 'Filled' && rStatus !== 'Closed') {
        setSelectedRole(singleRole);
        setStep(2);
      }
    }
  }, [initialRole, availableRoles, roles_statuses]);

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role);
    setStep(2);
  };

  // Check if form is modified to prevent accidental close
  const isDirty = () => {
    return (
      yearsExp.trim().length > 0 ||
      aboutYou.trim().length > 0 ||
      projects.trim().length > 0 ||
      github.trim().length > 0 ||
      linkedin.trim().length > 0 ||
      website.trim().length > 0 ||
      resume.trim().length > 0
    );
  };

  const handleClose = () => {
    if (isDirty() && step < 4) {
      setShowCloseConfirm(true);
      return;
    }
    onClose();
  };

  const validateStep2 = () => {
    if (!yearsExp.trim()) return 'Please enter your years of experience.';
    if (aboutYou.trim().length < 30) return 'Tell us about yourself (minimum 30 characters required).';
    return '';
  };

  const handleStep2Next = () => {
    const err = validateStep2();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setStep(3);
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      // Intro represents the selected role so we can easily search/match it on backend
      const finalIntro = `[Applying as: ${selectedRole}]`;
      
      // Serialize all fields securely into the reason column as a structured JSON object
      const payloadReason = JSON.stringify({
        experience_years: yearsExp.trim(),
        about_you: aboutYou.trim(),
        projects: projects.trim() || null,
        availability: availability,
        resume: resume.trim() || null
      });

      const portfolioLinks = [github, linkedin, website].filter(Boolean);

      await onSubmit(finalIntro, payloadReason, portfolioLinks, {
        role: selectedRole
      });
      setStep(4);
    } catch (err: any) {
      // User-friendly error message, log the actual error for developers
      console.error('[Application submission failed]:', err);
      setError(err.message || 'We could not submit your application. Please check your network and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="apply-modal-backdrop" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="apply-modal" role="dialog" aria-modal="true" style={{ maxWidth: step === 4 ? '460px' : '540px' }}>
        
        {/* Header */}
        <div className="apply-modal-header">
          <div className="apply-modal-header-left">
            {step > 1 && step < 4 && (
              <button
                type="button"
                onClick={() => {
                  if (availableRoles.length === 1 && step === 2) {
                    // Do nothing or let them go back to step 1 (where they see the single role)
                    setStep(1);
                  } else {
                    setStep(step - 1);
                  }
                }}
                className="apply-back-btn sc-view-btn"
              >
                ← Back
              </button>
            )}
            <div>
              <h2 className="apply-modal-title">
                {step === 4 ? 'All Set!' : `Apply to ${startup.name}`}
              </h2>
              {step < 4 && (
                <p className="apply-modal-subtitle">
                  Step {step} of 3: {step === 1 ? 'Choose Role' : step === 2 ? 'Fill Details' : 'Review'}
                </p>
              )}
            </div>
          </div>
          <button className="apply-modal-close" onClick={handleClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="apply-modal-body" style={{ maxHeight: 'calc(80vh - 120px)', overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
          
          {/* STEP 1: SELECT ROLE */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Please select the position you are applying for.
              </p>
              {availableRoles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                  <Briefcase size={28} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>There are no open roles listed for this startup at the moment.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {availableRoles.map((role) => {
                    const status = roles_statuses[role] || 'Open';
                    const isFilledOrClosed = status === 'Filled' || status === 'Closed';
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => !isFilledOrClosed && handleRoleSelect(role)}
                        className="role-card"
                        style={{ textAlign: 'left', cursor: isFilledOrClosed ? 'not-allowed' : 'pointer', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '12px', opacity: isFilledOrClosed ? 0.55 : 1, background: isFilledOrClosed ? 'var(--bg-hover)' : 'transparent' }}
                      >
                        <div className="role-card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <div className="role-card-title" style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>{role}</div>
                          {isFilledOrClosed ? (
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '4px', background: status === 'Filled' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: status === 'Filled' ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                              {status}
                            </span>
                          ) : (
                            <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.65rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          <span>• {startup.work_type || 'Remote'}</span>
                          <span>• {startup.compensation_type || 'Equity'}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: APPLICATION FORM */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              
              <div className="apply-role-bar">
                <span className="apply-role-text">
                  Applying for: <strong style={{ color: 'var(--text-main)' }}>{selectedRole}</strong>
                </span>
                {availableRoles.length > 1 && (
                  <button type="button" onClick={() => setStep(1)} className="apply-role-change-btn">
                    Change Role
                  </button>
                )}
              </div>

              {isRoleFilledOrClosed && (
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', color: 'var(--accent-danger)', fontSize: '0.8rem', fontWeight: 600 }}>
                  This position has already been filled.
                </div>
              )}

              {/* Years of Experience */}
              <div className="apply-field">
                <label className="apply-label">Years of Experience</label>
                <input
                  type="text"
                  className="apply-portfolio-input"
                  placeholder="e.g. 3 years"
                  value={yearsExp}
                  onChange={(e) => setYearsExp(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              {/* About You */}
              <div className="apply-field">
                <label className="apply-label">Tell us about yourself and why you'd be a great fit for this role. (min 30 chars)</label>
                <textarea
                  className="apply-textarea"
                  rows={4}
                  placeholder="Tell the founder about your background, skills, and why you are excited to build this startup together..."
                  value={aboutYou}
                  onChange={(e) => setAboutYou(e.target.value)}
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                  {aboutYou.length} chars (30 min)
                </div>
              </div>

              {/* Relevant Projects */}
              <div className="apply-field">
                <label className="apply-label">Relevant Projects (Optional)</label>
                <textarea
                  className="apply-textarea"
                  rows={3}
                  placeholder="Describe startup experience, open-source work, freelance work, or personal projects..."
                  value={projects}
                  onChange={(e) => setProjects(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Portfolio Links */}
              <div className="apply-field">
                <label className="apply-label">Portfolio & Social Links (Optional)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input type="text" className="apply-portfolio-input" placeholder="GitHub Profile URL" value={github} onChange={(e) => setGithub(e.target.value)} style={{ width: '100%' }} />
                  <input type="text" className="apply-portfolio-input" placeholder="LinkedIn Profile URL" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} style={{ width: '100%' }} />
                  <input type="text" className="apply-portfolio-input" placeholder="Portfolio Website" value={website} onChange={(e) => setWebsite(e.target.value)} style={{ width: '100%' }} />
                </div>
              </div>

              {/* Availability */}
              <div className="apply-field">
                <label className="apply-label">Availability</label>
                <select
                  className="apply-portfolio-input"
                  style={{ width: '100%', height: '36px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '0.8rem', padding: '0 0.5rem' }}
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                >
                  <option value="Full Time">Full Time</option>
                  <option value="Part Time">Part Time</option>
                  <option value="Weekends">Weekends</option>
                  <option value="Flexible">Flexible</option>
                </select>
              </div>

              {/* Resume */}
              <div className="apply-field">
                <label className="apply-label">Resume Link (Optional)</label>
                <input
                  type="text"
                  className="apply-portfolio-input"
                  placeholder="Link to PDF (Google Drive, Dropbox, etc.)"
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              {error && <div style={{ color: 'var(--accent-danger)', fontSize: '0.78rem', fontWeight: 600 }}>{error}</div>}

              <button
                type="button"
                className="apply-submit-btn"
                onClick={handleStep2Next}
                disabled={isRoleFilledOrClosed}
                style={isRoleFilledOrClosed ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                Review Application
              </button>

            </div>
          )}

          {/* STEP 3: REVIEW SUMMARY */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Please review your application summary details below before submitting.
              </p>

              <div style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Selected Position</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.15rem' }}>{selectedRole}</div>
                  </div>
                  {availableRoles.length > 1 && (
                    <button type="button" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.72rem', textDecoration: 'underline' }}>
                      Change
                    </button>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Experience</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', marginTop: '0.15rem' }}>{yearsExp}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>About You</div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-body)', lineHeight: 1.5, margin: '0.15rem 0 0', whiteSpace: 'pre-wrap' }}>
                    {aboutYou}
                  </p>
                </div>

                {projects && (
                  <div>
                    <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Relevant Projects</div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-body)', lineHeight: 1.5, margin: '0.15rem 0 0', whiteSpace: 'pre-wrap' }}>
                      {projects}
                    </p>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Availability</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 600, marginTop: '0.15rem' }}>{availability}</div>
                  </div>
                  {resume && (
                    <div>
                      <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Resume</div>
                      <a href={resume} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', textDecoration: 'underline', marginTop: '0.15rem' }}>
                        <FileText size={12} /> View Resume
                      </a>
                    </div>
                  )}
                </div>

                {(github || linkedin || website) && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>Portfolios</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {github && <a href={github} target="_blank" rel="noreferrer" className="role-skill-chip" style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Globe size={11} /> GitHub</a>}
                      {linkedin && <a href={linkedin} target="_blank" rel="noreferrer" className="role-skill-chip" style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Globe size={11} /> LinkedIn</a>}
                      {website && <a href={website} target="_blank" rel="noreferrer" className="role-skill-chip" style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Globe size={11} /> Website</a>}
                    </div>
                  </div>
                )}
              </div>

              {error && <div style={{ color: 'var(--accent-danger)', fontSize: '0.78rem', fontWeight: 600 }}>{error}</div>}

              <button
                type="button"
                className="apply-submit-btn"
                onClick={handleFinalSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <><Loader2 size={16} className="spin" /> Submitting…</>
                ) : (
                  <><Check size={16} /> Submit Application</>
                )}
              </button>
            </div>
          )}

          {/* STEP 4: SUBMIT SUCCESS */}
          {step === 4 && (
            <div style={{ textAlign: 'center', padding: '1rem 0.5rem' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem'
              }}>
                <Check size={28} style={{ color: 'var(--accent-success)' }} />
              </div>

              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
                🎉 Application Submitted Successfully!
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: '1.75rem' }}>
                Your application has been sent to the founder. You'll receive an email and an in-app notification when your application is reviewed.
              </p>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button type="button" onClick={onClose} className="sc-view-btn" style={{ padding: '0.55rem 1.25rem' }}>
                  View Startup
                </button>
                <Link href="/" className="apply-submit-btn" style={{ width: 'auto', padding: '0.55rem 1.25rem' }}>
                  Back to Feed
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>

      {showCloseConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
        }} onClick={(e) => e.stopPropagation()}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '24px',
            padding: '2rem',
            width: '90%',
            maxWidth: '360px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            textAlign: 'center',
            animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.6rem', letterSpacing: '-0.02em' }}>
              Unsaved Changes?
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              You have unsaved changes. Are you sure you want to discard them and close?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="sc-view-btn"
                style={{ padding: '0.6rem 1rem', fontSize: '0.825rem', fontWeight: 600, width: '100%' }}
                onClick={() => setShowCloseConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="apply-submit-btn"
                style={{ padding: '0.6rem 1rem', fontSize: '0.825rem', fontWeight: 600, background: 'var(--accent-danger, #ef4444)', border: 'none', color: '#fff', width: '100%' }}
                onClick={() => {
                  setShowCloseConfirm(false);
                  onClose();
                }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
