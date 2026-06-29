'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Rocket, Globe, Users, Clock, MapPin, BadgeCheck,
  ArrowLeft, Loader2, ExternalLink, Plus,
  ChevronRight, Check, X, Sparkles, Briefcase, Calendar, MessageCircle, FileText, Trash2
} from 'lucide-react';

import Navbar from '@/components/Navbar';
import SidebarLeft from '@/components/SidebarLeft';
import SidebarRight from '@/components/SidebarRight';
import ApplyToStartupModal from '@/components/ApplyToStartupModal';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { Startup, StartupApplication, StartupMember, StartupUpdate } from '@/lib/types';
import { STAGE_COLORS, COMPENSATION_COLORS, formatMatchScore, getMatchColor } from '@/lib/startupMatching';

const AuthModal = dynamic(() => import('./AuthModal'), { ssr: false });

type Tab = 'overview' | 'about' | 'roles' | 'team' | 'updates' | 'applicants';

interface RecommendedPerson {
  user_id: string;
  match_score: number;
  match_reasons: string[];
  profile: any;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const HIRING_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  'Hiring': { label: '🟢 Hiring', bg: 'rgba(34, 197, 94, 0.08)', text: 'var(--accent-success)', border: 'rgba(34, 197, 94, 0.25)' },
  'Urgent Hiring': { label: '🔥 Urgent Hiring', bg: 'rgba(239, 68, 68, 0.08)', text: 'var(--accent-danger)', border: 'rgba(239, 68, 68, 0.25)' },
  'Hiring Soon': { label: '🟡 Hiring Soon', bg: 'rgba(245, 158, 11, 0.08)', text: 'var(--accent-warning)', border: 'rgba(245, 158, 11, 0.25)' },
  'Positions Filled': { label: '✅ Positions Filled', bg: 'var(--bg-hover)', text: 'var(--text-muted)', border: 'var(--border-color)' },
  'Not Hiring': { label: '⏸️ Not Hiring', bg: 'var(--bg-hover)', text: 'var(--text-muted)', border: 'var(--border-color)' },
  'Always Hiring': { label: '🚀 Always Hiring', bg: 'rgba(37, 99, 235, 0.08)', text: 'var(--accent-primary)', border: 'rgba(37, 99, 235, 0.25)' }
};

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

function renderHiringBadge(status: string) {
  const cfg = HIRING_STATUS_CONFIG[status] || HIRING_STATUS_CONFIG['Hiring'];
  return (
    <span className="hiring-status-badge" style={{
      fontSize: '0.68rem',
      fontWeight: 600,
      padding: '0.18rem 0.5rem',
      borderRadius: '6px',
      background: cfg.bg,
      color: cfg.text,
      border: `1px solid ${cfg.border}`,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.2rem',
      whiteSpace: 'nowrap'
    }}>
      {cfg.label}
    </span>
  );
}

interface Props { startupId: string; }

