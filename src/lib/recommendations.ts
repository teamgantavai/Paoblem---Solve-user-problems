const DEFAULT_PAGE_SIZE = 5;
const PERSONALIZED_THRESHOLD = 12;

export const POST_EVENT_WEIGHTS: Record<string, number> = {
  POST_VIEW: 1,
  POST_OPEN: 3,
  POST_UPVOTE: 5,
  POST_COMMENT: 6,
  POST_SAVE: 8,
  POST_SHARE: 10,
  SOLUTION_VIEW: 8,
  SOLUTION_UPVOTE: 5,
  SOLUTION_SAVE: 8,
  CHALLENGE_ACCEPT: 20,
};

type AnyRow = Record<string, any>;

type RankedRow<T extends AnyRow> = T & {
  recommendation_score: number;
  recommendation_bucket: 'personalized' | 'trending' | 'discovery' | 'fresh';
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  AI: ['ai', 'artificial intelligence', 'machine learning', 'llm', 'gpt', 'automation', 'agent'],
  Education: ['education', 'learning', 'student', 'teacher', 'course', 'school', 'college', 'study'],
  SaaS: ['saas', 'b2b', 'subscription', 'crm', 'workflow', 'dashboard', 'productivity'],
  Healthcare: ['health', 'healthcare', 'doctor', 'patient', 'clinic', 'medical', 'therapy'],
  Finance: ['finance', 'fintech', 'payment', 'bank', 'invoice', 'tax', 'accounting'],
  Recruiting: ['recruiting', 'hiring', 'talent', 'resume', 'interview', 'job', 'career'],
  Design: ['design', 'figma', 'ux', 'ui', 'prototype', 'handoff'],
  DeveloperTools: ['developer', 'devtool', 'api', 'code', 'github', 'deploy', 'debug'],
  Marketplace: ['marketplace', 'buyer', 'seller', 'commerce', 'shop', 'vendor'],
  Consumer: ['consumer', 'social', 'creator', 'community', 'personal', 'mobile'],
};

export function getPageSize() {
  return DEFAULT_PAGE_SIZE;
}

export function parseRecommendationCursor(cursor: string | null) {
  if (!cursor?.startsWith('rec:')) return { offset: 0, excludeIds: [] as string[], isRecommendationCursor: false };
  const parts = cursor.split(':');
  const offset = Number(parts[1]);
  const excludeIds = parts[2] ? parts[2].split(',') : [];
  return { 
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0, 
    excludeIds, 
    isRecommendationCursor: true 
  };
}

export function extractCategories(row: AnyRow): string[] {
  const explicit = [row.category, row.vertical, row.topic]
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => normalizeCategory(value));

  const text = `${row.title || ''} ${row.body || ''} ${row.problem?.title || ''} ${row.problem?.body || ''}`.toLowerCase();
  const hashtags = Array.from(text.matchAll(/#([a-z0-9][a-z0-9_-]{2,30})/g)).map((match) => normalizeCategory(match[1]));
  const keywordCategories = Object.entries(CATEGORY_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))
    .map(([category]) => category);

  const categories = Array.from(new Set([...explicit, ...hashtags, ...keywordCategories])).filter(Boolean);
  return categories.length > 0 ? categories.slice(0, 5) : [row.type === 'idea' ? 'Ideas' : 'Problems'];
}

export async function getUserInterests(supabase: any, userId: string | null) {
  if (!userId) return new Map<string, number>();
  const { data, error } = await supabase
    .from('user_category_interests')
    .select('category, score')
    .eq('user_id', userId)
    .order('score', { ascending: false })
    .limit(50);

  if (error) return new Map<string, number>();
  return new Map<string, number>((data || []).map((row: AnyRow) => [String(row.category), Number(row.score || 0)]));
}

export function hasEnoughInterest(interests: Map<string, number>) {
  let total = 0;
  interests.forEach((score) => {
    total += score;
  });
  return total >= PERSONALIZED_THRESHOLD;
}

export function rankPosts<T extends AnyRow>(
  rows: T[],
  interests: Map<string, number>,
  options: { offset?: number; pageSize?: number; newUser?: boolean; seenIds?: Set<string>; type?: string | null } = {}
) {
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const newUser = options.newUser ?? !hasEnoughInterest(interests);
  const seenIds = options.seenIds || new Set<string>();
  const filtered = options.type && ['problem', 'idea', 'startup'].includes(options.type)
    ? rows.filter((row) => row.type === options.type)
    : rows;

  const ranked = filtered.map((row) => scorePost(row, interests, seenIds));
  const pools = {
    personalized: ranked.filter((row) => row.recommendation_bucket === 'personalized').sort(sortByRecommendation),
    trending: [...ranked].sort((a, b) => trendingScore(b) - trendingScore(a)),
    discovery: ranked.filter((row) => row.recommendation_bucket === 'discovery').sort(sortByRecommendation),
    fresh: [...ranked].sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || '')),
  };

  const mix: Record<string, number> = newUser
    ? { trending: 0.4, discovery: 0.4, fresh: 0.2 }
    : { personalized: 0.6, trending: 0.2, discovery: 0.2 };

  return mixRows(pools, mix, pageSize, options.offset || 0);
}

