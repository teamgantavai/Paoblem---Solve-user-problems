import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { SearchResponse, SearchHistoryItem, TrendingData } from '@/lib/types';

export function useSearch() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [session, setSession] = useState<any>(null);

  // Monitor session change
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Debounce query (120ms for instant-response feel)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 120);

    return () => clearTimeout(handler);
  }, [query]);

  // Fetch search results
  const searchResultsQuery = useQuery<SearchResponse>({
    queryKey: ['search', debouncedQuery],
    queryFn: async ({ signal }) => {
      if (!debouncedQuery.trim()) {
        return { problems: [], ideas: [], solutions: [], users: [] };
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, {
        headers,
        signal,
      });
      if (!res.ok) {
        throw new Error('Search request failed');
      }
      return res.json();
    },
    enabled: debouncedQuery.trim().length > 0,
    staleTime: 60 * 1000, // cache for 1 minute
  });

  // Fetch trending content
  const trendingQuery = useQuery<TrendingData>({
    queryKey: ['search-trending'],
    queryFn: async () => {
      const res = await fetch('/api/search/trending');
      if (!res.ok) {
        throw new Error('Trending fetch failed');
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });

  // Fetch history from DB (if logged in)
  const historyQuery = useQuery<SearchHistoryItem[]>({
    queryKey: ['search-history', session?.user?.id],
    queryFn: async () => {
      if (!session?.access_token) return [];
      const res = await fetch('/api/search/history', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        throw new Error('History fetch failed');
      }
      return res.json();
    },
    enabled: !!session,
  });

  // Local storage backup for guests
  const [localHistory, setLocalHistory] = useState<SearchHistoryItem[]>([]);

  useEffect(() => {
    if (!session) {
      const stored = localStorage.getItem('paoblem-search-history');
      if (stored) {
        try {
          setLocalHistory(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse local history', e);
        }
      }
    }
  }, [session]);

  const saveLocalHistory = (items: SearchHistoryItem[]) => {
    setLocalHistory(items);
    localStorage.setItem('paoblem-search-history', JSON.stringify(items));
  };

  // Add history item mutation
  const addHistoryMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      if (!trimmed) return;

      if (session?.access_token) {
        // Logged-in: Save to Supabase DB via API
        const res = await fetch('/api/search/history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ query: trimmed }),
        });
        if (!res.ok) throw new Error('Failed to save search history');
        return res.json();
      } else {
        // Guest: Save to LocalStorage
        const items = [...localHistory];
        const existingIdx = items.findIndex((i) => i.query.toLowerCase() === trimmed.toLowerCase());
        if (existingIdx > -1) {
          items.splice(existingIdx, 1); // remove duplicates
        }
        const newItem: SearchHistoryItem = {
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
          query: trimmed,
          created_at: new Date().toISOString(),
        };
        items.unshift(newItem);
        saveLocalHistory(items.slice(0, 10)); // limit to 10
        return newItem;
      }
    },
    onSuccess: () => {
      if (session) {
        queryClient.invalidateQueries({ queryKey: ['search-history', session.user.id] });
      }
    },
  });

  // Delete history item mutation
  const deleteHistoryMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (session?.access_token) {
        const res = await fetch(`/api/search/history?id=${itemId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (!res.ok) throw new Error('Failed to delete history item');
      } else {
        const items = localHistory.filter((i) => i.id !== itemId);
        saveLocalHistory(items);
      }
    },
    onSuccess: () => {
      if (session) {
        queryClient.invalidateQueries({ queryKey: ['search-history', session.user.id] });
      }
    },
  });

  // Clear all history mutation
  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      if (session?.access_token) {
        const res = await fetch('/api/search/history?all=true', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (!res.ok) throw new Error('Failed to clear history');
      } else {
        saveLocalHistory([]);
      }
    },
    onSuccess: () => {
      if (session) {
        queryClient.invalidateQueries({ queryKey: ['search-history', session.user.id] });
      }
    },
  });

  // Track search result clicks
  const trackClick = useCallback(async (searchQuery: string) => {
    try {
      await fetch('/api/search/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery.trim() }),
      });
    } catch (err) {
      console.warn('Failed to track click analytics', err);
    }
  }, []);

  const history = session ? (historyQuery.data || []) : localHistory;

  return {
    query,
    setQuery,
    debouncedQuery,
    searchResults: searchResultsQuery.data,
    isLoading: searchResultsQuery.isLoading,
    isError: searchResultsQuery.isError,
    error: searchResultsQuery.error,
    trending: trendingQuery.data,
    isLoadingTrending: trendingQuery.isLoading,
    history,
    isLoadingHistory: session ? historyQuery.isLoading : false,
    addHistory: (q: string) => addHistoryMutation.mutate(q),
    deleteHistory: (id: string) => deleteHistoryMutation.mutate(id),
    clearHistory: () => clearHistoryMutation.mutate(),
    trackClick,
  };
}
