import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { enqueueNotification } from '@/lib/queue';
import {
  getPageSize,
  getSeenPostIds,
  getUserInterests,
  hasEnoughInterest,
  parseRecommendationCursor,
  rankSolutions,
  updateUserInterestsForContent,
} from '@/lib/recommendations';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
const PAGE_SIZE = getPageSize();

const solutionSchema = z.object({
  problem_id: z.string().uuid(),
  title: z.string().min(3, 'Title must be at least 3 characters').max(220, 'Title too long'),
  body: z.string().min(10, 'Solution must be at least 10 characters').max(10000, 'Solution too long'),
  image_url: z.string().nullable().optional(),
  external_link: z.string().url().nullable().optional(),
  link_name: z.string().max(60).nullable().optional(),
  status: z.enum(['building', 'launched']).default('launched'),
});

const updateSolutionSchema = solutionSchema.omit({ problem_id: true }).partial().extend({
  id: z.string().uuid(),
});

function sanitize(text: string): string {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function withSolvedState<T extends { solutions_count?: number | null }>(post: T): T & { solved: boolean; solutions_count: number } {
  const solutionsCount = Number(post.solutions_count || 0);
  return { ...post, solutions_count: solutionsCount, solved: solutionsCount > 0 };
}

type CountRelation = { count?: number }[];
type ProblemWithSolutionCount = {
  id: string;
  title?: string;
  body?: string;
  solutions_count?: CountRelation | number | null;
};

type SolutionListRow = {
  user_id?: string;
  title?: string;
  body?: string;
  problem?: { title?: string | null; body?: string | null } | null;
  profiles?: {
    full_name?: string | null;
    username?: string | null;
    role?: string | null;
  } | null;
};

function relationCount(value: CountRelation | number | null | undefined) {
  return Array.isArray(value) ? Number(value[0]?.count || 0) : Number(value || 0);
}

type ProfileData = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  username: string | null;
};

