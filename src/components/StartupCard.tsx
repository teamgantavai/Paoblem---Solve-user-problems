'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, Clock, Users, Globe, MapPin,
  ChevronRight, BadgeCheck, Loader2, MoreVertical,
  Share2, Copy, MessageCircle, Flag, Star, SendHorizontal, Trash2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Startup } from '@/lib/types';
import { STAGE_COLORS, COMPENSATION_COLORS, formatMatchScore, getMatchColor } from '@/lib/startupMatching';

const HIRING_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  'Hiring': { label: 'Hiring', bg: 'rgba(34, 197, 94, 0.08)', text: 'var(--accent-success)', border: 'rgba(34, 197, 94, 0.25)' },
  'Urgent Hiring': { label: 'Urgent Hiring', bg: 'rgba(239, 68, 68, 0.08)', text: 'var(--accent-danger)', border: 'rgba(239, 68, 68, 0.25)' },
  'Hiring Soon': { label: 'Hiring Soon', bg: 'rgba(245, 158, 11, 0.08)', text: 'var(--accent-warning)', border: 'rgba(245, 158, 11, 0.25)' },
  'Positions Filled': { label: 'Positions Filled', bg: 'var(--bg-hover)', text: 'var(--text-muted)', border: 'var(--border-color)' },
  'Not Hiring': { label: 'Not Hiring', bg: 'var(--bg-hover)', text: 'var(--text-muted)', border: 'var(--border-color)' },
  'Always Hiring': { label: 'Always Hiring', bg: 'rgba(37, 99, 235, 0.08)', text: 'var(--accent-primary)', border: 'rgba(37, 99, 235, 0.25)' }
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
  } catch (e) { }
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
import { useMicroAnimations } from '@/hooks/useMicroAnimations';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';

