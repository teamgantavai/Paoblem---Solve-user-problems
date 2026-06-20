import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    // 2. Fetch popular problems (posts with type = 'problem')
    const { data: dbProblems, error: probErr } = await supabase
      .from('posts')
      .select('*, profiles:user_id(full_name, avatar_url, username)')
      .eq('type', 'problem')
      .order('upvotes', { ascending: false })
      .limit(3);

    // 3. Fetch popular ideas (posts with type = 'idea')
    const { data: dbIdeas, error: ideaErr } = await supabase
      .from('posts')
      .select('*, profiles:user_id(full_name, avatar_url, username)')
      .eq('type', 'idea')
      .order('upvotes', { ascending: false })
      .limit(3);

    // 4. Fetch popular solutions
    const { data: dbSolutions, error: solErr } = await supabase
      .from('solutions')
      .select('*, profiles:user_id(full_name, avatar_url, username), problem:problem_id(title, slug)')
      .order('upvotes', { ascending: false })
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
      solutions
    });
  } catch (err: any) {
    console.error('[trending/route] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