async function attachProfiles<T extends { user_id?: string }>(supabase: any, rows: T[]) {
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean))) as string[];
  if (userIds.length === 0) return rows;

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, username')
    .in('id', userIds) as { data: ProfileData[] | null };

  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return rows.map((row) => ({
    ...row,
    profiles: row.user_id ? profileMap.get(row.user_id) || null : null,
  }));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const problemId = searchParams.get('problemId');
    const filter = searchParams.get('filter') || 'all';
    const search = (searchParams.get('search') || '').trim();
    const cursor = searchParams.get('cursor');

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    let userId: string | null = null;
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    if (filter === 'unsolved') {
      let unsolvedQuery = supabase
        .from('posts')
        .select('*, profiles:user_id(full_name, avatar_url, role, username), solutions_count:solutions(count)')
        .eq('type', 'problem')
        .order('created_at', { ascending: false });

      if (search) {
        unsolvedQuery = unsolvedQuery.or(`title.ilike.%${search}%,body.ilike.%${search}%`);
      }

      const { data, error } = await unsolvedQuery;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const problems = ((data || []) as ProblemWithSolutionCount[])
        .map((post) => withSolvedState({ ...post, solutions_count: relationCount(post.solutions_count) }))
        .filter((post) => post.solutions_count === 0);

      const { data: allProblems } = await supabase
        .from('posts')
        .select('id, solutions_count:solutions(count)')
        .eq('type', 'problem');

      const problemsSolved = ((allProblems || []) as ProblemWithSolutionCount[])
        .filter((problem) => relationCount(problem.solutions_count) > 0).length;

      return NextResponse.json({
        solutions: [],
        unsolvedProblems: problems,
        stats: {
          totalSolutions: 0,
          problemsSolved,
          unsolvedProblems: problems.length,
          topTags: [],
        },
      });
    }

    let query = supabase
      .from('solutions')
      .select('*, problem:problem_id(id, title, slug, body, type)');

    if (problemId) query = query.eq('problem_id', problemId);
    if (filter === 'mine') {
      if (!userId) return NextResponse.json({ solutions: [], stats: emptyStats() });
      query = query.eq('user_id', userId);
    }
    if (problemId || filter === 'mine') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('upvotes', { ascending: false }).order('comments_count', { ascending: false }).limit(220);
    }
    const { data: rawSolutions, error } = await query;
    if (error) {
      if (error.message.includes('solutions')) {
        return NextResponse.json({ solutions: [], stats: emptyStats(), migrationRequired: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: allSolutions } = await supabase.from('solutions').select('id, problem_id, created_at');
    const { data: allProblems } = await supabase
      .from('posts')
      .select('id, title, body, solutions_count:solutions(count)')
      .eq('type', 'problem');

    const solutionsWithProfiles = await attachProfiles(supabase, rawSolutions || []);
    const normalizedSearch = search.toLowerCase();
    const searchedSolutions = normalizedSearch
      ? (solutionsWithProfiles as SolutionListRow[]).filter((solution) => {
          const haystack = [
            solution.title,
            solution.body,
            solution.problem?.title,
            solution.problem?.body,
            solution.profiles?.full_name,
            solution.profiles?.username,
            solution.profiles?.role,
          ].filter(Boolean).join(' ').toLowerCase();
          return haystack.includes(normalizedSearch);
        })
      : solutionsWithProfiles;

    let visibleSolutions = searchedSolutions;
    let nextCursor: string | null = null;
    let hasMore = false;
    if (!problemId && filter !== 'mine') {
      const admin = createClient(supabaseUrl, supabaseServiceKey);
      const interests = await getUserInterests(admin, userId);
      const seenIds = await getSeenPostIds(admin, userId, cursor ? 10 * 60 * 1000 : 0);
      const { offset } = parseRecommendationCursor(cursor);
      const ranked = rankSolutions(searchedSolutions as any[], interests, {
        offset,
        pageSize: PAGE_SIZE,
        newUser: !hasEnoughInterest(interests),
        seenIds,
      });
      hasMore = ranked.length > PAGE_SIZE;
      visibleSolutions = hasMore ? ranked.slice(0, PAGE_SIZE) : ranked;
      nextCursor = hasMore ? `rec:${offset + PAGE_SIZE}` : null;
    }

    const totalSolutions = allSolutions?.length || 0;
    const problemsSolved = new Set((allSolutions || []).map((s) => s.problem_id)).size;
    const unsolvedProblems = ((allProblems || []) as ProblemWithSolutionCount[])
      .filter((problem) => relationCount(problem.solutions_count) === 0).length;
    const topTags = collectTopTags(
      (visibleSolutions as SolutionListRow[]).map((solution) => `${solution.title || ''} ${solution.body || ''} ${solution.problem?.title || ''}`)
    );

    return NextResponse.json({
      solutions: visibleSolutions,
      nextCursor,
      hasMore,
      stats: {
        totalSolutions,
        problemsSolved,
        unsolvedProblems,
        topTags,
      },
    });
  } catch (err) {
    console.error('[solutions] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const parsed = solutionSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    const { data: problem, error: problemError } = await supabase
      .from('posts')
      .select('id, type, user_id, title')
      .eq('id', parsed.data.problem_id)
      .maybeSingle();

    if (problemError || !problem) return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
    if (problem.type !== 'problem') return NextResponse.json({ error: 'Solutions can only be added to problem posts' }, { status: 400 });

    const { data, error } = await supabase
      .from('solutions')
      .insert({
        user_id: user.id,
        problem_id: parsed.data.problem_id,
        title: sanitize(parsed.data.title),
        body: sanitize(parsed.data.body),
        image_url: parsed.data.image_url || null,
        external_link: parsed.data.external_link || null,
        link_name: parsed.data.link_name || null,
        status: parsed.data.status,
      })
      .select('*, problem:problem_id(id, title, slug, body, type)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const [solution] = await attachProfiles(supabase, data ? [data] : []);

    // Enqueue solved / building notification
    if (problem.user_id !== user.id) {
      try {
        await enqueueNotification('solved', {
          user_id: problem.user_id,
          actor_id: user.id,
          type: 'system',
          title: parsed.data.status === 'building' ? 'Solution in Progress' : 'Solution Completed',
          bodyTemplate: parsed.data.status === 'building'
            ? `{name} is working on solving your problem!`
            : `{name} built a solution for your problem!`,
          post_id: problem.id,
        });
      } catch (notifErr) {
        console.error('[solutions] Failed to enqueue solved notification:', notifErr);
      }
    }

    await updateUserInterestsForContent(supabase, user.id, solution?.problem || data, 'CHALLENGE_ACCEPT');
    return NextResponse.json({ solution }, { status: 201 });
  } catch (err) {
    console.error('[solutions] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const parsed = updateSolutionSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.title) updates.title = sanitize(parsed.data.title);
    if (parsed.data.body) updates.body = sanitize(parsed.data.body);
    if ('image_url' in parsed.data) updates.image_url = parsed.data.image_url || null;
    if ('external_link' in parsed.data) updates.external_link = parsed.data.external_link || null;
    if ('link_name' in parsed.data) updates.link_name = parsed.data.link_name || null;

    const { data, error } = await supabase
      .from('solutions')
      .update(updates)
      .eq('id', parsed.data.id)
      .eq('user_id', user.id)
      .select('*, problem:problem_id(id, title, slug, body, type)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const [solution] = await attachProfiles(supabase, data ? [data] : []);
    return NextResponse.json({ solution });
  } catch (err) {
    console.error('[solutions] PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing solution id' }, { status: 400 });

    const { error } = await supabase.from('solutions').delete().eq('id', id).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[solutions] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function emptyStats() {
  return { totalSolutions: 0, problemsSolved: 0, unsolvedProblems: 0, topTags: [] };
}

function collectTopTags(texts: string[]) {
  const stop = new Set(['this', 'that', 'with', 'from', 'have', 'will', 'solution', 'problem', 'your', 'about', 'into', 'for']);
  const counts = new Map<string, number>();
  texts.join(' ').toLowerCase().replace(/[^a-z0-9#\s]/g, ' ').split(/\s+/).forEach((word) => {
    const cleaned = word.replace(/^#/, '');
    if (cleaned.length < 4 || stop.has(cleaned)) return;
    counts.set(cleaned, (counts.get(cleaned) || 0) + 1);
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
}
