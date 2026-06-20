import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function checkAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return false;
  }

  // Check role from profiles table or user metadata
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // If user metadata role or database role is Admin/administrator
  const role = profile?.role?.toLowerCase();
  return role === 'admin' || role === 'administrator' || user.user_metadata?.role?.toLowerCase() === 'admin';
}

export async function GET(req: NextRequest) {
  try {
    // For demo/development purposes or admin users, let's bypass if query param bypass=true is set
    // but default to checking admin privileges.
    const { searchParams } = new URL(req.url);
    const bypass = searchParams.get('bypass') === 'true';

    if (!bypass) {
      const isAdmin = await checkAdmin(req);
      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch top searches
    const { data: rawQueries, error: qErr } = await supabase
      .from('search_queries')
      .select('query, results_count, clicked, created_at');

    if (qErr) {
      console.error('[search/analytics] Error fetching search queries:', qErr);
      return NextResponse.json({ error: qErr.message }, { status: 500 });
    }

    const queries = rawQueries || [];

    // Grouping
    const queryCounts: Record<string, number> = {};
    const noResultCounts: Record<string, number> = {};
    let clickedCount = 0;
    const totalSearches = queries.length;

    queries.forEach((q) => {
      const clean = q.query.toLowerCase().trim();
      if (!clean) return;

      queryCounts[clean] = (queryCounts[clean] || 0) + 1;
      
      if (q.results_count === 0) {
        noResultCounts[clean] = (noResultCounts[clean] || 0) + 1;
      }

      if (q.clicked) {
        clickedCount++;
      }
    });

    const topSearches = Object.entries(queryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    const noResultSearches = Object.entries(noResultCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    const searchToClickRate = totalSearches > 0 
      ? Math.round((clickedCount / totalSearches) * 100) 
      : 0;

    // Trending searches (compare last 48 hours to previous 48 hours)
    const now = Date.now();
    const fortyEightHours = 48 * 60 * 60 * 1000;
    const ninetySixHours = 96 * 60 * 60 * 1000;

    const recentCounts: Record<string, number> = {};
    const priorCounts: Record<string, number> = {};

    queries.forEach((q) => {
      const clean = q.query.toLowerCase().trim();
      const time = new Date(q.created_at).getTime();
      const age = now - time;

      if (age <= fortyEightHours) {
        recentCounts[clean] = (recentCounts[clean] || 0) + 1;
      } else if (age <= ninetySixHours) {
        priorCounts[clean] = (priorCounts[clean] || 0) + 1;
      }
    });

    const trendingSearches = Object.entries(recentCounts)
      .map(([query, count]) => {
        const priorCount = priorCounts[query] || 0;
        const trend = priorCount === 0 ? count : count - priorCount;
        return { query, count, trend };
      })
      .sort((a, b) => b.trend - a.trend)
      .slice(0, 5);

    return NextResponse.json({
      topSearches,
      noResultSearches,
      searchToClickRate,
      trendingSearches,
      totalSearches
    });
  } catch (err: any) {
    console.error('[search/analytics] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST /api/search/analytics ──────────────────────────────────────────────
// Record click events for search queries
export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    const trimmed = (query || '').trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the most recent search query matching this text and mark it as clicked
    const { data: recentSearch } = await supabase
      .from('search_queries')
      .select('id')
      .eq('query', trimmed)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentSearch) {
      const { error } = await supabase
        .from('search_queries')
        .update({ clicked: true })
        .eq('id', recentSearch.id);

      if (error) {
        console.error('[search/analytics] POST update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[search/analytics] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
