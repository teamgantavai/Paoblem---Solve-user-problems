import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/* eslint-disable @typescript-eslint/no-explicit-any */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

type AttachmentInput = {
  url: string;
  name?: string;
  type?: 'image' | 'file';
  mime_type?: string;
  size?: number;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

function directKey(a: string, b: string) {
  return [a, b].sort().join(':');
}

async function ensureDirectConversation(currentUserId: string, recipientId: string) {
  if (currentUserId === recipientId) {
    throw new Error('You cannot message yourself');
  }

  const key = directKey(currentUserId, recipientId);
  const [low, high] = [currentUserId, recipientId].sort();

  const { data: existing, error: findError } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('conversation_type', 'direct')
    .eq('direct_key', key)
    .maybeSingle();

  if (findError) throw findError;
  if (existing?.id) {
    await supabaseAdmin
      .from('conversation_participants')
      .upsert(
        [
          { conversation_id: existing.id, user_id: currentUserId, archived_at: null, blocked_at: null },
          { conversation_id: existing.id, user_id: recipientId, archived_at: null },
        ],
        { onConflict: 'conversation_id,user_id' }
      );
    return existing.id as string;
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from('conversations')
    .insert({
      conversation_type: 'direct',
      direct_key: key,
      user_low_id: low,
      user_high_id: high,
      created_by: currentUserId,
    })
    .select('id')
    .single();

  if (createError) throw createError;

  const { error: participantsError } = await supabaseAdmin
    .from('conversation_participants')
    .insert([
      { conversation_id: created.id, user_id: currentUserId },
      { conversation_id: created.id, user_id: recipientId },
    ]);

  if (participantsError) throw participantsError;
  return created.id as string;
}

async function requireParticipant(conversationId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('conversation_participants')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

async function listConversations(userId: string, archived = false) {
  const { data: memberships, error } = await supabaseAdmin
    .from('conversation_participants')
    .select('conversation_id, pinned_at, archived_at, muted_at, blocked_at, last_read_at')
    .eq('user_id', userId)
    .filter('archived_at', archived ? 'not.is' : 'is', null)
    .order('pinned_at', { ascending: false, nullsFirst: false });

  if (error) throw error;

  const conversationIds = (memberships || []).map((row: any) => row.conversation_id);
  if (!conversationIds.length) return [];

  const { data: conversations, error: conversationError } = await supabaseAdmin
    .from('conversations')
    .select('id, direct_key, updated_at, last_message_id, last_message_at')
    .in('id', conversationIds);

  if (conversationError) throw conversationError;

  const conversationById = new Map((conversations || []).map((row: any) => [row.id, row]));
  const lastMessageIds = (conversations || []).map((row: any) => row.last_message_id).filter(Boolean);
  const { data: lastMessages, error: lastMessageError } = lastMessageIds.length
    ? await supabaseAdmin
        .from('messages')
        .select('id, conversation_id, sender_id, content, message_type, created_at, deleted_at, attachments')
        .in('id', lastMessageIds)
    : { data: [], error: null };

  if (lastMessageError) throw lastMessageError;
  const lastMessageById = new Map((lastMessages || []).map((row: any) => [row.id, row]));

  const { data: participants, error: participantError } = await supabaseAdmin
    .from('conversation_participants')
    .select('conversation_id, user_id')
    .in('conversation_id', conversationIds);

  if (participantError) throw participantError;

  const participantUserIds = Array.from(new Set((participants || []).map((row: any) => row.user_id)));
  const { data: profiles, error: profileError } = participantUserIds.length
    ? await supabaseAdmin
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', participantUserIds)
    : { data: [], error: null };

  if (profileError) throw profileError;
  const profileById = new Map((profiles || []).map((row: any) => [row.id, row]));

  const { data: presenceRows, error: presenceError } = participantUserIds.length
    ? await supabaseAdmin
        .from('user_presence')
        .select('user_id, is_online, last_seen_at')
        .in('user_id', participantUserIds)
    : { data: [], error: null };

  if (presenceError) throw presenceError;
  const presenceByUserId = new Map((presenceRows || []).map((row: any) => [row.user_id, row]));

  const { data: incomingRows, error: incomingError } = await supabaseAdmin
    .from('messages')
    .select('conversation_id, id')
    .in('conversation_id', conversationIds)
    .neq('sender_id', userId)
    .is('deleted_at', null);

  if (incomingError) throw incomingError;

  const incomingIds = (incomingRows || []).map((row: any) => row.id);
  const { data: readRows, error: readError } = incomingIds.length
    ? await supabaseAdmin
        .from('message_reads')
        .select('message_id')
        .in('message_id', incomingIds)
        .eq('user_id', userId)
    : { data: [], error: null };

  if (readError) throw readError;

  const readIds = new Set((readRows || []).map((row: any) => row.message_id));
  const { data: hiddenRows, error: hiddenError } = incomingIds.length
    ? await supabaseAdmin
        .from('message_deletions')
        .select('message_id')
        .in('message_id', incomingIds)
        .eq('user_id', userId)
    : { data: [], error: null };

  if (hiddenError && hiddenError.code !== '42P01') throw hiddenError;
  const hiddenIds = new Set((hiddenRows || []).map((row: any) => row.message_id));

  const unreadByConversation = new Map<string, number>();
  (incomingRows || []).forEach((row: any) => {
    if (hiddenIds.has(row.id)) return;
    if (readIds.has(row.id)) return;
    unreadByConversation.set(row.conversation_id, (unreadByConversation.get(row.conversation_id) || 0) + 1);
  });

  const participantMap = new Map<string, any[]>();
  (participants || []).forEach((row: any) => {
    const list = participantMap.get(row.conversation_id) || [];
    list.push(row);
    participantMap.set(row.conversation_id, list);
  });

  return (memberships || [])
    .map((row: any) => {
      const other = (participantMap.get(row.conversation_id) || []).find((item) => item.user_id !== userId);
      const partner = profileById.get(other?.user_id) || {};
      const presence = presenceByUserId.get(other?.user_id);
      const conversation = conversationById.get(row.conversation_id);
      const lastMessage = conversation?.last_message_id ? lastMessageById.get(conversation.last_message_id) : null;

      return {
        id: row.conversation_id,
        partner: {
          id: partner.id,
          username: partner.username,
          full_name: partner.full_name,
          avatar_url: partner.avatar_url,
          is_online: !!presence?.is_online,
          last_seen_at: presence?.last_seen_at || null,
        },
        last_message: lastMessage
          ? {
              ...lastMessage,
              content: lastMessage.deleted_at ? 'This message was deleted' : lastMessage.content,
              attachments: lastMessage.attachments || [],
            }
          : null,
        unread_count: unreadByConversation.get(row.conversation_id) || 0,
        pinned: !!row.pinned_at,
        archived: !!row.archived_at,
        muted: !!row.muted_at,
        blocked: !!row.blocked_at,
        updated_at: conversation?.last_message_at || conversation?.updated_at,
      };
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
    });
}

async function hydrateMessages(rawMessages: any[], userId: string) {
  const messageIds = rawMessages.map((message) => message.id);
  const senderIds = Array.from(new Set(rawMessages.map((message) => message.sender_id).filter(Boolean)));
  const replyIds = Array.from(new Set(rawMessages.map((message) => message.reply_to_message_id).filter(Boolean)));

  const [{ data: profiles, error: profileError }, { data: reads, error: readsError }, { data: replies, error: repliesError }] = await Promise.all([
    senderIds.length
      ? supabaseAdmin.from('profiles').select('id, username, full_name, avatar_url').in('id', senderIds)
      : Promise.resolve({ data: [], error: null }),
    messageIds.length
      ? supabaseAdmin.from('message_reads').select('message_id, user_id, read_at').in('message_id', messageIds)
      : Promise.resolve({ data: [], error: null }),
    replyIds.length
      ? supabaseAdmin
          .from('messages')
          .select('id, sender_id, content, message_type, attachments, deleted_at')
          .in('id', replyIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profileError) throw profileError;
  if (readsError) throw readsError;
  if (repliesError) throw repliesError;

  const profileById = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
  const replyById = new Map((replies || []).map((reply: any) => [reply.id, reply]));
  const readsByMessageId = new Map<string, any[]>();
  (reads || []).forEach((read: any) => {
    const list = readsByMessageId.get(read.message_id) || [];
    list.push({ user_id: read.user_id, read_at: read.read_at });
    readsByMessageId.set(read.message_id, list);
  });

  return rawMessages.map((message: any) => {
    const reply = message.reply_to_message_id ? replyById.get(message.reply_to_message_id) : null;

    return {
      ...message,
      sender: profileById.get(message.sender_id) || null,
      reads: readsByMessageId.get(message.id) || [],
      content: message.deleted_at ? 'This message was deleted' : message.content,
      attachments: message.deleted_at ? [] : message.attachments || [],
      reply_to: reply
        ? {
            ...reply,
            content: reply.deleted_at ? 'This message was deleted' : reply.content,
            attachments: reply.deleted_at ? [] : reply.attachments || [],
          }
        : null,
      status:
        message.sender_id !== userId
          ? 'delivered'
          : (readsByMessageId.get(message.id) || []).some((read: any) => read.user_id !== userId)
            ? 'seen'
            : 'delivered',
    };
  });
}

async function listMessages(conversationId: string, userId: string, cursor?: string | null, search?: string | null) {
  const allowed = await requireParticipant(conversationId, userId);
  if (!allowed) return null;

  const { data: hiddenRows, error: hiddenError } = await supabaseAdmin
    .from('message_deletions')
    .select('message_id')
    .eq('user_id', userId);

  if (hiddenError && hiddenError.code !== '42P01') throw hiddenError;
  const hiddenIds = (hiddenRows || []).map((row: any) => row.message_id);

  let query = supabaseAdmin
    .from('messages')
    .select('id, conversation_id, sender_id, content, message_type, attachments, reply_to_message_id, edited_at, deleted_at, created_at, client_mutation_id')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(35);

  if (cursor) query = query.lt('created_at', cursor);
  if (search?.trim()) query = query.ilike('content', `%${search.trim()}%`);
  if (hiddenIds.length) query = query.not('id', 'in', `(${hiddenIds.join(',')})`);

  const { data, error } = await query;
  if (error) throw error;

  const messages = await hydrateMessages((data || []).reverse(), userId);

  return {
    messages,
    nextCursor: messages.length === 35 ? messages[0]?.created_at : null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return jsonError('Unauthorized', 401);

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');
    const archived = searchParams.get('archived') === 'true';

    if (conversationId) {
      const result = await listMessages(
        conversationId,
        user.id,
        searchParams.get('cursor'),
        searchParams.get('search')
      );
      if (!result) return jsonError('Conversation not found', 404);
      return NextResponse.json(result);
    }

    const conversations = await listConversations(user.id, archived);
    return NextResponse.json({ conversations, messages: conversations });
  } catch (err: any) {
    console.error('[GET /api/messages]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return jsonError('Unauthorized', 401);

    const body = await req.json();
    const content = String(body.body || body.content || '').trim();
    const attachments = Array.isArray(body.attachments) ? body.attachments as AttachmentInput[] : [];
    const hasAttachments = attachments.length > 0;

    if (body.startOnly) {
      if (!body.recipientId) return jsonError('recipientId is required', 400);
      const conversationId = await ensureDirectConversation(user.id, String(body.recipientId));
      return NextResponse.json({ conversationId, message: null }, { status: 201 });
    }

    if (!content && !hasAttachments) {
      return jsonError('Message content or attachment is required', 400);
    }

    const conversationId = body.conversationId
      ? String(body.conversationId)
      : await ensureDirectConversation(user.id, String(body.recipientId || ''));

    const allowed = await requireParticipant(conversationId, user.id);
    if (!allowed) return jsonError('Forbidden', 403);

    if (body.clientMutationId) {
      const { data: duplicate } = await supabaseAdmin
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('sender_id', user.id)
        .eq('client_mutation_id', body.clientMutationId)
        .maybeSingle();

      if (duplicate?.id) {
        const result = await listMessages(conversationId, user.id);
        const message = result?.messages.find((item: any) => item.id === duplicate.id);
        return NextResponse.json({ message, conversationId, duplicate: true });
      }
    }

    const messageType = hasAttachments
      ? attachments.some((item) => item.type === 'image' || item.mime_type?.startsWith('image/'))
        ? 'image'
        : 'file'
      : 'text';

    const { data: message, error } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        message_type: messageType,
        attachments,
        reply_to_message_id: body.replyToMessageId || null,
        client_mutation_id: body.clientMutationId || null,
      })
      .select('id, conversation_id, sender_id, content, message_type, attachments, reply_to_message_id, edited_at, deleted_at, created_at, client_mutation_id')
      .single();

    if (error) throw error;
    const [hydratedMessage] = await hydrateMessages([message], user.id);

    return NextResponse.json({
      conversationId,
      message: {
        ...hydratedMessage,
        status: 'sent',
        attachments: hydratedMessage.attachments || [],
      },
    }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/messages]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return jsonError('Unauthorized', 401);

    const body = await req.json();

    if (body.action === 'read' && body.conversationId) {
      const allowed = await requireParticipant(body.conversationId, user.id);
      if (!allowed) return jsonError('Forbidden', 403);

      const { data: unreadMessages, error: unreadError } = await supabaseAdmin
        .from('messages')
        .select('id')
        .eq('conversation_id', body.conversationId)
        .neq('sender_id', user.id)
        .is('deleted_at', null);

      if (unreadError) throw unreadError;

      if (unreadMessages?.length) {
        const now = new Date().toISOString();
        await supabaseAdmin
          .from('message_reads')
          .upsert(
            unreadMessages.map((message: any) => ({
              message_id: message.id,
              user_id: user.id,
              read_at: now,
            })),
            { onConflict: 'message_id,user_id' }
          );

        await supabaseAdmin
          .from('conversation_participants')
          .update({ last_read_at: now })
          .eq('conversation_id', body.conversationId)
          .eq('user_id', user.id);
      }

      return NextResponse.json({ success: true });
    }

    if (body.messageId && typeof body.body === 'string') {
      const nextContent = body.body.trim();
      if (!nextContent) return jsonError('Message cannot be empty', 400);

      const { data: message, error: findError } = await supabaseAdmin
        .from('messages')
        .select('id, sender_id, conversation_id, content, deleted_at')
        .eq('id', body.messageId)
        .maybeSingle();

      if (findError) throw findError;
      if (!message) return jsonError('Message not found', 404);
      if (message.sender_id !== user.id) return jsonError('Only the sender can edit this message', 403);
      if (message.deleted_at) return jsonError('Deleted messages cannot be edited', 400);

      const { data: updated, error: updateError } = await supabaseAdmin
        .from('messages')
        .update({ content: nextContent, edited_at: new Date().toISOString() })
        .eq('id', body.messageId)
        .eq('sender_id', user.id)
        .select('*')
        .single();

      if (updateError) throw updateError;
      return NextResponse.json({ success: true, message: updated });
    }

    return jsonError('Unsupported update action', 400);
  } catch (err: any) {
    console.error('[PUT /api/messages]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return jsonError('Unauthorized', 401);

    const { messageId, scope = 'everyone' } = await req.json();
    if (!messageId) return jsonError('messageId is required', 400);

    const { data: message, error: findError } = await supabaseAdmin
      .from('messages')
      .select('id, sender_id, conversation_id')
      .eq('id', messageId)
      .maybeSingle();

    if (findError) throw findError;
    if (!message) return jsonError('Message not found', 404);

    const allowed = await requireParticipant(message.conversation_id, user.id);
    if (!allowed) return jsonError('Forbidden', 403);

    if (scope === 'me') {
      const { error } = await supabaseAdmin
        .from('message_deletions')
        .upsert({
          message_id: messageId,
          user_id: user.id,
          deleted_at: new Date().toISOString(),
        }, { onConflict: 'message_id,user_id' });

      if (error) throw error;
      return NextResponse.json({ success: true, scope: 'me' });
    }

    if (message.sender_id !== user.id) return jsonError('Only the sender can delete this message', 403);

    const { error } = await supabaseAdmin
      .from('messages')
      .update({
        content: '',
        attachments: [],
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      })
      .eq('id', messageId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /api/messages]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}
