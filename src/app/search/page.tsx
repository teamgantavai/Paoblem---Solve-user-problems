'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, AlertTriangle, Lightbulb, User, NotebookPen, Clock, ArrowRight, Loader2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { SearchResponse, SearchResult, SearchResultSolution, SearchResultUser } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import '@/app/styles/search.css';

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryParam = searchParams.get('q') || '';

  const [inputVal, setInputVal] = useState(queryParam);
  const [activeTab, setActiveTab] = useState<'all' | 'problems' | 'ideas' | 'solutions' | 'users'>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'upvotes' | 'newest'>('relevance');
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Update input when query param changes
  useEffect(() => {
    setInputVal(queryParam);
  }, [queryParam]);

  // Fetch search results
  const { data: searchResults, isLoading, isError } = useQuery<SearchResponse>({
    queryKey: ['search-page', queryParam],
    queryFn: async () => {
      if (!queryParam.trim()) {
        return { problems: [], ideas: [], solutions: [], users: [] };
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const res = await fetch(`/api/search?q=${encodeURIComponent(queryParam)}&limit=15`, {
        headers
      });
      if (!res.ok) {
        throw new Error('Search failed');
      }
      return res.json();
    },
    enabled: true, // run even on empty to show empty state cleanly or initialize
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      router.push(`/search?q=${encodeURIComponent(inputVal.trim())}`);
    }
  };

  const highlightTitle = (text: string | null, searchStr: string) => {
    if (!text) return '';
    if (!searchStr) return text;
    const regex = new RegExp(`(${searchStr.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => 
      regex.test(part) ? <mark key={index} className="search-highlight">{part}</mark> : part
    );
  };

  // Filter and Sort results
  const getProcessedProblems = () => {
    let list = [...(searchResults?.problems || [])];
    if (sortBy === 'upvotes') {
      list.sort((a, b) => b.upvotes - a.upvotes);
    } else if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return list;
  };

  const getProcessedIdeas = () => {
    let list = [...(searchResults?.ideas || [])];
    if (sortBy === 'upvotes') {
      list.sort((a, b) => b.upvotes - a.upvotes);
    } else if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return list;
  };

  const getProcessedSolutions = () => {
    let list = [...(searchResults?.solutions || [])];
    if (sortBy === 'upvotes') {
      list.sort((a, b) => b.upvotes - a.upvotes);
    } else if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return list;
  };

  const getProcessedUsers = () => {
    return [...(searchResults?.users || [])];
  };

  const problems = getProcessedProblems();
  const ideas = getProcessedIdeas();
  const solutions = getProcessedSolutions();
  const users = getProcessedUsers();

  const totalCount = problems.length + ideas.length + solutions.length + users.length;

  return (
    <div className="app-container">
      <Navbar />

      <div className="search-page-wrapper" style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px 80px 20px' }}>
        
        {/* Search Refinement Header */}
        <div className="search-page-header" style={{ marginBottom: '32px' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', maxWidth: '640px' }}>
            <div className="search-overlay-input-wrap" style={{ flex: 1, backgroundColor: 'var(--bg-card)' }}>
              <Search className="search-icon" size={18} />
              <input
                type="text"
                placeholder="Search problems, solutions, ideas, or users..."
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="search-input"
                style={{ height: '44px' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ padding: '0 24px', borderRadius: '10px' }}>
              Search
            </button>
          </form>
          {queryParam && (
            <p style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Found {totalCount} results for "{queryParam}"
            </p>
          )}
        </div>

        {/* Tab Selection + Sorting controls */}
        <div className="search-page-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div className="search-page-tabs" style={{ display: 'flex', gap: '8px' }}>
            {(['all', 'problems', 'ideas', 'solutions', 'users'] as const).map((tab) => {
              const count = tab === 'all' ? totalCount : 
                            tab === 'problems' ? problems.length : 
                            tab === 'ideas' ? ideas.length : 
                            tab === 'solutions' ? solutions.length : users.length;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: activeTab === tab ? 'var(--accent-blue)' : 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    color: activeTab === tab ? 'white' : 'var(--text-body)',
                    padding: '6px 16px',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span style={{ textTransform: 'capitalize' }}>{tab}</span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>({count})</span>
                </button>
              );
            })}
          </div>

          {activeTab !== 'users' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span>Sort by</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="relevance">Relevance</option>
                <option value="upvotes">Upvotes</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          )}
        </div>

        {/* LOADING & ERROR STATES */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
            <Loader2 className="spin" size={32} style={{ color: 'var(--accent-blue)', marginBottom: '16px' }} />
            <p>Searching database...</p>
          </div>
        )}

        {isError && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#ef4444' }}>
            <p>An error occurred while fetching search results. Please try again.</p>
          </div>
        )}

        {/* RESULTS RENDER */}
        {!isLoading && !isError && (
          <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'all' || activeTab === 'users' ? '1fr' : '3fr 1fr', gap: '32px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {/* Problems Container */}
              {(activeTab === 'all' || activeTab === 'problems') && problems.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {activeTab === 'all' && (
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      <AlertTriangle size={16} /> Problems
                    </h3>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                    {problems.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => router.push(`/post/${p.slug}`)}
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          padding: '20px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        className="search-result-row"
                      >
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>
                          {highlightTitle(p.title, queryParam)}
                        </h4>
                        <p
                          style={{ fontSize: '0.9rem', color: 'var(--text-body)', lineHeight: '1.5', marginBottom: '12px' }}
                          dangerouslySetInnerHTML={{ __html: p.body_snippet }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {p.author && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <img src={p.author.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg'} alt="Author" style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
                                {p.author.full_name}
                              </span>
                            )}
                            <span>{p.upvotes} Upvotes</span>
                            <span>{p.comments_count} Comments</span>
                          </div>
                          <span>{new Date(p.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ideas Container */}
              {(activeTab === 'all' || activeTab === 'ideas') && ideas.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {activeTab === 'all' && (
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#d97706', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      <Lightbulb size={16} /> Ideas
                    </h3>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                    {ideas.map((i) => (
                      <div
                        key={i.id}
                        onClick={() => router.push(`/post/${i.slug}`)}
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          padding: '20px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        className="search-result-row"
                      >
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>
                          {highlightTitle(i.title, queryParam)}
                        </h4>
                        <p
                          style={{ fontSize: '0.9rem', color: 'var(--text-body)', lineHeight: '1.5', marginBottom: '12px' }}
                          dangerouslySetInnerHTML={{ __html: i.body_snippet }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {i.author && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <img src={i.author.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg'} alt="Author" style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
                                {i.author.full_name}
                              </span>
                            )}
                            <span>{i.upvotes} Upvotes</span>
                            <span>{i.comments_count} Comments</span>
                          </div>
                          <span>{new Date(i.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Solutions Container */}
              {(activeTab === 'all' || activeTab === 'solutions') && solutions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {activeTab === 'all' && (
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      <NotebookPen size={16} /> Solutions
                    </h3>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                    {solutions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => router.push(`/solutions?id=${s.id}`)}
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          padding: '20px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        className="search-result-row"
                      >
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>
                          {highlightTitle(s.title, queryParam)}
                        </h4>
                        <p
                          style={{ fontSize: '0.9rem', color: 'var(--text-body)', lineHeight: '1.5', marginBottom: '12px' }}
                          dangerouslySetInnerHTML={{ __html: s.body_snippet }}
                        />
                        <div style={{ display: 'inline-block', backgroundColor: 'var(--search-bg)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                          Problem: {s.problem_title}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {s.author && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <img src={s.author.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg'} alt="Author" style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
                                {s.author.full_name}
                              </span>
                            )}
                            <span>{s.upvotes} Upvotes</span>
                          </div>
                          <span>{new Date(s.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Users Container */}
              {(activeTab === 'all' || activeTab === 'users') && users.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {activeTab === 'all' && (
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      <User size={16} /> Users
                    </h3>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {users.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => router.push(`/user/${u.username}`)}
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          padding: '16px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '16px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        className="search-result-row"
                      >
                        <img
                          src={u.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg'}
                          alt={u.full_name || 'User'}
                          style={{ width: '48px', height: '48px', borderRadius: '50%', border: '1px solid var(--border-color)' }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>
                            {highlightTitle(u.full_name, queryParam)}
                          </h4>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                            @{u.username}
                          </span>
                          {u.role && (
                            <span style={{ fontSize: '0.65rem', backgroundColor: 'var(--search-bg)', border: '1px solid var(--border-color)', color: 'var(--text-body)', padding: '2px 8px', borderRadius: '12px', display: 'inline-block', marginBottom: '6px' }}>
                              {u.role}
                            </span>
                          )}
                          {u.bio_snippet && (
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                              {u.bio_snippet}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* EMPTY RESULTS STATE */}
              {totalCount === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
                  <Search size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '8px' }}>
                    No results found for "{queryParam}"
                  </h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    Check your spelling, try tags like #startup, or write a different search query.
                  </p>
                </div>
              )}
            </div>

            {/* Sidebar when on specific tabs */}
            {activeTab !== 'all' && activeTab !== 'users' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '16px' }}>
                    Search Tips
                  </h3>
                  <ul style={{ fontSize: '0.8rem', color: 'var(--text-body)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '10px', lineHeight: '1.4' }}>
                    <li>Use tags like <strong>#startup</strong> to locate topics directly</li>
                    <li>Fuzzy matching handles common spelling mistakes automatically</li>
                    <li>Relevance combines upvotes, exact matching, comments, and views</li>
                  </ul>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

export default function SearchResultsPage() {
  return (
    <Suspense fallback={null}>
      <SearchResultsContent />
    </Suspense>
  );
}
