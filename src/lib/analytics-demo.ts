import type {
  AIInsight,
  AnalyticsMetric,
  AnalyticsOverview,
  AnalyticsOverviewResponse,
  AnalyticsPostResponse,
  AnalyticsTimeSeries,
  AudienceInsight,
  EngagementBreakdown,
  FunnelStage,
  PostComparisonRow,
  TopPerformingPost,
  TrafficSource,
} from './types';

export type DateRange = '24h' | '7d' | '30d' | '90d' | 'custom';

export function getRangeDays(range: DateRange): number {
  switch (range) {
    case '24h': return 1;
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    default: return 30;
  }
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) + 1;
}

function makeMetric(base: number, variance: number, points: number, rand: () => number): AnalyticsMetric {
  const sparkline = Array.from({ length: points }, (_, i) =>
    Math.round(base * (0.7 + rand() * 0.6) * (1 + i * 0.02))
  );
  const value = sparkline[sparkline.length - 1] ?? base;
  const prev = sparkline[sparkline.length - 2] ?? base * 0.9;
  const delta = prev === 0 ? 0 : Math.round(((value - prev) / prev) * 1000) / 10;
  return { value, delta, sparkline };
}

function generateTimeSeries(days: number, seed: string): AnalyticsTimeSeries[] {
  const rand = seededRandom(hashSeed(seed));
  const series: AnalyticsTimeSeries[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const views = Math.round(80 + rand() * 400 + (days - i) * 12);
    series.push({
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      date: d.toISOString().slice(0, 10),
      views,
      uniqueViews: Math.round(views * (0.55 + rand() * 0.25)),
      upvotes: Math.round(views * (0.04 + rand() * 0.03)),
      comments: Math.round(views * (0.02 + rand() * 0.02)),
      shares: Math.round(views * (0.01 + rand() * 0.015)),
      saves: Math.round(views * (0.008 + rand() * 0.012)),
    });
  }
  return series;
}

function generateHeatmap(seed: string): number[][] {
  const rand = seededRandom(hashSeed(seed + '-heatmap'));
  return Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => {
      const isWeekend = day >= 5;
      const isPeak = hour >= 9 && hour <= 21;
      const base = isPeak ? 0.6 : 0.15;
      const weekendBoost = isWeekend && hour >= 10 && hour <= 22 ? 0.25 : 0;
      return Math.round((base + weekendBoost + rand() * 0.35) * 100);
    })
  );
}

function generateOverview(days: number, seed: string): AnalyticsOverview {
  const rand = seededRandom(hashSeed(seed + '-overview'));
  const points = Math.min(days, 14);
  const views = makeMetric(4200 + rand() * 2000, 0.3, points, rand);
  const unique = makeMetric(Math.round(views.value * 0.62), 0.25, points, rand);
  const upvotes = makeMetric(Math.round(views.value * 0.06), 0.2, points, rand);
  const downvotes = makeMetric(Math.round(views.value * 0.008), 0.15, points, rand);
  const comments = makeMetric(Math.round(views.value * 0.035), 0.22, points, rand);
  const shares = makeMetric(Math.round(views.value * 0.018), 0.18, points, rand);
  const saves = makeMetric(Math.round(views.value * 0.012), 0.16, points, rand);
  const followers = makeMetric(Math.round(12 + rand() * 30), 0.3, points, rand);
  const engagement = makeMetric(
    Math.round(((upvotes.value + comments.value + shares.value + saves.value) / views.value) * 1000) / 10,
    0.1,
    points,
    rand
  );
  const ranking = makeMetric(Math.round(65 + rand() * 30), 0.12, points, rand);

  return {
    totalViews: views,
    uniqueViews: unique,
    upvotes,
    downvotes,
    comments,
    shares,
    saves,
    followersGained: followers,
    engagementRate: engagement,
    rankingScore: ranking,
    isDemo: true,
  };
}