export default function StartupDetailClient({ startupId }: Props) {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [startup, setStartup] = useState<Startup | null>(null);
  const [members, setMembers] = useState<StartupMember[]>([]);
  const [updates, setUpdates] = useState<StartupUpdate[]>([]);
  const [applications, setApplications] = useState<StartupApplication[]>([]);
  const [recommendedPeople, setRecommendedPeople] = useState<RecommendedPerson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [hasApplied, setHasApplied] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [selectedApplyRole, setSelectedApplyRole] = useState<string | undefined>(undefined);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [appLoading, setAppLoading] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const res = await fetch(`/api/startups/${startupId}`, {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });
      if (!res.ok) { setIsLoading(false); return; }
      const data = await res.json();
      setStartup(data.startup);
      setMembers(data.members || []);
      setUpdates(data.updates || []);
      setRecommendedPeople(data.recommendedPeople || []);
      setHasApplied(data.startup?.has_applied || false);
      setIsLoading(false);
    }
    load();
  }, [startupId, session?.access_token]);

  // Load applicants for founder
  useEffect(() => {
    if (!startup || !session?.access_token || session.user?.id !== startup.founder_id) return;
    fetch(`/api/startups/${startup.id}/applications`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).then((r) => r.ok ? r.json() : { applications: [] })
      .then((d) => setApplications(d.applications || []));
  }, [startup, session]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };



  const handleApply = async (intro: string, reason: string, portfolioLinks: string[], extraData?: any) => {
    if (!session) { setIsAuthOpen(true); return; }
    const res = await fetch(`/api/startups/${startupId}/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        intro,
        reason,
        portfolio_links: portfolioLinks,
        role: extraData?.role || ''
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error || 'Failed to apply');
    }
    setHasApplied(true);
    setApplyOpen(false);
    showToast('✓ Application submitted!');
  };

  const handleApplicationAction = async (applicationId: string, status: 'accepted' | 'rejected') => {
    if (!session?.access_token) return;
    setAppLoading(applicationId);
    const res = await fetch(`/api/startups/${startupId}/applications`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ application_id: applicationId, status }),
    });
    if (res.ok) {
      if (status === 'rejected') {
        setApplications((prev) => prev.filter((app) => app.id !== applicationId));
        showToast('✓ Application rejected');
      } else {
        setApplications((prev) =>
          prev.map((app) => app.id === applicationId ? { ...app, status } : app)
        );
        showToast('✓ Applicant accepted!');
        
        // Retrieve the role name from the application intro metadata
        const acceptedApp = applications.find(app => app.id === applicationId);
        if (acceptedApp && acceptedApp.intro) {
          const match = acceptedApp.intro.match(/\[Applying as:\s*(.*?)\]/);
          const roleName = match ? match[1].trim() : null;
          if (roleName) {
            setTimeout(() => {
              const confirmFill = window.confirm(
                `This candidate has been accepted.\n\nWould you like to mark the role "${roleName}" as "Filled"?\n\nClick OK for "Yes, Mark as Filled" or Cancel for "Keep Hiring".`
              );
              if (confirmFill) {
                handleUpdateRoleStatus(roleName, 'Filled');
              }
            }, 500);
          }
        }
      }
    }
    setAppLoading(null);
  };

  const handleChatWithApplicant = async (recipientId: string, recipientName: string, recipientAvatar?: string, recipientUsername?: string) => {
    if (!session?.access_token) return;
    if (session.user?.id === recipientId) {
      showToast('Cannot chat with yourself');
      return;
    }
    
    window.dispatchEvent(new CustomEvent('top-loader:start'));
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          recipientId,
          startOnly: true
        })
      });
      if (!res.ok) throw new Error('Could not start chat');
      const data = await res.json();
      
      const params = new URLSearchParams();
      params.set('conversationId', data.conversationId);
      params.set('partnerId', recipientId);
      if (recipientName) params.set('partnerName', recipientName);
      if (recipientAvatar) params.set('partnerAvatar', recipientAvatar);
      if (recipientUsername) params.set('partnerUsername', recipientUsername);

      router.push(`/chats?${params.toString()}`);
    } catch (error) {
      console.error(error);
      showToast('Failed to start chat.');
      window.dispatchEvent(new CustomEvent('top-loader:finish'));
    }
  };

  const handleUpdateHiringStatus = async (newStatus: string) => {
    if (!startup || !session?.access_token) return;
    try {
      const parsed = parseFundingStage(startup.funding_stage);
      const updatedFundingStage = JSON.stringify({
        funding_stage: parsed.funding_stage,
        hiring_status: newStatus,
        roles_statuses: parsed.roles_statuses
      });
      
      const res = await fetch(`/api/startups/${startupId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ funding_stage: updatedFundingStage })
      });
      if (res.ok) {
        setStartup(prev => {
          if (!prev) return null;
          return { ...prev, funding_stage: updatedFundingStage };
        });
        showToast('✓ Hiring status updated!');
      }
    } catch (e) {
      showToast('Failed to update status');
    }
  };

  const handleUpdateRoleStatus = async (roleName: string, roleStatus: string) => {
    if (!startup || !session?.access_token) return;
    try {
      const parsed = parseFundingStage(startup.funding_stage);
      const updatedRolesStatuses = {
        ...parsed.roles_statuses,
        [roleName]: roleStatus
      };
      
      // Auto-compute main status if all are filled
      let newHiringStatus = parsed.hiring_status;
      const allRoles = startup.looking_for || [];
      const allFilled = allRoles.length > 0 && allRoles.every(r => updatedRolesStatuses[r] === 'Filled');
      if (allFilled) {
        newHiringStatus = 'Positions Filled';
      }

      const updatedFundingStage = JSON.stringify({
        funding_stage: parsed.funding_stage,
        hiring_status: newHiringStatus,
        roles_statuses: updatedRolesStatuses
      });
      
      const res = await fetch(`/api/startups/${startupId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ funding_stage: updatedFundingStage })
      });
      if (res.ok) {
        setStartup(prev => {
          if (!prev) return null;
          return { ...prev, funding_stage: updatedFundingStage };
        });
        showToast(`✓ Status for ${roleName} updated!`);
      }
    } catch (e) {
      showToast('Failed to update role status');
    }
  };

  const handleDeleteStartup = async () => {
    if (!startup || !session?.access_token) return;
    
    const confirmed = window.confirm(
      "Delete Startup?\n\nThis action is permanent and cannot be undone."
    );
    if (!confirmed) return;
    
    try {
      const res = await fetch(`/api/startups/${startupId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      if (res.ok) {
        showToast('Startup deleted successfully.');
        setTimeout(() => {
          router.push('/');
        }, 1000);
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'Failed to delete startup');
      }
    } catch (err: any) {
      console.error('[delete]', err);
      showToast('Error deleting startup');
    }
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="main-content">
          <SidebarLeft />
          <div className="center-feed">
            <div className="startup-detail-layout">
              <div style={{ height: '2rem', width: '60px', background: 'var(--bg-hover)', borderRadius: '6px', margin: '1rem 0 0.5rem', opacity: 0.6 }} />
              <div style={{ width: '100%', height: '180px', background: 'var(--bg-hover)', borderRadius: '12px', opacity: 0.6 }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '12px', background: 'var(--bg-hover)', opacity: 0.6 }} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ width: '90px', height: '34px', borderRadius: '8px', background: 'var(--bg-hover)', opacity: 0.6 }} />
                  <div style={{ width: '110px', height: '34px', borderRadius: '8px', background: 'var(--bg-hover)', opacity: 0.6 }} />
                </div>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ height: '28px', width: '55%', background: 'var(--bg-hover)', borderRadius: '6px', opacity: 0.6 }} />
                <div style={{ height: '16px', width: '75%', background: 'var(--bg-hover)', borderRadius: '4px', opacity: 0.45 }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' as const }}>
                {[80, 60, 70, 90].map((w, i) => (
                  <div key={i} style={{ height: '26px', width: `${w}px`, borderRadius: '20px', background: 'var(--bg-hover)', opacity: 0.5 }} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                {[70, 55, 80, 50, 65].map((w, i) => (
                  <div key={i} style={{ height: '20px', width: `${w}px`, borderRadius: '4px', background: 'var(--bg-hover)', opacity: 0.5 }} />
                ))}
              </div>
              <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[100, 90, 80, 95, 70].map((w, i) => (
                  <div key={i} style={{ height: '14px', width: `${w}%`, background: 'var(--bg-hover)', borderRadius: '4px', opacity: 0.45 }} />
                ))}
              </div>
            </div>
          </div>
          <SidebarRight />
        </div>
      </>
    );
  }

  if (!startup) {
    return (
      <>
        <Navbar />
        <div className="page-container">
          <SidebarLeft />
          <main className="main-content">
            <div className="startups-empty" style={{ padding: '4rem 1rem' }}>
              <div className="startups-empty-icon"><Rocket size={26} /></div>
              <h3>Startup Not Found</h3>
              <p>This startup may have been removed or the link is incorrect.</p>
              <Link href="/startups" className="sc-view-btn">← Back to Startups</Link>
            </div>
          </main>
          <SidebarRight />
        </div>
      </>
    );
  }

  const isFounder = session?.user?.id === startup.founder_id;
  const stageStyle = STAGE_COLORS[startup.stage] || STAGE_COLORS['Idea'];
  const compStyle = COMPENSATION_COLORS[startup.compensation_type] || { bg: 'var(--bg-hover)', text: 'var(--text-muted)' };
  const founder = startup.profiles;
  const { funding_stage: rawFundingStage, hiring_status, roles_statuses } = parseFundingStage(startup.funding_stage);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'about', label: 'About' },
    { key: 'roles', label: 'Open Roles' },
    { key: 'team', label: 'Team' },
    { key: 'updates', label: 'Updates' },
    ...(isFounder ? [{ key: 'applicants' as Tab, label: `Applicants (${applications.length})` }] : []),
  ];

  return (
    <>
      <Navbar />
      <div className="main-content">
        <SidebarLeft />
        <div className="center-feed center-feed--detail">
          <div className="startup-detail-layout">



            {/* Header Section (No Banner) */}
            <div className="startup-detail-header-card">
              <div className="startup-detail-header-content">
                {/* Logo and Info */}
                <div className="startup-detail-brand-info">
                  <div className="startup-detail-logo">
                    {startup.logo_url ? (
                      <img src={startup.logo_url} alt={startup.name} />
                    ) : (
                      startup.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="startup-detail-text-info">
                    <div className="startup-detail-name-wrapper">
                      <h1 className="startup-detail-name">
                        {startup.name}
                        {startup.verified && (
                          <BadgeCheck size={20} className="startup-verified-badge" />
                        )}
                      </h1>
                    </div>
                    {startup.tagline && (
                      <p className="startup-detail-tagline">{startup.tagline}</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="startup-detail-actions-group">
                  {!isFounder && (
                    <button
                      type="button"
                      className={`sc-apply-btn ${hasApplied ? 'applied' : ''}`}
                      onClick={() => {
                        if (!session) { setIsAuthOpen(true); return; }
                        if (!hasApplied) {
                          setSelectedApplyRole(undefined);
                          setApplyOpen(true);
                        }
                      }}
                      disabled={hasApplied}
                    >
                      {hasApplied ? <><Check size={14} /> Applied</> : 'Apply to Join'}
                    </button>
                  )}
                  {isFounder && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Link
                        href={`/startups/create?edit=${startup.id}`}
                        className="sc-view-btn"
                      >
                        Edit Startup
                      </Link>
                      <button
                        type="button"
                        onClick={handleDeleteStartup}
                        className="sc-view-btn"
                        style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: 'var(--accent-danger)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Meta Row */}
              <div className="startup-detail-meta-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span
                  className="sc-stage-badge"
                  style={{ background: stageStyle.bg, color: stageStyle.text, borderColor: stageStyle.border }}
                >
                  {startup.stage}
                </span>
                {isFounder ? (
                  <select
                    value={hiring_status}
                    onChange={(e) => handleUpdateHiringStatus(e.target.value)}
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      padding: '0.18rem 0.5rem',
                      borderRadius: '6px',
                      background: 'var(--bg-hover)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      outline: 'none',
                      height: '24px'
                    }}
                  >
                    <option value="Hiring">🟢 Hiring</option>
                    <option value="Urgent Hiring">🔥 Urgent Hiring</option>
                    <option value="Hiring Soon">🟡 Hiring Soon</option>
                    <option value="Positions Filled">✅ Positions Filled</option>
                    <option value="Not Hiring">⏸️ Not Hiring</option>
                    <option value="Always Hiring">🚀 Always Hiring</option>
                  </select>
                ) : (
                  renderHiringBadge(hiring_status)
                )}
                {startup.work_type && (
                  <span className="sc-work-type"><MapPin size={12} />{startup.work_type}</span>
                )}
                {startup.website && (
                  <a
                    href={startup.website.startsWith('http') ? startup.website : `https://${startup.website}`}
                    target="_blank" rel="noopener noreferrer"
                    className="sc-work-type sc-website-link"
                  >
                    <Globe size={12} /> Website <ExternalLink size={10} />
                  </a>
                )}
              </div>

              {/* Founder Profile */}
              {founder && (
                <div className="startup-detail-founder-row">
                  <span className="founder-by-label">Created by</span>
                  <Link href={`/user/${founder.username}`} className="founder-profile-link">
                    {founder.avatar_url ? (
                      <img src={founder.avatar_url} alt={founder.full_name || ''} className="founder-avatar-img" />
                    ) : (
                      <div className="founder-avatar-fallback">
                        {(founder.full_name || '?').charAt(0)}
                      </div>
                    )}
                    <div className="founder-details-text">
                      <span className="founder-fullname">
                        {founder.full_name || founder.username}
                      </span>
                      <span className="founder-role-title"> · {founder.role || 'Maker'}</span>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="startup-tabs">
              {tabs.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`startup-tab ${activeTab === key ? 'active' : ''}`}
                  onClick={() => setActiveTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── Tab Content ── */}

            {activeTab === 'overview' && (
              <>
                {/* Description preview */}
                {startup.description && (
                  <div className="startup-section-card">
                    <div className="startup-section-title"><Briefcase size={15} /> Description</div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-body)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                      {startup.description}
                    </p>
                  </div>
                )}

                {/* Looking For */}
                {startup.looking_for?.length > 0 && (
                  <div className="startup-section-card">
                    <div className="startup-section-title">Looking For</div>
                    <div className="sc-chips-row">
                      {startup.looking_for.map((r) => (
                        <span key={r} className="sc-chip sc-chip-role">{r}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Required Skills */}
                {startup.required_skills?.length > 0 && (
                  <div className="startup-section-card">
                    <div className="startup-section-title">Required Skills</div>
                    <div className="sc-chips-row">
                      {startup.required_skills.map((s) => (
                        <span key={s} className="sc-chip sc-chip-skill">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Recommended People — filter out self */}
                {recommendedPeople.filter(rec => rec.user_id !== session?.user?.id).length > 0 && (
                  <div className="recommended-people-section">
                    <div className="recommended-people-title">
                      <Sparkles size={15} style={{ color: 'var(--accent-primary)' }} />
                      Recommended People
                    </div>
                    {recommendedPeople
                      .filter(rec => rec.user_id !== session?.user?.id)
                      .map((rec) => (
                        <Link
                          key={rec.user_id}
                          href={`/user/${rec.profile?.username}`}
                          className="recommended-person-card"
                        >
                          {rec.profile?.avatar_url ? (
                            <img src={rec.profile.avatar_url} alt={rec.profile.full_name || rec.profile.username} className="rpc-avatar" />
                          ) : (
                            <div className="rpc-avatar" style={{ background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>
                              {(rec.profile?.full_name || rec.profile?.username || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="rpc-info">
                            <div className="rpc-name">{rec.profile?.full_name || rec.profile?.username || 'Unknown'}</div>
                            <div className="rpc-role">
                              {rec.profile?.role || 'Member'}
                              {rec.profile?.skills?.length > 0 && (
                                <> · {rec.profile.skills.slice(0, 3).join(', ')}</>
                              )}
                            </div>
                            {rec.match_reasons.length > 0 && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                {rec.match_reasons[0]}
                              </div>
                            )}
                          </div>
                          <span className="rpc-score" style={{ color: getMatchColor(rec.match_score) }}>
                            {formatMatchScore(rec.match_score)}
                          </span>
                        </Link>
                      ))
                    }
                  </div>
                )}
              </>
            )}

            {activeTab === 'about' && (
              <div className="startup-section-card">
                <div className="startup-section-title">About {startup.name}</div>
                {startup.description ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-body)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                    {startup.description}
                  </p>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>No description yet.</p>
                )}
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {rawFundingStage && (
                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-muted)', width: 100, flexShrink: 0 }}>Funding</span>
                      <span style={{ color: 'var(--text-main)' }}>{rawFundingStage}</span>
                    </div>
                  )}
                  {startup.industry && (
                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-muted)', width: 100, flexShrink: 0 }}>Industry</span>
                      <span style={{ color: 'var(--text-main)' }}>{startup.industry}</span>
                    </div>
                  )}
                  {startup.work_type && (
                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-muted)', width: 100, flexShrink: 0 }}>Work Type</span>
                      <span style={{ color: 'var(--text-main)' }}>{startup.work_type}</span>
                    </div>
                  )}
                  {startup.deadline && (
                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)', width: 100, flexShrink: 0 }}>Deadline</span>
                      <span style={{ color: 'var(--accent-warning)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Calendar size={13} />
                        {new Date(startup.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'roles' && (
              <div className="startup-section-card">
                <div className="startup-section-title">Open Roles</div>
                {startup.looking_for?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    {startup.looking_for.map((role: string) => (
                      <div key={role} className="role-card">
                        <div className="role-card-top">
                          <div>
                            <div className="role-card-title">{role}</div>
                            <div className="role-card-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {startup.compensation_type && (
                                <span className="role-card-badge role-card-badge--comp">{startup.compensation_type}</span>
                              )}
                              {startup.work_type && (
                                <span className="role-card-badge role-card-badge--work"><MapPin size={10} />{startup.work_type}</span>
                              )}
                              {isFounder ? (
                                <select
                                  value={roles_statuses[role] || 'Open'}
                                  onChange={(e) => handleUpdateRoleStatus(role, e.target.value)}
                                  style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    padding: '0.12rem 0.4rem',
                                    borderRadius: '5px',
                                    background: 'var(--bg-hover)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-main)',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    height: '22px'
                                  }}
                                >
                                  <option value="Open">🟢 Open</option>
                                  <option value="Urgent Hiring">🔥 Urgent Hiring</option>
                                  <option value="Interviewing">⏳ Interviewing</option>
                                  <option value="Filled">✅ Filled</option>
                                  <option value="Closed">❌ Closed</option>
                                </select>
                              ) : (
                                <>
                                  {(roles_statuses[role] || 'Open') === 'Filled' ? (
                                    <span className="role-card-badge" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                                      ✅ Filled
                                    </span>
                                  ) : (roles_statuses[role] || 'Open') === 'Closed' ? (
                                    <span className="role-card-badge" style={{ background: 'var(--bg-hover)', color: 'var(--accent-danger)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                                      ❌ Closed
                                    </span>
                                  ) : (roles_statuses[role] || 'Open') === 'Urgent Hiring' ? (
                                    <span className="role-card-badge" style={{ background: 'rgba(239, 68, 68, 0.08)', color: 'var(--accent-danger)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                                      🔥 Urgent Hiring
                                    </span>
                                  ) : (roles_statuses[role] || 'Open') === 'Interviewing' ? (
                                    <span className="role-card-badge" style={{ background: 'rgba(245, 158, 11, 0.08)', color: 'var(--accent-warning)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                                      ⏳ Interviewing
                                    </span>
                                  ) : (
                                    <span className="role-card-badge role-card-badge--open">🟢 Open</span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          {!isFounder && (
                            <>
                              {(roles_statuses[role] || 'Open') === 'Filled' || (roles_statuses[role] || 'Open') === 'Closed' ? (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 1.1rem' }}>
                                  {(roles_statuses[role] || 'Open') === 'Filled' ? '✅ Position Filled' : '❌ Position Closed'}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className={`sc-apply-btn ${hasApplied ? 'applied' : ''}`}
                                  style={{ padding: '0.5rem 1.1rem', fontSize: '0.8rem', flexShrink: 0 }}
                                  disabled={hasApplied}
                                  onClick={() => {
                                    if (!session) { setIsAuthOpen(true); return; }
                                    if (!hasApplied) {
                                      setSelectedApplyRole(role);
                                      setApplyOpen(true);
                                    }
                                  }}
                                >
                                  {hasApplied ? 'Applied' : 'Apply'}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        {startup.required_skills?.length > 0 && (
                          <div className="role-card-skills">
                            {startup.required_skills.slice(0, 5).map((skill: string) => (
                              <span key={skill} className="role-skill-chip">{skill}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                    <Briefcase size={28} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No open roles listed yet.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'team' && (
              <div className="startup-section-card">
                <div className="startup-section-title">Team Members</div>
                {/* Founder */}
                {founder && (
                  <Link href={`/user/${founder.username}`} className="startup-member-card">
                    {founder.avatar_url ? (
                      <img src={founder.avatar_url} alt={founder.full_name || ''} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }}>
                        {(founder.full_name || '?').charAt(0)}
                      </div>
                    )}
                    <div className="startup-member-info">
                      <div className="startup-member-name">{founder.full_name || founder.username}</div>
                      <div className="startup-member-role">Founder · {founder.role}</div>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </Link>
                )}
                {members.map((m) => (
                  <Link key={m.id} href={`/user/${m.profiles?.username}`} className="startup-member-card">
                    {m.profiles?.avatar_url ? (
                      <img src={m.profiles.avatar_url} alt={m.profiles.full_name || ''} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }}>
                        {(m.profiles?.full_name || '?').charAt(0)}
                      </div>
                    )}
                    <div className="startup-member-info">
                      <div className="startup-member-name">{m.profiles?.full_name || m.profiles?.username}</div>
                      <div className="startup-member-role">{m.role || m.profiles?.role || 'Team Member'}</div>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </Link>
                ))}
                {members.length === 0 && !founder && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>No team members yet.</p>
                )}
              </div>
            )}

            {activeTab === 'updates' && (
              <div className="startup-section-card">
                <div className="startup-section-title">Recent Updates</div>
                {updates.length > 0 ? updates.map((update) => (
                  <div key={update.id} className="startup-update-card">
                    <div className="startup-update-header">
                      {update.profiles?.avatar_url && (
                        <img src={update.profiles.avatar_url} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
                      )}
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{timeAgo(update.created_at)}</span>
                    </div>
                    <p className="startup-update-body">{update.body}</p>
                  </div>
                )) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>No updates yet.</p>
                )}
              </div>
            )}

            {activeTab === 'applicants' && isFounder && (
              <div>
                <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.875rem' }}>
                  Applications ({applications.length})
                </h2>
                {applications.length === 0 ? (
                  <div className="startups-empty">
                    <div className="startups-empty-icon"><Users size={26} /></div>
                    <h3>No Applications Yet</h3>
                    <p>Applications will appear here once people apply.</p>
                  </div>
                                            ) : applications.map((app) => {
                  let appliedRole = null;
                  if (app.intro && app.intro.startsWith('[Applying as:')) {
                    const match = app.intro.match(/^\[Applying as:\s*(.*?)\]/);
                    if (match && match[1]) appliedRole = match[1];
                  }

                  let parsedReason = null;
                  try {
                    if (app.reason && app.reason.startsWith('{')) {
                      parsedReason = JSON.parse(app.reason);
                    }
                  } catch (e) {}

                  return (
                    <div key={app.id} className="applicant-card">
                      <Link href={`/user/${app.profiles?.username}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                        {app.profiles?.avatar_url ? (
                          <img src={app.profiles.avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>
                            {(app.profiles?.full_name || '?').charAt(0)}
                          </div>
                        )}
                      </Link>
                      <div className="applicant-card-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <div className="applicant-name">
                            <Link href={`/user/${app.profiles?.username}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                              {app.profiles?.full_name || app.profiles?.username}
                            </Link>
                          </div>
                          <span className={`applicant-status-badge ${app.status}`}>{app.status}</span>
                        </div>
                        <div className="applicant-meta">
                          {appliedRole ? `Applying as: ${appliedRole}` : (app.profiles?.role || 'Member')} · Applied {timeAgo(app.applied_at)}
                        </div>

                        {/* Render details depending on structured JSON vs plain text */}
                        {parsedReason ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.65rem', background: 'var(--bg-body)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                            {parsedReason.about_you && (
                              <div>
                                <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>About You</div>
                                <p style={{ fontSize: '0.825rem', color: 'var(--text-body)', lineHeight: 1.5, margin: '0.15rem 0 0', whiteSpace: 'pre-wrap' }}>{parsedReason.about_you}</p>
                              </div>
                            )}
                            {parsedReason.projects && (
                              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                                <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Relevant Projects</div>
                                <p style={{ fontSize: '0.825rem', color: 'var(--text-body)', lineHeight: 1.5, margin: '0.15rem 0 0', whiteSpace: 'pre-wrap' }}>{parsedReason.projects}</p>
                              </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                              {parsedReason.experience_years && (
                                <div>
                                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Experience</div>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '0.15rem' }}>{parsedReason.experience_years}</div>
                                </div>
                              )}
                              {parsedReason.availability && (
                                <div>
                                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Availability</div>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '0.15rem' }}>{parsedReason.availability}</div>
                                </div>
                              )}
                            </div>
                            {parsedReason.resume && (
                              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                                <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Resume</div>
                                <a href={parsedReason.resume} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', textDecoration: 'underline', marginTop: '0.15rem' }}>
                                  <FileText size={12} /> View Resume
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          app.reason && <p className="applicant-reason">{app.reason}</p>
                        )}

                        {app.portfolio_links?.length > 0 && (
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                            {app.portfolio_links.map((link, i) => (
                              <a key={i} href={link} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <ExternalLink size={11} /> Link {i + 1}
                              </a>
                            ))}
                          </div>
                        )}

                        {app.status === 'pending' && (
                          <div className="applicant-actions">
                            <button
                              type="button"
                              className="applicant-action-btn accept"
                              onClick={() => handleApplicationAction(app.id, 'accepted')}
                              disabled={appLoading === app.id}
                            >
                              {appLoading === app.id ? <Loader2 size={12} className="spin" /> : <><Check size={12} /> Accept</>}
                            </button>
                            <button
                              type="button"
                              className="applicant-action-btn reject"
                              onClick={() => handleApplicationAction(app.id, 'rejected')}
                              disabled={appLoading === app.id}
                            >
                              <X size={12} /> Reject
                            </button>
                          </div>
                        )}

                        {app.status === 'accepted' && (
                          <div className="applicant-actions" style={{ marginTop: '0.75rem' }}>
                            <button
                              type="button"
                              className="applicant-action-btn accept"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}
                              onClick={() => handleChatWithApplicant(
                                app.applicant_id,
                                app.profiles?.full_name || app.profiles?.username || 'Applicant',
                                app.profiles?.avatar_url || undefined,
                                app.profiles?.username || undefined
                              )}
                            >
                              <MessageCircle size={14} /> Chat with Applicant
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
        <SidebarRight />
      </div>

      {applyOpen && (
        <ApplyToStartupModal
          startup={startup}
          initialRole={selectedApplyRole}
          onClose={() => setApplyOpen(false)}
          onSubmit={handleApply}
        />
      )}

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      {toast && <div className="startup-toast">{toast}</div>}
    </>
  );
}
