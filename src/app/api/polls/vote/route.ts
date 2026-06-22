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

// Simple in-memory rate-limiter: max 30 votes / minute / user
const rateLimitMap      = new Map<string, { count: number; resetTime: number }>();
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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Verify poll exists and is not expired
    const { data: poll, error: pollErr } = await supabaseAdmin
      .from('polls')
      .select('id, expires_at, multiple_choice')
      .eq('id', poll_id)
      .maybeSingle();

    if (pollErr || !poll) {
      return NextResponse.json({ error: 'Poll not found.' }, { status: 404 });
    }
    if (new Date(poll.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'This poll has ended.' }, { status: 400 });
    }

    // 5. Verify option belongs to this poll
    const { data: option, error: optErr } = await supabaseAdmin
      .from('poll_options')
      .select('id')
      .eq('id', option_id)
      .eq('poll_id', poll_id)
      .maybeSingle();

    if (optErr || !option) {
      return NextResponse.json({ error: 'Invalid poll option.' }, { status: 400 });
    }

    // 6. Check existing vote
    const { data: existingVote } = await supabaseAdmin
      .from('poll_votes')
      .select('id, option_id')
      .eq('poll_id', poll_id)
      .eq('user_id', user.id)
      .maybeSingle();

    let action          = 'voted';
    let votedOptionId   = option_id;

    if (existingVote) {
      if (existingVote.option_id === option_id) {
        // Toggle off: remove vote
        await supabaseAdmin.from('poll_votes').delete().eq('id', existingVote.id);
        // Decrement vote count
        await supabaseAdmin.rpc('decrement_poll_vote', {
          p_option_id: option_id,
        }).catch(() => {
          // Fallback if RPC doesn't exist: read-then-write
          supabaseAdmin
            .from('poll_options')
            .select('vote_count')
            .eq('id', option_id)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                supabaseAdmin
                  .from('poll_options')
                  .update({ vote_count: Math.max(0, (data.vote_count ?? 1) - 1) })
                  .eq('id', option_id);
              }
            });
        });
        action        = 'unvoted';
        votedOptionId = '';
      } else {
        // Change vote: decrement old, increment new
        await supabaseAdmin.from('poll_votes').update({ option_id }).eq('id', existingVote.id);

        // Decrement old option
        const { data: oldOpt } = await supabaseAdmin
          .from('poll_options').select('vote_count').eq('id', existingVote.option_id).maybeSingle();
        if (oldOpt) {
          await supabaseAdmin
            .from('poll_options')
            .update({ vote_count: Math.max(0, (oldOpt.vote_count ?? 1) - 1) })
            .eq('id', existingVote.option_id);
        }
        // Increment new option
        const { data: newOpt } = await supabaseAdmin
          .from('poll_options').select('vote_count').eq('id', option_id).maybeSingle();
        if (newOpt) {
          await supabaseAdmin
            .from('poll_options')
            .update({ vote_count: (newOpt.vote_count ?? 0) + 1 })
            .eq('id', option_id);
        }
        action = 'changed';
      }
    } else {
      // New vote: insert row and increment count
      await supabaseAdmin.from('poll_votes').insert({
        poll_id,
        option_id,
        user_id: user.id,
      });
      const { data: newOpt } = await supabaseAdmin
        .from('poll_options').select('vote_count').eq('id', option_id).maybeSingle();
      if (newOpt) {
        await supabaseAdmin
          .from('poll_options')
          .update({ vote_count: (newOpt.vote_count ?? 0) + 1 })
          .eq('id', option_id);
      }
    }

    // 7. Return fresh option counts
    const { data: updatedOptions } = await supabaseAdmin
      .from('poll_options')
      .select('id, option_text, vote_count, position')
      .eq('poll_id', poll_id)
      .order('position', { ascending: true });

    return NextResponse.json({
      action,
      voted_option_id: votedOptionId || null,
      options        : updatedOptions ?? [],
    });
  } catch (err) {
    console.error('[polls/vote] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
