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
      .select('id, full_name, avatar_url, role, bio, location, created_at, username, cover_url, reputation, pref_receive_saves, pref_receive_analytics, pref_receive_solutions, pref_receive_replies');

    if (userId) {
      query = query.eq('id', userId);
    } else {
      query = query.eq('username', username);
    }

    let { data: profile, error: profileError } = await query.single();

    if ((profileError || !profile) && userId) {
      console.warn(`[GET /api/profile] Profile missing for user ${userId}, checking auth.users...`);
      const { data: { user }, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (user && !authUserError) {
        console.log(`[GET /api/profile] User exists in auth.users, creating fallback profile...`);
        const fallbackUsername = user.user_metadata?.username || user.email?.split('@')[0] || `user_${userId.slice(0, 8)}`;
        const { data: newProfile, error: profileCreateError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: userId,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Member',
            avatar_url: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`,
            role: user.user_metadata?.role || 'Innovator',
            username: fallbackUsername,
            reputation: 0
          })
          .select()
          .single();

        if (!profileCreateError && newProfile) {
          profile = newProfile;
          profileError = null;
        } else {
          console.error('[GET /api/profile] Failed to create fallback profile:', profileCreateError);
        }
      }
    }

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
    const { 
      full_name, role, bio, location, avatar_url, username, cover_url,
      pref_receive_saves, pref_receive_analytics, pref_receive_solutions, pref_receive_replies 
    } = body;

    // Validate role
    const VALID_ROLES = ['Innovator', 'Founder', 'Builder', 'Developer', 'Designer', 'Investor', 'Maker', 'Researcher'];
    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Fetch current profile to get current username
    const { data: currentProfile, error: getProfileError } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();

    if (getProfileError || !currentProfile) {
      return NextResponse.json({ error: 'Failed to retrieve profile' }, { status: 500 });
    }

    const currentUsername = currentProfile.username;
    let usernameChangedThisTime = false;

    const updates: Record<string, any> = {};
    if (full_name !== undefined) updates.full_name = full_name?.trim() || null;
    if (role !== undefined) updates.role = role;
    if (bio !== undefined) updates.bio = bio?.trim() || null;
    if (location !== undefined) updates.location = location?.trim() || null;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (cover_url !== undefined) updates.cover_url = cover_url;
    if (pref_receive_saves !== undefined) updates.pref_receive_saves = !!pref_receive_saves;
    if (pref_receive_analytics !== undefined) updates.pref_receive_analytics = !!pref_receive_analytics;
    if (pref_receive_solutions !== undefined) updates.pref_receive_solutions = !!pref_receive_solutions;
    if (pref_receive_replies !== undefined) updates.pref_receive_replies = !!pref_receive_replies;
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

      if (cleanUsername !== currentUsername) {
        const usernameChanged = !!user.user_metadata?.username_changed;
        if (usernameChanged) {
          return NextResponse.json({ error: 'Username can only be changed once' }, { status: 400 });
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
        usernameChangedThisTime = true;
      }
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

    // Also update auth metadata so role/name/avatar/username/cover_url is reflected in session
    if (full_name !== undefined || role !== undefined || avatar_url !== undefined || username !== undefined || cover_url !== undefined) {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          ...(full_name !== undefined ? { full_name: updates.full_name } : {}),
          ...(role !== undefined ? { role } : {}),
          ...(avatar_url !== undefined ? { avatar_url } : {}),
          ...(cover_url !== undefined ? { cover_url } : {}),
          ...(username !== undefined ? { username: updates.username } : {}),
          ...(usernameChangedThisTime ? { username_changed: true } : {}),
        }
      });
    }

    return NextResponse.json({ profile: updated });
  } catch (err: any) {
    console.error('[PUT /api/profile]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
