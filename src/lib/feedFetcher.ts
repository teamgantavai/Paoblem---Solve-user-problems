import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface FeedResponse {
  posts: any[];
  nextCursor: string | null;
  hasMore: boolean;
}

// In-memory cache for the default initial feed (10 seconds TTL)
let cachedFeed: FeedResponse | null = null;
let cachedFeedTime = 0;

export async function getInitialFeed(category?: string | null, type?: string | null): Promise<FeedResponse> {
  const isDefaultFeed = !category && !type;
  if (isDefaultFeed && cachedFeed && (Date.now() - cachedFeedTime < 10000)) {
    return cachedFeed;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const PAGE_SIZE = 12;

  // Optimize select query to only fetch columns needed for the feed cards (Objective 8)
  const feedSelect = 'id, title, body, type, image_url, external_link, link_name, upvotes, downvotes, comments_count, views_count, created_at, user_id, category, tags, quality_score, unique_viewers, saves, slug, profiles:user_id(full_name, avatar_url, role, username), solutions_count:solutions(count)';

  let query = supabase
    .from('posts')
    .select(feedSelect);

  if (category) {
    query = query.eq('category', category);
  }
  if (type === 'problem' || type === 'idea' || type === 'startup') {
    query = query.eq('type', type);
  }

  query = query.order('created_at', { ascending: false }).limit(PAGE_SIZE + 1);

  const startTime = Date.now();
  const { data, error } = await query;
  const dbDuration = Date.now() - startTime;

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Performance Metrics] getInitialFeed database query time: ${dbDuration}ms`);
  }

  if (error) {
    console.error('getInitialFeed error:', error);
    return { posts: [], nextCursor: null, hasMore: false };
  }

  const normalized = (data || []).map((post: any) => {
    const rawCount = Array.isArray(post.solutions_count)
      ? post.solutions_count[0]?.count
      : post.solutions_count;
    const solutionsCount = Number(rawCount || 0);
    return {
      ...post,
      solutions_count: solutionsCount,
      solved: post.type === 'problem' && solutionsCount > 0,
    };
  });

  const hasMore = normalized.length > PAGE_SIZE;
  const posts = hasMore ? normalized.slice(0, PAGE_SIZE) : normalized;
  const nextCursor = hasMore ? posts[posts.length - 1].created_at : null;

  const result = { posts, nextCursor, hasMore };

  if (isDefaultFeed && posts.length > 0) {
    cachedFeed = result;
    cachedFeedTime = Date.now();
  }

  return result;
}
