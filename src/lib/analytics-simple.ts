import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AnalyticsGridResponse,
  PostAnalyticsDetailResponse,
  PostGridItem,
  PostVoter,
  UserDemographics,
} from './types';

function sumDailyByPost(rows: { post_id: string; views: number; upvotes: number; downvotes: number; comments: number; follows_gained: number; unique_views: number }[]) {
  const map = new Map<string, { views: number; votes: number; comments: number; followsGained: number; impressions: number }>();
  for (const r of rows) {
    const cur = map.get(r.post_id) ?? { views: 0, votes: 0, comments: 0, followsGained: 0, impressions: 0 };
    cur.views += r.views;
    cur.votes += r.upvotes + r.downvotes;
    cur.comments += r.comments;
    cur.followsGained += r.follows_gained;
    cur.impressions += r.unique_views || r.views;
    map.set(r.post_id, cur);
  }
  return map;
}

function aggregateDemographics(events: { metadata: Record<string, unknown> | null }[]): UserDemographics {
  const devices = new Map<string, number>();
  const browsers = new Map<string, number>();
  const countries = new Map<string, number>();

  for (const ev of events) {
    const m = ev.metadata ?? {};
    const device = String(m.device || 'Unknown');
    const browser = String(m.browser || 'Unknown');
    const country = String(m.country || (m.referrer === 'direct' ? 'Direct' : 'Unknown'));

    devices.set(device, (devices.get(device) ?? 0) + 1);
    browsers.set(browser, (browsers.get(browser) ?? 0) + 1);
    countries.set(country, (countries.get(country) ?? 0) + 1);
  }

  const toList = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

  return {
    devices: toList(devices),
    browsers: toList(browsers),
    countries: toList(countries),
  };
}

