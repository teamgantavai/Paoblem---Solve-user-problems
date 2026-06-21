import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// GET /api/follows/list?userId=xxx&type=followers|following
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    const type = req.nextUrl.searchParams.get('type'); // 'followers' or 'following'

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    if (type !== 'followers' && type !== 'following') {
      return NextResponse.json({ error: 'type must be followers or following' }, { status: 400 });
    }

    let userIds: string[] = [];

    if (type === 'followers') {
      // People who follow this user (follower_id → following_id = userId)
      const { data, error } = await supabaseAdmin
        .from('follows')
        .select('follower_id')
        .eq('following_id', userId);

      if (error) throw error;
      userIds = (data || []).map((r: { follower_id: string }) => r.follower_id);
    } else {
      // People this user follows (following_id → follower_id = userId)
      const { data, error } = await supabaseAdmin
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      if (error) throw error;
      userIds = (data || []).map((r: { following_id: string }) => r.following_id);
    }

    if (userIds.length === 0) {
      return NextResponse.json({ users: [] });
    }

    // Fetch profiles for all those user IDs
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, username, avatar_url, role, bio')
      .in('id', userIds);

    if (profileError) throw profileError;

    return NextResponse.json({ users: profiles || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[GET /api/follows/list]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
