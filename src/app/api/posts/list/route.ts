import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const PAGE_SIZE = 5;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const type = searchParams.get('type');
    const savedIds = searchParams.get('savedIds');

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

    let query = supabase
      .from('posts')
      .select('*, profiles:user_id(full_name, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE + 1);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    if (type === 'problem' || type === 'idea') {
      query = query.eq('type', type);
    } else if (type === 'mine') {
      if (!userId) {
        return NextResponse.json({ posts: [], nextCursor: null, hasMore: false });
      }
      query = query.eq('user_id', userId);
    } else if (type === 'saved') {
      if (!savedIds) {
        return NextResponse.json({ posts: [], nextCursor: null, hasMore: false });
      }
      const idsArray = savedIds.split(',').filter(Boolean);
      if (idsArray.length === 0) {
        return NextResponse.json({ posts: [], nextCursor: null, hasMore: false });
      }
      query = query.in('id', idsArray);
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
