import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

function getAuth(req: NextRequest) {
  return (req.headers.get('authorization') || '').replace('Bearer ', '').trim();
}

// POST /api/startups/[id]/star — Star a startup
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = getAuth(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminSupa = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Try startup_stars first, fallback to startup_follows if table doesn't exist
  let errorObj: any = null;
  try {
    const { error } = await adminSupa
      .from('startup_stars')
      .upsert({ startup_id: id, user_id: user.id }, { onConflict: 'startup_id,user_id' });
    if (!error) return NextResponse.json({ starred: true });
    errorObj = error;
  } catch (err) {
    errorObj = err;
  }

  // Fallback to startup_follows
  const { error: fallbackError } = await adminSupa
    .from('startup_follows')
    .upsert({ startup_id: id, user_id: user.id }, { onConflict: 'startup_id,user_id' });

  if (fallbackError) {
    console.error('[Star API Error]', errorObj, fallbackError);
    return NextResponse.json({ error: fallbackError.message }, { status: 500 });
  }

  return NextResponse.json({ starred: true });
}

// DELETE /api/startups/[id]/star — Unstar a startup
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = getAuth(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminSupa = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Try startup_stars first, fallback to startup_follows
  try {
    const { error } = await adminSupa
      .from('startup_stars')
      .delete()
      .eq('startup_id', id)
      .eq('user_id', user.id);
    if (!error) return NextResponse.json({ starred: false });
  } catch (err) {}

  const { error: fallbackError } = await adminSupa
    .from('startup_follows')
    .delete()
    .eq('startup_id', id)
    .eq('user_id', user.id);

  if (fallbackError) {
    return NextResponse.json({ error: fallbackError.message }, { status: 500 });
  }

  return NextResponse.json({ starred: false });
}
