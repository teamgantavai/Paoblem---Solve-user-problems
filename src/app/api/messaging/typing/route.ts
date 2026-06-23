import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/* eslint-disable @typescript-eslint/no-explicit-any */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey);

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(authHeader.slice('Bearer '.length));
  if (error || !data.user) return null;
  return data.user;
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (!body.conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    const { data: membership, error: memberError } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', body.conversationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { error } = await supabaseAdmin
      .from('typing_status')
      .upsert({
        conversation_id: body.conversationId,
        user_id: user.id,
        is_typing: !!body.isTyping,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'conversation_id,user_id' });

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[POST /api/messaging/typing]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
