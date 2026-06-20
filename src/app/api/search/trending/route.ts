import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildTrendingSections } from '@/lib/recommendations';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get trending search terms from the search_queries table (last 7 days)
    let trendingTerms: string[] = [];
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: queryData } = await supabase
        .from('search_queries')
        .select('query')
        .gte('created_at', sevenDaysAgo);

      if (queryData && queryData.length > 0) {
        const counts: Record<string, number> = {};
        queryData.forEach((row) => {
          const q = row.query.toLowerCase().trim();
          if (q.length >= 2) {
            counts[q] = (counts[q] || 0) + 1;
          }
        });
        trendingTerms = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([q]) => q);
      }
    } catch (e) {
      console.warn('[trending/route] Failed to fetch trending terms:', e);
    }

    // Default terms fallback if none exist
    if (trendingTerms.length === 0) {
      trendingTerms = ['ai', 'recruiting', 'design', 'developer', 'startup'];
    }

    const sinceWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 2. Fetch platform-wide candidates and recent interactions.
    const { data: dbPosts } = await supabase
      .from('posts')
      .select('*, profiles:user_id(full_name, avatar_url, username), solutions_count:solutions(count)')
      .order('upvotes', { ascending: false })
      .order('comments_count', { ascending: false })
      .limit(120);

    const { data: interactions } = await supabase
      .from('post_events')
      .select('post_id, event_type, metadata, created_at')
      .gte('created_at', sinceWeek)
      .limit(2000);

    const normalizedPosts = (dbPosts || []).map((post: any) => ({
      ...post,
      solutions_count: Array.isArray(post.solutions_count) ? Number(post.solutions_count[0]?.count || 0) : Number(post.solutions_count || 0),
    }));

    const sections = buildTrendingSections(normalizedPosts, interactions || []);
    const dbProblems = sections.trendingToday.filter((post: any) => post.type === 'problem').slice(0, 3);
    const dbIdeas = sections.trendingThisWeek.filter((post: any) => post.type === 'idea').slice(0, 3);

    // 3. Fetch platform-wide trending solutions.
    const { data: dbSolutions, error: solErr } = await supabase
      .from('solutions')
      .select('*, profiles:user_id(full_name, avatar_url, username), problem:problem_id(title, slug)')
      .order('upvotes', { ascending: false })
      .order('comments_count', { ascending: false })
      .limit(3);

    // Map database results to frontend SearchResult types
    const problems = (dbProblems || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      body_snippet: p.body.slice(0, 120),
      type: p.type,
      slug: p.slug,
      upvotes: p.upvotes,
      comments_count: p.comments_count,
      views_count: p.views_count,
      created_at: p.created_at,
      author: p.profiles || null,
      rank: p.upvotes
    }));

    const ideas = (dbIdeas || []).map((i: any) => ({
      id: i.id,
      title: i.title,
      body_snippet: i.body.slice(0, 120),
      type: i.type,
      slug: i.slug,
      upvotes: i.upvotes,
      comments_count: i.comments_count,
      views_count: i.views_count,
      created_at: i.created_at,
      author: i.profiles || null,
      rank: i.upvotes
    }));

    const solutions = (dbSolutions || []).map((s: any) => ({
      id: s.id,
      title: s.title,
      body_snippet: s.body.slice(0, 120),
      problem_id: s.problem_id,
      problem_title: s.problem?.title || 'Related Problem',
      upvotes: s.upvotes,
      created_at: s.created_at,
      author: s.profiles || null,
      rank: s.upvotes
    }));

    return NextResponse.json({
      searches: trendingTerms,
      problems,
      ideas,
      solutions,
      sections: {
        trendingToday: sections.trendingToday.slice(0, 10).map(toPostResult),
        trendingThisWeek: sections.trendingThisWeek.slice(0, 10).map(toPostResult),
        mostSolved: sections.mostSolved.slice(0, 10).map(toPostResult),
        mostDiscussed: sections.mostDiscussed.slice(0, 10).map(toPostResult),
      },
    });
  } catch (err: any) {
    console.error('[trending/route] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function toPostResult(p: any) {
  return {
    id: p.id,
    title: p.title,
    body_snippet: (p.body || '').slice(0, 120),
    type: p.type,
    slug: p.slug,
    upvotes: p.upvotes,
    comments_count: p.comments_count,
    views_count: p.views_count,
    created_at: p.created_at,
    author: p.profiles || null,
    rank: p.recommendation_score || p.upvotes || 0,
  };
}