function generateTrafficSources(seed: string): TrafficSource[] {
  const rand = seededRandom(hashSeed(seed + '-traffic'));
  const raw = [
    { source: 'Direct', weight: 0.32 + rand() * 0.08 },
    { source: 'Search', weight: 0.22 + rand() * 0.06 },
    { source: 'Social', weight: 0.18 + rand() * 0.05 },
    { source: 'Referral', weight: 0.12 + rand() * 0.04 },
    { source: 'Internal', weight: 0.1 + rand() * 0.03 },
  ];
  const total = raw.reduce((s, r) => s + r.weight, 0);
  return raw.map(r => ({
    source: r.source,
    count: Math.round(r.weight * 1000),
    percentage: Math.round((r.weight / total) * 1000) / 10,
  }));
}

function generateAudience(seed: string): AudienceInsight {
  const rand = seededRandom(hashSeed(seed + '-audience'));
  return {
    countries: [
      { name: 'United States', count: Math.round(800 + rand() * 200) },
      { name: 'United Kingdom', count: Math.round(320 + rand() * 80) },
      { name: 'India', count: Math.round(280 + rand() * 100) },
      { name: 'Germany', count: Math.round(180 + rand() * 60) },
      { name: 'Canada', count: Math.round(150 + rand() * 50) },
    ],
    cities: [
      { name: 'San Francisco', count: Math.round(120 + rand() * 40) },
      { name: 'London', count: Math.round(95 + rand() * 30) },
      { name: 'New York', count: Math.round(88 + rand() * 25) },
      { name: 'Berlin', count: Math.round(72 + rand() * 20) },
      { name: 'Toronto', count: Math.round(65 + rand() * 18) },
    ],
    devices: [
      { name: 'Mobile', count: 58, percentage: 58 },
      { name: 'Desktop', count: 35, percentage: 35 },
      { name: 'Tablet', count: 7, percentage: 7 },
    ],
    browsers: [
      { name: 'Chrome', count: Math.round(520 + rand() * 100) },
      { name: 'Safari', count: Math.round(280 + rand() * 60) },
      { name: 'Firefox', count: Math.round(90 + rand() * 30) },
      { name: 'Edge', count: Math.round(70 + rand() * 25) },
    ],
    visitorTypes: [
      { name: 'Returning', count: 42, percentage: 42 },
      { name: 'New', count: 58, percentage: 58 },
    ],
  };
}

function generateFunnel(overview: AnalyticsOverview): FunnelStage[] {
  const views = overview.totalViews.value;
  const opened = Math.round(views * 0.72);
  const read = Math.round(opened * 0.58);
  const upvoted = overview.upvotes.value;
  const commented = overview.comments.value;
  const shared = overview.shares.value;

  const stages = [
    { stage: 'Views', count: views },
    { stage: 'Opened', count: opened },
    { stage: 'Read', count: read },
    { stage: 'Upvoted', count: upvoted },
    { stage: 'Commented', count: commented },
    { stage: 'Shared', count: shared },
  ];

  return stages.map((s, i) => ({
    stage: s.stage,
    count: s.count,
    percentage: views === 0 ? 0 : Math.round((s.count / views) * 1000) / 10,
    conversionFromPrevious:
      i === 0 ? null : Math.round((s.count / stages[i - 1].count) * 1000) / 10,
  }));
}

function generateEngagement(overview: AnalyticsOverview): EngagementBreakdown {
  const views = overview.totalViews.value || 1;
  return {
    upvoteRate: Math.round((overview.upvotes.value / views) * 1000) / 10,
    commentRate: Math.round((overview.comments.value / views) * 1000) / 10,
    shareRate: Math.round((overview.shares.value / views) * 1000) / 10,
    saveRate: Math.round((overview.saves.value / views) * 1000) / 10,
    avgReadTimeSeconds: 142,
    scrollDepthPercent: 68,
  };
}

function generateAIInsights(seed: string, overview: AnalyticsOverview): AIInsight {
  const rand = seededRandom(hashSeed(seed + '-ai'));
  const baseViews = overview.totalViews.value / 7;
  return {
    bestTimeToPost: 'Tuesday & Thursday, 10:00–12:00 AM (your audience peak)',
    performanceReason:
      'Strong engagement rate driven by problem-type posts with clear titles. Mobile traffic converts 1.4× better on weekday mornings.',
    suggestions: [
      'Add a compelling hook in the first 2 lines to improve read-through rate.',
      'Cross-post during peak hours (Tue/Thu 10 AM) for +18% estimated reach.',
      'Include 1–2 images — posts with visuals get 2.3× more shares in your niche.',
    ],
    predictedViewsNext7Days: Array.from({ length: 7 }, (_, i) =>
      Math.round(baseViews * (0.95 + rand() * 0.2 + i * 0.03))
    ),
  };
}

