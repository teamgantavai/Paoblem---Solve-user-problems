import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── GET /api/profile?userId=<id> ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Fetch profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, avatar_url, role, bio, location, created_at')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Fetch post count
    const { count: postCount } = await supabaseAdmin
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Fetch comment count
    const { count: commentCount } = await supabaseAdmin
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Fetch total upvotes received on user's posts
    const { data: posts } = await supabaseAdmin
      .from('posts')
      .select('upvotes')
      .eq('user_id', userId);

    const totalUpvotes = posts?.reduce((sum, p) => sum + (p.upvotes || 0), 0) ?? 0;

    return NextResponse.json({
      profile,
      stats: {
        postCount: postCount ?? 0,
        commentCount: commentCount ?? 0,
        totalUpvotes,
      }
    });
  } catch (err: any) {
    console.error('[GET /api/profile]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── PUT /api/profile ──────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
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

    const body = await req.json();
    const { full_name, role, bio, location } = body;

    // Validate role
    const VALID_ROLES = ['Innovator', 'Founder', 'Builder', 'Developer', 'Designer', 'Investor', 'Maker', 'Researcher'];
    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const updates: Record<string, string | null | undefined> = {};
    if (full_name !== undefined) updates.full_name = full_name?.trim() || null;
    if (role !== undefined) updates.role = role;
    if (bio !== undefined) updates.bio = bio?.trim() || null;
    if (location !== undefined) updates.location = location?.trim() || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('[PUT /api/profile] update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Also update auth metadata so role/name is reflected in session
    if (full_name !== undefined || role !== undefined) {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          ...(full_name !== undefined ? { full_name: updates.full_name } : {}),
          ...(role !== undefined ? { role } : {}),
        }
      });
    }

    return NextResponse.json({ profile: updated });
  } catch (err: any) {
    console.error('[PUT /api/profile]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
