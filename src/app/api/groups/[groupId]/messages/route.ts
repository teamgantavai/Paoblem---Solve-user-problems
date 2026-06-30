import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeader, getAdminClient } from '@/lib/auth-fast';

/* eslint-disable @typescript-eslint/no-explicit-any */

const db = getAdminClient();
const PAGE_SIZE = 35;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function getMember(groupId: string, userId: string) {
  const { data } = await db
    .from('group_members')
    .select('role, muted_until')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  return data || null;
}

async function hydrateMessages(rawMessages: any[], userId: string) {
  if (!rawMessages.length) return [];

  const messageIds = rawMessages.map((m) => m.id);
  const senderIds = Array.from(new Set(rawMessages.map((m) => m.sender_id).filter(Boolean)));
  const replyIds = Array.from(new Set(rawMessages.map((m) => m.reply_to_message_id).filter(Boolean)));

  const [
    { data: profiles },
    { data: reactions },
    { data: reads },
    { data: replies },
  ] = await Promise.all([
    senderIds.length
      ? db.from('profiles').select('id, username, full_name, avatar_url').in('id', senderIds)
      : Promise.resolve({ data: [] }),
    messageIds.length
      ? db.from('group_message_reactions').select('message_id, user_id, emoji').in('message_id', messageIds)
      : Promise.resolve({ data: [] }),
    messageIds.length
      ? db.from('group_message_reads').select('message_id, user_id, read_at').in('message_id', messageIds)
      : Promise.resolve({ data: [] }),
    replyIds.length
      ? db.from('group_messages').select('id, sender_id, content, message_type, attachments, deleted_at').in('id', replyIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileById = new Map((profiles || []).map((p: any) => [p.id, p]));
  const replyById = new Map((replies || []).map((r: any) => [r.id, r]));

  // Group reactions by message_id
  const reactionsByMessage = new Map<string, { emoji: string; users: string[] }[]>();
  (reactions || []).forEach((r: any) => {
    const list = reactionsByMessage.get(r.message_id) || [];
    const existing = list.find((item) => item.emoji === r.emoji);
    if (existing) {
      existing.users.push(r.user_id);
    } else {
      list.push({ emoji: r.emoji, users: [r.user_id] });
    }
    reactionsByMessage.set(r.message_id, list);
  });

  // Group reads by message_id
  const readsByMessage = new Map<string, { user_id: string; read_at: string }[]>();
  (reads || []).forEach((r: any) => {
    const list = readsByMessage.get(r.message_id) || [];
    list.push({ user_id: r.user_id, read_at: r.read_at });
    readsByMessage.set(r.message_id, list);
  });

  return rawMessages.map((msg: any) => {
    const reply = msg.reply_to_message_id ? replyById.get(msg.reply_to_message_id) : null;
    return {
      ...msg,
      content: msg.deleted_at ? 'This message was deleted' : msg.content,
      attachments: msg.deleted_at ? [] : msg.attachments || [],
      sender: profileById.get(msg.sender_id) || null,
      reactions: reactionsByMessage.get(msg.id) || [],
      reads: readsByMessage.get(msg.id) || [],
      my_reaction: (reactions || []).find((r: any) => r.message_id === msg.id && r.user_id === userId)?.emoji || null,
      reply_to: reply
        ? {
            ...reply,
            content: reply.deleted_at ? 'This message was deleted' : reply.content,
            attachments: reply.deleted_at ? [] : reply.attachments || [],
            sender: profileById.get(reply.sender_id) || null,
          }
        : null,
    };
  });
}

// ── GET /api/groups/[groupId]/messages ─────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    const { groupId } = await params;
    const member = await getMember(groupId, userId);
    if (!member) return jsonError('You are not a member of this group', 403);

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const search = searchParams.get('search');
    const pinnedOnly = searchParams.get('pinned') === 'true';

    let query = db
      .from('group_messages')
      .select('id, group_id, sender_id, content, message_type, attachments, reply_to_message_id, mentions, pinned_at, pinned_by, edited_at, deleted_at, client_mutation_id, created_at, updated_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (cursor) query = query.lt('created_at', cursor);
    if (search?.trim()) query = query.ilike('content', `%${search.trim()}%`);
    if (pinnedOnly) query = query.not('pinned_at', 'is', null).order('pinned_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    const messages = await hydrateMessages((data || []).reverse(), userId);

    return NextResponse.json({
      messages,
      nextCursor: messages.length === PAGE_SIZE ? messages[0]?.created_at : null,
    });
  } catch (err: any) {
    console.error('[GET /api/groups/[groupId]/messages]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}

// ── POST /api/groups/[groupId]/messages ────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    const { groupId } = await params;
    const member = await getMember(groupId, userId);
    if (!member) return jsonError('You are not a member of this group', 403);

    // Check mute
    if (member.muted_until && new Date(member.muted_until) > new Date()) {
      return jsonError('You are muted in this group', 403);
    }

    // Check message permission
    const { data: group } = await db
      .from('groups')
      .select('message_permission')
      .eq('id', groupId)
      .single();

    const roleRank: Record<string, number> = { owner: 4, admin: 3, moderator: 2, member: 1 };
    const requiredRank = roleRank[group?.message_permission || 'member'] || 1;
    const myRank = roleRank[member.role] || 1;
    if (myRank < requiredRank) {
      return jsonError('You do not have permission to send messages in this group', 403);
    }

    const body = await req.json();
    const content = String(body.content || body.body || '').trim();
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const mentions = Array.isArray(body.mentions) ? body.mentions : [];
    const replyToMessageId = body.replyToMessageId ? String(body.replyToMessageId) : null;
    const clientMutationId = body.clientMutationId ? String(body.clientMutationId) : null;

    if (!content && !attachments.length) {
      return jsonError('Message content or attachment is required', 400);
    }

    // Dedup
    if (clientMutationId) {
      const { data: dup } = await db
        .from('group_messages')
        .select('id')
        .eq('group_id', groupId)
        .eq('sender_id', userId)
        .eq('client_mutation_id', clientMutationId)
        .maybeSingle();
      if (dup?.id) {
        const [msg] = await hydrateMessages([dup], userId);
        return NextResponse.json({ message: msg, duplicate: true }, { status: 200 });
      }
    }

    const messageType = attachments.length
      ? attachments.some((a: any) => a.type === 'image' || a.mime_type?.startsWith('image/'))
        ? 'image'
        : 'file'
      : 'text';

    const { data: message, error } = await db
      .from('group_messages')
      .insert({
        group_id: groupId,
        sender_id: userId,
        content,
        message_type: messageType,
        attachments,
        reply_to_message_id: replyToMessageId,
        mentions,
        client_mutation_id: clientMutationId,
      })
      .select('id, group_id, sender_id, content, message_type, attachments, reply_to_message_id, mentions, pinned_at, edited_at, deleted_at, client_mutation_id, created_at')
      .single();

    if (error) throw error;

    const [hydrated] = await hydrateMessages([message], userId);

    // Send mention notifications (non-blocking)
    if (mentions.length > 0) {
      (async () => {
        try {
          const { data: mentioner } = await db
            .from('profiles')
            .select('username, full_name')
            .eq('id', userId)
            .single();
          const { data: groupData } = await db
            .from('groups')
            .select('name')
            .eq('id', groupId)
            .single();

          const mentionNotifs = mentions
            .filter((uid: string) => uid !== userId)
            .map((uid: string) => ({
              user_id: uid,
              type: 'group_mention',
              title: `Mentioned in ${groupData?.name || 'a group'}`,
              body: `@${mentioner?.username || userId} mentioned you: ${content.slice(0, 100)}`,
              read: false,
            }));
          if (mentionNotifs.length > 0) {
            await db.from('notifications').insert(mentionNotifs);
          }
        } catch (_) { /* non-fatal */ }
      })();
    }

    return NextResponse.json({ message: hydrated }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/groups/[groupId]/messages]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}

// ── PUT /api/groups/[groupId]/messages ─────────────────────────
// Supports: edit message, mark-as-read, toggle reaction
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    const { groupId } = await params;
    const member = await getMember(groupId, userId);
    if (!member) return jsonError('Forbidden', 403);

    const body = await req.json();

    // Mark all messages as read
    if (body.action === 'read') {
      const now = new Date().toISOString();

      // Get unread messages sent by others
      const { data: unread } = await db
        .from('group_messages')
        .select('id')
        .eq('group_id', groupId)
        .neq('sender_id', userId)
        .is('deleted_at', null);

      if (unread?.length) {
        await db.from('group_message_reads').upsert(
          unread.map((m: any) => ({ message_id: m.id, user_id: userId, read_at: now })),
          { onConflict: 'message_id,user_id' }
        );
      }

      // Update last_read_at for the member
      await db
        .from('group_members')
        .update({ last_read_at: now })
        .eq('group_id', groupId)
        .eq('user_id', userId);

      return NextResponse.json({ success: true });
    }

    // Edit message
    if (body.action === 'edit' && body.messageId && typeof body.content === 'string') {
      const nextContent = body.content.trim();
      if (!nextContent) return jsonError('Message cannot be empty', 400);

      const { data: msg } = await db
        .from('group_messages')
        .select('id, sender_id, deleted_at')
        .eq('id', body.messageId)
        .eq('group_id', groupId)
        .maybeSingle();

      if (!msg) return jsonError('Message not found', 404);
      if (msg.sender_id !== userId) return jsonError('You can only edit your own messages', 403);
      if (msg.deleted_at) return jsonError('Cannot edit a deleted message', 400);

      const { data: updated, error } = await db
        .from('group_messages')
        .update({ content: nextContent, edited_at: new Date().toISOString() })
        .eq('id', body.messageId)
        .select('*')
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, message: updated });
    }

    // Toggle reaction
    if (body.action === 'react' && body.messageId && body.emoji) {
      const { data: existing } = await db
        .from('group_message_reactions')
        .select('emoji')
        .eq('message_id', body.messageId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        if (existing.emoji === body.emoji) {
          // Remove reaction
          await db.from('group_message_reactions')
            .delete()
            .eq('message_id', body.messageId)
            .eq('user_id', userId);
        } else {
          // Swap reaction
          await db.from('group_message_reactions')
            .update({ emoji: body.emoji })
            .eq('message_id', body.messageId)
            .eq('user_id', userId);
        }
      } else {
        // Add reaction
        await db.from('group_message_reactions').insert({
          message_id: body.messageId,
          user_id: userId,
          emoji: body.emoji,
        });
      }

      return NextResponse.json({ success: true });
    }

    return jsonError('Unsupported action', 400);
  } catch (err: any) {
    console.error('[PUT /api/groups/[groupId]/messages]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}

// ── DELETE /api/groups/[groupId]/messages ──────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    const { groupId } = await params;
    const member = await getMember(groupId, userId);
    if (!member) return jsonError('Forbidden', 403);

    const { messageId, scope = 'everyone' } = await req.json();
    if (!messageId) return jsonError('messageId is required', 400);

    const { data: msg } = await db
      .from('group_messages')
      .select('id, sender_id')
      .eq('id', messageId)
      .eq('group_id', groupId)
      .maybeSingle();

    if (!msg) return jsonError('Message not found', 404);

    const roleRank: Record<string, number> = { owner: 4, admin: 3, moderator: 2, member: 1 };

    if (scope === 'everyone') {
      // Sender can always delete own; admin/mod can delete any
      if (msg.sender_id !== userId && (roleRank[member.role] || 1) < 2) {
        return jsonError('You cannot delete this message', 403);
      }
      const { error: updateError } = await db.from('group_messages').update({
        content: 'This message was deleted',
        attachments: [],
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      }).eq('id', messageId);

      if (updateError) {
        console.error('[DELETE /api/groups/[groupId]/messages] Update error:', updateError);
        throw updateError;
      }

      const { error: reactionError } = await db.from('group_message_reactions').delete().eq('message_id', messageId);
      if (reactionError) {
        console.error('[DELETE /api/groups/[groupId]/messages] Reaction delete error:', reactionError);
        throw reactionError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /api/groups/[groupId]/messages]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}
