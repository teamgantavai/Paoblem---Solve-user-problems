import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeader, getAdminClient } from '@/lib/auth-fast';

/* eslint-disable @typescript-eslint/no-explicit-any */

const db = getAdminClient();

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// ── GET /api/groups/invite/[code] ─────────────────────────────
// Resolve an invite link — returns group info and invite status
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    const { data: invite, error } = await db
      .from('group_invites')
      .select('id, group_id, invited_by, status, expires_at, created_at')
      .eq('invite_code', code)
      .maybeSingle();

    if (error) throw error;
    if (!invite) return jsonError('Invite not found', 404);

    // Check expiry
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return jsonError('This invite link has expired', 410);
    }
    if (invite.status === 'expired') return jsonError('This invite link has expired', 410);

    // Fetch group info
    const { data: group } = await db
      .from('groups')
      .select('id, name, description, avatar_url, privacy, member_count')
      .eq('id', invite.group_id)
      .single();

    if (!group) return jsonError('Group not found', 404);

    // Fetch inviter profile
    const { data: inviterProfile } = await db
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .eq('id', invite.invited_by)
      .single();

    return NextResponse.json({
      invite: { ...invite, invite_code: code },
      group,
      invited_by_profile: inviterProfile,
    });
  } catch (err: any) {
    console.error('[GET /api/groups/invite/[code]]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}

// ── POST /api/groups/invite/[code] ────────────────────────────
// Join via invite link
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    const { code } = await params;

    const { data: invite, error } = await db
      .from('group_invites')
      .select('*')
      .eq('invite_code', code)
      .maybeSingle();

    if (error) throw error;
    if (!invite) return jsonError('Invite not found', 404);
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return jsonError('This invite link has expired', 410);
    }

    const groupId = invite.group_id;

    // Check if already a member
    const { data: existing } = await db
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) return NextResponse.json({ success: true, already_member: true, groupId });

    // Add member
    const { error: memberError } = await db.from('group_members').insert({
      group_id: groupId,
      user_id: userId,
      role: 'member',
    });

    if (memberError) throw memberError;

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
      content: `${name} joined via invite link`,
      message_type: 'system',
    });

    return NextResponse.json({ success: true, groupId }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/groups/invite/[code]]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}
