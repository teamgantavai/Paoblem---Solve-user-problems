import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const envs: Record<string, string> = {};
    for (const key of Object.keys(process.env)) {
      envs[key] = process.env[key] || '';
    }
    return NextResponse.json({
      envs
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