export function rankSolutions<T extends AnyRow>(
  rows: T[],
  interests: Map<string, number>,
  options: { offset?: number; pageSize?: number; newUser?: boolean; seenIds?: Set<string> } = {}
) {
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const newUser = options.newUser ?? !hasEnoughInterest(interests);
  const seenIds = options.seenIds || new Set<string>();
  const ranked = rows.map((row) => scoreSolution(row, interests, seenIds));
  const pools = {
    personalized: ranked.filter((row) => row.recommendation_bucket === 'personalized').sort(sortByRecommendation),
    trending: [...ranked].sort((a, b) => solutionTrendingScore(b) - solutionTrendingScore(a)),
    discovery: ranked.filter((row) => row.recommendation_bucket === 'discovery').sort(sortByRecommendation),
    fresh: [...ranked].sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || '')),
  };

  const mix: Record<string, number> = newUser
    ? { trending: 0.4, discovery: 0.4, fresh: 0.2 }
    : { personalized: 0.7, trending: 0.2, discovery: 0.1 };

  return mixRows(pools, mix, pageSize, options.offset || 0);
}

export async function updateUserInterestsForContent(
  supabase: any,
  userId: string | null,
  content: AnyRow | null | undefined,
  eventType: string,
  dwellSeconds = 0
) {
  if (!userId || !content) return;
  const baseWeight = POST_EVENT_WEIGHTS[eventType] || 0;
  const dwellBoost = Math.min(Math.floor(Math.max(0, dwellSeconds) / 15), 4);
  const weight = baseWeight + dwellBoost;
  if (weight <= 0) return;

  const categories = extractCategories(content);
  await Promise.all(categories.map(async (category) => {
    const { data } = await supabase
      .from('user_category_interests')
      .select('score')
      .eq('user_id', userId)
      .eq('category', category)
      .maybeSingle();

    const nextScore = Number(data?.score || 0) + weight;
    await supabase.from('user_category_interests').upsert({
      user_id: userId,
      category,
      score: nextScore,
      last_interaction_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,category' });
  }));
}

export async function getSeenPostIds(supabase: any, userId: string | null, excludeRecentMs = 0) {
  if (!userId) return new Set<string>();
  let query = supabase
    .from('feed_impressions')
    .select('post_id')
    .eq('user_id', userId)
    .gte('shown_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());

  if (excludeRecentMs > 0) {
    query = query.lt('shown_at', new Date(Date.now() - excludeRecentMs).toISOString());
  }

  const { data, error } = await query.limit(500);
  if (error) return new Set<string>();
  return new Set<string>((data || []).map((row: AnyRow) => String(row.post_id)).filter(Boolean));
}

export async function recordPostImpressions(supabase: any, userId: string | null, posts: AnyRow[]) {
  if (!userId || posts.length === 0) return;
  await supabase.from('feed_impressions').insert(posts.map((post, index) => ({
    user_id: userId,
    post_id: post.id,
    rank_position: index + 1,
    score: post.recommendation_score || null,
  })));
}

export function buildTrendingSections(posts: AnyRow[], interactions: AnyRow[]) {
  const now = Date.now();
  const scored = posts.map((post) => ({
    post,
    today: interactionScore(post.id, interactions, now - 24 * 60 * 60 * 1000),
    week: interactionScore(post.id, interactions, now - 7 * 24 * 60 * 60 * 1000),
    solved: Number(post.solutions_count || 0) * 12 + Number(post.challenge_count || 0) * 8,
    discussed: Number(post.comments_count || 0) * 5 + replyCount(post.id, interactions) * 2,
  }));

  return {
    trendingToday: scored.sort((a, b) => b.today - a.today).map((item) => item.post),
    trendingThisWeek: scored.sort((a, b) => b.week - a.week).map((item) => item.post),
    mostSolved: scored.sort((a, b) => b.solved - a.solved).map((item) => item.post),
    mostDiscussed: scored.sort((a, b) => b.discussed - a.discussed).map((item) => item.post),
  };
}

function scorePost<T extends AnyRow>(row: T, interests: Map<string, number>, seenIds: Set<string>): RankedRow<T> {
  const categories = extractCategories(row);
  const interestMatch = categories.reduce((sum, category) => sum + (interests.get(category) || 0), 0);
  const engagement = Number(row.upvotes || 0) * 4 + Number(row.comments_count || 0) * 6 + Number(row.views_count || 0) * 0.4 - Number(row.downvotes || 0) * 3;
  const solutionActivity = Number(row.solutions_count || 0) * 10 + (row.solved ? 8 : 0);
  const qualityScore = Number(row.ai_quality_score || row.quality_score || 0);
  const confidenceScore = Number(row.confidence_score !== undefined && row.confidence_score !== null ? row.confidence_score : 1.0);
  const quality = qualityScore * confidenceScore * 8;
  const freshness = freshnessScore(row.created_at);
  const repeatPenalty = seenIds.has(row.id) ? 35 : 0;
  const score = interestMatch * 1.8 + engagement + solutionActivity + quality + freshness - repeatPenalty;
  const hasMatch = interestMatch > 0;

  return {
    ...row,
    recommendation_score: score,
    recommendation_bucket: hasMatch ? 'personalized' : engagement > 8 ? 'trending' : 'discovery',
  };
}

function scoreSolution<T extends AnyRow>(row: T, interests: Map<string, number>, seenIds: Set<string>): RankedRow<T> {
  const categories = extractCategories(row);
  const interestMatch = categories.reduce((sum, category) => sum + (interests.get(category) || 0), 0);
  const engagement = Number(row.upvotes || 0) * 5 + Number(row.comments_count || 0) * 4 - Number(row.downvotes || 0) * 3;
  const freshness = freshnessScore(row.created_at);
  const repeatPenalty = seenIds.has(row.problem_id) ? 15 : 0;
  const score = interestMatch * 1.8 + engagement + freshness - repeatPenalty;

  return {
    ...row,
    recommendation_score: score,
    recommendation_bucket: interestMatch > 0 ? 'personalized' : engagement > 6 ? 'trending' : 'discovery',
  };
}

function mixRows<T extends RankedRow<AnyRow>>(
  pools: Record<string, T[]>,
  mix: Record<string, number>,
  pageSize: number,
  offset: number
) {
  const targetSize = pageSize + 1;
  const mixed: T[] = [];
  const used = new Set<string>();
  
  // Mix the entire candidate pool once to build a stable list, avoiding skipping/duplicating items
  const totalCandidates = Object.values(pools).flat().length;

  Object.entries(mix).forEach(([bucket, ratio]) => {
    const count = Math.max(1, Math.round(totalCandidates * ratio));
    takeFromPool(pools[bucket] || [], count, mixed, used);
  });

  takeFromPool(
    Object.values(pools).flat().sort(sortByRecommendation),
    totalCandidates - mixed.length,
    mixed,
    used
  );

  return mixed.slice(offset, offset + targetSize);
}

function takeFromPool<T extends AnyRow>(pool: T[], count: number, target: T[], used: Set<string>) {
  const startLength = target.length;
  for (const row of pool) {
    if (target.length - startLength >= count) break;
    const key = row.id || row.post_id || row.problem_id;
    if (!key || used.has(key)) continue;
    target.push(row);
    used.add(key);
  }
}

function sortByRecommendation(a: AnyRow, b: AnyRow) {
  return Number(b.recommendation_score || 0) - Number(a.recommendation_score || 0);
}

function trendingScore(row: AnyRow) {
  return Number(row.upvotes || 0) * 5 + Number(row.comments_count || 0) * 4 + Number(row.views_count || 0) * 0.6 + Number(row.solutions_count || 0) * 8 - Number(row.downvotes || 0) * 3;
}

function solutionTrendingScore(row: AnyRow) {
  return Number(row.upvotes || 0) * 5 + Number(row.comments_count || 0) * 4 - Number(row.downvotes || 0) * 3;
}

function interactionScore(postId: string, interactions: AnyRow[], sinceMs: number) {
  return interactions
    .filter((event) => event.post_id === postId && Date.parse(event.created_at || '') >= sinceMs)
    .reduce((sum, event) => sum + (POST_EVENT_WEIGHTS[event.event_type] || 1), 0);
}

function replyCount(postId: string, interactions: AnyRow[]) {
  return interactions.filter((event) => event.post_id === postId && event.metadata?.is_reply).length;
}

function freshnessScore(createdAt: string | null | undefined) {
  const ageHours = Math.max(1, (Date.now() - Date.parse(createdAt || new Date().toISOString())) / 36e5);
  return Math.max(0, 30 / Math.pow(ageHours, 0.35));
}

function normalizeCategory(value: string) {
  return value
    .trim()
    .replace(/^#/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\s/g, '');
}
