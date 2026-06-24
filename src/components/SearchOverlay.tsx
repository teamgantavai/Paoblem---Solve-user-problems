import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, ChevronLeft, AlertTriangle, Lightbulb, User, Clock, Trash2, ArrowRight, NotebookPen, Loader2 } from 'lucide-react';
import { useSearch } from '@/hooks/useSearch';
import { SearchResult, SearchResultSolution, SearchResultUser } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export default function SearchOverlay({ isOpen, onClose, initialQuery = '' }: SearchOverlayProps) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    query,
    setQuery,
    searchResults,
    isLoading,
    trending,
    isLoadingTrending,
    history,
    addHistory,
    deleteHistory,
    clearHistory,
    trackClick,
  } = useSearch();

  const [activeIndex, setActiveIndex] = useState(-1);

  // Initialize query if initialQuery is passed
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setTimeout(() => inputRef.current?.focus(), 100);
      setActiveIndex(-1);
    }
  }, [isOpen, initialQuery, setQuery]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (overlayRef.current && !overlayRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Highlight query match in titles
  const highlightTitle = (text: string | null, searchStr: string) => {
    if (!text) return '';
    if (!searchStr) return text;
    const regex = new RegExp(`(${searchStr.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => 
      regex.test(part) ? <mark key={index} className="search-highlight">{part}</mark> : part
    );
  };

  // Compile list of navigable items
  const getNavigableItems = () => {
    const items: Array<{
      type: 'query' | 'problem' | 'idea' | 'solution' | 'user' | 'action';
      label: string;
      url: string;
      onClick: () => void;
    }> = [];

    if (!query.trim()) {
      // Recent Searches
      history.forEach((h) => {
        items.push({
          type: 'query',
          label: h.query,
          url: `/search?q=${encodeURIComponent(h.query)}`,
          onClick: () => {
            addHistory(h.query);
            router.push(`/search?q=${encodeURIComponent(h.query)}`);
            onClose();
          }
        });
      });
    } else if (searchResults) {
      // Problems
      searchResults.problems.forEach((p) => {
        items.push({
          type: 'problem',
          label: p.title,
          url: `/post/${p.slug}`,
          onClick: () => {
            addHistory(query);
            trackClick(query);
            router.push(`/post/${p.slug}`);
            onClose();
          }
        });
      });
      // Ideas
      searchResults.ideas.forEach((i) => {
        items.push({
          type: 'idea',
          label: i.title,
          url: `/post/${i.slug}`,
          onClick: () => {
            addHistory(query);
            trackClick(query);
            router.push(`/post/${i.slug}`);
            onClose();
          }
        });
      });
      // Solutions
      searchResults.solutions.forEach((s) => {
        items.push({
          type: 'solution',
          label: s.title,
          url: `/solutions?id=${s.id}`,
          onClick: () => {
            addHistory(query);
            trackClick(query);
            router.push(`/solutions?id=${s.id}`);
            onClose();
          }
        });
      });
      // Users
      searchResults.users.forEach((u) => {
        items.push({
          type: 'user',
          label: u.full_name || u.username || 'User',
          url: `/user/${u.username}`,
          onClick: () => {
            addHistory(query);
            trackClick(query);
            router.push(`/user/${u.username}`);
            onClose();
          }
        });
      });

      // "View all results" option
      items.push({
        type: 'action',
        label: `View all results for "${query}"`,
        url: `/search?q=${encodeURIComponent(query)}`,
        onClick: () => {
          addHistory(query);
          router.push(`/search?q=${encodeURIComponent(query)}`);
          onClose();
        }
      });
    }

    return items;
  };

  const navigableItems = getNavigableItems();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1 < navigableItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : navigableItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < navigableItems.length) {
        navigableItems[activeIndex].onClick();
      } else if (query.trim()) {
        addHistory(query);
        router.push(`/search?q=${encodeURIComponent(query)}`);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="search-overlay-backdrop">
      <div className="search-overlay-card" ref={overlayRef} onKeyDown={handleKeyDown}>
        {/* Header Search Input (Instagram/Threads style) */}
        <div className="search-overlay-header">
          <button className="search-back-btn" onClick={onClose} aria-label="Back">
            <ChevronLeft size={28} />
          </button>
          
          <div className="search-overlay-input-wrap">
            <Search className="search-icon" size={16} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(-1);
              }}
              className="search-input"
            />
            {query && (
              <button onClick={() => setQuery('')} className="clear-btn" aria-label="Clear query">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Content Container */}
        <div className="search-overlay-body scrollbar-custom">
          {isLoading && (
            <div className="search-status-container">
              <Loader2 className="spinner-icon spin" size={24} />
              <p>Searching...</p>
            </div>
          )}

          {/* EMPTY QUERY STATE (History list + Suggested Profiles) */}
          {!query.trim() && !isLoading && (
            <div className="search-history-instagram">
              <div className="section-header">
                <h3>Recent</h3>
                {history.length > 0 && (
                  <button className="clear-all-btn" onClick={() => clearHistory()}>
                    Clear all
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="empty-state-instagram">
                  <span>No recent searches.</span>
                </div>
              ) : (
                <div className="instagram-history-list">
                  {history.map((h, idx) => {
                    const isFocused = activeIndex === idx;
                    return (
                      <div
                        key={h.id}
                        className={`instagram-row-item ${isFocused ? 'focused' : ''}`}
                        onClick={() => {
                          addHistory(h.query);
                          router.push(`/search?q=${encodeURIComponent(h.query)}`);
                          onClose();
                        }}
                      >
                        {/* Circular Search Icon */}
                        <div className="instagram-circle-icon">
                          <Search size={18} />
                        </div>
                        
                        <div className="instagram-row-info">
                          <span className="instagram-query-text">{h.query}</span>
                        </div>

                        <button
                          className="instagram-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteHistory(h.id);
                          }}
                          aria-label="Remove search history item"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Suggested profiles (simulating search screen suggested list) */}
              {trending?.problems && trending.problems.length > 0 && (
                <div className="instagram-suggested-section" style={{ marginTop: '24px' }}>
                  <h3>Suggested</h3>
                  <div className="instagram-suggested-list">
                    {trending.problems.slice(0, 3).map((p, idx) => {
                      const globalIdx = history.length + idx;
                      const isFocused = activeIndex === globalIdx;
                      const authorName = p.author?.full_name || 'Innovator';
                      const authorUsername = p.author?.username || 'user';
                      const authorAvatar = p.author?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${authorUsername}`;
                      return (
                        <div
                          key={p.id}
                          className={`instagram-row-item ${isFocused ? 'focused' : ''}`}
                          onClick={() => {
                            router.push(`/post/${p.slug}`);
                            onClose();
                          }}
                        >
                          <img
                            src={authorAvatar}
                            alt={authorName}
                            className="instagram-profile-avatar"
                          />
                           <div className="instagram-row-info">
                            <span className="instagram-profile-username">
                              {authorUsername}
                            </span>
                            <span className="instagram-profile-name">{authorName}</span>
                          </div>
                          <button className="instagram-row-arrow" aria-label="Go">
                            <ChevronLeft size={16} style={{ transform: 'rotate(180deg)', opacity: 0.5 }} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RESULTS STATE */}
          {query.trim() && !isLoading && searchResults && (
            <div className="search-results-instagram">
              {/* Users category */}
              {searchResults.users.length > 0 && (
                <div className="result-category-instagram">
                  <div className="category-header">Users</div>
                  <div className="instagram-suggested-list">
                    {searchResults.users.map((u) => {
                      const itemIdx = navigableItems.findIndex((x) => x.type === 'user' && (x.label === u.full_name || x.label === u.username));
                      const isFocused = activeIndex === itemIdx;
                      return (
                        <div
                          key={u.id}
                          className={`instagram-row-item ${isFocused ? 'focused' : ''}`}
                          onClick={() => {
                            addHistory(query);
                            trackClick(query);
                            router.push(`/user/${u.username}`);
                            onClose();
                          }}
                        >
                          <img
                            src={u.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg'}
                            alt={u.full_name || 'User'}
                            className="instagram-profile-avatar"
                          />
                          <div className="instagram-row-info">
                            <span className="instagram-profile-username">
                              {u.username}
                            </span>
                            <span className="instagram-profile-name">{u.full_name}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Problems category */}
              {searchResults.problems.length > 0 && (
                <div className="result-category-instagram" style={{ marginTop: '20px' }}>
                  <div className="category-header">Problems</div>
                  <div className="instagram-suggested-list">
                    {searchResults.problems.map((p) => {
                      const itemIdx = navigableItems.findIndex((x) => x.type === 'problem' && x.label === p.title);
                      const isFocused = activeIndex === itemIdx;
                      return (
                        <div
                          key={p.id}
                          className={`instagram-row-item ${isFocused ? 'focused' : ''}`}
                          onClick={() => {
                            addHistory(query);
                            trackClick(query);
                            router.push(`/post/${p.slug}`);
                            onClose();
                          }}
                        >
                          <div className="instagram-circle-icon problem">
                            <AlertTriangle size={16} />
                          </div>
                          <div className="instagram-row-info">
                            <span className="instagram-post-title">{p.title}</span>
                            <span className="instagram-post-meta">{p.upvotes} upvotes · {p.comments_count} comments</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ideas category */}
              {searchResults.ideas.length > 0 && (
                <div className="result-category-instagram" style={{ marginTop: '20px' }}>
                  <div className="category-header">Ideas</div>
                  <div className="instagram-suggested-list">
                    {searchResults.ideas.map((i) => {
                      const itemIdx = navigableItems.findIndex((x) => x.type === 'idea' && x.label === i.title);
                      const isFocused = activeIndex === itemIdx;
                      return (
                        <div
                          key={i.id}
                          className={`instagram-row-item ${isFocused ? 'focused' : ''}`}
                          onClick={() => {
                            addHistory(query);
                            trackClick(query);
                            router.push(`/post/${i.slug}`);
                            onClose();
                          }}
                        >
                          <div className="instagram-circle-icon idea">
                            <Lightbulb size={16} />
                          </div>
                          <div className="instagram-row-info">
                            <span className="instagram-post-title">{i.title}</span>
                            <span className="instagram-post-meta">{i.upvotes} upvotes · {i.comments_count} comments</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Solutions category */}
              {searchResults.solutions.length > 0 && (
                <div className="result-category-instagram" style={{ marginTop: '20px' }}>
                  <div className="category-header">Solutions</div>
                  <div className="instagram-suggested-list">
                    {searchResults.solutions.map((s) => {
                      const itemIdx = navigableItems.findIndex((x) => x.type === 'solution' && x.label === s.title);
                      const isFocused = activeIndex === itemIdx;
                      return (
                        <div
                          key={s.id}
                          className={`instagram-row-item ${isFocused ? 'focused' : ''}`}
                          onClick={() => {
                            addHistory(query);
                            trackClick(query);
                            router.push(`/solutions?id=${s.id}`);
                            onClose();
                          }}
                        >
                          <div className="instagram-circle-icon solution">
                            <NotebookPen size={16} />
                          </div>
                          <div className="instagram-row-info">
                            <span className="instagram-post-title">{s.title}</span>
                            <span className="instagram-post-meta">{s.problem_title}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EMPTY RESULTS STATE */}
          {query.trim() && !isLoading && searchResults &&
            searchResults.problems.length === 0 &&
            searchResults.ideas.length === 0 &&
            searchResults.solutions.length === 0 &&
            searchResults.users.length === 0 && (
              <div className="instagram-empty-state">
                <Search size={40} className="empty-icon" />
                <p>No results found for "{query}"</p>
                <span>Try checking spelling or keywords.</span>
              </div>
            )}
        </div>

        {/* Footer View All results */}
        {query.trim() && !isLoading && (
          <div className="search-overlay-footer">
            <button
              className={`view-all-results-action-btn ${activeIndex === navigableItems.length - 1 ? 'focused' : ''}`}
              onClick={() => {
                addHistory(query);
                router.push(`/search?q=${encodeURIComponent(query)}`);
                onClose();
              }}
            >
              <span>View all results for "{query}"</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
