import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { enqueueNotification } from '@/lib/queue';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey
);

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Try new conversations-based queries first
    try {
      // 1. Fetch conversations this user is part of
      const { data: memberConversations, error: memberErr } = await supabaseAdmin
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (memberErr) throw memberErr;

      const conversationIds = (memberConversations || []).map(mc => mc.conversation_id);

      if (conversationIds.length > 0) {
        // Fetch all messages in these conversations
        const { data: messagesData, error: msgErr } = await supabaseAdmin
          .from('messages')
          .select(`
            *,
            sender:sender_id(full_name, avatar_url),
            attachments(*),
            read_receipts(*)
          `)
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false });

        if (msgErr) throw msgErr;

        // Fetch conversation details and other members
        const { data: membersData, error: membersErr } = await supabaseAdmin
          .from('conversation_members')
          .select(`
            conversation_id,
            user:user_id(id, full_name, avatar_url, role, online, last_seen)
          `)
          .in('conversation_id', conversationIds);

        if (membersErr) throw membersErr;

        // Group members by conversation_id
        const membersMap: Record<string, any[]> = {};
        membersData?.forEach((m: any) => {
          if (!membersMap[m.conversation_id]) {
            membersMap[m.conversation_id] = [];
          }
          if (m.user) {
            membersMap[m.conversation_id].push(m.user);
          }
        });

        // Pre-process messages to find conversation metadata and filter out cleared chats
        const convMetadata: Record<string, { name?: string, avatar?: string }> = {};
        const clearedAtMap: Record<string, number> = {};
        
        (messagesData || []).forEach((m: any) => {
          if (m.type === 'GROUP_RENAME' && !convMetadata[m.conversation_id]?.name) {
            convMetadata[m.conversation_id] = { ...convMetadata[m.conversation_id], name: m.content };
          }
          if (m.type === 'GROUP_AVATAR' && !convMetadata[m.conversation_id]?.avatar) {
            convMetadata[m.conversation_id] = { ...convMetadata[m.conversation_id], avatar: m.content };
          }
          if (m.type === 'CHAT_CLEARED' && m.sender_id === user.id && !clearedAtMap[m.conversation_id]) {
            clearedAtMap[m.conversation_id] = new Date(m.created_at).getTime();
          }
        });

        // Format messages to preserve backward compatibility (mapping to partner_id, partner_name etc.)
        const formattedMessages = (messagesData || [])
          .filter((m: any) => {
            const clearedAt = clearedAtMap[m.conversation_id];
            if (clearedAt && new Date(m.created_at).getTime() <= clearedAt) {
              return false; // hide messages sent before or equal to the clear marker
            }
            return true;
          })
          .map((m: any) => {
          const convMembers = membersMap[m.conversation_id] || [];
          const partners = convMembers.filter(member => member.id !== user.id);
          const partner = partners[0] || convMembers[0] || {};
          const isGroup = convMembers.length > 2;
          
          let partnerName = isGroup ? partners.map(p => p.full_name?.split(' ')[0] || 'User').join(', ') : (partner.full_name || 'Member');
          let partnerAvatar = partner.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${partner.id || m.sender_id}`;

          if (isGroup) {
            if (convMetadata[m.conversation_id]?.name) partnerName = convMetadata[m.conversation_id].name!;
            if (convMetadata[m.conversation_id]?.avatar) partnerAvatar = convMetadata[m.conversation_id].avatar!;
          }
          
          return {
            id: m.id,
            conversation_id: m.conversation_id,
            sender_id: m.sender_id,
            recipient_id: partner.id || m.sender_id,
            partner_id: partner.id || m.sender_id,
            partner_name: partnerName,
            partner_avatar: partnerAvatar,
            partner_online: isGroup ? partners.some(p => p.online) : (partner.online || false),
            partner_last_seen: partner.last_seen || null,
            is_group: isGroup,
            members: convMembers,
            body: m.content || '',
            read: m.read_receipts?.some((r: any) => r.user_id !== m.sender_id) || false,
            type: m.type || 'TEXT',
            attachments: m.attachments || [],
            created_at: m.created_at,
            sender_name: m.sender?.full_name || 'Member',
            sender_avatar: m.sender?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.sender_id}`,
          };
        });

        return NextResponse.json({ messages: formattedMessages });
      } else {
        return NextResponse.json({ messages: [] });
      }
    } catch (newSchemaErr: any) {
      console.warn('New schema query failed, falling back to legacy messages table:', newSchemaErr.message);
    }

    // FALLBACK: Query legacy messages table
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('*, sender:sender_id(full_name, avatar_url), recipient:recipient_id(full_name, avatar_url)')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedMessages = (data || []).map((m: any) => {
      const isSentByMe = m.sender_id === user.id;
      const partner = isSentByMe ? m.recipient : m.sender;
      const partnerId = isSentByMe ? m.recipient_id : m.sender_id;
      return {
        id: m.id,
        sender_id: m.sender_id,
        recipient_id: m.recipient_id,
        partner_id: partnerId,
        partner_name: partner?.full_name || 'Member',
        partner_avatar: partner?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${partnerId}`,
        body: m.body || m.content || '',
        read: m.read || false,
        created_at: m.created_at,
        sender_name: m.sender?.full_name || 'Member',
        sender_avatar: m.sender?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.sender_id}`,
      };
    });

    return NextResponse.json({ messages: formattedMessages });
  } catch (err: any) {
    console.error('[GET /api/messages]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { recipientId, participantIds, body, type = 'TEXT', attachments = [], conversationId } = await req.json();
    if (!recipientId && !conversationId && (!participantIds || participantIds.length === 0)) {
      return NextResponse.json({ error: 'recipientId, participantIds or conversationId is required' }, { status: 400 });
    }

    // Try new schema inserting logic first
    try {
      let activeConversationId = conversationId;

      if (!activeConversationId && participantIds && participantIds.length > 0) {
        // Create new group chat conversation
        const { data: newConv, error: createErr } = await supabaseAdmin
          .from('conversations')
          .insert({ type: 'group' })
          .select()
          .single();
        if (createErr) throw createErr;
        activeConversationId = newConv.id;
        
        const membersToInsert = [user.id, ...participantIds].map(uid => ({
          conversation_id: activeConversationId,
          user_id: uid
        }));
        await supabaseAdmin.from('conversation_members').insert(membersToInsert);
      } else if (!activeConversationId && recipientId) {
        // Find if direct conversation already exists
        const { data: existingMembers, error: findErr } = await supabaseAdmin
          .from('conversation_members')
          .select('conversation_id')
          .in('user_id', [user.id, recipientId]);

        if (!findErr && existingMembers) {
          // Count occurrences to find conversation with both users
          const counts: Record<string, number> = {};
          existingMembers.forEach((m: any) => {
            counts[m.conversation_id] = (counts[m.conversation_id] || 0) + 1;
          });
          const match = Object.entries(counts).find(([_, count]) => count === 2);
          if (match) {
            activeConversationId = match[0];
          }
        }

        // If no conversation matches, create a new one
        if (!activeConversationId) {
          const { data: newConv, error: createErr } = await supabaseAdmin
            .from('conversations')
            .insert({ type: 'direct' })
            .select()
            .single();

          if (createErr) throw createErr;
          activeConversationId = newConv.id;

          // Add members
          await supabaseAdmin
            .from('conversation_members')
            .insert([
              { conversation_id: activeConversationId, user_id: user.id },
              { conversation_id: activeConversationId, user_id: recipientId }
            ]);
        }
      }

      // Insert message
      const { data: newMsg, error: msgErr } = await supabaseAdmin
        .from('messages')
        .insert({
          conversation_id: activeConversationId,
          sender_id: user.id,
          type: type,
          content: body || ''
        })
        .select(`
          *,
          sender:sender_id(full_name, avatar_url)
        `)
        .single();

      if (msgErr) throw msgErr;

      // Handle attachments if any
      if (attachments && attachments.length > 0) {
        const attachmentsToInsert = attachments.map((att: any) => ({
          message_id: newMsg.id,
          url: att.url,
          file_type: att.file_type || 'FILE',
          size: att.size || 0
        }));

        await supabaseAdmin
          .from('attachments')
          .insert(attachmentsToInsert);
      }

      // Fetch partner info
      const { data: partnerProfile } = await supabaseAdmin
        .from('profiles')
        .select('full_name, avatar_url, online, last_seen')
        .eq('id', recipientId)
        .single();

      const formattedMessage = {
        id: newMsg.id,
        conversation_id: activeConversationId,
        sender_id: user.id,
        recipient_id: recipientId,
        partner_id: recipientId,
        partner_name: partnerProfile?.full_name || 'Member',
        partner_avatar: partnerProfile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${recipientId}`,
        partner_online: partnerProfile?.online || false,
        partner_last_seen: partnerProfile?.last_seen || null,
        body: newMsg.content || '',
        read: false,
        type: newMsg.type || 'TEXT',
        attachments: attachments,
        created_at: newMsg.created_at,
        sender_name: newMsg.sender?.full_name || 'Member',
        sender_avatar: newMsg.sender?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`,
      };

      return NextResponse.json({ message: formattedMessage }, { status: 201 });
    } catch (newSchemaErr: any) {
      console.warn('New schema insert failed, falling back to legacy messages table:', newSchemaErr.message);
    }

    // FALLBACK: Insert into legacy messages table
    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        body: body || '',
      })
      .select('*, sender:sender_id(full_name, avatar_url), recipient:recipient_id(full_name, avatar_url)')
      .single();

    if (error) throw error;

    try {
      await enqueueNotification('message', {
        user_id: recipientId,
        actor_id: user.id,
        type: 'system',
        title: 'New Message',
        bodyTemplate: `{name} sent you a message.`,
      });
    } catch (notifErr) {
      console.error('Failed to enqueue message notification:', notifErr);
    }

    const isSentByMe = data.sender_id === user.id;
    const partner = isSentByMe ? data.recipient : data.sender;
    const partnerId = isSentByMe ? data.recipient_id : data.sender_id;

    const formattedMessage = {
      id: data.id,
      sender_id: data.sender_id,
      recipient_id: data.recipient_id,
      partner_id: partnerId,
      partner_name: partner?.full_name || 'Member',
      partner_avatar: partner?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${partnerId}`,
      body: data.body || '',
      read: data.read || false,
      created_at: data.created_at,
      sender_name: data.sender?.full_name || 'Member',
      sender_avatar: data.sender?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.sender_id}`,
    };

    return NextResponse.json({ message: formattedMessage }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/messages]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { id, partnerId, read } = await req.json();

    // Try new read receipts update
    try {
      if (partnerId) {
        const { data: unreadMsgs } = await supabaseAdmin
          .from('messages')
          .select('id')
          .eq('sender_id', partnerId);

        if (unreadMsgs && unreadMsgs.length > 0) {
          const receipts = unreadMsgs.map(m => ({
            message_id: m.id,
            user_id: user.id
          }));
          await supabaseAdmin.from('read_receipts').upsert(receipts);
        }
      } else if (id === 'all') {
        // Get all messages where user is recipient
        const { data: unreadMsgs } = await supabaseAdmin
          .from('messages')
          .select('id')
          .not('sender_id', 'eq', user.id);

        if (unreadMsgs && unreadMsgs.length > 0) {
          const receipts = unreadMsgs.map(m => ({
            message_id: m.id,
            user_id: user.id
          }));
          await supabaseAdmin.from('read_receipts').upsert(receipts);
        }
      } else {
        await supabaseAdmin
          .from('read_receipts')
          .upsert({ message_id: id, user_id: user.id });
      }
    } catch (newSchemaErr) {
      // ignore, proceed to fallback
    }

    if (partnerId) {
      const { error } = await supabaseAdmin
        .from('messages')
        .update({ read: !!read })
        .eq('sender_id', partnerId)
        .eq('recipient_id', user.id);
      if (error) throw error;
    } else if (id === 'all') {
      const { error } = await supabaseAdmin
        .from('messages')
        .update({ read: !!read })
        .eq('recipient_id', user.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from('messages')
        .update({ read: !!read })
        .eq('id', id)
        .eq('recipient_id', user.id);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[PUT /api/messages]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
