import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { matchStartupsToUser } from '@/lib/startupMatching';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
const PAGE_SIZE = 10;

function parseFundingStage(value: string | null) {
  if (!value) return { funding_stage: '', hiring_status: 'Hiring', roles_statuses: {} as Record<string, string> };
  try {
    if (value.startsWith('{')) {
      const data = JSON.parse(value);
      return {
        funding_stage: data.funding_stage || '',
        hiring_status: data.hiring_status || 'Hiring',
        roles_statuses: (data.roles_statuses || {}) as Record<string, string>
      };
    }
  } catch (e) {}
  return { funding_stage: value, hiring_status: 'Hiring', roles_statuses: {} as Record<string, string> };
}

function getAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  return token;
}

// GET /api/startups — List startups feed
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = getAuth(req);
  const cursor = searchParams.get('cursor');
  const stage = searchParams.get('stage');
  const industry = searchParams.get('industry');
  const role = searchParams.get('role');
  const skills = searchParams.get('skills'); // comma-separated
  const compensation = searchParams.get('compensation');
  const workType = searchParams.get('work_type');
  const hiringStatus = searchParams.get('hiring_status');
  const sort = searchParams.get('sort') || 'newest'; // newest | trending | ai
  const q = searchParams.get('q')?.trim().toLowerCase();

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });
  const adminSupa = createClient(supabaseUrl, supabaseServiceKey);

  // Get current user if authenticated
  let userId: string | null = null;
  let userProfile: any = null;
  if (token) {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id || null;
    if (userId) {
      const { data } = await adminSupa
        .from('profiles')
        .select('id, skills, preferred_roles, interests, work_preference, looking_for, availability, ai_keywords')
        .eq('id', userId)
        .single();
      userProfile = data;
    }
  }

  try {
    let query = adminSupa
      .from('startups')
      .select(`
        *,
        profiles:founder_id (
          full_name, avatar_url, role, username
        )
      `)
      .order('created_at', { ascending: false });

    // Filters
    if (stage) query = query.eq('stage', stage);
    if (industry) query = query.eq('industry', industry);
    if (compensation) query = query.eq('compensation_type', compensation);
    if (workType) query = query.eq('work_type', workType);

    // Pagination cursor
    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const limitAmount = q ? 100 : (PAGE_SIZE + 1);
    query = query.limit(limitAmount);

    const { data: rows, error } = await query;
    if (error) throw error;

    let startups: any[] = rows || [];

    // Search query matching
    if (q) {
      startups = startups.filter((s) => {
        const nameMatch = s.name?.toLowerCase().includes(q);
        const taglineMatch = s.tagline?.toLowerCase().includes(q);
        const descMatch = s.description?.toLowerCase().includes(q);
        const indMatch = s.industry?.toLowerCase().includes(q);
        const stageMatch = s.stage?.toLowerCase().includes(q);
        const workMatch = s.work_type?.toLowerCase().includes(q);
        const compMatch = s.compensation_type?.toLowerCase().includes(q);
        const skillsMatch = (s.required_skills || []).some((sk: string) => sk.toLowerCase().includes(q));
        const rolesMatch = (s.looking_for || []).some((r: string) => r.toLowerCase().includes(q));
        
        return nameMatch || taglineMatch || descMatch || indMatch || stageMatch || workMatch || compMatch || skillsMatch || rolesMatch;
      });
    }

    // Post-filter by role (checking looking_for array)
    if (role) {
      startups = startups.filter((s) =>
        (s.looking_for || []).some((r: string) =>
          r.toLowerCase().includes(role.toLowerCase())
        )
      );
    }

    // Post-filter by skills
    if (skills) {
      const skillList = skills.split(',').map((s) => s.trim().toLowerCase());
      startups = startups.filter((s) =>
        (s.required_skills || []).some((sk: string) =>
          skillList.includes(sk.toLowerCase())
        )
      );
    }

    // Post-filter by hiring_status
    if (hiringStatus) {
      startups = startups.filter((s) => {
        const parsed = parseFundingStage(s.funding_stage);
        return parsed.hiring_status.toLowerCase() === hiringStatus.toLowerCase();
      });
    }

    // AI sorting — rank by match score for the user
    if (sort === 'ai' && userProfile) {
      const results = matchStartupsToUser(userProfile, startups);
      startups = results.map((r) => ({ ...r.startup, match_score: r.match_score }));
    } else if (sort === 'trending') {
      startups = startups.sort((a, b) =>
        (b.applications_count + b.followers_count) - (a.applications_count + a.followers_count)
      );
    }

    // Check follow/apply status for authenticated users
    let followedIds = new Set<string>();
    let appliedIds = new Set<string>();
    if (userId && startups.length > 0) {
      const ids = startups.map((s) => s.id);
      const [followRes, applyRes] = await Promise.all([
        adminSupa.from('startup_follows').select('startup_id').eq('user_id', userId).in('startup_id', ids),
        adminSupa.from('startup_applications').select('startup_id').eq('applicant_id', userId).in('startup_id', ids),
      ]);
      followedIds = new Set((followRes.data || []).map((r: any) => r.startup_id));
      appliedIds = new Set((applyRes.data || []).map((r: any) => r.startup_id));
    }

    const hasMore = startups.length > PAGE_SIZE;
    const page = startups.slice(0, PAGE_SIZE).map((s) => ({
      ...s,
      is_following: followedIds.has(s.id),
      has_applied: appliedIds.has(s.id),
    }));
    const nextCursor = hasMore ? page[page.length - 1]?.created_at || null : null;

    // If AI-recommended, also compute and return top recommended startups for sidebar
    let recommended: any[] = [];
    if (userProfile && !cursor) {
      const allForRec = [...startups];
      const recResults = matchStartupsToUser(userProfile, allForRec);
      recommended = recResults.slice(0, 5).map((r) => ({
        ...r.startup,
        match_score: r.match_score,
        match_reasons: r.match_reasons,
      }));
    }

    return NextResponse.json({ startups: page, nextCursor, hasMore, recommended });
  } catch (err: any) {
    console.error('[/api/startups GET]', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch startups' }, { status: 500 });
  }
}

// POST /api/startups — Create a startup
export async function POST(req: NextRequest) {
  const token = getAuth(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminSupa = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Startup name is required' }, { status: 400 });
    }
    if (!body.stage) {
      return NextResponse.json({ error: 'Stage is required' }, { status: 400 });
    }

    const payload = {
      founder_id: user.id,
      name: body.name.trim(),
      tagline: body.tagline?.trim() || null,
      description: body.description?.trim() || null,
      stage: body.stage,
      industry: body.industry?.trim() || null,
      funding_stage: body.funding_stage?.trim() || null,
      website: body.website?.trim() || null,
      logo_url: body.logo_url || null,
      banner_url: body.banner_url || null,
      compensation_type: body.compensation_type || 'Equity',
      work_type: body.work_type || 'Remote',
      looking_for: Array.isArray(body.looking_for) ? body.looking_for : [],
      required_skills: Array.isArray(body.required_skills) ? body.required_skills : [],
      deadline: body.deadline || null,
    };

    const { data, error } = await adminSupa
      .from('startups')
      .insert(payload)
      .select(`*, profiles:founder_id (full_name, avatar_url, role, username)`)
      .single();

    if (error) throw error;

    return NextResponse.json({ startup: data }, { status: 201 });
  } catch (err: any) {
    console.error('[/api/startups POST]', err);
    return NextResponse.json({ error: err.message || 'Failed to create startup' }, { status: 500 });
  }
}
