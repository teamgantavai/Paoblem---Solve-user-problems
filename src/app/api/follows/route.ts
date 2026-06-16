import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { enqueueNotification } from '@/lib/queue';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Initialize admin client to run count queries and bypass user restriction if needed
const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
);

// ── GET: Get follow status and counts ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const targetUserId = req.nextUrl.searchParams.get('userId');
    if (!targetUserId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Get current logged-in user (optional)
    const authHeader = req.headers.get('Authorization');
    let currentUserId: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) currentUserId = user.id;
    }

    // Fetch counts
    const { count: followersCount } = await supabaseAdmin
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', targetUserId);

    const { count: followingCount } = await supabaseAdmin
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', targetUserId);

    let isFollowing = false;
    if (currentUserId && currentUserId !== targetUserId) {
      const { data } = await supabaseAdmin
        .from('follows')
        .select('*')
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId)
        .maybeSingle();
      if (data) isFollowing = true;
    }

    return NextResponse.json({
      followersCount: followersCount || 0,
      followingCount: followingCount || 0,
      isFollowing,
    });
  } catch (err: any) {
    console.error('[GET /api/follows]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST: Toggle follow status ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { targetUserId } = await req.json();
    if (!targetUserId) {
      return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 });
    }

    if (user.id === targetUserId) {
      return NextResponse.json({ error: 'You cannot follow yourself' }, { status: 400 });
    }

    // Check if already following
    const { data: existing } = await supabaseAdmin
      .from('follows')
      .select('*')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .maybeSingle();

    if (existing) {
      // Unfollow
      const { error } = await supabaseAdmin
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId);

      if (error) throw error;
      return NextResponse.json({ isFollowing: false });
    } else {
      // Follow
      const { error } = await supabaseAdmin
        .from('follows')
        .insert({
          follower_id: user.id,
          following_id: targetUserId,
        });

      if (error) throw error;

      try {
        await enqueueNotification('follow', {
          user_id: targetUserId,
          actor_id: user.id,
          type: 'follow',
          title: 'New Follower',
          bodyTemplate: '{name} started following you.',
        });
      } catch (notifErr) {
        console.error('Failed to enqueue follow notification:', notifErr);
      }

      return NextResponse.json({ isFollowing: true });
    }
  } catch (err: any) {
    console.error('[POST /api/follows]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
