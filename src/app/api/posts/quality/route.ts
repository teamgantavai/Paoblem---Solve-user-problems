import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Whitelist of counter columns that can be incremented via this API
const VALID_COUNTERS = [
  'unique_viewers',
  'long_reads',
  'see_more_clicks',
  'saves',
  'shares',
  'profile_clicks',
  'link_clicks',
  'reports',
  'hidden_count',
] as const;

type CounterColumn = (typeof VALID_COUNTERS)[number];

const incrementSchema = z.object({
  post_id: z.string().uuid(),
  counter: z.enum(VALID_COUNTERS).optional(),
  delta: z.number().int().default(1),
  recalculate_only: z.boolean().default(false),
});

/**
 * POST /api/posts/quality
 *
 * Increments a behavioral counter and recalculates the quality score.
 * Returns the new quality_score and unique_viewers so the client can
 * update the badge instantly without re-fetching the full post.
 *
 * Body: { post_id, counter?, delta?, recalculate_only? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = incrementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { post_id, counter, delta, recalculate_only } = parsed.data;

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // If a counter was specified (and not recalculate_only), increment it first
    if (counter && !recalculate_only && delta !== 0) {
      // Use the DB helper function which also guards against invalid column names
      const { error: incrError } = await admin.rpc('increment_quality_counter', {
        p_post_id: post_id,
        p_column: counter,
        p_delta: delta,
      });

      if (incrError) {
        console.error('[quality] increment_quality_counter error:', incrError.message);
        // Fall through — still try to recalculate
      }
    } else {
      // Just recalculate without incrementing
      const { error: calcError } = await admin.rpc('recalculate_quality_score', {
        p_post_id: post_id,
      });

      if (calcError) {
        console.error('[quality] recalculate_quality_score error:', calcError.message);
      }
    }

    // Fetch the freshly updated score to return to the client
    const { data: post, error: fetchError } = await admin
      .from('posts')
      .select('quality_score, unique_viewers, confidence_score, engagement_score')
      .eq('id', post_id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({
      quality_score: post?.quality_score ?? null,
      unique_viewers: post?.unique_viewers ?? 0,
      confidence_score: post?.confidence_score ?? null,
      engagement_score: post?.engagement_score ?? null,
    });
  } catch (err) {
    console.error('[quality] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/posts/quality?post_id=...
 *
 * Returns the current quality score for a post (lightweight read).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const post_id = searchParams.get('post_id');

    if (!post_id) {
      return NextResponse.json({ error: 'post_id is required' }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await admin
      .from('posts')
      .select('quality_score, unique_viewers, confidence_score, engagement_score')
      .eq('id', post_id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      quality_score: data?.quality_score ?? null,
      unique_viewers: data?.unique_viewers ?? 0,
      confidence_score: data?.confidence_score ?? null,
      engagement_score: data?.engagement_score ?? null,
    });
  } catch (err) {
    console.error('[quality] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
