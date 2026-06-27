import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Award checking logic ─────────────────────────────────────────────────────
async function getUserStats(userId: string) {
  const [
    postsRes,
    commentsRes,
    solutionsRes,
  ] = await Promise.all([
    supabaseAdmin.from('posts').select('type, upvotes, views_count').eq('user_id', userId),
    supabaseAdmin.from('comments').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabaseAdmin.from('solutions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  const posts = postsRes.data || [];
  const commentCount = commentsRes.count || 0;
  const solutionCount = solutionsRes.count || 0;

  let problemCount = 0;
  let ideaCount = 0;
  let startupCount = 0;
  let totalUpvotes = 0;
  let totalViews = 0;

  posts.forEach((p) => {
    if (p.type === 'problem') problemCount++;
    else if (p.type === 'idea') ideaCount++;
    else if (p.type === 'startup') startupCount++;
    totalUpvotes += p.upvotes || 0;
    totalViews += p.views_count || 0;
  });

  return {
    postCount: posts.length,
    problemCount,
    ideaCount,
    startupCount,
    commentCount,
    solutionCount,
    totalUpvotes,
    totalViews,
  };
}

type UserStats = {
  postCount: number;
  problemCount: number;
  ideaCount: number;
  startupCount: number;
  commentCount: number;
  solutionCount: number;
  totalUpvotes: number;
  totalViews: number;
};

function checkCondition(condition: any, stats: UserStats, badgeSlug?: string): boolean {
  const { type, threshold, post_type } = condition;

  switch (type) {
    case 'post_count':
      // Creator post milestones were renamed from problem to posts
      const isCreatorPostBadge = badgeSlug && [
        'first-problem',
        'problem-pioneer',
        'problem-architect',
        'problem-master',
        'problem-legend',
        'problem-deity'
      ].includes(badgeSlug);

      if (isCreatorPostBadge) {
        return stats.postCount >= threshold;
      }

      if (post_type === 'problem') return stats.problemCount >= threshold;
      if (post_type === 'idea') return stats.ideaCount >= threshold;
      if (post_type === 'startup') return stats.startupCount >= threshold;
      return stats.postCount >= threshold;
    case 'comment_count':
      return stats.commentCount >= threshold;
    case 'solution_count':
      return stats.solutionCount >= threshold;
    case 'upvotes_received':
      return stats.totalUpvotes >= threshold;
    case 'views_count':
      return stats.totalViews >= threshold;
    case 'special':
      // Special badges are manually awarded — skip auto-check
      return false;
    case 'streak_days':
      // Streak logic would require additional tracking — skip for now
      return false;
    default:
      return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = user.id;

    // Get all badge definitions (active, non-special)
    const { data: allBadges, error: badgeError } = await supabaseAdmin
      .from('badge_definitions')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (badgeError) throw badgeError;

    // Get already-earned badges
    const { data: earnedBadges, error: earnedError } = await supabaseAdmin
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId);

    if (earnedError) throw earnedError;

    const earnedIds = new Set((earnedBadges || []).map((b: any) => b.badge_id));

    // Get user stats
    const stats = await getUserStats(userId);

    // Find newly eligible badges
    const newlyEligible = (allBadges || []).filter((badge: any) => {
      if (earnedIds.has(badge.id)) return false;
      const condition = badge.unlock_condition;
      if (!condition || condition.type === 'special') return false;
      return checkCondition(condition, stats, badge.slug);
    });

    if (newlyEligible.length === 0) {
      return NextResponse.json({ newBadges: [] });
    }

    // Award the new badges
    const insertRows = newlyEligible.map((badge: any) => ({
      user_id: userId,
      badge_id: badge.id,
      earned_at: new Date().toISOString(),
      is_featured: false,
      notified: false,
    }));

    const { error: insertError } = await supabaseAdmin
      .from('user_badges')
      .upsert(insertRows, { onConflict: 'user_id,badge_id', ignoreDuplicates: true });

    if (insertError) throw insertError;

    // Return the awarded badges in a friendly format
    const newBadges = newlyEligible.map((badge: any) => ({
      slug: badge.slug,
      name: badge.name,
      description: badge.description,
      category: badge.category,
      rarity: badge.rarity,
      rep_reward: badge.rep_reward,
    }));

    return NextResponse.json({ newBadges });
  } catch (err: any) {
    console.error('[Badge Check Error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
