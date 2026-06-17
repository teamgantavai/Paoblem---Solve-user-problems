import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { enqueueNotification } from '@/lib/queue';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const voteSchema = z.object({
  post_id: z.string().uuid(),
  vote_type: z.enum(['up', 'down']),
});

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
      .single();

    if (existing) {
      if (existing.vote_type === vote_type) {
        // Remove vote (toggle off)
        await supabase.from('votes').delete().eq('id', existing.id);
        return NextResponse.json({ action: 'removed' });
      } else {
        // Update vote type
        await supabase
          .from('votes')
          .update({ vote_type })
          .eq('id', existing.id);
        return NextResponse.json({ action: 'updated', vote_type });
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

    // Send notification via Queue
    try {
      const { data: post } = await supabaseAdmin.from('posts').select('user_id').eq('id', post_id).single();
      if (post && post.user_id !== user.id) {
        await enqueueNotification('vote', {
          user_id: post.user_id,
          actor_id: user.id,
          type: vote_type === 'up' ? 'upvote' : 'downvote',
          title: vote_type === 'up' ? 'New Upvote' : 'New Downvote',
          bodyTemplate: `{name} ${vote_type}voted your post.`,
          post_id: post_id
        });
      }
    } catch (notifErr) {
      console.error('Failed to enqueue vote notification:', notifErr);
    }

    return NextResponse.json({ action: 'created', vote_type }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