const ShareModal = dynamic(() => import('./ShareModal'), { ssr: false });
const ShareInAppChatsModal = dynamic(() => import('./ShareInAppChatsModal'), { ssr: false });

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, search?: string): React.ReactNode {
  if (!search || !search.trim() || !text) return text;
  const regex = new RegExp(`(${escapeRegExp(search)})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="search-highlight">{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
}

interface StartupCardProps {
  startup: Startup;
  onApply?: (startup: Startup) => void;
  session?: any;
  onAuthRequired?: () => void;
  searchQuery?: string;
  onShareClick?: (startup: Startup) => void;
  onChatShareClick?: (startup: Startup) => void;
}

export default function StartupCard({ startup, onApply, session, onAuthRequired, searchQuery, onShareClick, onChatShareClick }: StartupCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isStarred, setIsStarred] = useState(startup.is_following || false);
  const [starsCount, setStarsCount] = useState(startup.followers_count || 0);
  const { animateUpvote } = useMicroAnimations();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isChatShareOpen, setIsChatShareOpen] = useState(false);
  const { hiring_status } = parseFundingStage(startup.funding_stage);

  useEffect(() => {
    setIsStarred(startup.is_following || false);
  }, [startup.is_following]);

  useEffect(() => {
    setStarsCount(startup.followers_count || 0);
  }, [startup.followers_count]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = () => setMenuOpen(false);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, [menuOpen]);

  const founder = startup.profiles;
  const founderName = founder?.full_name || founder?.username || 'Founder';
  const founderAvatar = founder?.avatar_url;
  const founderUsername = founder?.username;

  const handleStarToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session) {
      if (onAuthRequired) onAuthRequired();
      return;
    }

    const nextStarred = !isStarred;
    setIsStarred(nextStarred);
    setStarsCount(prev => nextStarred ? prev + 1 : Math.max(0, prev - 1));

    try {
      const res = await fetch(`/api/startups/${startup.id}/star`, {
        method: nextStarred ? 'POST' : 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (!res.ok) throw new Error('Star action failed');
    } catch (err) {
      console.error(err);
      setIsStarred(!nextStarred);
      setStarsCount(prev => !nextStarred ? prev + 1 : Math.max(0, prev - 1));
    }
  };

  const handleReportSpam = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    alert('Startup listing reported successfully.');
  };

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/startups?q=${encodeURIComponent(startup.name)}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setMenuOpen(false);
    }, 2000);
  };

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);

    const confirmed = window.confirm(
      "Delete Startup?\n\nThis action is permanent and cannot be undone."
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/startups/${startup.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      if (res.ok) {
        toast.success('Startup deleted successfully.');
        window.location.reload();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || 'Failed to delete startup');
      }
    } catch (err: any) {
      console.error('[delete]', err);
      toast.error('Error deleting startup');
    }
  };

  const handleChat = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session) {
      if (onAuthRequired) onAuthRequired();
      return;
    }
    if (session.user?.id === startup.founder_id) {
      toast.error('You cannot message yourself (Founder)');
      return;
    }
    setMenuOpen(false);
    window.dispatchEvent(new CustomEvent('top-loader:start'));
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          recipientId: startup.founder_id,
          startOnly: true
        })
      });
      if (!res.ok) throw new Error('Could not start chat');
      const data = await res.json();

      const params = new URLSearchParams();
      params.set('conversationId', data.conversationId);
      params.set('partnerId', startup.founder_id);
      if (founderName) params.set('partnerName', founderName);
      if (founderAvatar) params.set('partnerAvatar', founderAvatar);
      if (founderUsername) params.set('partnerUsername', founderUsername);

      router.push(`/chats?${params.toString()}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to start chat.');
      window.dispatchEvent(new CustomEvent('top-loader:finish'));
    }
  };

  const stageStyle = STAGE_COLORS[startup.stage] || STAGE_COLORS['Idea'];
  const compStyle = COMPENSATION_COLORS[startup.compensation_type] || { bg: 'var(--bg-hover)', text: 'var(--text-muted)' };

  const MAX_ROLES = 4;
  const MAX_SKILLS = 5;
  const displayRoles = startup.looking_for?.slice(0, MAX_ROLES) || [];
  const moreRoles = (startup.looking_for?.length || 0) - MAX_ROLES;
  const displaySkills = startup.required_skills?.slice(0, MAX_SKILLS) || [];
  const moreSkills = (startup.required_skills?.length || 0) - MAX_SKILLS;

  const hasDescription = !!startup.description?.trim();

  const handleApplyClick = () => {
    if (!session) {
      if (onAuthRequired) onAuthRequired();
      return;
    }
    if (onApply) onApply(startup);
  };

  return (
    <article className="startup-card">
      {/* ── Header: Founder Info ── */}
      <div className="sc-header" style={{ position: 'relative' }}>
        <Link href={founderUsername ? `/user/${founderUsername}` : '#'} className="sc-founder">
          {founderAvatar ? (
            <img src={founderAvatar} alt={founderName} className="sc-avatar" />
          ) : (
            <div className="sc-avatar-placeholder">
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                {founderName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="sc-founder-info">
            <span className="sc-founder-name" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {founderName}
              {startup.verified && (
                <span className="sc-verified"><BadgeCheck size={13} /></span>
              )}
              <span className="post-type-badge startup">
                Startup
              </span>
            </span>
            <span className="sc-founder-meta">
              <span className="sc-meta-sub">
                <Clock size={11} />
                <span>{timeAgo(startup.created_at)} ago</span>
              </span>
              {startup.work_type && (
                <>
                  <span className="sc-meta-divider">·</span>
                  <span className="sc-meta-sub">
                    <MapPin size={11} />
                    <span>{startup.work_type}</span>
                  </span>
                </>
              )}
            </span>
          </div>
        </Link>

        <div className="sc-header-right" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Stage badge */}
          <span
            className="sc-stage-badge"
            style={{
              background: stageStyle.bg,
              color: stageStyle.text,
              borderColor: stageStyle.border,
            }}
          >
            {startup.stage}
          </span>

          {/* Hiring status badge */}
          {renderHiringBadge(hiring_status)}

          {/* AI match score if available */}
          {startup.match_score != null && startup.match_score > 0 && (
            <span
              className="match-score-badge"
              style={{
                background: `${getMatchColor(startup.match_score)}18`,
                color: getMatchColor(startup.match_score),
                borderColor: `${getMatchColor(startup.match_score)}40`,
              }}
            >
              {formatMatchScore(startup.match_score)}
            </span>
          )}

          {/* Options Menu Button (Three dot) */}
          <div className="post-menu-shell" style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px', borderRadius: '50%' }}
              className="post-header-action-btn"
              title="More Options"
            >
              <MoreVertical size={16} />
            </button>

            {menuOpen && (
              <div className="post-overflow-menu" style={{ right: 0, top: '100%', position: 'absolute', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                <button onClick={handleCopyLink} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <Copy size={14} /> {copied ? 'Copied!' : 'Copy Link'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    if (onShareClick) {
                      onShareClick(startup);
                    } else {
                      setIsShareModalOpen(true);
                    }
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <Share2 size={14} /> Share
                </button>
                <button onClick={handleReportSpam} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <Flag size={14} /> Mark as spam
                </button>
                {session?.user?.id === startup.founder_id && (
                  <button
                    onClick={handleDeleteClick}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-danger)' }}
                  >
                    <Trash2 size={14} /> Delete Startup
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Startup Info ── */}
      <div className="sc-startup-info">
        <Link
          href={`/startups/${startup.id}`}
          style={{ textDecoration: 'none' }}
          onClick={() => window.dispatchEvent(new CustomEvent('top-loader:start'))}
        >
          <h2 className="sc-name">{highlightText(startup.name, searchQuery)}</h2>
        </Link>
        {startup.tagline && (
          <p className="sc-tagline">{highlightText(startup.tagline, searchQuery)}</p>
        )}
      </div>

      {/* ── Chips ── */}
      {(displayRoles.length > 0 || displaySkills.length > 0) && (
        <div className="sc-chips-section">
          {displayRoles.length > 0 && (
            <div>
              <div className="sc-chips-label">Looking For</div>
              <div className="sc-chips-row">
                {displayRoles.map((role) => (
                  <span key={role} className="sc-chip sc-chip-role">{highlightText(role, searchQuery)}</span>
                ))}
                {moreRoles > 0 && (
                  <span className="sc-chip sc-chip-more">+{moreRoles}</span>
                )}
              </div>
            </div>
          )}

          {displaySkills.length > 0 && (
            <div>
              <div className="sc-chips-label">Skills</div>
              <div className="sc-chips-row">
                {displaySkills.map((skill) => (
                  <span key={skill} className="sc-chip sc-chip-skill">{highlightText(skill, searchQuery)}</span>
                ))}
                {moreSkills > 0 && (
                  <span className="sc-chip sc-chip-more">+{moreSkills}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Compensation + Work Type ── */}
      <div className="sc-meta-row">
        <span
          className="sc-compensation"
          style={{ background: compStyle.bg, color: compStyle.text }}
        >
          {startup.compensation_type}
        </span>
        {startup.work_type && (
          <span className="sc-work-type">
            <Globe size={11} />
            {startup.work_type}
          </span>
        )}
        {startup.industry && (
          <span className="sc-work-type">{highlightText(startup.industry || '', searchQuery)}</span>
        )}
      </div>

      {/* ── Description ── */}
      {hasDescription && (
        <>
          <p className={`sc-description ${expanded ? 'expanded' : ''}`}>
            {highlightText(startup.description || '', searchQuery)}
          </p>
          {startup.description && startup.description.length > 200 && (
            <button
              className="sc-read-more"
              onClick={() => setExpanded((e) => !e)}
              type="button"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </>
      )}

      {/* ── Metadata Row (Applied, Deadline) ── */}
      {(startup.applications_count > 0 || startup.deadline) && (
        <div className="sc-meta-row-below" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0 0.5rem', marginBottom: '0.65rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {startup.applications_count > 0 && (
            <span className="sc-meta-item">
              <CheckCircle2 size={13} />
              {startup.applications_count} applied
            </span>
          )}
          {startup.deadline && (
            <span className="sc-meta-item" style={{ color: 'var(--accent-warning)' }}>
              <Clock size={13} />
              Deadline: {new Date(startup.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="sc-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        {/* Left Side: Actions (Star & DM/Send) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Star (Like) Container */}
          <div className="vote-container" style={{ borderColor: isStarred ? '#eab308' : undefined, background: isStarred ? 'rgba(234,179,8,0.08)' : undefined }}>
            <button
              className="vote-btn"
              onClick={(e) => {
                animateUpvote(e.currentTarget);
                handleStarToggle(e);
              }}
              style={{ color: isStarred ? '#eab308' : undefined }}
              aria-label="Star Startup"
            >
              <Star size={16} fill={isStarred ? 'currentColor' : 'none'} />
            </button>
            <span className={`vote-label up ${isStarred ? 'active' : ''}`} style={{ color: isStarred ? '#eab308' : undefined, paddingRight: '12px' }}>
              {starsCount}
            </span>
          </div>

          {/* DM / Send Button (Share to Chat) */}
          <button
            type="button"
            className="post-comment-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (!session) {
                if (onAuthRequired) onAuthRequired();
              } else {
                if (onChatShareClick) {
                  onChatShareClick(startup);
                } else {
                  setIsChatShareOpen(true);
                }
              }
            }}
            style={{
              padding: '0.35rem 0.55rem',
            }}
            title="Share in Chat"
          >
            <SendHorizontal size={18} />
          </button>
        </div>

        {/* Right Side: View / Apply buttons */}
        <div className="sc-footer-actions">
          <Link
            href={`/startups/${startup.id}`}
            className="sc-view-btn"
            onClick={() => window.dispatchEvent(new CustomEvent('top-loader:start'))}
          >
            View <ChevronRight size={13} />
          </Link>

          <button
            type="button"
            className={`sc-apply-btn ${startup.has_applied ? 'applied' : ''}`}
            onClick={handleApplyClick}
            disabled={startup.has_applied || false}
          >
            {startup.has_applied ? (
              <><CheckCircle2 size={14} /> Applied</>
            ) : (
              'Apply to Join'
            )}
          </button>
        </div>
      </div>

      {isShareModalOpen && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          post={{
            id: startup.id,
            title: startup.name,
            body: startup.tagline || startup.description || '',
            slug: undefined,
            user_id: startup.founder_id,
            profiles: startup.profiles,
            type: 'startup'
          } as any}
          session={session}
        />
      )}

      {isChatShareOpen && (
        <ShareInAppChatsModal
          isOpen={isChatShareOpen}
          onClose={() => setIsChatShareOpen(false)}
          post={{
            id: startup.id,
            title: startup.name,
            body: startup.tagline || startup.description || '',
            slug: undefined,
            user_id: startup.founder_id,
            profiles: startup.profiles,
            type: 'startup'
          } as any}
          session={session}
        />
      )}
    </article>
  );
}
