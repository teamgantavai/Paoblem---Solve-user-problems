import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendApplicationAcceptedEmail, sendApplicationRejectedEmail } from '@/lib/email';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

function getAuth(req: NextRequest) {
  return (req.headers.get('authorization') || '').replace('Bearer ', '').trim();
}

// GET /api/startups/[id]/applications — Founder views all applications
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = getAuth(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminSupa = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify founder
  const { data: startup } = await adminSupa
    .from('startups').select('founder_id').eq('id', id).single();
  if (!startup || startup.founder_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await adminSupa
    .from('startup_applications')
    .select(`
      *,
      profiles:applicant_id (
        id, full_name, avatar_url, role, username, headline,
        skills, preferred_roles, interests, looking_for, availability, work_preference,
        github, linkedin, twitter, website
      )
    `)
    .eq('startup_id', id)
    .order('applied_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ applications: data || [] });
}

// PATCH /api/startups/[id]/applications — Accept or reject an application
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

  const { data: startup } = await adminSupa
    .from('startups').select('founder_id, name').eq('id', id).single();
  if (!startup || startup.founder_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { application_id, status } = body;

  if (!application_id || !['accepted', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { data, error } = await adminSupa
    .from('startup_applications')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', application_id)
    .eq('startup_id', id)
    .select(`*, profiles:applicant_id(full_name, username)`)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If accepted, add to startup_members
  if (status === 'accepted' && data) {
    await adminSupa.from('startup_members').upsert({
      startup_id: id,
      user_id: data.applicant_id,
      role: null,
    }, { onConflict: 'startup_id,user_id' });
  }

  // Send email notification (non-blocking)
  try {
    const { data: { user: applicantAuth } } = await adminSupa.auth.admin.getUserById(data.applicant_id);
    const applicantEmail = applicantAuth?.email;
    const applicantName = (data as any).profiles?.full_name || (data as any).profiles?.username || 'there';

    // Parse role from intro field
    const roleMatch = (data.intro || '').match(/\[Applying as: ([^\]]+)\]/);
    const role = roleMatch ? roleMatch[1] : 'Team Member';

    // Get founder profile
    const founderProfile = await adminSupa
      .from('profiles').select('full_name, username').eq('id', startup.founder_id).single();
    const founderName = founderProfile.data?.full_name || founderProfile.data?.username || 'the founder';

    if (applicantEmail) {
      if (status === 'accepted') {
        sendApplicationAcceptedEmail({
          applicantEmail,
          applicantName,
          startupName: startup.name,
          startupId: id,
          role,
          founderName,
        });
      } else if (status === 'rejected') {
        sendApplicationRejectedEmail({
          applicantEmail,
          applicantName,
          startupName: startup.name,
          role,
        });
      }
    }
  } catch (emailErr) {
    console.error('[applications] email error (non-fatal):', emailErr);
  }

  return NextResponse.json({ application: data });
}
