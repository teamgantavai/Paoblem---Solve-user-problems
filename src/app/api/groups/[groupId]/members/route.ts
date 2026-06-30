import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeader, getAdminClient } from '@/lib/auth-fast';
import { sendGroupJoinRequestEmail } from '@/lib/email';

/* eslint-disable @typescript-eslint/no-explicit-any */

const db = getAdminClient();

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function getMyRole(groupId: string, userId: string): Promise<string | null> {
  const { data } = await db
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  return data?.role || null;
}

// ── GET /api/groups/[groupId]/members ──────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    const { groupId } = await params;
    const role = await getMyRole(groupId, userId);
    if (!role) return jsonError('Forbidden', 403);

    const { data: members, error } = await db
      .from('group_members')
      .select('user_id, role, muted_until, joined_at')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });

    if (error) throw error;

    const userIds = (members || []).map((m: any) => m.user_id);
    const { data: profiles } = userIds.length
      ? await db.from('profiles').select('id, username, full_name, avatar_url').in('id', userIds)
      : { data: [] };
    const profileById = new Map((profiles || []).map((p: any) => [p.id, p]));

    // Fetch presence
    const { data: presenceRows } = userIds.length
      ? await db.from('user_presence').select('user_id, is_online, last_seen_at').in('user_id', userIds)
      : { data: [] };
    const presenceById = new Map((presenceRows || []).map((p: any) => [p.user_id, p]));

    const result = (members || []).map((m: any) => ({
      user_id: m.user_id,
      role: m.role,
      muted_until: m.muted_until,
      joined_at: m.joined_at,
      profile: profileById.get(m.user_id) || null,
      is_online: !!presenceById.get(m.user_id)?.is_online,
      last_seen_at: presenceById.get(m.user_id)?.last_seen_at || null,
    }));

    return NextResponse.json({ members: result });
  } catch (err: any) {
    console.error('[GET /api/groups/[groupId]/members]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}

// ── POST /api/groups/[groupId]/members ─────────────────────────
// Public groups: create a join request (requires admin approval).
// Private groups: only admin+ can add members directly.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    const { groupId } = await params;
    const body = await req.json();
    const targetUserId = String(body.userId || userId);

    // Check if already a member
    const { data: existing } = await db
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (existing) return NextResponse.json({ success: true, already_member: true });

    // If adding someone else, must be admin+
    if (targetUserId !== userId) {
      const role = await getMyRole(groupId, userId);
      if (!role || !['owner', 'admin'].includes(role)) {
        return jsonError('Only admins can add members directly', 403);
      }

      // Direct add (by admins only)
      const { error } = await db.from('group_members').insert({
        group_id: groupId,
        user_id: targetUserId,
        role: 'member',
      });
      if (error) throw error;

      const { data: profile } = await db
        .from('profiles')
        .select('username, full_name')
        .eq('id', targetUserId)
        .single();
      const memberName = profile?.full_name || profile?.username || 'A new member';
      await db.from('group_messages').insert({
        group_id: groupId,
        sender_id: targetUserId,
        content: `${memberName} joined the group`,
        message_type: 'system',
      });

      return NextResponse.json({ success: true }, { status: 201 });
    }

    // Self-join flow
    const { data: group } = await db
      .from('groups')
      .select('privacy, name')
      .eq('id', groupId)
      .single();

    if (group?.privacy === 'private') {
      return jsonError('This group is private. You need an invite to join.', 403);
    }

    // Public group — check for existing pending request
    const { data: existingRequest } = await db
      .from('group_join_requests')
      .select('id, status')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingRequest?.status === 'pending') {
      return NextResponse.json({ success: true, status: 'pending' });
    }

    // Create / reset a join request
    const { error: reqError } = await db.from('group_join_requests').upsert({
      group_id: groupId,
      user_id: userId,
      status: 'pending',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'group_id,user_id' });

    if (reqError) throw reqError;

    // Fetch requester profile for notifications
    const { data: requesterProfile } = await db
      .from('profiles')
      .select('username, full_name')
      .eq('id', userId)
      .single();
    const requesterName = requesterProfile?.full_name || requesterProfile?.username || 'Someone';

    // Notify group owners and admins in-app + email
    try {
      const { data: admins } = await db
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .in('role', ['owner', 'admin']);

      for (const admin of (admins || [])) {
        try {
          await db.from('notifications').insert({
            user_id: admin.user_id,
            type: 'group_invite',
            title: `New join request for "${group?.name}"`,
            body: `${requesterName} has requested to join "${group?.name}"`,
            read: false,
          });
        } catch (_) { /* non-fatal */ }

        try {
          const { data: { user } } = await db.auth.admin.getUserById(admin.user_id);
          if (user?.email && group?.name) {
            await sendGroupJoinRequestEmail(user.email, requesterName, group.name, groupId);
          }
        } catch (_) { /* non-fatal */ }
      }
    } catch (_) { /* non-fatal */ }

    return NextResponse.json({ success: true, status: 'pending' }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/groups/[groupId]/members]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}

