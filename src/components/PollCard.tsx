'use client';
// components/PollCard.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, CheckCircle, Clock, Loader2, AlertCircle } from 'lucide-react';

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
  if (days > 1)  return `${days}d ${hours}h left`;
  if (days === 1) return `1d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
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

  // Fetch poll data
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

      // Sync server counts
      if (data.options) {
        setPoll(prev => prev ? { ...prev, options: data.options } : prev);
      }
      setVotedOptionId(data.voted_option_id ?? null);
    } catch (err: unknown) {
      // Roll back optimistic update
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
      <div style={{
        display    : 'flex',
        alignItems : 'center',
        gap        : '0.5rem',
        padding    : '0.75rem 0',
        color      : 'var(--text-muted)',
        fontSize   : '0.8rem',
      }}>
        <Loader2 size={13} className="spin" />
        Loading poll…
      </div>
    );
  }

  // ── Fetch error ────────────────────────────────────────────────────────────
  if (fetchError || !poll) {
    return (
      <div style={{
        display      : 'flex',
        alignItems   : 'center',
        gap          : '0.4rem',
        padding      : '0.6rem 0.75rem',
        background   : 'var(--bg-hover)',
        borderRadius : '10px',
        fontSize     : '0.78rem',
        color        : 'var(--text-muted)',
      }}>
        <AlertCircle size={13} />
        {fetchError ?? 'Poll not available'}
      </div>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalVotes = poll.options.reduce((s, o) => s + o.vote_count, 0);
  const isExpired  = new Date(poll.expires_at).getTime() < Date.now();
  const hasVoted   = votedOptionId !== null;
  const showBars   = hasVoted || isExpired;    // reveal results once voted or ended
  const maxVotes   = Math.max(...poll.options.map(o => o.vote_count), 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      border       : '1px solid var(--border-color)',
      borderRadius : '14px',
      overflow     : 'hidden',
      marginTop    : '0.5rem',
      background   : 'var(--bg-card)',
    }}>
      {/* Header */}
      <div style={{
        display        : 'flex',
        alignItems     : 'center',
        justifyContent : 'space-between',
        padding        : '0.6rem 0.85rem',
        borderBottom   : '1px solid var(--border-color)',
        background     : 'rgba(99,102,241,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <BarChart3 size={13} style={{ color: '#6366f1' }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Poll
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: isExpired ? '#ef4444' : 'var(--text-muted)' }}>
          <Clock size={11} />
          {isExpired ? 'Ended' : getRemainingTime(poll.expires_at)}
        </div>
      </div>

      {/* Options */}
      <div style={{ padding: '0.65rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {[...poll.options]
          .sort((a, b) => a.position - b.position)
          .map(option => {
            const pct       = totalVotes > 0 ? Math.round((option.vote_count / totalVotes) * 100) : 0;
            const isChosen  = votedOptionId === option.id;
            const isLeading = showBars && option.vote_count === maxVotes && maxVotes > 0;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleVote(option.id)}
                disabled={isExpired || voting}
                style={{
                  position      : 'relative',
                  display       : 'flex',
                  alignItems    : 'center',
                  justifyContent: 'space-between',
                  padding       : '0.55rem 0.75rem',
                  border        : `1.5px solid ${isChosen ? '#6366f1' : 'var(--border-color)'}`,
                  borderRadius  : '10px',
                  background    : isChosen ? 'rgba(99,102,241,0.06)' : 'transparent',
                  cursor        : isExpired ? 'default' : 'pointer',
                  textAlign     : 'left',
                  overflow      : 'hidden',
                  transition    : 'border-color 0.15s, background 0.15s',
                  opacity       : (isExpired || voting) && !isChosen ? 0.7 : 1,
                }}
                onMouseEnter={e => {
                  if (!isExpired && !voting)
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#6366f1';
                }}
                onMouseLeave={e => {
                  if (!isChosen)
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-color)';
                }}
                aria-label={`${option.option_text}${showBars ? ` – ${pct}%` : ''}`}
                aria-pressed={isChosen}
              >
                {/* Background percentage bar */}
                {showBars && (
                  <div
                    aria-hidden="true"
                    style={{
                      position     : 'absolute',
                      inset        : 0,
                      width        : `${pct}%`,
                      background   : isLeading
                        ? 'rgba(99,102,241,0.12)'
                        : 'rgba(255,255,255,0.04)',
                      borderRadius : '10px',
                      transition   : 'width 0.4s ease',
                      pointerEvents: 'none',
                    }}
                  />
                )}

                {/* Label */}
                <span style={{
                  position   : 'relative',
                  display    : 'flex',
                  alignItems : 'center',
                  gap        : '0.4rem',
                  fontSize   : '0.85rem',
                  fontWeight : isChosen ? 600 : 400,
                  color      : 'var(--text-main)',
                  flexShrink : 1,
                  minWidth   : 0,
                  overflow   : 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace : 'nowrap',
                }}>
                  {isChosen && (
                    <CheckCircle
                      size={12}
                      style={{ color: '#6366f1', flexShrink: 0 }}
                    />
                  )}
                  {option.option_text}
                </span>

                {/* Percentage */}
                {showBars && (
                  <span style={{
                    position   : 'relative',
                    flexShrink : 0,
                    fontSize   : '0.8rem',
                    fontWeight : isLeading ? 700 : 500,
                    color      : isLeading ? '#6366f1' : 'var(--text-muted)',
                    marginLeft : '0.5rem',
                  }}>
                    {pct}%
                  </span>
                )}
              </button>
            );
          })}
      </div>

      {/* Footer */}
      <div style={{
        padding        : '0.45rem 0.85rem 0.65rem',
        display        : 'flex',
        alignItems     : 'center',
        justifyContent : 'space-between',
        fontSize       : '0.72rem',
        color          : 'var(--text-muted)',
      }}>
        <span>
          {totalVotes === 1 ? '1 vote' : `${totalVotes.toLocaleString()} votes`}
        </span>
        <span>
          {voteError && (
            <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertCircle size={11} /> {voteError}
            </span>
          )}
          {!voteError && !isExpired && !hasVoted && session && (
            <span>Tap an option to vote</span>
          )}
          {!voteError && !isExpired && !hasVoted && !session && (
            <button
              type="button"
              onClick={onAuthRequired}
              style={{
                background  : 'none',
                border      : 'none',
                color       : '#6366f1',
                fontWeight  : 600,
                cursor      : 'pointer',
                fontSize    : '0.72rem',
                padding     : 0,
              }}
            >
              Sign in to vote
            </button>
          )}
          {!voteError && hasVoted && !isExpired && (
            <span style={{ color: '#6366f1' }}>
              ✓ Voted — tap again to change
            </span>
          )}
          {isExpired && (
            <span style={{ color: '#ef4444' }}>Poll closed</span>
          )}
        </span>
      </div>
    </div>
  );
}