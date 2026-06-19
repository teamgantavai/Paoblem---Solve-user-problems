import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const voteSchema = z.object({
  solution_id: z.string().uuid(),
  vote_type: z.enum(['up', 'down']),
});

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const parsed = voteSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    const { solution_id, vote_type } = parsed.data;
    const { data: existing } = await supabase
      .from('solution_votes')
      .select('*')
      .eq('user_id', user.id)
      .eq('solution_id', solution_id)
      .maybeSingle();

    if (existing) {
      if (existing.vote_type === vote_type) {
        await supabase.from('solution_votes').delete().eq('id', existing.id);
        return NextResponse.json({ action: 'removed' });
      }
      await supabase.from('solution_votes').update({ vote_type }).eq('id', existing.id);
      return NextResponse.json({ action: 'updated', vote_type });
    }

    const { error } = await supabase.from('solution_votes').insert({
      user_id: user.id,
      solution_id,
      vote_type,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ action: 'created', vote_type }, { status: 201 });
  } catch (err) {
    console.error('[solutions/vote] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
