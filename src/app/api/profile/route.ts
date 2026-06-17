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
    const username = req.nextUrl.searchParams.get('username');
    if (!userId && !username) {
      return NextResponse.json({ error: 'userId or username is required' }, { status: 400 });
    }

    // Fetch profile
    let query = supabaseAdmin
      .from('profiles')
      .select('id, full_name, avatar_url, role, bio, location, created_at, username');

    if (userId) {
      query = query.eq('id', userId);
    } else {
      query = query.eq('username', username);
    }

    const { data: profile, error: profileError } = await query.single();

    if (profileError || !profile) {
      console.error('[GET /api/profile] profileError:', profileError, 'profile:', profile);
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const targetUserId = profile.id;

    // Fetch post count
    const { count: postCount } = await supabaseAdmin
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', targetUserId);

    // Fetch comment count
    const { count: commentCount } = await supabaseAdmin
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', targetUserId);

    // Fetch total upvotes received on user's posts
    const { data: posts } = await supabaseAdmin
      .from('posts')
      .select('upvotes')
      .eq('user_id', targetUserId);

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
    const { full_name, role, bio, location, avatar_url, username } = body;

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
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (username !== undefined) {
      const cleanUsername = username?.trim().toLowerCase();
      if (!cleanUsername) {
        return NextResponse.json({ error: 'Username cannot be empty' }, { status: 400 });
      }
      if (cleanUsername.length < 3) {
        return NextResponse.json({ error: 'Username must be at least 3 characters' }, { status: 400 });
      }
      if (/[^a-z0-9_]/.test(cleanUsername)) {
        return NextResponse.json({ error: 'Username can only contain lowercase letters, numbers, and underscores' }, { status: 400 });
      }

      // Check if username is already taken by another user
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .neq('id', user.id)
        .maybeSingle();

      if (checkError) {
        return NextResponse.json({ error: 'Failed to validate username' }, { status: 500 });
      }
      if (existing) {
        return NextResponse.json({ error: 'Username is already taken' }, { status: 400 });
      }

      updates.username = cleanUsername;
    }

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

    // Also update auth metadata so role/name/avatar/username is reflected in session
    if (full_name !== undefined || role !== undefined || avatar_url !== undefined || username !== undefined) {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          ...(full_name !== undefined ? { full_name: updates.full_name } : {}),
          ...(role !== undefined ? { role } : {}),
          ...(avatar_url !== undefined ? { avatar_url } : {}),
          ...(username !== undefined ? { username: updates.username } : {}),
        }
      });
    }

    return NextResponse.json({ profile: updated });
  } catch (err: any) {
    console.error('[PUT /api/profile]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
