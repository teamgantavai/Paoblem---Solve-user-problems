import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const PAGE_SIZE = 10;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const type = searchParams.get('type');

    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('posts')
      .select('*, profiles:user_id(full_name, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE + 1);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    if (type && (type === 'problem' || type === 'idea')) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[posts/list] Supabase error:', JSON.stringify(error));
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const hasMore = (data?.length || 0) > PAGE_SIZE;
    const posts = hasMore ? data!.slice(0, PAGE_SIZE) : (data || []);
    const nextCursor = hasMore ? posts[posts.length - 1].created_at : null;

    return NextResponse.json({
      posts,
      nextCursor,
      hasMore,
    });
  } catch (err) {
    console.error('[posts/list] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
