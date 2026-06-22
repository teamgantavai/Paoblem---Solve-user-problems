import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

// ── Ensure poll tables exist (runs DDL via Supabase SQL endpoint) ──────────────
let tablesReady = false;
async function ensurePollTables() {
  if (tablesReady) return;
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS polls (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id         UUID NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
        expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
        multiple_choice BOOLEAN NOT NULL DEFAULT FALSE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS poll_options (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        poll_id     UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
        option_text TEXT NOT NULL,
        vote_count  INTEGER NOT NULL DEFAULT 0,
        position    INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS poll_votes (
        id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        poll_id   UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
        option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
        user_id   UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(poll_id, user_id)
      );
    `;

    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method : 'POST',
      headers: {
        'Content-Type' : 'application/json',
        'apikey'       : supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ sql }),
    });

    // If exec_sql RPC doesn't exist either, fall through silently —
    // tables may already exist from a prior migration.
    tablesReady = true;
  } catch {
    tablesReady = true; // assume tables exist
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  if (!postId) {
    return NextResponse.json({ error: 'postId is required' }, { status: 400 });
  }

  await ensurePollTables();

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Fetch poll row for this post
  const { data: poll, error: pollErr } = await supabaseAdmin
    .from('polls')
    .select('id, post_id, expires_at, multiple_choice, created_at')
    .eq('post_id', postId)
    .single();

  if (pollErr || !poll) {
    return NextResponse.json({ poll: null }, { status: 200 });
  }

  // 2. Fetch options with vote counts
  const { data: options, error: optsErr } = await supabaseAdmin
    .from('poll_options')
    .select('id, option_text, vote_count, position')
    .eq('poll_id', poll.id)
    .order('position', { ascending: true });

  if (optsErr) {
    console.error('[polls/get] Options fetch error:', optsErr);
    return NextResponse.json({ error: 'Failed to fetch poll options' }, { status: 500 });
  }

  // 3. Determine which option the current user voted for
  let userVotedOptionId: string | null = null;

  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '').trim();
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user } } = await supabaseUser.auth.getUser(token);
    if (user) {
      const { data: vote } = await supabaseAdmin
        .from('poll_votes')
        .select('option_id')
        .eq('poll_id', poll.id)
        .eq('user_id', user.id)
        .maybeSingle();

      userVotedOptionId = vote?.option_id ?? null;
    }
  }

  return NextResponse.json({
    poll: {
      ...poll,
      options             : options ?? [],
      user_voted_option_id: userVotedOptionId,
    },
  });
}
