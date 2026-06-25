import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { enqueueNotification } from '@/lib/queue';
import { updateUserInterestsForContent } from '@/lib/recommendations';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const voteSchema = z.object({
  post_id: z.string().uuid(),
  vote_type: z.enum(['up', 'down']),
});

async function recalculateQualityScore(
  admin: any,
  post_id: string
): Promise<{ quality_score: number | null; unique_viewers: number }> {
  try {
    await admin.rpc('recalculate_quality_score', { p_post_id: post_id });
    const { data } = await admin
      .from('posts')
      .select('quality_score, unique_viewers')
      .eq('id', post_id)
      .single();
    return {
      quality_score: data?.quality_score ?? null,
      unique_viewers: data?.unique_viewers ?? 0,
    };
  } catch {
    return { quality_score: null, unique_viewers: 0 };
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const supabaseAdmin = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = voteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { post_id, vote_type } = parsed.data;

    // Check existing vote
    const { data: existing } = await supabase
      .from('votes')
      .select('*')
      .eq('user_id', user.id)
      .eq('post_id', post_id)
      .maybeSingle();

    if (existing) {
      if (existing.vote_type === vote_type) {
        // Remove vote (toggle off)
        await supabase.from('votes').delete().eq('id', existing.id);
        // Recalculate quality score after vote removal
        const qualityResult = await recalculateQualityScore(supabaseAdmin, post_id);
        return NextResponse.json({ action: 'removed', ...qualityResult });
      } else {
        // Update vote type
        await supabase
          .from('votes')
          .update({ vote_type })
          .eq('id', existing.id);
        if (vote_type === 'up') {
          const { data: post } = await supabaseAdmin.from('posts').select('*').eq('id', post_id).maybeSingle();
          await updateUserInterestsForContent(supabaseAdmin, user.id, post, 'POST_UPVOTE');
        }
        const qualityResult = await recalculateQualityScore(supabaseAdmin, post_id);
        return NextResponse.json({ action: 'updated', vote_type, ...qualityResult });
      }
    }

    // Insert new vote
    const { error } = await supabase.from('votes').insert({
      user_id: user.id,
      post_id,
      vote_type,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (vote_type === 'up') {
      const { data: post } = await supabaseAdmin.from('posts').select('*').eq('id', post_id).maybeSingle();
      await updateUserInterestsForContent(supabaseAdmin, user.id, post, 'POST_UPVOTE');
    }

    // Recalculate quality score after new vote
    const qualityResult = await recalculateQualityScore(supabaseAdmin, post_id);

    // Send notification via Queue (don't block the response on this)
    (async () => {
      try {
        const { data: post } = await supabaseAdmin.from('posts').select('user_id').eq('id', post_id).single();
        if (post && post.user_id !== user.id) {
          await enqueueNotification('vote', {
            user_id: post.user_id,
            actor_id: user.id,
            type: vote_type === 'up' ? 'upvote' : 'downvote',
            title: vote_type === 'up' ? 'New Upvote' : 'New Downvote',
            bodyTemplate: `{name} ${vote_type}voted your post.`,
            post_id: post_id,
          });
        }
      } catch (notifErr) {
        console.error('Failed to enqueue vote notification:', notifErr);
      }
    })();

    return NextResponse.json({ action: 'created', vote_type, ...qualityResult }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
