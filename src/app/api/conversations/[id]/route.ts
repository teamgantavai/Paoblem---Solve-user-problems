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

async function isParticipant(conversationId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('conversation_participants')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(req);
    if (!user) return jsonError('Unauthorized', 401);

    const { id: conversationId } = await params;
    if (!(await isParticipant(conversationId, user.id))) return jsonError('Forbidden', 403);

    const body = await req.json();
    const now = new Date().toISOString();
    const updates: Record<string, string | null> = {};

    if (body.action === 'pin') updates.pinned_at = body.enabled ? now : null;
    if (body.action === 'archive') updates.archived_at = body.enabled ? now : null;
    if (body.action === 'mute') updates.muted_at = body.enabled ? now : null;
    if (body.action === 'block') updates.blocked_at = body.enabled ? now : null;

    if (!Object.keys(updates).length) {
      return jsonError('Unsupported conversation action', 400);
    }

    const { error } = await supabaseAdmin
      .from('conversation_participants')
      .update(updates)
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[PATCH /api/conversations/[id]]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(req);
    if (!user) return jsonError('Unauthorized', 401);

    const { id: conversationId } = await params;
    if (!(await isParticipant(conversationId, user.id))) return jsonError('Forbidden', 403);

    const body = await req.json();
    if (body.action !== 'report') return jsonError('Unsupported action', 400);

    const { data: participants } = await supabaseAdmin
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId);

    const reportedUserId = body.reportedUserId || (participants || []).find((row: any) => row.user_id !== user.id)?.user_id;
    if (!reportedUserId) return jsonError('Reported user is required', 400);

    const { error } = await supabaseAdmin
      .from('user_reports')
      .insert({
        reporter_id: user.id,
        reported_user_id: reportedUserId,
        conversation_id: conversationId,
        reason: String(body.reason || 'Conversation reported').slice(0, 500),
      });

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[POST /api/conversations/[id]]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}
