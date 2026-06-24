import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

type ProfileData = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  username: string | null;
};

async function attachProfiles<T extends { user_id?: string }>(supabase: any, rows: T[]) {
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
  if (!userIds.length) return rows;
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, username')
    .in('id', userIds) as { data: ProfileData[] | null };
  const map = new Map((profiles || []).map((p) => [p.id, p]));
  return rows.map((r) => ({ ...r, profiles: r.user_id ? map.get(r.user_id) || null : null }));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: solution, error } = await admin
      .from('solutions')
      .select('*, problem:problem_id(id, title, slug, body, type, category, upvotes, downvotes, comments_count, created_at, profiles:user_id(full_name, avatar_url, role, username))')
      .eq('id', id)
      .maybeSingle();

    if (error || !solution) {
      return NextResponse.json({ error: 'Solution not found' }, { status: 404 });
    }

    const [solutionWithProfile] = await attachProfiles(supabase, [solution]);

    // Fetch related solutions for same problem
    const { data: related } = await admin
      .from('solutions')
      .select('id, title, upvotes, comments_count, created_at, user_id')
      .eq('problem_id', solution.problem_id)
      .neq('id', id)
      .order('upvotes', { ascending: false })
      .limit(3);

    const relatedWithProfiles = await attachProfiles(supabase, related || []);

    return NextResponse.json({ solution: solutionWithProfile, related: relatedWithProfiles });
  } catch (err) {
    console.error('[solution detail] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
