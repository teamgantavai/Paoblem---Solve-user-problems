'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, MessageCircle, Search, TriangleIcon, CheckCircle, SlidersHorizontal, X } from 'lucide-react';
import Navbar from '@/components/Navbar';
import SidebarLeft from '@/components/SidebarLeft';
import SidebarRight from '@/components/SidebarRight';
import ImageGallery from '@/components/ImageGallery';
import { supabase } from '@/lib/supabase';
import { Post, Solution } from '@/lib/types';
import { decodeHTMLEntities } from '@/lib/htmlDecoder';

type SolutionFilter = 'all' | 'solved' | 'unsolved' | 'mine';
type AuthSession = { access_token: string } | null;

interface SolutionStats {
  totalSolutions: number;
  problemsSolved: number;
  unsolvedProblems: number;
  topTags: { name: string; count: number }[];
}

export default function SolutionsPage() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession>(null);
  const [filter, setFilter] = useState<SolutionFilter>('all');
  const [search, setSearch] = useState('');
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [unsolvedProblems, setUnsolvedProblems] = useState<Post[]>([]);
  const [stats, setStats] = useState<SolutionStats>({
    totalSolutions: 0,
    problemsSolved: 0,
    unsolvedProblems: 0,
    topTags: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const viewedSolutionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => setSession(currentSession));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => setSession(currentSession));
    return () => subscription.unsubscribe();
  }, []);

  async function fetchSolutions(cursor?: string | null, append = false) {
    if (append) {
      setIsFetchingMore(true);
    } else {
      setIsLoading(true);
    }
    try {
      const params = new URLSearchParams();
      params.set('filter', filter);
      if (search.trim()) params.set('search', search.trim());
      if (cursor) params.set('cursor', cursor);
      const headers: Record<string, string> = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch(`/api/solutions?${params.toString()}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load solutions');
      setSolutions((current) => append ? [...current, ...(data.solutions || [])] : (data.solutions || []));
      setUnsolvedProblems((current) => append ? [...current, ...(data.unsolvedProblems || [])] : (data.unsolvedProblems || []));
      setStats(data.stats || stats);
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      console.error(err);
      if (!append) {
        setSolutions([]);
        setUnsolvedProblems([]);
      }
    } finally {
      if (append) {
        setIsFetchingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSolutions(null, false);
    }, 200);
    return () => clearTimeout(timer);
  }, [filter, search, session?.access_token]);

  useEffect(() => {
    if (!loadMoreRef.current || filter === 'unsolved') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && nextCursor && !isFetchingMore && !isLoading) {
        fetchSolutions(nextCursor, true);
      }
    }, { threshold: 0.8 });
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, nextCursor, isFetchingMore, isLoading, filter]);

  const trackSolutionEvent = async (solutionId: string, eventType: 'SOLUTION_VIEW' | 'SOLUTION_SAVE') => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      await fetch('/api/solutions/track', {
        method: 'POST',
        headers,
        body: JSON.stringify({ solution_id: solutionId, event_type: eventType }),
      });
    } catch (err) {
      console.warn('[solutions] Failed to track solution event', err);
    }
  };

  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-solution-id]'));
    if (cards.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const solutionId = (entry.target as HTMLElement).dataset.solutionId;
        if (!solutionId || !entry.isIntersecting || viewedSolutionsRef.current.has(solutionId)) return;
        viewedSolutionsRef.current.add(solutionId);
        trackSolutionEvent(solutionId, 'SOLUTION_VIEW');
      });
    }, { threshold: 0.55 });
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [solutions.map((solution) => solution.id).join(','), session?.access_token]);

  const filteredSolutions = useMemo(() => {
    if (filter !== 'solved') return solutions;
    return solutions.filter((solution) => solution.problem?.type === 'problem');
  }, [filter, solutions]);

  const filterLabels: Record<SolutionFilter, string> = {
    all: 'All Solutions',
    solved: 'Solved Problems',
    unsolved: 'Unsolved Problems',
    mine: 'My Solutions',
  };

  return (
    <div className="app-container">
      <Navbar />
      <div className="main-content">
        <SidebarLeft />
        <main className="center-feed solutions-page">
          {stats.topTags.length > 0 && (
            <div className="solutions-tags-row">
              {stats.topTags.map((tag) => (
                <span key={tag.name}>#{tag.name}</span>
              ))}
            </div>
          )}

          <section className="solutions-controls">
            <div className="solutions-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by problem, solution, user, or tag"
              />
              {search && (
                <button type="button" className="solutions-clear-search" onClick={() => setSearch('')} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="solutions-filter-shell">
              <button
                type="button"
                className="solutions-filter-trigger"
                onClick={() => setIsFilterOpen((open) => !open)}
                aria-expanded={isFilterOpen}
              >
                <SlidersHorizontal size={16} />
                <span>{filterLabels[filter]}</span>
              </button>
              {isFilterOpen && (
                <div className="solutions-filter-menu">
                  {([
                    ['all', 'All Solutions', 'Every submitted solution'],
                    ['solved', 'Solved Problems', 'Solutions attached to problems'],
                    ['unsolved', 'Unsolved Problems', 'Problems still waiting for help'],
                    ['mine', 'My Solutions', 'Solutions posted by you'],
                  ] as [SolutionFilter, string, string][]).map(([id, label, description]) => (
                    <button
                      key={id}
                      type="button"
                      className={filter === id ? 'active' : ''}
                      onClick={() => {
                        setFilter(id);
                        setIsFilterOpen(false);
                      }}
                    >
                      <span>{label}</span>
                      <small>{description}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <div className="solutions-active-row">
            <span>{filterLabels[filter]}</span>
            <small>{filter === 'unsolved' ? `${unsolvedProblems.length} open problems` : `${filteredSolutions.length} solutions shown`}</small>
          </div>

          {isLoading && <div className="solutions-loading">Loading solutions...</div>}

          {!isLoading && filter === 'unsolved' && (
            <div className="solutions-list">
              {unsolvedProblems.length === 0 ? (
                <div className="solutions-empty">
                  <CheckCircle size={22} />
                  <div>
                    <strong>No unsolved problems found.</strong>
                    <p>Every visible problem in this view already has a submitted solution.</p>
                  </div>
                </div>
              ) : (
                unsolvedProblems.map((problem) => (
                  <article key={problem.id} className="solution-card solution-card--problem">
                    <div className="solution-card-header">
                      <div>
                        <h3>{decodeHTMLEntities(problem.title)}</h3>
                      </div>
                    </div>
                    <p className="solution-card-body">{decodeHTMLEntities(problem.body).slice(0, 240)}</p>
                    <button className="solution-open-problem" onClick={() => router.push(`/post/${problem.slug || problem.id}#solutions`)}>
                      Open problem
                    </button>
                  </article>
                ))
              )}
            </div>
          )}

          {!isLoading && filter !== 'unsolved' && (
            <div className="solutions-list">
              {filteredSolutions.length === 0 ? (
                <p className="solutions-empty-text">No solutions yet. Open a problem and become the first developer to solve it.</p>
              ) : (
                filteredSolutions.map((solution) => (
                  <article key={solution.id} className="solution-card" data-solution-id={solution.id}>
                    <div className="solution-card-header">
                      <img
                        src={solution.profiles?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${solution.user_id}`}
                        alt={solution.profiles?.full_name || 'Developer'}
                        className="solution-avatar"
                      />
                      <div>
                        <h3>{decodeHTMLEntities(solution.title)}</h3>
                        <p>
                          Solved by {solution.profiles?.full_name || 'Developer'}
                          {solution.profiles?.role ? ` · ${solution.profiles.role}` : ''} · {new Date(solution.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button className="solution-problem-link" onClick={() => router.push(`/post/${solution.problem?.slug || solution.problem_id}#solutions`)}>
                      Solves: {decodeHTMLEntities(solution.problem?.title || 'Open problem')}
                    </button>
                    <p className="solution-card-body">{decodeHTMLEntities(solution.body)}</p>
                    <ImageGallery imageUrlsString={solution.image_url} />
                    {solution.external_link && (
                      <a className="solution-link" href={solution.external_link} target="_blank" rel="noreferrer">
                        <ExternalLink size={13} />
                        {solution.link_name || solution.external_link}
                      </a>
                    )}
                    <div className="solution-card-footer">
                      <span className="vote-container"><TriangleIcon size={15} /> <span className="vote-label up">+{solution.upvotes}</span></span>
                      <span className="vote-container"><TriangleIcon size={15} style={{ transform: 'rotate(180deg)' }} /> <span className="vote-label down">-{solution.downvotes}</span></span>
                      <span className="solution-comments-pill"><MessageCircle size={14} /> {solution.comments_count}</span>
                    </div>
                  </article>
                ))
              )}
              <div ref={loadMoreRef} />
              {isFetchingMore && <div className="solutions-loading">Loading more solutions...</div>}
            </div>
          )}
        </main>
        <SidebarRight />
      </div>
    </div>
  );
}
