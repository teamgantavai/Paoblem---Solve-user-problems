import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { enqueueNotification } from '@/lib/queue';
import { updateUserInterestsForContent } from '@/lib/recommendations';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const commentSchema = z.object({
  post_id: z.string().uuid(),
  body: z.string().min(1, 'Comment cannot be empty').max(2000, 'Comment too long'),
  parent_id: z.string().uuid().optional().nullable(),
});

function sanitize(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { post_id, body: commentBody, parent_id } = parsed.data;
    const sanitizedBody = sanitize(commentBody);

    const { data, error } = await supabase
      .from('comments')
      .insert({
        user_id: user.id,
        post_id,
        body: sanitizedBody,
        parent_id: parent_id || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      const { data: post } = await supabaseAdmin.from('posts').select('user_id').eq('id', post_id).single();
      if (post && post.user_id !== user.id) {
        await enqueueNotification('comment', {
          user_id: post.user_id,
          actor_id: user.id,
          type: 'comment',
          title: 'New Comment',
          bodyTemplate: `{name} commented on your post.`,
          post_id: post_id
        });
      }
    } catch (notifErr) {
      console.error('Failed to enqueue comment notification:', notifErr);
    }

    const { data: interestPost } = await supabaseAdmin.from('posts').select('*').eq('id', post_id).maybeSingle();
    await updateUserInterestsForContent(supabaseAdmin, user.id, interestPost, 'POST_COMMENT');

    // Recalculate quality score after new comment (fire-and-forget, non-blocking)
    supabaseAdmin.rpc('recalculate_quality_score', { p_post_id: post_id }).catch(() => {});

    return NextResponse.json({ comment: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { id, body } = await req.json();
    if (!id || !body || !body.trim()) {
      return NextResponse.json({ error: 'Comment ID and body are required' }, { status: 400 });
    }

    const sanitizedBody = sanitize(body.trim());

    const supabaseAdmin = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabaseAdmin
      .from('comments')
      .update({
        body: sanitizedBody,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ comment: data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabaseAdmin
      .from('comments')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch the post_id for this comment so we can recalculate quality
    // (comment already deleted, so we need post_id from the URL or body)
    const post_id_param = searchParams.get('post_id');
    if (post_id_param) {
      supabaseAdmin.rpc('recalculate_quality_score', { p_post_id: post_id_param }).catch(() => {});
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
