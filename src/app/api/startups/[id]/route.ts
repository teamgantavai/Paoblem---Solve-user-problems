import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { matchUsersToStartup } from '@/lib/startupMatching';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

function getAuth(req: NextRequest) {
  return (req.headers.get('authorization') || '').replace('Bearer ', '').trim();
}

// GET /api/startups/[id] — Get single startup
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = getAuth(req);
  const adminSupa = createClient(supabaseUrl, supabaseServiceKey);

  let userId: string | null = null;
  if (token) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id || null;
  }

  try {
    // Fetch startup (by id or slug)
    const isUUID = /^[0-9a-f-]{36}$/i.test(id);
    let query = adminSupa
      .from('startups')
      .select(`
        *,
        profiles:founder_id (
          id, full_name, avatar_url, role, username, headline, bio
        )
      `);

    const { data: startup, error } = isUUID
      ? await query.eq('id', id).single()
      : await query.eq('slug', id).single();

    if (error || !startup) {
      return NextResponse.json({ error: 'Startup not found' }, { status: 404 });
    }

    // Fetch members
    const { data: members } = await adminSupa
      .from('startup_members')
      .select('*, profiles:user_id (full_name, avatar_url, role, username)')
      .eq('startup_id', startup.id)
      .order('joined_at');

    // Fetch recent updates
    const { data: updates } = await adminSupa
      .from('startup_updates')
      .select('*, profiles:author_id (full_name, avatar_url, username)')
      .eq('startup_id', startup.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Follow/apply status
    let is_following = false;
    let has_applied = false;
    let application_status: string | null = null;
    if (userId) {
      const [followRes, applyRes] = await Promise.all([
        adminSupa.from('startup_follows').select('id').eq('startup_id', startup.id).eq('user_id', userId).maybeSingle(),
        adminSupa.from('startup_applications').select('id, status').eq('startup_id', startup.id).eq('applicant_id', userId).maybeSingle(),
      ]);
      is_following = !!followRes.data;
      has_applied = !!applyRes.data;
      application_status = applyRes.data?.status || null;
    }

    // AI match for recommended people (top 8 profiles matching this startup)
    let recommendedPeople: any[] = [];
    try {
      const { data: allProfiles } = await adminSupa
        .from('profiles')
        .select('id, full_name, avatar_url, role, username, headline, skills, preferred_roles, interests, work_preference, looking_for, availability, ai_keywords')
        .neq('id', startup.founder_id)
        .not('skills', 'is', null)
        .limit(200);

      if (allProfiles && allProfiles.length > 0) {
        const matched = matchUsersToStartup(startup, allProfiles);
        recommendedPeople = matched.slice(0, 8).map((m) => ({
          user_id: m.user_id,
          match_score: m.match_score,
          match_reasons: m.match_reasons,
          profile: m.profile,
        }));
      }
    } catch (matchErr) {
      console.error('[startup match]', matchErr);
    }

    // Applications count visible to founder only
    let applicationsCount = 0;
    if (userId === startup.founder_id) {
      const { count } = await adminSupa
        .from('startup_applications')
        .select('id', { count: 'exact', head: true })
        .eq('startup_id', startup.id);
      applicationsCount = count || 0;
    }

    return NextResponse.json({
      startup: {
        ...startup,
        is_following,
        has_applied,
        application_status,
        applications_count: userId === startup.founder_id ? applicationsCount : startup.applications_count,
      },
      members: members || [],
      updates: updates || [],
      recommendedPeople,
    });
  } catch (err: any) {
    console.error('[/api/startups/[id] GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/startups/[id] — Update startup (founder only)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

    // Verify ownership
    const { data: existing } = await adminSupa
      .from('startups').select('founder_id').eq('id', id).single();
    if (!existing || existing.founder_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allowed = ['name', 'tagline', 'description', 'stage', 'industry', 'funding_stage',
      'website', 'logo_url', 'banner_url', 'compensation_type', 'work_type',
      'looking_for', 'required_skills', 'deadline'];

    const update: Record<string, any> = {};
    allowed.forEach((key) => {
      if (key in body) update[key] = body[key];
    });
    update.updated_at = new Date().toISOString();

    const { data, error } = await adminSupa
      .from('startups').update(update).eq('id', id)
      .select('*, profiles:founder_id(full_name,avatar_url,role,username)')
      .single();

    if (error) throw error;
    return NextResponse.json({ startup: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/startups/[id] — Delete startup (founder only)
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

  const { data: existing } = await adminSupa
    .from('startups').select('founder_id').eq('id', id).single();
  if (!existing || existing.founder_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await adminSupa.from('startups').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
