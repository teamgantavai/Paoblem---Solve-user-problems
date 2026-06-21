import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { email, token, type } = await req.json();

    if (!email || !token || !type) {
      return NextResponse.json({ error: 'Email, token, and type are required' }, { status: 400 });
    }

    let result = await supabaseAdmin.auth.verifyOtp({ email, token, type });
    
    // Fallback for signup to magiclink type if needed
    if (result.error && type === 'signup') {
      result = await supabaseAdmin.auth.verifyOtp({ email, token, type: 'magiclink' });
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ session: result.data.session, user: result.data.user });
  } catch (err: any) {
    console.error('[POST /api/auth/verify-otp]', err);
    return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 500 });
  }
}