export async function fetchAnalyticsGrid(
  supabase: SupabaseClient,
  userId: string
): Promise<AnalyticsGridResponse> {
  const { data: posts } = await supabase
    .from('posts')
    .select('id, title, slug, type, image_url, upvotes, downvotes, comments_count, views_count, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const { data: solutions } = await supabase
    .from('solutions')
    .select('id, title, problem_id, image_url, upvotes, downvotes, comments_count, created_at, problem:problem_id(slug)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!posts?.length && !solutions?.length) {
    return {
      totals: { views: 0, votes: 0, comments: 0, followsGained: 0 },
      posts: [],
      isDemo: false,
    };
  }

  const postIds = (posts || []).map(p => p.id);
  let analyticsMap = new Map<string, { views: number; votes: number; comments: number; followsGained: number; impressions: number }>();

  if (postIds.length > 0) {
    const { data: dailyRows } = await supabase
      .from('post_analytics_daily')
      .select('post_id, views, unique_views, upvotes, downvotes, comments, follows_gained')
      .in('post_id', postIds);

    if (dailyRows?.length) {
      analyticsMap = sumDailyByPost(dailyRows);
    }
  }

  const gridPosts: PostGridItem[] = (posts || []).map(p => {
    const analytics = analyticsMap.get(p.id);
    const views = analytics?.views ?? p.views_count ?? 0;
    const votes = analytics?.votes ?? (p.upvotes + p.downvotes);
    const comments = analytics?.comments ?? p.comments_count ?? 0;
    const followsGained = analytics?.followsGained ?? 0;

    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      type: p.type,
      image_url: p.image_url,
      created_at: p.created_at,
      views,
      votes,
      upvotes: analytics ? undefined : p.upvotes,
      downvotes: analytics ? undefined : p.downvotes,
      comments,
      followsGained,
    };
  });

  const solutionIds = (solutions || []).map(s => s.id);
  let solutionViewsMap = new Map<string, number>();

  if (solutionIds.length > 0) {
    const { data: solViews } = await supabase
      .from('solution_events')
      .select('solution_id')
      .in('solution_id', solutionIds)
      .eq('event_type', 'SOLUTION_VIEW');

    if (solViews) {
      for (const sv of solViews) {
        solutionViewsMap.set(sv.solution_id, (solutionViewsMap.get(sv.solution_id) ?? 0) + 1);
      }
    }
  }

  const gridSolutions: PostGridItem[] = (solutions || []).map(s => {
    const views = solutionViewsMap.get(s.id) ?? 0;
    const votes = s.upvotes + s.downvotes;

    return {
      id: s.id,
      title: s.title,
      slug: (Array.isArray(s.problem) ? s.problem[0]?.slug : (s.problem as any)?.slug) || s.problem_id,
      type: 'solution' as any,
      image_url: s.image_url,
      created_at: s.created_at,
      views,
      votes,
      upvotes: s.upvotes,
      downvotes: s.downvotes,
      comments: s.comments_count,
      followsGained: 0,
    };
  });

  const allGridItems = [...gridPosts, ...gridSolutions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const totals = allGridItems.reduce(
    (acc, p) => ({
      views: acc.views + p.views,
      votes: acc.votes + p.votes,
      comments: acc.comments + p.comments,
      followsGained: acc.followsGained + p.followsGained,
    }),
    { views: 0, votes: 0, comments: 0, followsGained: 0 }
  );

  return { totals, posts: allGridItems, isDemo: false };
}

export async function fetchPostAnalyticsDetail(
  supabase: SupabaseClient,
  postId: string,
  userId: string
): Promise<PostAnalyticsDetailResponse | null> {
  const { data: post } = await supabase
    .from('posts')
    .select('id, title, slug, body, type, image_url, upvotes, downvotes, comments_count, views_count, created_at, user_id')
    .eq('id', postId)
    .maybeSingle();

  if (!post || post.user_id !== userId) {
    // If not found in posts, try solutions
    const { data: solution } = await supabase
      .from('solutions')
      .select('id, title, body, image_url, upvotes, downvotes, comments_count, created_at, user_id, problem_id, problem:problem_id(slug)')
      .eq('id', postId)
      .maybeSingle();

    if (!solution || solution.user_id !== userId) return null;

    const { data: events } = await supabase
      .from('solution_events')
      .select('event_type, metadata, user_id')
      .eq('solution_id', postId);

    const views = (events || []).filter(e => e.event_type === 'SOLUTION_VIEW').length;
    const uniqueViewers = new Set(
      (events || [])
        .filter(e => e.event_type === 'SOLUTION_VIEW')
        .map(e => e.user_id || String(e.metadata?.ip_address || Math.random()))
    );
    const uniqueViews = uniqueViewers.size;

    const viewEvents = (events || []).filter(e => e.event_type === 'SOLUTION_VIEW');
    const demographics = viewEvents.length
      ? aggregateDemographics(viewEvents as { metadata: Record<string, unknown> | null }[])
      : {
          devices: [{ name: 'Mobile', count: 0 }, { name: 'Desktop', count: 0 }],
          browsers: [{ name: 'Chrome', count: 0 }],
          countries: [{ name: 'Unknown', count: 0 }],
        };

    const { data: sVotes } = await supabase
      .from('solution_votes')
      .select('user_id, vote_type, created_at')
      .eq('solution_id', postId)
      .order('created_at', { ascending: false })
      .limit(50);

    let voters: PostVoter[] = [];
    if (sVotes && sVotes.length > 0) {
      const userIds = sVotes.map(v => v.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, username')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? []);

      voters = sVotes.map(v => {
        const p = profileMap.get(v.user_id);
        return {
          user_id: v.user_id,
          vote_type: v.vote_type as 'up' | 'down',
          created_at: v.created_at,
          full_name: p?.full_name ?? 'Anonymous',
          avatar_url: p?.avatar_url ?? null,
          username: p?.username ?? null,
        };
      });
    }

    return {
      post: {
        id: solution.id,
        title: solution.title,
        slug: (Array.isArray(solution.problem) ? solution.problem[0]?.slug : (solution.problem as any)?.slug) || solution.problem_id,
        body: solution.body,
        type: 'solution' as any,
        image_url: solution.image_url,
        created_at: solution.created_at,
      },
      stats: {
        views,
        impressions: uniqueViews || views,
        upvotes: solution.upvotes,
        downvotes: solution.downvotes,
        comments: solution.comments_count,
        followsGained: 0,
      },
      voters,
      demographics,
      isDemo: false,
    };
  }

  const { data: dailyRows } = await supabase
    .from('post_analytics_daily')
    .select('views, unique_views, upvotes, downvotes, comments, follows_gained, opens')
    .eq('post_id', postId);

  let views = post.views_count ?? 0;
  let impressions = post.views_count ?? 0;
  let upvotes = post.upvotes ?? 0;
  let downvotes = post.downvotes ?? 0;
  let comments = post.comments_count ?? 0;
  let followsGained = 0;

  if (dailyRows?.length) {
    views = dailyRows.reduce((s, r) => s + r.views, 0);
    impressions = dailyRows.reduce((s, r) => s + (r.unique_views || r.views), 0);
    upvotes = dailyRows.reduce((s, r) => s + r.upvotes, 0) || upvotes;
    downvotes = dailyRows.reduce((s, r) => s + r.downvotes, 0) || downvotes;
    comments = dailyRows.reduce((s, r) => s + r.comments, 0) || comments;
    followsGained = dailyRows.reduce((s, r) => s + r.follows_gained, 0);
  }

  const { data: votes } = await supabase
    .from('votes')
    .select('user_id, vote_type, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: false })
    .limit(50);

  let voters: PostVoter[] = [];
  if (votes && votes.length > 0) {
    const userIds = votes.map(v => v.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, username')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? []);

    voters = votes.map((v: any) => {
      const p = profileMap.get(v.user_id);
      return {
        user_id: v.user_id,
        vote_type: v.vote_type,
        created_at: v.created_at,
        full_name: p?.full_name ?? 'Anonymous',
        avatar_url: p?.avatar_url ?? null,
        username: p?.username ?? null,
      };
    });
  }

  const { data: events } = await supabase
    .from('post_events')
    .select('metadata')
    .eq('post_id', postId)
    .eq('event_type', 'POST_VIEW')
    .limit(500);

  const demographics = events?.length
    ? aggregateDemographics(events as { metadata: Record<string, unknown> | null }[])
    : {
        devices: [{ name: 'Mobile', count: 0 }, { name: 'Desktop', count: 0 }],
        browsers: [{ name: 'Chrome', count: 0 }],
        countries: [{ name: 'Unknown', count: 0 }],
      };

  return {
    post: {
      id: post.id,
      title: post.title,
      slug: post.slug,
      body: post.body,
      type: post.type,
      image_url: post.image_url,
      created_at: post.created_at,
    },
    stats: {
      views,
      impressions,
      upvotes,
      downvotes,
      comments,
      followsGained,
    },
    voters,
    demographics,
    isDemo: false,
  };
}
