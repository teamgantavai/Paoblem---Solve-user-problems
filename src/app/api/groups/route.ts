import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeader, getAdminClient } from '@/lib/auth-fast';

/* eslint-disable @typescript-eslint/no-explicit-any */

const db = getAdminClient();

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// ── GET /api/groups ────────────────────────────────────────────
// Returns all groups the current user is a member of.
export async function GET(req: NextRequest) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    // Fetch memberships
    const { data: memberships, error: memberError } = await db
      .from('group_members')
      .select('group_id, role, joined_at, last_read_at')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });

    if (memberError) throw memberError;
    if (!memberships?.length) return NextResponse.json({ groups: [] });

    const groupIds = memberships.map((m: any) => m.group_id);

    // Fetch group details
    const { data: groups, error: groupError } = await db
      .from('groups')
      .select('id, name, description, avatar_url, category, privacy, last_message_at, member_count, created_at, updated_at')
      .in('id', groupIds)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (groupError) throw groupError;

    // Fetch latest message per group for preview
    const { data: lastMessages, error: lastMsgError } = await db
      .from('group_messages')
      .select('id, group_id, sender_id, content, message_type, attachments, created_at, deleted_at')
      .in('group_id', groupIds)
      .order('created_at', { ascending: false });

    if (lastMsgError) throw lastMsgError;

    // Build last-message-per-group map (first row for each group)
    const lastMessageByGroup = new Map<string, any>();
    (lastMessages || []).forEach((msg: any) => {
      if (!lastMessageByGroup.has(msg.group_id)) {
        lastMessageByGroup.set(msg.group_id, msg);
      }
    });

    // Fetch sender profiles for last messages
    const senderIds = Array.from(new Set(
      Array.from(lastMessageByGroup.values()).map((m: any) => m.sender_id).filter(Boolean)
    ));
    const { data: profiles } = senderIds.length
      ? await db.from('profiles').select('id, username, full_name, avatar_url').in('id', senderIds)
      : { data: [] };
    const profileById = new Map((profiles || []).map((p: any) => [p.id, p]));

    // Count unread messages per group
    const unreadByGroup = new Map<string, number>();
    const membershipMap = new Map((memberships || []).map((m: any) => [m.group_id, m]));
    for (const groupId of groupIds) {
      const membership = membershipMap.get(groupId);
      const lastReadAt = membership?.last_read_at;
      let query = db
        .from('group_messages')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', groupId)
        .neq('sender_id', userId)
        .is('deleted_at', null);
      if (lastReadAt) query = query.gt('created_at', lastReadAt);
      const { count } = await query;
      unreadByGroup.set(groupId, count || 0);
    }

    const result = (groups || []).map((group: any) => {
      const membership = membershipMap.get(group.id);
      const lastMsg = lastMessageByGroup.get(group.id);
      const lastMsgSender = lastMsg ? profileById.get(lastMsg.sender_id) : null;
      return {
        ...group,
        my_role: membership?.role || 'member',
        joined_at: membership?.joined_at,
        unread_count: unreadByGroup.get(group.id) || 0,
        last_message: lastMsg
          ? {
              id: lastMsg.id,
              content: lastMsg.deleted_at ? 'This message was deleted' : lastMsg.content,
              message_type: lastMsg.message_type,
              sender: lastMsgSender,
              created_at: lastMsg.created_at,
            }
          : null,
      };
    });

    return NextResponse.json({ groups: result });
  } catch (err: any) {
    console.error('[GET /api/groups]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}

// ── POST /api/groups ───────────────────────────────────────────
// Create a new group. Creator automatically becomes owner.
export async function POST(req: NextRequest) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) return jsonError('Group name is required', 400);
    if (name.length > 100) return jsonError('Group name must be 100 characters or fewer', 400);

    const description = String(body.description || '').trim().slice(0, 500) || null;
    const avatarUrl = body.avatarUrl ? String(body.avatarUrl) : null;
    const bannerUrl = body.bannerUrl ? String(body.bannerUrl) : null;
    const category = body.category ? String(body.category).trim().slice(0, 50) : null;
    const privacy = ['public', 'private'].includes(body.privacy) ? body.privacy : 'public';
    const invitePermission = ['owner', 'admin', 'member'].includes(body.invitePermission)
      ? body.invitePermission : 'admin';
    const messagePermission = ['owner', 'admin', 'moderator', 'member'].includes(body.messagePermission)
      ? body.messagePermission : 'member';
    const memberIds: string[] = Array.isArray(body.memberIds) ? body.memberIds.filter((id: any) => typeof id === 'string' && id !== userId) : [];

    // Create group
    const { data: group, error: createError } = await db
      .from('groups')
      .insert({
        name,
        description,
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
        category,
        privacy,
        invite_permission: invitePermission,
        message_permission: messagePermission,
        created_by: userId,
      })
      .select('*')
      .single();

    if (createError) throw createError;

    // Add creator as owner
    const { error: ownerError } = await db
      .from('group_members')
      .insert({ group_id: group.id, user_id: userId, role: 'owner' });

    if (ownerError) throw ownerError;

    // Add initial members as regular members
    if (memberIds.length > 0) {
      const memberRows = memberIds.map((uid: string) => ({
        group_id: group.id,
        user_id: uid,
        role: 'member',
      }));
      await db.from('group_members').insert(memberRows);

      // Create invites/notifications for invited members
      try {
        const { data: inviterProfile } = await db
          .from('profiles')
          .select('username, full_name')
          .eq('id', userId)
          .single();

        const inviterName = inviterProfile?.full_name || inviterProfile?.username || 'Someone';
        const notifRows = memberIds.map((uid: string) => ({
          user_id: uid,
          type: 'group_invite',
          title: 'Added to a group',
          body: `@${inviterProfile?.username || userId} added you to "${name}"`,
          read: false,
        }));
        await db.from('notifications').insert(notifRows).then(() => inviterName);
      } catch (_) {
        // Non-fatal
      }
    }

    // Insert system message
    await db.from('group_messages').insert({
      group_id: group.id,
      sender_id: userId,
      content: 'Group created',
      message_type: 'system',
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/groups]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}
