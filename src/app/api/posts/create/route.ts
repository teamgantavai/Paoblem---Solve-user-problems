// app/api/posts/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
const supabaseAdmin      = createClient(supabaseUrl, supabaseServiceKey);

// ─── Zod schema ───────────────────────────────────────────────────────────────
const pollDataSchema = z.object({
  question        : z.string().min(3).max(500),
  options         : z.array(z.string().min(1).max(100)).min(2).max(10),
  duration        : z.string(),
  expires_at      : z.string().datetime(),
  multiple_choice : z.boolean().optional().default(false),
  allow_vote_changes: z.boolean().optional().default(false),
});

const createPostSchema = z.object({
  title          : z.string().min(3, 'Title must be at least 3 characters').max(300, 'Title too long'),
  body           : z.string().min(1, 'Body is required').max(10000, 'Body too long'),
  type           : z.enum(['problem', 'idea']),
  image_url      : z.string().nullable().optional().refine((val) => {
    if (!val) return true;
    try {
      if (val.startsWith('[') && val.endsWith(']')) {
        const arr = JSON.parse(val);
        return Array.isArray(arr) && arr.length <= 10 &&
          arr.every((item: unknown) => typeof item === 'string' && /^https?:\/\//i.test(item));
      }
      return /^https?:\/\//i.test(val);
    } catch { return false; }
  }, { message: 'image_url must be a valid URL or a JSON array of up to 10 valid URLs' }),
  external_link  : z.string().url().nullable().optional(),
  link_name      : z.string().max(60).nullable().optional(),
  poll_question  : z.string().max(500).nullable().optional(),
  category       : z.string().max(60).nullable().optional(),
  tags           : z.array(z.string().max(30)).max(5).nullable().optional(),
  metadata       : z.any().optional(),
  video_url      : z.string().url().nullable().optional(),
  // NEW: structured poll payload — only present when type is a poll post
  poll_data      : pollDataSchema.nullable().optional(),
});

// ─── Rate limiter (in-memory, resets per worker instance) ─────────────────────
const rateLimitMap  = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX    = 10;

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

// ─── Minimal HTML sanitiser (no external deps needed) ─────────────────────────
function sanitize(text: string): string {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Attempt an insert, gracefully dropping unknown columns on PGRST204 ───────
async function insertWithFallback(
  supabase: any,
  payload: Record<string, unknown>,
): Promise<{ data: Record<string, unknown> | null; error: { message: string; code?: string } | null }> {
  // Columns that may or may not exist in the table yet.
  // We try with all of them, then progressively strip unknown ones.
  const OPTIONAL_COLS = ['metadata', 'poll_question', 'category', 'tags', 'link_name', 'video_url'];

  let { data, error } = await (supabase as any)
    .from('posts')
    .insert(payload)
    .select()
    .single() as { data: Record<string, unknown> | null; error: { message: string; code?: string } | null };

  // PGRST204 = column not found in schema cache. Strip the offending columns one by one.
  if (error && (error.code === 'PGRST204' || /column|schema cache/i.test(error.message || ''))) {
    const fallback = { ...payload };
    for (const col of OPTIONAL_COLS) {
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

// ─── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // 1. Auth
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

    // 2. Rate limit
    if (!checkRateLimit(user.id)) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
    }

    // 3. Parse & validate body
    const raw    = await req.json();
    const parsed = createPostSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 },
      );
    }

    const {
      title, body: postBody, type, image_url, external_link, link_name,
      metadata, video_url, poll_question, category, tags, poll_data,
    } = parsed.data;

    const sanitizedTitle = sanitize(title);
    const sanitizedBody  = sanitize(postBody);

    // 4. Build metadata object (store poll/category/tags there for backwards compat)
    const metadataValue: Record<string, unknown> = {
      ...(typeof metadata === 'object' && metadata !== null ? metadata : {}),
      ...(poll_question                     ? { poll_question }              : {}),
      ...(category                          ? { category }                   : {}),
      ...(tags && tags.length > 0           ? { tags }                       : {}),
      ...(poll_data                         ? { poll_expires_at: poll_data.expires_at, poll_duration: poll_data.duration } : {}),
    };

    const insertPayload: Record<string, unknown> = {
      user_id       : user.id,
      title         : sanitizedTitle,
      body          : sanitizedBody,
      type,
      image_url     : image_url || null,
      external_link : external_link || null,
      metadata      : metadataValue,
      video_url     : video_url || null,
      // Top-level columns (may not exist yet — handled by insertWithFallback)
      poll_question : poll_question || null,
      category      : category     || null,
      tags          : tags && tags.length > 0 ? tags : null,
      link_name     : link_name    || null,
    };

    // 5. Insert post (with graceful fallback for missing columns)
    const { data: post, error: insertError } = await insertWithFallback(supabase, insertPayload);

    if (insertError || !post) {
      console.error('[posts/create] Insert error:', JSON.stringify(insertError));
      return NextResponse.json(
        { error: insertError?.message || 'Failed to create post.' },
        { status: 500 },
      );
    }

    // 6. If this is a poll post, create the poll + options rows
    //    Use the admin client so RLS doesn't block option inserts.
    if (poll_data && post.id) {
      try {
        const { data: pollRow, error: pollErr } = await supabaseAdmin
          .from('polls')
          .insert({
            post_id         : post.id,
            expires_at      : poll_data.expires_at,
            multiple_choice : poll_data.multiple_choice ?? false,
            allow_vote_changes: poll_data.allow_vote_changes ?? false,
          })
          .select()
          .single();

        if (pollErr) {
          console.error('[posts/create] Poll insert error:', JSON.stringify(pollErr));
          // Don't fail the whole request — the post itself was created.
        } else if (pollRow) {
          const optionRows = poll_data.options.map((text, idx) => ({
            poll_id     : pollRow.id,
            option_text : text.trim(),
            position    : idx,
            vote_count  : 0,
          }));

          const { error: optsErr } = await supabaseAdmin
            .from('poll_options')
            .insert(optionRows);

          if (optsErr) {
            console.error('[posts/create] Poll options insert error:', JSON.stringify(optsErr));
          }
        }
      } catch (pollEx) {
        console.error('[posts/create] Unexpected poll error:', pollEx);
      }
    }

    // 7. Notify followers
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
        const typeLabel  = poll_data ? 'poll' : type;

        const notifications = followers.map((f: { follower_id: string }) => ({
          user_id : f.follower_id,
          type    : 'new_post',
          title   : 'New Post',
          body    : `${posterName} just published a new ${typeLabel}.`,
          post_id : post.id,
          read    : false,
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
