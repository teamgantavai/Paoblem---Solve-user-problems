import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeader, getAdminClient } from '@/lib/auth-fast';

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

// ── GET /api/groups/[groupId] ──────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    const { groupId } = await params;

    const { data: group, error } = await db
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (error || !group) return jsonError('Group not found', 404);

    const role = await getMyRole(groupId, userId);
    if (!role && group.privacy === 'private') return jsonError('Forbidden', 403);

    return NextResponse.json({ group: { ...group, my_role: role } });
  } catch (err: any) {
    console.error('[GET /api/groups/[groupId]]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}

// ── PATCH /api/groups/[groupId] ────────────────────────────────
// Update group info/settings (owner or admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    const { groupId } = await params;
    const role = await getMyRole(groupId, userId);
    if (!role || !['owner', 'admin'].includes(role)) {
      return jsonError('Forbidden — only admins and owners can update group settings', 403);
    }

    const body = await req.json();
    const updates: Record<string, any> = {};

    if (typeof body.name === 'string') {
      const name = body.name.trim();
      if (!name) return jsonError('Group name cannot be empty', 400);
      if (name.length > 100) return jsonError('Group name too long', 400);
      updates.name = name;
    }
    if (typeof body.description === 'string') {
      updates.description = body.description.trim().slice(0, 500) || null;
    }
    if (typeof body.avatar_url === 'string' || body.avatar_url === null) {
      updates.avatar_url = body.avatar_url;
    }
    if (typeof body.banner_url === 'string' || body.banner_url === null) {
      updates.banner_url = body.banner_url;
    }
    if (typeof body.category === 'string') {
      updates.category = body.category.trim().slice(0, 50) || null;
    }
    if (['public', 'private'].includes(body.privacy)) {
      updates.privacy = body.privacy;
    }
    if (['owner', 'admin', 'member'].includes(body.invite_permission)) {
      updates.invite_permission = body.invite_permission;
    }
    if (['owner', 'admin', 'moderator', 'member'].includes(body.message_permission)) {
      updates.message_permission = body.message_permission;
    }

    if (!Object.keys(updates).length) return jsonError('No valid fields to update', 400);

    const { data: updated, error } = await db
      .from('groups')
      .update(updates)
      .eq('id', groupId)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ group: updated });
  } catch (err: any) {
    console.error('[PATCH /api/groups/[groupId]]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}

// ── DELETE /api/groups/[groupId] ───────────────────────────────
// Only the owner can delete a group.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return jsonError('Unauthorized', 401);

    const { groupId } = await params;
    const role = await getMyRole(groupId, userId);
    if (role !== 'owner') {
      return jsonError('Forbidden — only the owner can delete this group', 403);
    }

    const { error } = await db.from('groups').delete().eq('id', groupId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /api/groups/[groupId]]', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}