// ── PATCH /api/groups/[groupId]/members ────────────────────────
// Change role (owner only for admin, admin for mod/member) or mute
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    const { groupId } = await params;
    const myRole = await getMyRole(groupId, userId);
    if (!myRole) return jsonError('Forbidden', 403);

    const body = await req.json();
    const targetUserId = String(body.userId || '');
    if (!targetUserId) return jsonError('userId is required', 400);
    if (targetUserId === userId) return jsonError('Cannot modify your own role', 400);

    const roleRank: Record<string, number> = { owner: 4, admin: 3, moderator: 2, member: 1 };

    // Role change
    if (body.action === 'set_role' && body.role) {
      const newRole = body.role;
      if (!['owner', 'admin', 'moderator', 'member'].includes(newRole)) {
        return jsonError('Invalid role', 400);
      }

      // Only owner can set admin; admin can set mod/member
      if (newRole === 'owner' && myRole !== 'owner') {
        return jsonError('Only the current owner can transfer ownership', 403);
      }
      if (newRole === 'admin' && myRole !== 'owner') {
        return jsonError('Only the owner can assign admins', 403);
      }
      if (['moderator', 'member'].includes(newRole) && (roleRank[myRole] || 1) < 3) {
        return jsonError('You need to be an admin or owner', 403);
      }

      const { error } = await db
        .from('group_members')
        .update({ role: newRole })
        .eq('group_id', groupId)
        .eq('user_id', targetUserId);

      if (error) throw error;

      // If transferring ownership, demote current owner to admin
      if (newRole === 'owner') {
        await db
          .from('group_members')
          .update({ role: 'admin' })
          .eq('group_id', groupId)
          .eq('user_id', userId);
      }

      return NextResponse.json({ success: true });
    }

    // Mute
    if (body.action === 'mute') {
      if ((roleRank[myRole] || 1) < 2) return jsonError('Moderator permission required', 403);

      const mutedUntil = body.duration_minutes
        ? new Date(Date.now() + Number(body.duration_minutes) * 60_000).toISOString()
        : null;

      const { error } = await db
        .from('group_members')
        .update({ muted_until: mutedUntil })
        .eq('group_id', groupId)
        .eq('user_id', targetUserId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return jsonError('Unsupported action', 400);
  } catch (err: any) {
    console.error('[PATCH /api/groups/[groupId]/members]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}

// ── DELETE /api/groups/[groupId]/members ───────────────────────
// Remove a member (admin+) or leave self
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    const { groupId } = await params;
    const body = await req.json();
    const targetUserId = String(body.userId || userId);

    if (targetUserId !== userId) {
      const myRole = await getMyRole(groupId, userId);
      if (!myRole || !['owner', 'admin'].includes(myRole)) {
        return jsonError('Only admins can remove members', 403);
      }
      // Prevent removing owner
      const targetRole = await getMyRole(groupId, targetUserId);
      if (targetRole === 'owner') {
        return jsonError('Cannot remove the group owner', 403);
      }
    }

    const { error } = await db
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', targetUserId);

    if (error) throw error;

    // System message
    const { data: profile } = await db
      .from('profiles')
      .select('username, full_name')
      .eq('id', targetUserId)
      .single();

    const name = profile?.full_name || profile?.username || 'A member';
    const isLeaving = targetUserId === userId;
    await db.from('group_messages').insert({
      group_id: groupId,
      sender_id: targetUserId,
      content: isLeaving ? `${name} left the group` : `${name} was removed from the group`,
      message_type: 'system',
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /api/groups/[groupId]/members]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}
