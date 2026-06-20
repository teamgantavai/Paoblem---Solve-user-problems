import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }

    const { data: rpcExists, error: rpcError } = await supabaseAdmin.rpc('check_email_exists', {
      email_to_check: normalizedEmail,
    });

    if (!rpcError && typeof rpcExists === 'boolean') {
      return NextResponse.json({ exists: rpcExists });
    }

    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;

      const users = data.users || [];
      if (users.some((user) => user.email?.toLowerCase() === normalizedEmail)) {
        return NextResponse.json({ exists: true });
      }
      if (users.length < 1000) break;
    }

    return NextResponse.json({ exists: false });
  } catch (err: any) {
    console.error('[POST /api/auth/email-exists]', err);
    return NextResponse.json({ error: 'Could not check this email' }, { status: 500 });
  }
}

