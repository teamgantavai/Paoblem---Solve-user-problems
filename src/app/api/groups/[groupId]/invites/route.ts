import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeader, getAdminClient } from '@/lib/auth-fast';
import { sendGroupInviteEmail, sendGroupInviteAcceptedEmail } from '@/lib/email';
import crypto from 'crypto';

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

// ── GET /api/groups/[groupId]/invites ──────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    const { groupId } = await params;
    const role = await getMyRole(groupId, userId);

    // Members can see invites sent to them; admins can see all
    const { data: invites, error } = await db
      .from('group_invites')
      .select('id, group_id, invited_by, invited_user_id, invite_code, status, expires_at, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const visible = (invites || []).filter((inv: any) => {
      if (['owner', 'admin'].includes(role || '')) return true;
      return inv.invited_user_id === userId || inv.invited_by === userId;
    });

    // Hydrate profiles
    const userIds = Array.from(new Set([
      ...visible.map((i: any) => i.invited_by),
      ...visible.map((i: any) => i.invited_user_id).filter(Boolean),
    ]));
    const { data: profiles } = userIds.length
      ? await db.from('profiles').select('id, username, full_name, avatar_url').in('id', userIds)
      : { data: [] };
    const profileById = new Map((profiles || []).map((p: any) => [p.id, p]));

    return NextResponse.json({
      invites: visible.map((inv: any) => ({
        ...inv,
        invited_by_profile: profileById.get(inv.invited_by),
        invited_user_profile: inv.invited_user_id ? profileById.get(inv.invited_user_id) : null,
      })),
    });
  } catch (err: any) {
    console.error('[GET /api/groups/[groupId]/invites]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}

// ── POST /api/groups/[groupId]/invites ─────────────────────────
// Create a user invite or generate a shareable link
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    const { groupId } = await params;
    const myRole = await getMyRole(groupId, userId);

    // Check invite permission
    const { data: group } = await db
      .from('groups')
      .select('invite_permission, name')
      .eq('id', groupId)
      .single();

    const roleRank: Record<string, number> = { owner: 4, admin: 3, moderator: 2, member: 1 };
    const required = roleRank[group?.invite_permission || 'admin'] || 3;
    if ((roleRank[myRole || ''] || 0) < required) {
      return jsonError('You do not have permission to invite members', 403);
    }

    const body = await req.json();

    // Generate shareable link
    if (body.type === 'link') {
      const expiresAt = body.expires_days
        ? new Date(Date.now() + Number(body.expires_days) * 86_400_000).toISOString()
        : new Date(Date.now() + 7 * 86_400_000).toISOString(); // 7 days default

      const code = crypto.randomBytes(10).toString('hex');

      const { data: invite, error } = await db
        .from('group_invites')
        .insert({
          group_id: groupId,
          invited_by: userId,
          invite_code: code,
          expires_at: expiresAt,
        })
        .select('*')
        .single();

      if (error) throw error;
      return NextResponse.json({ invite, link: `${process.env.NEXT_PUBLIC_APP_URL || ''}/groups/invite/${code}` }, { status: 201 });
    }

    // Invite by username or userId
    let invitedUserId = body.userId ? String(body.userId) : null;
    if (!invitedUserId && body.username) {
      const { data: profile } = await db
        .from('profiles')
        .select('id')
        .eq('username', body.username.replace('@', ''))
        .maybeSingle();
      invitedUserId = profile?.id || null;
    }

    if (!invitedUserId) return jsonError('User not found', 404);
    if (invitedUserId === userId) return jsonError('Cannot invite yourself', 400);

    // Check if already a member
    const { data: existing } = await db
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('user_id', invitedUserId)
      .maybeSingle();
    if (existing) return jsonError('User is already a member of this group', 409);

    // Check for pending invite
    const { data: pendingInvite } = await db
      .from('group_invites')
      .select('id')
      .eq('group_id', groupId)
      .eq('invited_user_id', invitedUserId)
      .eq('status', 'pending')
      .maybeSingle();
    if (pendingInvite) return jsonError('User already has a pending invite', 409);

    const { data: invite, error } = await db
      .from('group_invites')
      .insert({
        group_id: groupId,
        invited_by: userId,
        invited_user_id: invitedUserId,
        expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      })
      .select('*')
      .single();

    if (error) throw error;

    // In-app notification + email to invited user
    try {
      const { data: inviterProfile } = await db
        .from('profiles')
        .select('username, full_name')
        .eq('id', userId)
        .single();
      const inviterName = inviterProfile?.full_name || inviterProfile?.username || 'Someone';

      await db.from('notifications').insert({
        user_id: invitedUserId,
        type: 'group_invite',
        title: `You've been invited to join "${group?.name}"`,
        body: `${inviterName} invited you to join "${group?.name}". Open your invitations to accept or decline.`,
        read: false,
      });

      // Email the invited user
      const { data: { user: invitedAuthUser } } = await db.auth.admin.getUserById(invitedUserId);
      if (invitedAuthUser?.email && group?.name) {
        const { data: invitedProfile } = await db
          .from('profiles')
          .select('full_name, username')
          .eq('id', invitedUserId)
          .single();
        const inviteeName = invitedProfile?.full_name || invitedProfile?.username || 'there';
        await sendGroupInviteEmail(
          invitedAuthUser.email,
          inviteeName,
          inviterName,
          group.name,
          invite.id,
          invite.group_id
        );
      }
    } catch (_) { /* non-fatal */ }

    return NextResponse.json({ invite }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/groups/[groupId]/invites]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}

// ── PATCH /api/groups/[groupId]/invites ────────────────────────
// Accept or decline an invite
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    const { groupId } = await params;
    const body = await req.json();
    const { inviteId, status } = body;

    if (!inviteId || !['accepted', 'declined'].includes(status)) {
      return jsonError('inviteId and valid status (accepted/declined) required', 400);
    }

    const { data: invite, error: findError } = await db
      .from('group_invites')
      .select('*')
      .eq('id', inviteId)
      .eq('invited_user_id', userId)
      .maybeSingle();

    if (findError) throw findError;
    if (!invite) return jsonError('Invite not found or does not belong to you', 404);
    if (invite.status !== 'pending') return jsonError('Invite is no longer pending', 400);
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await db.from('group_invites').update({ status: 'expired' }).eq('id', inviteId);
      return jsonError('Invite has expired', 410);
    }

    await db.from('group_invites').update({ status }).eq('id', inviteId);

    if (status === 'accepted') {
      // Add member
      const { error: memberError } = await db.from('group_members').insert({
        group_id: groupId,
        user_id: userId,
        role: 'member',
      });
      if (memberError && memberError.code !== '23505') throw memberError;

      // System message
      const { data: profile } = await db
        .from('profiles')
        .select('username, full_name')
        .eq('id', userId)
        .single();
      const name = profile?.full_name || profile?.username || 'A new member';
      await db.from('group_messages').insert({
        group_id: groupId,
        sender_id: userId,
        content: `${name} joined the group`,
        message_type: 'system',
      });

      // Notify inviter + send confirmation email
      try {
        const { data: group } = await db
          .from('groups')
          .select('name')
          .eq('id', groupId)
          .single();

        // In-app notification for the inviter
        if (invite.invited_by) {
          try {
            await db.from('notifications').insert({
              user_id: invite.invited_by,
              type: 'group_invite',
              title: `${name} accepted your invitation`,
              body: `${name} joined "${group?.name}" after accepting your invitation.`,
              read: false,
            });
          } catch (_) { /* non-fatal */ }
        }

        // Confirmation email to the new member
        const { data: { user: newMemberAuth } } = await db.auth.admin.getUserById(userId);
        if (newMemberAuth?.email && group?.name) {
          await sendGroupInviteAcceptedEmail(newMemberAuth.email, name, group.name, groupId);
        }
      } catch (_) { /* non-fatal */ }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[PATCH /api/groups/[groupId]/invites]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}

// ── DELETE /api/groups/[groupId]/invites ───────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    const { groupId } = await params;
    const { inviteId } = await req.json();
    if (!inviteId) return jsonError('inviteId is required', 400);

    const myRole = await getMyRole(groupId, userId);
    const { error } = await db
      .from('group_invites')
      .delete()
      .eq('id', inviteId)
      .or(`invited_by.eq.${userId},group_id.eq.${groupId}${['owner', 'admin'].includes(myRole || '') ? '' : '.and.invited_by.eq.' + userId}`);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /api/groups/[groupId]/invites]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}
