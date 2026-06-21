import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey
);

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const user = await authenticate(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.name === 'string') updates.name = body.name.trim();
    if (typeof body.avatar_url === 'string') updates.avatar_url = body.avatar_url;
    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: 'No valid updates supplied' }, { status: 400 });
    }

    const { data: membership } = await supabaseAdmin
      .from('conversation_members')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('conversations')
      .update(updates)
      .eq('id', conversationId)
      .select('id, type, name, avatar_url, created_by, updated_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ conversation: data });
  } catch (err: any) {
    console.error('[PATCH /api/conversations/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const user = await authenticate(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const action = req.nextUrl.searchParams.get('action'); // 'delete' or 'leave'

    if (action === 'leave') {
      // Leave group or delete direct chat from my side
      const { error } = await supabaseAdmin
        .from('conversation_members')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    } 
    
    if (action === 'delete') {
      // Find the creator by getting the first message
      const { data: firstMessage } = await supabaseAdmin
        .from('messages')
        .select('sender_id')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (firstMessage && firstMessage.sender_id !== user.id) {
        return NextResponse.json({ error: 'Only the creator can delete the group chat' }, { status: 403 });
      }

      // Delete the conversation (cascades to members and messages)
      const { error } = await supabaseAdmin
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[DELETE /api/conversations/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
