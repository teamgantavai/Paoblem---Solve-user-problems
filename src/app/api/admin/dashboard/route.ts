import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 1. Verify admin access
    const admin = await verifyAdmin(req);

    // 2. Fetch basic counts in parallel
    const [
      { count: totalUsers, error: usersErr },
      { count: totalPosts, error: postsErr },
      { count: totalProblems, error: probErr },
      { count: totalIdeas, error: ideaErr },
      { count: totalComments, error: commErr },
      { count: totalVotes, error: voteErr },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('posts').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('posts').select('*', { count: 'exact', head: true }).eq('type', 'problem'),
      supabaseAdmin.from('posts').select('*', { count: 'exact', head: true }).eq('type', 'idea'),
      supabaseAdmin.from('comments').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('votes').select('*', { count: 'exact', head: true }),
    ]);

    if (usersErr) throw usersErr;
    if (postsErr) throw postsErr;

    // 3. Fetch average quality score
    const { data: postsQuality, error: qualityErr } = await supabaseAdmin
      .from('posts')
      .select('quality_score')
      .not('quality_score', 'is', null);
    
    let avgQualityScore = 0;
    if (!qualityErr && postsQuality && postsQuality.length > 0) {
      const sum = postsQuality.reduce((acc, p) => acc + (p.quality_score || 0), 0);
      avgQualityScore = Number((sum / postsQuality.length).toFixed(2));
    }

    // 4. Fetch Active Users Today (last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: activeUsersTodayData } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .gte('last_seen', oneDayAgo);
    const activeUsersToday = activeUsersTodayData?.length || 0;

    // 5. Fetch Pending Reports (Handle missing table case gracefully)
    let pendingReports = 0;
    let migrationsRequired = false;
    try {
      const { count, error: reportsErr } = await supabaseAdmin
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      if (reportsErr && reportsErr.message.includes('relation "public.reports" does not exist')) {
        migrationsRequired = true;
      } else if (!reportsErr && count !== null) {
        pendingReports = count;
      }
    } catch {
      migrationsRequired = true;
    }

    // 6. Fetch Trending Posts
    const { data: trendingPosts } = await supabaseAdmin
      .from('posts')
      .select('id, title, type, quality_score, upvotes, comments_count, created_at, slug')
      .order('quality_score', { ascending: false })
      .limit(5);

    // 7. Calculate growth indicators
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { count: usersThisWeek } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneWeekAgo);

    const { count: usersPrevWeek } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twoWeeksAgo)
      .lt('created_at', oneWeekAgo);

    const growthThisWeek = (usersThisWeek || 0) - (usersPrevWeek || 0);
    const growthPercent = usersPrevWeek
      ? Number(((growthThisWeek / usersPrevWeek) * 100).toFixed(1))
      : usersThisWeek ? 100 : 0;

    // 8. Generate Daily Charts Data (Last 14 days)
    const dailyNewUsers: { date: string; count: number }[] = [];
    const dailyPosts: { date: string; count: number }[] = [];
    const dailyEngagement: { date: string; views: number; interactions: number }[] = [];

    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      dailyNewUsers.push({ date: dateStr, count: 0 });
      dailyPosts.push({ date: dateStr, count: 0 });
      dailyEngagement.push({ date: dateStr, views: 0, interactions: 0 });
    }

    // Fetch new profiles for last 14 days and group
    const { data: recentProfiles } = await supabaseAdmin
      .from('profiles')
      .select('created_at')
      .gte('created_at', dailyNewUsers[0].date);

    recentProfiles?.forEach(p => {
      const dateStr = p.created_at.split('T')[0];
      const match = dailyNewUsers.find(item => item.date === dateStr);
      if (match) match.count++;
    });

    // Fetch new posts for last 14 days and group
    const { data: recentPosts } = await supabaseAdmin
      .from('posts')
      .select('created_at, views_count, upvotes, comments_count')
      .gte('created_at', dailyPosts[0].date);

    recentPosts?.forEach(p => {
      const dateStr = p.created_at.split('T')[0];
      const match = dailyPosts.find(item => item.date === dateStr);
      if (match) match.count++;

      // Also add to engagement counts
      const engMatch = dailyEngagement.find(item => item.date === dateStr);
      if (engMatch) {
        engMatch.views += p.views_count || 0;
        engMatch.interactions += (p.upvotes || 0) + (p.comments_count || 0);
      }
    });

    // 9. Categories Breakdown
    const { data: allPosts } = await supabaseAdmin
      .from('posts')
      .select('category');
    
    const categoriesMap: Record<string, number> = {};
    allPosts?.forEach(p => {
      const cat = p.category || 'Uncategorized';
      categoriesMap[cat] = (categoriesMap[cat] || 0) + 1;
    });

    const topCategories = Object.entries(categoriesMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      cards: {
        totalUsers: totalUsers || 0,
        totalPosts: totalPosts || 0,
        problems: totalProblems || 0,
        ideas: totalIdeas || 0,
        totalComments: totalComments || 0,
        totalVotes: totalVotes || 0,
        avgQualityScore,
        activeUsersToday,
        pendingReports,
        growthThisWeek: {
          count: growthThisWeek,
          percentage: growthPercent,
        },
      },
      charts: {
        dailyNewUsers,
        dailyPosts,
        dailyEngagement,
        topCategories,
      },
      trendingPosts: trendingPosts || [],
      migrationsRequired,
    });
  } catch (err: any) {
    console.error('[Admin Dashboard API] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
