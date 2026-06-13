import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const updatePostSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(3, 'Title must be at least 3 characters').max(300, 'Title too long'),
  body: z.string().min(10, 'Body must be at least 10 characters').max(10000, 'Body too long'),
  type: z.enum(['problem', 'idea']),
  image_url: z.string().nullable().optional().refine((val) => {
    if (!val) return true;
    try {
      if (val.startsWith('[') && val.endsWith(']')) {
        const arr = JSON.parse(val);
        return Array.isArray(arr) && arr.length <= 10 && arr.every((item: any) => typeof item === 'string' && /^https?:\/\//i.test(item));
      }
      return /^https?:\/\//i.test(val);
    } catch {
      return false;
    }
  }, {
    message: 'Image URL must be a valid URL or a JSON array of up to 10 valid URLs'
  }),
  external_link: z.string().url().nullable().optional(),
  link_name: z.string().max(60).nullable().optional(),
});

function sanitize(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

    const body = await req.json();
    const parsed = updatePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { id, title, body: postBody, type, image_url, external_link, link_name } = parsed.data;

    // Verify ownership
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (post.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sanitizedTitle = sanitize(title);
    const sanitizedBody = sanitize(postBody);

    const updatePayload: Record<string, unknown> = {
      title: sanitizedTitle,
      body: sanitizedBody,
      type,
      image_url: image_url || null,
      external_link: external_link || null,
      updated_at: new Date().toISOString(),
    };

    // Only set link_name if explicitly provided
    if (link_name !== undefined) {
      updatePayload.link_name = link_name;
    }

    const { data, error: updateError } = await supabase
      .from('posts')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ post: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
