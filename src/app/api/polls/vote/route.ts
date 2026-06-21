// app/api/polls/vote/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

const voteSchema = z.object({
  poll_id   : z.string().uuid('poll_id must be a UUID'),
  option_id : z.string().uuid('option_id must be a UUID'),
});

// Simple rate-limiter: max 30 votes per minute per user
const rateLimitMap  = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX    = 30;

function checkRateLimit(key: string): boolean {
  const now   = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '').trim();

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
    }

    // 2. Rate limit
    if (!checkRateLimit(user.id)) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    // 3. Validate payload
    const raw    = await req.json();
    const parsed = voteSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { poll_id, option_id } = parsed.data;

    // 4. Call the atomic vote function (SECURITY DEFINER — handles race conditions)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: result, error: rpcErr } = await supabaseAdmin
      .rpc('vote_on_poll', {
        p_poll_id   : poll_id,
        p_option_id : option_id,
        p_user_id   : user.id,
      });

    if (rpcErr) {
      console.error('[polls/vote] RPC error:', rpcErr);
      return NextResponse.json({ error: 'Vote failed. Please try again.' }, { status: 500 });
    }

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // 5. Return updated options so the client can refresh percentages without a refetch
    const { data: updatedOptions } = await supabaseAdmin
      .from('poll_options')
      .select('id, option_text, vote_count, position')
      .eq('poll_id', poll_id)
      .order('position', { ascending: true });

    return NextResponse.json({
      action           : result?.action           ?? 'unknown',
      voted_option_id  : result?.voted_option_id  ?? null,
      options          : updatedOptions ?? [],
    });
  } catch (err) {
    console.error('[polls/vote] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}