import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { data: notifs, error: nError } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .limit(1);

    const { data: msgs, error: mError } = await supabaseAdmin
      .from('messages')
      .select('*')
      .limit(1);

    return NextResponse.json({
      time: new Date().toISOString(),
      nError,
      notifs,
      mError,
      msgs,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
