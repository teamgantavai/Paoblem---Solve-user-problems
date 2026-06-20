import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateUser, getServiceClient, upsertDailyAggregation } from '@/lib/analytics-server';
import { updateUserInterestsForContent } from '@/lib/recommendations';

const trackSchema = z.object({
  post_id: z.string().uuid(),
  event_type: z.enum([
    'POST_VIEW',
    'POST_OPEN',
    'POST_UPVOTE',
    'POST_DOWNVOTE',
    'POST_COMMENT',
    'POST_SHARE',
    'POST_SAVE',
    'FOLLOW_FROM_POST',
    'CHALLENGE_ACCEPT',
    'DWELL',
  ]),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = trackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { post_id, event_type, metadata } = parsed.data;
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const supabase = getServiceClient();
    let userId: string | null = null;

    if (token) {
      const auth = await authenticateUser(token);
      userId = auth?.user.id ?? null;
    }

    const { error: insertError } = await supabase.from('post_events').insert({
      post_id,
      user_id: userId,
      event_type,
      metadata: metadata ?? {},
    });

    if (insertError) {
      // Table may not exist yet — fail silently for tracking
      if (insertError.code === '42P01' || insertError.message.includes('does not exist')) {
        return NextResponse.json({ ok: true, queued: false });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await upsertDailyAggregation(supabase, post_id, event_type);

    if (userId) {
      const { data: post } = await supabase.from('posts').select('*').eq('id', post_id).maybeSingle();
      await updateUserInterestsForContent(
        supabase,
        userId,
        post,
        event_type,
        typeof metadata?.dwellSeconds === 'number' ? metadata.dwellSeconds : 0
      );
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
