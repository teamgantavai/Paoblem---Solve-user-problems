import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAppUrl, sendEmail } from '@/lib/email';

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

    const origin = req.headers.get('origin');
    const appUrl = getAppUrl(origin);
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
      options: {
        redirectTo: `${appUrl}/profile`,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const properties = (data as any).properties || {};
    const otp = properties.email_otp || properties.hashed_token || '';
    const actionLink = properties.action_link || '';

    await sendEmail({
      to: normalizedEmail,
      subject: 'Your Paoblem verification code',
      text: `Your Paoblem code is ${otp}. This code is valid for 15 minutes. You can also continue here: ${actionLink}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827">
          <h2>Your Paoblem code</h2>
          <p>Use this one-time code to continue (valid for 15 minutes):</p>
          <p style="font-size:28px;font-weight:800;letter-spacing:6px">${otp}</p>
          <p><a href="${actionLink}" style="display:inline-block;background:#111827;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none">Continue to Paoblem</a></p>
          <p style="color:#6b7280;font-size:13px">This code and link will expire in 15 minutes.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[POST /api/auth/resend-verification]', err);
    return NextResponse.json({ error: err.message || 'Could not resend verification email' }, { status: 500 });
  }
}

