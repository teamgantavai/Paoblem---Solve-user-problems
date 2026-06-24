import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const createPostSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(300, 'Title too long'),
  body: z.string().min(1, 'Body is required').max(10000, 'Body too long'),
  type: z.enum(['problem', 'idea']),
  image_url: z.string().nullable().optional().refine((val) => {
    if (!val) return true;
    try {
      if (val.startsWith('[') && val.endsWith(']')) {
        const arr = JSON.parse(val);
        return Array.isArray(arr) && arr.length <= 10
          && arr.every((item: unknown) => typeof item === 'string' && /^https?:\/\//i.test(item));
      }
      return /^https?:\/\//i.test(val);
    } catch {
      return false;
    }
  }, { message: 'image_url must be a valid URL or a JSON array of up to 10 valid URLs' }),
  external_link: z.string().url().nullable().optional(),
  link_name: z.string().max(60).nullable().optional(),
  category: z.string().max(60).nullable().optional(),
  tags: z.array(z.string().max(30)).max(5).nullable().optional(),
  metadata: z.any().optional(),
  video_url: z.string().url().nullable().optional(),
});

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 10;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

function sanitize(text: string): string {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function insertWithFallback(
  supabase: any,
  payload: Record<string, unknown>,
): Promise<{ data: Record<string, unknown> | null; error: { message: string; code?: string } | null }> {
  const optionalColumns = ['metadata', 'category', 'tags', 'link_name', 'video_url'];

  let { data, error } = await (supabase as any)
    .from('posts')
    .insert(payload)
    .select()
    .single() as { data: Record<string, unknown> | null; error: { message: string; code?: string } | null };

  if (error && (error.code === 'PGRST204' || /column|schema cache/i.test(error.message || ''))) {
    const fallback = { ...payload };
    for (const col of optionalColumns) {
      delete fallback[col];
    }
    ({ data, error } = await (supabase as any)
      .from('posts')
      .insert(fallback)
      .select()
      .single());
  }

  return { data, error };
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '').trim();

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired session. Please sign in again.' },
        { status: 401 },
      );
    }

    if (!checkRateLimit(user.id)) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
    }

    const raw = await req.json();
    const parsed = createPostSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 },
      );
    }

    const {
      title,
      body: postBody,
      type,
      image_url,
      external_link,
      link_name,
      metadata,
      video_url,
      category,
      tags,
    } = parsed.data;

    const metadataValue: Record<string, unknown> = {
      ...(typeof metadata === 'object' && metadata !== null ? metadata : {}),
      ...(category ? { category } : {}),
      ...(tags && tags.length > 0 ? { tags } : {}),
    };

    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      title: sanitize(title),
      body: sanitize(postBody),
      type,
      image_url: image_url || null,
      external_link: external_link || null,
      metadata: metadataValue,
      video_url: video_url || null,
      category: category || null,
      tags: tags && tags.length > 0 ? tags : null,
      link_name: link_name || null,
    };

    const { data: post, error: insertError } = await insertWithFallback(supabase, insertPayload);
    if (insertError || !post) {
      console.error('[posts/create] Insert error:', JSON.stringify(insertError));
      return NextResponse.json(
        { error: insertError?.message || 'Failed to create post.' },
        { status: 500 },
      );
    }

    try {
      const { data: followers } = await supabaseAdmin
        .from('follows')
        .select('follower_id')
        .eq('following_id', user.id);

      if (followers && followers.length > 0) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();

        const posterName = profile?.username ? `@${profile.username}` : 'Someone you follow';
        const notifications = followers.map((f: { follower_id: string }) => ({
          user_id: f.follower_id,
          type: 'new_post',
          title: 'New Post',
          body: `${posterName} just published a new ${type}.`,
          post_id: post.id,
          read: false,
        }));

        await supabaseAdmin.from('notifications').insert(notifications);
      }
    } catch (notifErr) {
      console.error('[posts/create] Notification error:', notifErr);
    }

    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    console.error('[posts/create] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
