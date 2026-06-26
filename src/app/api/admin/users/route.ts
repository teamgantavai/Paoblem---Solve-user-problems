import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, logAdminAction } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// GET list of users with merging auth details and profile details
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    const { searchParams } = new URL(req.url);

    const search = searchParams.get('search')?.toLowerCase() || '';
    const sortBy = searchParams.get('sortBy') || 'joined'; // 'joined', 'posts', 'comments', 'reputation', 'active'
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // 'asc', 'desc'
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;

    // 1. Fetch profiles and aggregate posts/comments counts in parallel
    const [
      { data: profiles, error: profErr },
      { data: postsCountData },
      { data: commentsCountData },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*'),
      supabaseAdmin.from('posts').select('user_id'),
      supabaseAdmin.from('comments').select('user_id'),
    ]);

    if (profErr) throw profErr;

    // Build helper count maps
    const postsMap: Record<string, number> = {};
    postsCountData?.forEach(p => {
      postsMap[p.user_id] = (postsMap[p.user_id] || 0) + 1;
    });

    const commentsMap: Record<string, number> = {};
    commentsCountData?.forEach(c => {
      commentsMap[c.user_id] = (commentsMap[c.user_id] || 0) + 1;
    });

    // 2. Fetch auth.users using Admin Auth API
    const { data: { users: authUsers }, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
    if (authErr) throw authErr;

    const authMap = new Map<string, any>();
    authUsers.forEach(u => {
      authMap.set(u.id, {
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed_at: u.email_confirmed_at,
        banned_until: (u as any).banned_until,
      });
    });

    // 3. Merge profiles with auth details
    let mergedUsers = profiles.map(p => {
      const authInfo = authMap.get(p.id) || {};
      return {
        id: p.id,
        full_name: p.full_name || 'Anonymous',
        username: p.username || '',
        avatar_url: p.avatar_url || '',
        role: p.role || 'Innovator',
        is_developer: p.is_developer || false,
        online: p.online || false,
        last_seen: p.last_seen || authInfo.last_sign_in_at || p.created_at || authInfo.created_at,
        created_at: p.created_at || authInfo.created_at,
        email: authInfo.email || '',
        email_confirmed: !!authInfo.email_confirmed_at,
        
        // Dynamic stats
        totalPosts: postsMap[p.id] || 0,
        totalComments: commentsMap[p.id] || 0,
        
        // Administrative columns (with safe defaults if migration not applied yet)
        reputation: p.reputation || 0,
        is_verified: !!p.is_verified,
        is_banned: !!p.is_banned,
        suspended_until: p.suspended_until || null,
      };
    });

    // 4. Apply search filter
    if (search) {
      mergedUsers = mergedUsers.filter(
        u =>
          u.full_name.toLowerCase().includes(search) ||
          u.username.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search)
      );
    }

    // 5. Apply sorting
    mergedUsers.sort((a, b) => {
      let valA: any = a.created_at;
      let valB: any = b.created_at;

      if (sortBy === 'posts') {
        valA = a.totalPosts;
        valB = b.totalPosts;
      } else if (sortBy === 'comments') {
        valA = a.totalComments;
        valB = b.totalComments;
      } else if (sortBy === 'reputation') {
        valA = a.reputation;
        valB = b.reputation;
      } else if (sortBy === 'active') {
        valA = a.last_seen;
        valB = b.last_seen;
      }

      if (valA === undefined || valA === null) valA = 0;
      if (valB === undefined || valB === null) valB = 0;

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = mergedUsers.length;
    const paginated = mergedUsers.slice(offset, offset + limit);

    return NextResponse.json({
      users: paginated,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    console.error('[Admin Users API] GET Error:', err);
    return NextResponse.json({ error: err.message || 'Access Denied' }, { status: 403 });
  }
}

// POST actions: ban, unban, suspend, verify, reset_reputation, edit, delete
export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    const body = await req.json();
    const { userId, action, payload } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: 'Missing userId or action' }, { status: 400 });
    }

    // Load existing profile to verify user exists
    const { data: profile, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchErr || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    let result: any = null;

    switch (action) {
      case 'ban':
        // Ban in GoTrue auth (using infinite duration or 100 years)
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: '876000h', // ~100 years
        });
        // Update profile flags
        result = await supabaseAdmin
          .from('profiles')
          .update({ is_banned: true, suspended_until: null })
          .eq('id', userId);
        
        await logAdminAction(admin.id, 'ban_user', 'user', userId, { email: profile.email });
        break;

      case 'unban':
        // Unban in GoTrue auth
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: 'none',
        });
        // Update profile flags
        result = await supabaseAdmin
          .from('profiles')
          .update({ is_banned: false, suspended_until: null })
          .eq('id', userId);

        await logAdminAction(admin.id, 'unban_user', 'user', userId, { email: profile.email });
        break;

      case 'suspend':
        const hours = parseInt(payload?.hours || '24', 10);
        const suspendedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
        
        // Ban in GoTrue auth for specific duration
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: `${hours}h`,
        });
        // Update profile status
        result = await supabaseAdmin
          .from('profiles')
          .update({ suspended_until: suspendedUntil, is_banned: false })
          .eq('id', userId);

        await logAdminAction(admin.id, 'suspend_user', 'user', userId, { hours, until: suspendedUntil });
        break;

      case 'verify':
        result = await supabaseAdmin
          .from('profiles')
          .update({ is_verified: true })
          .eq('id', userId);

        await logAdminAction(admin.id, 'verify_user', 'user', userId);
        break;

      case 'unverify':
        result = await supabaseAdmin
          .from('profiles')
          .update({ is_verified: false })
          .eq('id', userId);

        await logAdminAction(admin.id, 'unverify_user', 'user', userId);
        break;

      case 'reset_reputation':
        result = await supabaseAdmin
          .from('profiles')
          .update({ reputation: 0 })
          .eq('id', userId);

        await logAdminAction(admin.id, 'reset_reputation', 'user', userId);
        break;

      case 'edit':
        const { full_name, username, role } = payload || {};
        result = await supabaseAdmin
          .from('profiles')
          .update({
            full_name,
            username,
            role,
          })
          .eq('id', userId);

        await logAdminAction(admin.id, 'edit_user', 'user', userId, { full_name, username, role });
        break;

      case 'delete':
        // Auth delete will trigger CASCADE profile delete because of foreign key constraint
        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (delErr) throw delErr;

        await logAdminAction(admin.id, 'delete_user_account', 'user', userId, { username: profile.username });
        return NextResponse.json({ success: true, message: 'Account deleted successfully' });

      default:
        return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    if (result && result.error) {
      throw result.error;
    }

    return NextResponse.json({ success: true, message: `Action ${action} completed successfully` });
  } catch (err: any) {
    console.error('[Admin Users Action API] Error:', err);
    return NextResponse.json({ error: err.message || 'Action failed' }, { status: 500 });
  }
}
