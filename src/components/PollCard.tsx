'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, BarChart3, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export interface PollOption {
  id: string;
  option_text: string;
  vote_count: number;
  position: number;
}

export interface PollData {
  id: string;
  post_id: string;
  expires_at: string;
  multiple_choice: boolean;
  allow_vote_changes?: boolean;
  options: PollOption[];
  user_voted_option_id: string | null;
}

interface PollCardProps {
  postId: string;
  pollQuestion: string;
  session: { access_token: string; user: { id: string } } | null;
  onAuthRequired: () => void;
}

function formatVotes(count: number) {
  return count === 1 ? '1 vote' : `${count.toLocaleString()} votes`;
}

function formatEndsAt(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getTimeRemaining(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Poll Closed';

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (diff >= week) {
    const weeks = Math.max(1, Math.round(diff / week));
    return `Ends in ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
  }
  if (diff >= day) {
    const days = Math.max(1, Math.round(diff / day));
    return `Ends in ${days} ${days === 1 ? 'day' : 'days'}`;
  }
  if (diff >= hour) {
    const hours = Math.max(1, Math.round(diff / hour));
    return `Ends in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }

  const minutes = Math.max(1, Math.round(diff / minute));
  return `Ends in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

export default function PollCard({ postId, pollQuestion, session, onAuthRequired }: PollCardProps) {
  const [poll, setPoll] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [votingOptionId, setVotingOptionId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const fetchPoll = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    setFetchError(null);

    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const res = await fetch(`/api/polls/${postId}`, { headers, cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load poll');

      setPoll(json.poll ?? null);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load poll');
    } finally {
      setLoading(false);
    }
  }, [postId, session?.access_token]);

  useEffect(() => {
    fetchPoll(true);
  }, [fetchPoll]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!poll?.id) return;

    const channel = supabase
      .channel(`poll-results:${poll.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_votes', filter: `poll_id=eq.${poll.id}` },
        () => fetchPoll(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_options', filter: `poll_id=eq.${poll.id}` },
        () => fetchPoll(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPoll, poll?.id]);

  const totals = useMemo(() => {
    const totalVotes = poll?.options.reduce((sum, option) => sum + option.vote_count, 0) ?? 0;
    const maxVotes = Math.max(0, ...(poll?.options.map((option) => option.vote_count) ?? [0]));
    return { totalVotes, maxVotes };
  }, [poll?.options]);

  async function handleVote(optionId: string) {
    if (!session) {
      onAuthRequired();
      return;
    }
    if (!poll || votingOptionId) return;

    const isExpired = new Date(poll.expires_at).getTime() <= Date.now();
    const hasVoted = Boolean(poll.user_voted_option_id);
    const canChangeVote = poll.allow_vote_changes === true;
    if (isExpired || (hasVoted && !canChangeVote) || poll.user_voted_option_id === optionId) return;

    const previousPoll = poll;
    setVoteError(null);
    setVotingOptionId(optionId);

    setPoll((current) => {
      if (!current) return current;
      return {
        ...current,
        user_voted_option_id: optionId,
        options: current.options.map((option) => {
          if (option.id === optionId) return { ...option, vote_count: option.vote_count + 1 };
          if (option.id === current.user_voted_option_id) return { ...option, vote_count: Math.max(0, option.vote_count - 1) };
          return option;
        }),
      };
    });

    try {
      const res = await fetch('/api/polls/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ poll_id: poll.id, option_id: optionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Vote failed');

      setPoll((current) => current
        ? { ...current, options: data.options ?? current.options, user_voted_option_id: data.voted_option_id ?? optionId }
        : current);
    } catch (err) {
      setPoll(previousPoll);
      setVoteError(err instanceof Error ? err.message : 'Failed to save vote');
    } finally {
      setVotingOptionId(null);
    }
  }

  if (loading) {
    return (
      <div className="poll-card poll-card--loading">
        <Loader2 size={16} className="spin" />
        Loading poll...
      </div>
    );
  }

  if (fetchError || !poll) {
    return (
      <div className="poll-card poll-card--error">
        <AlertCircle size={16} />
        {fetchError ?? 'Poll not available'}
      </div>
    );
  }

  const isExpired = new Date(poll.expires_at).getTime() <= Date.now();
  const hasVoted = Boolean(poll.user_voted_option_id);
  const showResults = hasVoted || isExpired;
  const canChangeVote = poll.allow_vote_changes === true;
  const isLockedByVote = hasVoted && !canChangeVote && !isExpired;

  return (
    <section className={`poll-card ${isExpired ? 'poll-card--closed' : ''}`} aria-label={`Poll: ${pollQuestion}`}>
      <header className="poll-card__header">
        <div className="poll-card__type">
          <BarChart3 size={15} />
          <span>Poll</span>
        </div>
        <div className="poll-card__status">
          <Clock size={14} />
          <span>{getTimeRemaining(poll.expires_at)}</span>
        </div>
      </header>

      <h4 className="poll-card__question">{pollQuestion}</h4>

      <div className="poll-card__options" role="list">
        {[...poll.options].sort((a, b) => a.position - b.position).map((option) => {
          const percent = totals.totalVotes > 0 ? Math.round((option.vote_count / totals.totalVotes) * 100) : 0;
          const selected = poll.user_voted_option_id === option.id;
          const leading = showResults && option.vote_count === totals.maxVotes && totals.maxVotes > 0;
          const disabled = isExpired || Boolean(votingOptionId) || isLockedByVote || selected;

          return (
            <button
              key={option.id}
              type="button"
              className={`poll-option ${selected ? 'poll-option--selected' : ''} ${leading ? 'poll-option--leading' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                handleVote(option.id);
              }}
              disabled={disabled}
              aria-pressed={selected}
              aria-label={`${option.option_text}${showResults ? `, ${percent} percent, ${option.vote_count} votes` : ''}`}
            >
              {showResults && (
                <span className="poll-option__bar" style={{ width: `${percent}%` }} aria-hidden="true" />
              )}
              <span className="poll-option__content">
                <span className="poll-option__label">
                  {selected && <CheckCircle2 size={15} />}
                  {option.option_text}
                </span>
                {showResults && <strong className="poll-option__percent">{percent}%</strong>}
              </span>
            </button>
          );
        })}
      </div>

      <footer className="poll-card__footer">
        <span>{formatVotes(totals.totalVotes)}</span>
        <span>Ends {formatEndsAt(poll.expires_at)}</span>
      </footer>

      <div className="poll-card__hint" aria-live="polite">
        {voteError && <span className="poll-card__error"><AlertCircle size={13} /> {voteError}</span>}
        {!voteError && isExpired && <span>Voting Disabled. Results Visible.</span>}
        {!voteError && !isExpired && !session && (
          <button type="button" onClick={(event) => { event.stopPropagation(); onAuthRequired(); }}>
            Sign in to vote
          </button>
        )}
        {!voteError && !isExpired && session && !hasVoted && <span>Choose one option to vote.</span>}
        {!voteError && !isExpired && hasVoted && !canChangeVote && <span>Vote saved. Changes are disabled for this poll.</span>}
        {!voteError && !isExpired && hasVoted && canChangeVote && <span>Vote saved. You can change it before the poll closes.</span>}
      </div>
    </section>
  );
}
