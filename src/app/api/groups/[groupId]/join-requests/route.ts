import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeader, getAdminClient } from '@/lib/auth-fast';
import { sendGroupJoinApprovedEmail } from '@/lib/email';

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

// ── GET /api/groups/[groupId]/join-requests ──────────────────
// Owner/admin: list all pending join requests
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    const { groupId } = await params;
    const myRole = await getMyRole(groupId, userId);
    if (!myRole || !['owner', 'admin'].includes(myRole)) {
      return jsonError('Only admins can view join requests', 403);
    }

    const { data: requests, error } = await db
      .from('group_join_requests')
      .select('id, user_id, status, message, created_at')
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Hydrate profiles
    const userIds = (requests || []).map((r: any) => r.user_id);
    const { data: profiles } = userIds.length
      ? await db.from('profiles').select('id, username, full_name, avatar_url').in('id', userIds)
      : { data: [] };
    const profileById = new Map((profiles || []).map((p: any) => [p.id, p]));

    return NextResponse.json({
      requests: (requests || []).map((r: any) => ({
        ...r,
        profile: profileById.get(r.user_id) || null,
      })),
    });
  } catch (err: any) {
    console.error('[GET /api/groups/[groupId]/join-requests]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}

// ── PATCH /api/groups/[groupId]/join-requests ────────────────
// Approve or reject a join request
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    const { groupId } = await params;
    const myRole = await getMyRole(groupId, userId);
    if (!myRole || !['owner', 'admin'].includes(myRole)) {
      return jsonError('Only admins can manage join requests', 403);
    }

    const body = await req.json();
    const { requestId, action } = body;

    if (!requestId || !['approve', 'reject'].includes(action)) {
      return jsonError('requestId and action (approve|reject) are required', 400);
    }

    const { data: request, error: findError } = await db
      .from('group_join_requests')
      .select('*')
      .eq('id', requestId)
      .eq('group_id', groupId)
      .maybeSingle();

    if (findError) throw findError;
    if (!request) return jsonError('Join request not found', 404);
    if (request.status !== 'pending') return jsonError('Request is no longer pending', 400);

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await db
      .from('group_join_requests')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (action === 'approve') {
      // Add to group members
      const { error: memberError } = await db.from('group_members').insert({
        group_id: groupId,
        user_id: request.user_id,
        role: 'member',
      });
      if (memberError && memberError.code !== '23505') throw memberError;

      // Fetch group info
      const { data: group } = await db
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .single();

      // System message
      const { data: profile } = await db
        .from('profiles')
        .select('username, full_name')
        .eq('id', request.user_id)
        .single();
      const memberName = profile?.full_name || profile?.username || 'A new member';
      await db.from('group_messages').insert({
        group_id: groupId,
        sender_id: request.user_id,
        content: `${memberName} joined the group`,
        message_type: 'system',
      });

      // In-app notification for the approved user
      try {
        await db.from('notifications').insert({
          user_id: request.user_id,
          type: 'group_invite',
          title: `Your request to join "${group?.name}" was approved`,
          body: `You have been approved to join "${group?.name}". Welcome!`,
          read: false,
        });
      } catch (_) { /* non-fatal */ }

      // Email notification
      try {
        const { data: { user } } = await db.auth.admin.getUserById(request.user_id);
        if (user?.email && group?.name) {
          await sendGroupJoinApprovedEmail(user.email, memberName, group.name, groupId);
        }
      } catch (_) { /* non-fatal */ }

    } else {
      // Rejected — optional in-app notification
      try {
        const { data: group } = await db
          .from('groups')
          .select('name')
          .eq('id', groupId)
          .single();

        await db.from('notifications').insert({
          user_id: request.user_id,
          type: 'group_invite',
          title: `Request to join "${group?.name}" was not approved`,
          body: `Your request to join "${group?.name}" was reviewed and not approved at this time.`,
          read: false,
        });
      } catch (_) { /* non-fatal */ }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[PATCH /api/groups/[groupId]/join-requests]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}

// ── DELETE /api/groups/[groupId]/join-requests ───────────────
// User cancels their own pending join request
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    const { groupId } = await params;

    const { error } = await db
      .from('group_join_requests')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /api/groups/[groupId]/join-requests]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}
