import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAppUrl, sendEmail } from '@/lib/email';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName } = await req.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(fullName || '').trim();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }
    if (!password || String(password).length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }
    if (!cleanName) {
      return NextResponse.json({ error: 'Please enter your name' }, { status: 400 });
    }

    const origin = req.headers.get('origin');
    const appUrl = getAppUrl(origin);
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email: normalizedEmail,
      password,
      options: {
        data: { full_name: cleanName },
        redirectTo: `${appUrl}/profile`,
      },
    });

    if (error) {
      const message = error.message.toLowerCase().includes('already')
        ? 'This email is already registered. Try logging in instead.'
        : error.message;
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const properties = (data as any).properties || {};
    const otp = properties.email_otp || properties.hashed_token || '';
    const actionLink = properties.action_link || '';

    await sendEmail({
      to: normalizedEmail,
      subject: 'Verify your Paoblem email',
      text: `Your Paoblem verification code is ${otp}. This code is valid for 15 minutes. You can also verify here: ${actionLink}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827">
          <h2>Verify your Paoblem email</h2>
          <p>Use this one-time code to finish creating your account (valid for 15 minutes):</p>
          <p style="font-size:28px;font-weight:800;letter-spacing:6px">${otp}</p>
          <p>Or click this secure verification link:</p>
          <p><a href="${actionLink}" style="display:inline-block;background:#111827;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none">Verify email</a></p>
          <p style="color:#6b7280;font-size:13px">This verification code and link will expire in 15 minutes. If you did not create a Paoblem account, you can ignore this email.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[POST /api/auth/signup]', err);
    return NextResponse.json({ error: err.message || 'Could not create account' }, { status: 500 });
  }
}

