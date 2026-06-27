import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUserStats(userId: string) {
  const [
    { count: postCount },
    { count: problemCount },
    { count: ideaCount },
    { count: startupCount },
    { count: commentCount },
    { count: solutionCount },
    postsData,
  ] = await Promise.all([
    supabaseAdmin.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabaseAdmin.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('type', 'problem'),
    supabaseAdmin.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('type', 'idea'),
    supabaseAdmin.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('type', 'startup'),
    supabaseAdmin.from('comments').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabaseAdmin.from('solutions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabaseAdmin.from('posts').select('upvotes, views_count, created_at').eq('user_id', userId),
  ]);

  const totalUpvotes = postsData.data?.reduce((sum, p) => sum + (p.upvotes || 0), 0) || 0;
  const totalViews = postsData.data?.reduce((sum, p) => sum + (p.views_count || 0), 0) || 0;

  // Calculate posting streak
  let streak = 0;
  if (postsData.data && postsData.data.length > 0) {
    const sortedPosts = [...postsData.data].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const uniqueDates = Array.from(
      new Set(
        sortedPosts.map(p => {
          const d = new Date(p.created_at);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })
      )
    );

    if (uniqueDates.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      if (uniqueDates[0] === todayStr || uniqueDates[0] === yesterdayStr) {
        streak = 1;
        let prevDate = new Date(uniqueDates[0]);

        for (let i = 1; i < uniqueDates.length; i++) {
          const currentDate = new Date(uniqueDates[i]);
          const diffTime = Math.abs(prevDate.getTime() - currentDate.getTime());
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            streak++;
            prevDate = currentDate;
          } else if (diffDays > 1) {
            break;
          }
        }
      }
    }
  }

  return {
    postCount: postCount || 0,
    problemCount: problemCount || 0,
    ideaCount: ideaCount || 0,
    startupCount: startupCount || 0,
    commentCount: commentCount || 0,
    solutionCount: solutionCount || 0,
    totalUpvotes,
    totalViews,
    streakDays: streak,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    const [badgesData, stats] = await Promise.all([
      supabaseAdmin
        .from('user_badges')
        .select(`
          id,
          user_id,
          badge_id,
          earned_at,
          is_featured,
          notified,
          badge_definitions (
            id,
            slug,
            name,
            description,
            hint_text,
            category,
            rarity,
            rep_reward,
            is_hidden,
            sort_order
          )
        `)
        .eq('user_id', userId)
        .order('earned_at', { ascending: false }),
      getUserStats(userId),
    ]);

    if (badgesData.error) throw badgesData.error;

    return NextResponse.json({ badges: badgesData.data, stats });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { badgeId, is_featured } = await req.json();

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user || user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('user_badges')
      .update({ is_featured })
      .eq('user_id', userId)
      .eq('badge_id', badgeId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ badge: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
