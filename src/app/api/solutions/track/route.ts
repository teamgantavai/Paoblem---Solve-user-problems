import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { updateUserInterestsForContent } from '@/lib/recommendations';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const trackSchema = z.object({
  solution_id: z.string().uuid(),
  event_type: z.enum(['SOLUTION_VIEW', 'SOLUTION_UPVOTE', 'SOLUTION_SAVE']),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = trackSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    let userId: string | null = null;

    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const { data: solution } = await supabase
      .from('solutions')
      .select('*, problem:problem_id(id, title, body, type)')
      .eq('id', parsed.data.solution_id)
      .maybeSingle();

    if (!solution) return NextResponse.json({ error: 'Solution not found' }, { status: 404 });

    const { error } = await supabase.from('solution_events').insert({
      solution_id: parsed.data.solution_id,
      problem_id: solution.problem_id,
      user_id: userId,
      event_type: parsed.data.event_type,
      metadata: parsed.data.metadata || {},
    });

    if (error && !(error.code === '42P01' || error.message.includes('does not exist'))) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await updateUserInterestsForContent(supabase, userId, solution.problem || solution, parsed.data.event_type);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error('[solutions/track] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