export function generateDemoPostAnalytics(
  postId: string,
  range: DateRange = '30d'
): AnalyticsPostResponse {
  const days = getRangeDays(range);
  const seed = postId || 'all-posts';
  const overview = generateOverview(days, seed);
  const timeSeries = generateTimeSeries(days, seed);

  return {
    overview,
    timeSeries,
    engagementTrend: timeSeries,
    trafficSources: generateTrafficSources(seed),
    audience: generateAudience(seed),
    funnel: generateFunnel(overview),
    engagement: generateEngagement(overview),
    heatmap: generateHeatmap(seed),
    aiInsights: generateAIInsights(seed, overview),
    isDemo: true,
  };
}

export function generateDemoOverviewResponse(
  userId: string,
  range: DateRange = '30d'
): AnalyticsOverviewResponse {
  const days = getRangeDays(range);
  const seed = userId || 'demo-user';
  const overview = generateOverview(days, seed);
  const timeSeries = generateTimeSeries(days, seed);

  const demoPosts = [
    { id: 'demo-1', title: 'Why onboarding friction kills retention', slug: 'onboarding-friction' },
    { id: 'demo-2', title: 'AI copilots for indie founders', slug: 'ai-copilots-founders' },
    { id: 'demo-3', title: 'Building in public: week 12 recap', slug: 'building-in-public-w12' },
    { id: 'demo-4', title: 'The case for async-first teams', slug: 'async-first-teams' },
  ];

  const topPosts: TopPerformingPost[] = [
    { id: 'demo-1', title: demoPosts[0].title, metric: 4820, metricLabel: 'Views', trend: 12.4, slug: demoPosts[0].slug },
    { id: 'demo-2', title: demoPosts[1].title, metric: 8.2, metricLabel: 'Engagement %', trend: 5.1, slug: demoPosts[1].slug },
    { id: 'demo-3', title: demoPosts[2].title, metric: 34, metricLabel: 'Growth %', trend: 34, slug: demoPosts[2].slug },
    { id: 'demo-4', title: demoPosts[3].title, metric: 186, metricLabel: 'Shares', trend: -2.1, slug: demoPosts[3].slug },
    { id: 'demo-1', title: demoPosts[0].title, metric: 94, metricLabel: 'Saves', trend: 8.7, slug: demoPosts[0].slug },
  ];

  return {
    overview,
    timeSeries,
    topPosts,
    posts: demoPosts,
    isDemo: true,
  };
}

export function generateDemoCompareResponse(
  postIds: string[],
  range: DateRange = '30d'
): { posts: PostComparisonRow[]; isDemo: boolean } {
  const titles = [
    'Why onboarding friction kills retention',
    'AI copilots for indie founders',
    'Building in public: week 12 recap',
    'The case for async-first teams',
  ];

  const posts: PostComparisonRow[] = postIds.map((id, i) => {
    const rand = seededRandom(hashSeed(id + range));
    const views = Math.round(1200 + rand() * 4000);
    return {
      postId: id,
      title: titles[i % titles.length] || `Post ${i + 1}`,
      views,
      engagementRate: Math.round((4 + rand() * 6) * 10) / 10,
      comments: Math.round(views * (0.02 + rand() * 0.03)),
      shares: Math.round(views * (0.01 + rand() * 0.02)),
      growthRate: Math.round((rand() * 40 - 5) * 10) / 10,
    };
  });

  return { posts, isDemo: true };
}

export const EVENT_DAILY_FIELD_MAP: Record<string, keyof import('./types').PostAnalyticsDaily> = {
  POST_VIEW: 'views',
  POST_OPEN: 'opens',
  POST_UPVOTE: 'upvotes',
  POST_DOWNVOTE: 'downvotes',
  POST_COMMENT: 'comments',
  POST_SHARE: 'shares',
  POST_SAVE: 'saves',
  FOLLOW_FROM_POST: 'follows_gained',
};
