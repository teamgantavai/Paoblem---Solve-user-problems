import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendNewApplicationEmail } from '@/lib/email';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

function getAuth(req: NextRequest) {
  return (req.headers.get('authorization') || '').replace('Bearer ', '').trim();
}

// POST /api/startups/[id]/apply
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = getAuth(req);
  if (!token) return NextResponse.json({ error: 'Sign in to apply' }, { status: 401 });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminSupa = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Prevent founder from applying to own startup
  const { data: startup } = await adminSupa
    .from('startups').select('founder_id, name, required_skills').eq('id', id).single();
  if (!startup) return NextResponse.json({ error: 'Startup not found' }, { status: 404 });
  if (startup.founder_id === user.id) {
    return NextResponse.json({ error: 'You cannot apply to your own startup' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const selectedRole = (body.role || '').trim();

  // Check if they already applied to this startup for the same role
  const { data: existingApp } = await adminSupa
    .from('startup_applications')
    .select('id, intro')
    .eq('startup_id', id)
    .eq('applicant_id', user.id)
    .maybeSingle();

  if (existingApp) {
    const existingIntro = existingApp.intro || '';
    const roleMatch = existingIntro.match(/\[Applying as:\s*(.*?)\]/) || [null, existingIntro];
    const existingRole = (roleMatch[1] || existingIntro).trim().toLowerCase();
    
    if (existingRole === selectedRole.toLowerCase() && selectedRole !== '') {
      return NextResponse.json({ error: 'You have already applied for this position.' }, { status: 400 });
    }
  }

  const { data, error } = await adminSupa
    .from('startup_applications')
    .upsert({
      startup_id: id,
      applicant_id: user.id,
      intro: body.intro?.trim() || null,
      reason: body.reason?.trim() || null,
      portfolio_links: Array.isArray(body.portfolio_links)
        ? body.portfolio_links.filter(Boolean)
        : [],
      status: 'pending',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'startup_id,applicant_id' })
    .select()
    .single();

  if (error) {
    console.error('[apply]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send email to founder (non-blocking)
  try {
    const [{ data: { user: founderAuth } }, { data: applicantProfile }] = await Promise.all([
      adminSupa.auth.admin.getUserById(startup.founder_id),
      adminSupa.from('profiles').select('full_name, username').eq('id', user.id).single(),
    ]);
    const founderProfile = await adminSupa
      .from('profiles').select('full_name, username').eq('id', startup.founder_id).single();

    if (founderAuth?.email) {
      // Parse role and intro from request payload
      const roleMatch = (body.intro || '').match(/\[Applying as: ([^\]]+)\]/);
      const role = roleMatch ? roleMatch[1] : 'Team Member';
      
      let introText = '';
      try {
        if (body.reason && body.reason.startsWith('{')) {
          const parsed = JSON.parse(body.reason);
          introText = parsed.about_you || '';
        }
      } catch (e) {}
      if (!introText) {
        introText = (body.intro || '').replace(/\[Applying as: [^\]]+\]\n?/, '').trim();
      }

      sendNewApplicationEmail({
        founderEmail: founderAuth.email,
        founderName: founderProfile.data?.full_name || founderProfile.data?.username || 'there',
        startupName: startup.name,
        startupId: id,
        applicantName: applicantProfile?.full_name || applicantProfile?.username || 'Someone',
        role,
        introText: introText.slice(0, 300),
      });
    }
  } catch (emailErr) {
    console.error('[apply] email error (non-fatal):', emailErr);
  }

  return NextResponse.json({ application: data }, { status: 201 });
}

// DELETE /api/startups/[id]/apply — Withdraw application
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

  const { error } = await adminSupa
    .from('startup_applications')
    .delete()
    .eq('startup_id', id)
    .eq('applicant_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
