import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ADMIN_EMAIL } from '@/lib/adminConstants';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return false;

  const token = authHeader.replace('Bearer ', '');
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    return !error && user?.email === ADMIN_EMAIL;
  } catch {
    return false;
  }
}

// GET - List all badge definitions
export async function GET(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get badges with earn counts
    const { data: badges, error } = await supabaseAdmin
      .from('badge_definitions')
      .select('*')
      .order('sort_order');

    if (error) throw error;

    // Get earn counts per badge
    const { data: earnCounts, error: earnError } = await supabaseAdmin
      .from('user_badges')
      .select('badge_id');

    if (earnError) throw earnError;

    const countMap: Record<string, number> = {};
    (earnCounts || []).forEach((row: any) => {
      countMap[row.badge_id] = (countMap[row.badge_id] || 0) + 1;
    });

    const badgesWithCounts = (badges || []).map((b: any) => ({
      ...b,
      earn_count: countMap[b.id] || 0,
    }));

    return NextResponse.json({ badges: badgesWithCounts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST - Create a new badge definition
export async function POST(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { data, error } = await supabaseAdmin
      .from('badge_definitions')
      .insert(body)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ badge: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH - Update a badge definition
export async function PATCH(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, ...updates } = await req.json();
    const { data, error } = await supabaseAdmin
      .from('badge_definitions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ badge: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE - Remove a badge definition (and all user_badges for it)
export async function DELETE(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await req.json();
    const { error } = await supabaseAdmin
      .from('badge_definitions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
