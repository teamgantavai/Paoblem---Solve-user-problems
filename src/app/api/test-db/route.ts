import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  try {
    // 1. Try to query search_queries
    const { data: qData, error: qErr } = await supabase
      .from('search_queries')
      .select('*')
      .limit(1);

    // 2. Try to query search_history
    const { data: hData, error: hErr } = await supabase
      .from('search_history')
      .select('*')
      .limit(1);

    // 3. Try calling search_all RPC with correct signature
    const { data: rpcData, error: rpcErr } = await supabase.rpc('search_all', {
      query_text: 'test',
      limit_per_type: 1
    });

    return NextResponse.json({
      search_queries: { exists: !qErr, error: qErr?.message },
      search_history: { exists: !hErr, error: hErr?.message },
      search_all_rpc: { exists: !rpcErr, error: rpcErr?.message }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
