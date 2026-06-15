import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const envKeys = Object.keys(process.env);
    
    // Let's check if we can run raw SQL queries if pg is initialized
    // Let's check if DATABASE_URL or other connection strings exist
    const hasDatabaseUrl = !!process.env.DATABASE_URL;
    const databaseUrlValue = process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + "..." : null;

    // Check tables in public schema using supabase admin REST api (if exposed)
    // Supabase admin client can check database tables if we query pg_tables or information_schema, but normally postgrest hides it.
    // Let's try to query 'conversations' to see if it exists
    const { data: convs, error: cError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .limit(1);

    const { data: members, error: memError } = await supabaseAdmin
      .from('conversation_members')
      .select('*')
      .limit(1);

    const { data: attachments, error: attError } = await supabaseAdmin
      .from('attachments')
      .select('*')
      .limit(1);

    const { data: receipts, error: recError } = await supabaseAdmin
      .from('read_receipts')
      .select('*')
      .limit(1);

    return NextResponse.json({
      envKeys,
      hasDatabaseUrl,
      databaseUrlValue,
      conversations: { error: cError?.message || null, exists: !cError },
      conversation_members: { error: memError?.message || null, exists: !memError },
      attachments: { error: attError?.message || null, exists: !attError },
      read_receipts: { error: recError?.message || null, exists: !recError },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
