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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const problemId = searchParams.get('problemId');
    const sort = searchParams.get('sort') || 'hot';
    const status = searchParams.get('status') || '';
    const search = (searchParams.get('search') || '').trim();

    if (!problemId) {
      return NextResponse.json({ error: 'Missing problemId' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the problem
    const { data: problem, error: problemError } = await supabase
      .from('posts')
      .select('id, title, slug, body, type, upvotes, downvotes, comments_count, category, created_at, profiles:user_id(full_name, avatar_url, role, username)')
      .eq('id', problemId)
      .maybeSingle();

    if (problemError || !problem) {
      return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
    }

    // Build solutions query
    let query = admin
      .from('solutions')
      .select('*')
      .eq('problem_id', problemId);

    // Sort
    if (sort === 'hot') {
      query = query.order('upvotes', { ascending: false }).order('comments_count', { ascending: false });
    } else if (sort === 'top') {
      query = query.order('upvotes', { ascending: false });
    } else if (sort === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (sort === 'discussed') {
      query = query.order('comments_count', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data: rawSolutions, error: solError } = await query;
    if (solError) {
      return NextResponse.json({ error: solError.message }, { status: 500 });
    }

    let solutions = await attachProfiles(supabase, rawSolutions || []);

    // Filter by search
    if (search) {
      const lower = search.toLowerCase();
      solutions = solutions.filter((s: any) => {
        const hay = [s.title, s.body, s.profiles?.full_name, s.profiles?.username].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(lower);
      });
    }

    // Filter by status (if you add a status field to solutions, enable this)
    // For now status filter is cosmetic / future-proof

    return NextResponse.json({
      problem,
      solutions,
      total: solutions.length,
    });
  } catch (err) {
    console.error('[by-problem] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
