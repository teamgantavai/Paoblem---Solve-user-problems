import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const createPostSchema = z.object({
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
  metadata: z.any().optional(),
  video_url: z.string().url().nullable().optional(),
});

// Simple in-memory rate limiter
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

    // Create a client with the user's JWT to verify identity via RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('[posts/create] Auth error:', authError);
      return NextResponse.json({ error: 'Invalid or expired session. Please sign in again.' }, { status: 401 });
    }

    if (!checkRateLimit(user.id)) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
    }

    const body = await req.json();

    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { title, body: postBody, type, image_url, external_link, link_name, metadata, video_url } = parsed.data;

    const sanitizedTitle = sanitize(title);
    const sanitizedBody = sanitize(postBody);

    const insertData: Record<string, unknown> = {
      user_id: user.id,
      title: sanitizedTitle,
      body: sanitizedBody,
      type,
      image_url: image_url || null,
      external_link: external_link || null,
      metadata: metadata || {},
      video_url: video_url || null,
    };

    // Add link_name if provided (requires the column to exist in DB)
    if (link_name) {
      insertData.link_name = link_name;
    }

    const { data, error } = await supabase
      .from('posts')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[posts/create] Insert error:', JSON.stringify(error));
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ post: data }, { status: 201 });
  } catch (err) {
    console.error('[posts/create] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
