import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

export async function GET(
  req: NextRequest,
  { params }: { params: { postId: string } },
) {
  const { postId } = params;
  if (!postId) {
    return NextResponse.json({ error: 'postId is required' }, { status: 400 });
  }

  // Use admin client for read so RLS doesn't block unauthenticated reads.
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Fetch poll row for this post
  const { data: poll, error: pollErr } = await supabaseAdmin
    .from('polls')
    .select('id, post_id, expires_at, multiple_choice, created_at')
    .eq('post_id', postId)
    .single();

  if (pollErr || !poll) {
    // Not found is a valid state (post may not be a poll yet)
    return NextResponse.json({ poll: null }, { status: 200 });
  }

  // 2. Fetch options
  const { data: options, error: optsErr } = await supabaseAdmin
    .from('poll_options')
    .select('id, option_text, vote_count, position')
    .eq('poll_id', poll.id)
    .order('position', { ascending: true });

  if (optsErr) {
    console.error('[polls/get] Options fetch error:', optsErr);
    return NextResponse.json({ error: 'Failed to fetch poll options' }, { status: 500 });
  }

  // 3. If user is authenticated, find which option they voted for
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
        .single();

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
