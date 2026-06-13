import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    // Fetch messages where user is sender or recipient
    // Include sender and recipient profile info
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
        body: m.body,
        read: m.read,
        created_at: m.created_at,
        // Match legacy format for popover
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

    const { recipientId, body } = await req.json();
    if (!recipientId || !body?.trim()) {
      return NextResponse.json({ error: 'recipientId and body are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        body: body.trim(),
      })
      .select('*, sender:sender_id(full_name, avatar_url), recipient:recipient_id(full_name, avatar_url)')
      .single();

    if (error) throw error;

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
      body: data.body,
      read: data.read,
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

    const { id, read } = await req.json();

    if (id === 'all') {
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
