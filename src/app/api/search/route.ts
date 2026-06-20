import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '5', 10);

    const supabase = createClient(supabaseUrl, supabaseKey);

    let userId: string | null = null;
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
      }
    }

    const trimmedQuery = q.trim();
    if (!trimmedQuery) {
      return NextResponse.json({
        problems: [],
        ideas: [],
        solutions: [],
        users: []
      });
    }

    // Call unified RPC search function
    const { data: searchResults, error: searchError } = await supabase.rpc('search_all', {
      query_text: trimmedQuery,
      limit_per_type: limit
    });

    if (searchError) {
      console.error('[search/route] search_all rpc error:', searchError);
      return NextResponse.json({ error: searchError.message }, { status: 500 });
    }

    // Parse the JSONB result
    const results = typeof searchResults === 'string' ? JSON.parse(searchResults) : searchResults;

    const problems = results?.problems || [];
    const ideas = results?.ideas || [];
    const solutions = results?.solutions || [];
    const users = results?.users || [];

    const totalResults = problems.length + ideas.length + solutions.length + users.length;

    // Track search query asynchronously in search_queries
    // Do not block response for tracking
    supabase.from('search_queries').insert({
      user_id: userId,
      query: trimmedQuery,
      results_count: totalResults,
      clicked: false
    }).then(({ error: trackError }) => {
      if (trackError) {
        console.error('[search/route] Failed to insert search query tracker:', trackError);
      }
    });

    return NextResponse.json({
      problems,
      ideas,
      solutions,
      users
    });
  } catch (err: any) {
    console.error('[search/route] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
