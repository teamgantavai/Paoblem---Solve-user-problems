'use client';
// components/PollCard.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart2, CheckCircle2, Clock, Loader2, AlertCircle, Users } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface PollOption {
  id         : string;
  option_text: string;
  vote_count : number;
  position   : number;
}

export interface PollData {
  id                  : string;
  post_id             : string;
  expires_at          : string;
  multiple_choice     : boolean;
  options             : PollOption[];
  user_voted_option_id: string | null;
}

interface PollCardProps {
  postId         : string;
  pollQuestion   : string;
  session        : { access_token: string; user: { id: string } } | null;
  onAuthRequired : () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getRemainingTime(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days    = Math.floor(diff / 86_400_000);
  const hours   = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000)  / 60_000);
  if (days > 1)   return `${days}d left`;
  if (days === 1)  return `1d ${hours}h left`;
  if (hours > 0)   return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m left`;
  return 'Ending soon';
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function PollCard({
  postId, pollQuestion, session, onAuthRequired,
}: PollCardProps) {
  const [poll,          setPoll]          = useState<PollData | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [voting,        setVoting]        = useState(false);
  const [votedOptionId, setVotedOptionId] = useState<string | null>(null);
  const [fetchError,    setFetchError]    = useState<string | null>(null);
  const [voteError,     setVoteError]     = useState<string | null>(null);

  // Tick every 30 s so "time remaining" stays fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const fetchPoll = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res  = await fetch(`/api/polls/${postId}`, { headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load poll');
      if (json.poll) {
        setPoll(json.poll);
        setVotedOptionId(json.poll.user_voted_option_id ?? null);
      }
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load poll');
    } finally {
      setLoading(false);
    }
  }, [postId, session?.access_token]);

  useEffect(() => { fetchPoll(); }, [fetchPoll]);

  // ── Vote handler ──────────────────────────────────────────────────────────
  async function handleVote(optionId: string) {
    if (!session) { onAuthRequired(); return; }
    if (!poll || voting) return;
    if (new Date(poll.expires_at).getTime() < Date.now()) return;

    setVoteError(null);
    setVoting(true);

    // Optimistic update
    const isToggleOff = votedOptionId === optionId;
    const prevPoll    = poll;
    const prevVoted   = votedOptionId;

    setPoll(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        options: prev.options.map(opt => {
          if (isToggleOff && opt.id === optionId)
            return { ...opt, vote_count: Math.max(0, opt.vote_count - 1) };
          if (!isToggleOff && opt.id === optionId)
            return { ...opt, vote_count: opt.vote_count + 1 };
          if (!isToggleOff && votedOptionId && opt.id === votedOptionId)
            return { ...opt, vote_count: Math.max(0, opt.vote_count - 1) };
          return opt;
        }),
      };
    });
    setVotedOptionId(isToggleOff ? null : optionId);

    try {
      const res = await fetch('/api/polls/vote', {
        method : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization : `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ poll_id: poll.id, option_id: optionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Vote failed');
      if (data.options?.length) {
        setPoll(prev => prev ? { ...prev, options: data.options } : prev);
      }
      setVotedOptionId(data.voted_option_id ?? null);
    } catch (err: unknown) {
      setPoll(prevPoll);
      setVotedOptionId(prevVoted);
      setVoteError(err instanceof Error ? err.message : 'Failed to vote.');
    } finally {
      setVoting(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
        <Loader2 size={14} className="spin" />
        Loading poll…
      </div>
    );
  }

  if (fetchError || !poll) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 0.75rem', background: 'var(--bg-hover)', borderRadius: '10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <AlertCircle size={13} />
        {fetchError ?? 'Poll not available'}
      </div>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalVotes = poll.options.reduce((s, o) => s + o.vote_count, 0);
  const isExpired  = new Date(poll.expires_at).getTime() < Date.now();
  const hasVoted   = votedOptionId !== null;
  const showBars   = hasVoted || isExpired;
  const maxVotes   = Math.max(...poll.options.map(o => o.vote_count), 1);
  const sortedOpts = [...poll.options].sort((a, b) => a.position - b.position);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      borderRadius : '16px',
      overflow     : 'hidden',
      marginTop    : '0.75rem',
      background   : 'var(--bg-card)',
      border       : '1px solid var(--border-color)',
    }}>
      {/* ── Header ── */}
      <div style={{
        display        : 'flex',
        alignItems     : 'center',
        justifyContent : 'space-between',
        padding        : '0.65rem 1rem',
        borderBottom   : '1px solid var(--border-color)',
        background     : 'rgba(99,102,241,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <BarChart2 size={14} style={{ color: '#6366f1' }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Poll</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: isExpired ? '#ef4444' : 'var(--text-muted)' }}>
          <Clock size={11} />
          <span>{isExpired ? 'Ended' : getRemainingTime(poll.expires_at)}</span>
        </div>
      </div>

      {/* ── Options ── */}
      <div style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {sortedOpts.map(option => {
          const pct       = totalVotes > 0 ? Math.round((option.vote_count / totalVotes) * 100) : 0;
          const isChosen  = votedOptionId === option.id;
          const isLeading = showBars && option.vote_count === maxVotes && option.vote_count > 0;
          const canVote   = !isExpired && !voting;

          return (
            <div key={option.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <button
                type="button"
                onClick={() => canVote && handleVote(option.id)}
                disabled={isExpired || voting}
                aria-pressed={isChosen}
                aria-label={`${option.option_text}${showBars ? `, ${pct}%` : ''}`}
                style={{
                  position      : 'relative',
                  display       : 'flex',
                  alignItems    : 'center',
                  justifyContent: 'space-between',
                  width         : '100%',
                  padding       : '0.6rem 0.85rem',
                  border        : `2px solid ${isChosen ? '#6366f1' : isLeading ? 'rgba(99,102,241,0.35)' : 'var(--border-color)'}`,
                  borderRadius  : '12px',
                  background    : isChosen ? 'rgba(99,102,241,0.08)' : 'transparent',
                  cursor        : isExpired || voting ? 'default' : 'pointer',
                  textAlign     : 'left',
                  overflow      : 'hidden',
                  transition    : 'border-color 0.15s, background 0.15s',
                  outline       : 'none',
                }}
                onMouseEnter={e => { if (canVote && !isChosen) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.5)'; }}
                onMouseLeave={e => { if (!isChosen) (e.currentTarget as HTMLButtonElement).style.borderColor = isLeading ? 'rgba(99,102,241,0.35)' : 'var(--border-color)'; }}
              >
                {/* Animated fill bar */}
                {showBars && (
                  <div
                    aria-hidden="true"
                    style={{
                      position     : 'absolute',
                      top          : 0,
                      left         : 0,
                      height       : '100%',
                      width        : `${pct}%`,
                      background   : isChosen
                        ? 'rgba(99,102,241,0.14)'
                        : isLeading
                          ? 'rgba(99,102,241,0.07)'
                          : 'rgba(255,255,255,0.03)',
                      borderRadius : '10px',
                      transition   : 'width 0.5s cubic-bezier(0.25,0.46,0.45,0.94)',
                      pointerEvents: 'none',
                    }}
                  />
                )}

                {/* Option text + check */}
                <span style={{
                  position    : 'relative',
                  display     : 'flex',
                  alignItems  : 'center',
                  gap         : '0.45rem',
                  fontSize    : '0.875rem',
                  fontWeight  : isChosen ? 600 : 400,
                  color       : isChosen ? 'var(--text-main)' : 'var(--text-main)',
                  flex        : 1,
                  minWidth    : 0,
                  overflow    : 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace  : 'nowrap',
                  paddingRight: showBars ? '0.5rem' : 0,
                }}>
                  {isChosen
                    ? <CheckCircle2 size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
                    : !showBars && (
                        <span style={{
                          width       : 14,
                          height      : 14,
                          borderRadius: '50%',
                          border      : '2px solid var(--border-color)',
                          flexShrink  : 0,
                          display     : 'inline-block',
                        }} />
                      )
                  }
                  {option.option_text}
                </span>

                {/* Percentage pill (only when bars shown) */}
                {showBars && (
                  <span style={{
                    position  : 'relative',
                    flexShrink: 0,
                    fontSize  : '0.82rem',
                    fontWeight: isLeading ? 700 : 500,
                    color     : isChosen || isLeading ? '#6366f1' : 'var(--text-muted)',
                  }}>
                    {pct}%
                  </span>
                )}
              </button>

              {/* Vote count bar (shown after voting) */}
              {showBars && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '0.25rem' }}>
                  <div style={{
                    flex          : 1,
                    height        : '4px',
                    borderRadius  : '999px',
                    background    : 'var(--bg-hover)',
                    overflow      : 'hidden',
                  }}>
                    <div style={{
                      height    : '100%',
                      width     : `${pct}%`,
                      background: isChosen ? '#6366f1' : isLeading ? '#818cf8' : 'var(--text-muted)',
                      borderRadius: '999px',
                      transition: 'width 0.5s cubic-bezier(0.25,0.46,0.45,0.94)',
                    }} />
                  </div>
                  <span style={{
                    fontSize  : '0.72rem',
                    color     : 'var(--text-muted)',
                    flexShrink: 0,
                    minWidth  : '2.5rem',
                    textAlign : 'right',
                  }}>
                    {option.vote_count.toLocaleString()} {option.vote_count === 1 ? 'vote' : 'votes'}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div style={{
        padding        : '0.5rem 1rem 0.75rem',
        display        : 'flex',
        alignItems     : 'center',
        justifyContent : 'space-between',
        borderTop      : '1px solid var(--border-color)',
      }}>
        {/* Total vote count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <Users size={12} />
          <span>{totalVotes === 0 ? 'No votes yet' : totalVotes === 1 ? '1 vote' : `${totalVotes.toLocaleString()} votes`}</span>
        </div>

        {/* Status / CTA */}
        <div style={{ fontSize: '0.75rem' }}>
          {voteError && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#ef4444' }}>
              <AlertCircle size={11} /> {voteError}
            </span>
          )}
          {!voteError && isExpired && (
            <span style={{ color: '#ef4444', fontWeight: 500 }}>Poll closed</span>
          )}
          {!voteError && !isExpired && hasVoted && (
            <span style={{ color: '#6366f1', fontWeight: 500 }}>Voted — tap to change</span>
          )}
          {!voteError && !isExpired && !hasVoted && session && (
            <span style={{ color: 'var(--text-muted)' }}>Tap an option to vote</span>
          )}
          {!voteError && !isExpired && !hasVoted && !session && (
            <button
              type="button"
              onClick={onAuthRequired}
              style={{ background: 'none', border: 'none', color: '#6366f1', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
            >
              Sign in to vote
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
