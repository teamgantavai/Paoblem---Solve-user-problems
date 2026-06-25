import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getPageSize,
  getSeenPostIds,
  getUserInterests,
  hasEnoughInterest,
  parseRecommendationCursor,
  rankPosts,
  recordPostImpressions,
} from '@/lib/recommendations';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;

const PAGE_SIZE = getPageSize();

export async function GET(req: NextRequest) {
  try {
        const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const type = searchParams.get('type');
    const savedIds = searchParams.get('savedIds');
    const postId = searchParams.get('postId');
    const category = searchParams.get('category');

    const supabase = createClient(supabaseUrl, supabaseKey);

    let userId: string | null = null;
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
      }
    }

    if (type === 'poll') {
      return NextResponse.json({ posts: [], nextCursor: null, hasMore: false });
    }

    const isDirectFilter = !!postId || type === 'mine' || type === 'saved' || !!category;

    let query = supabase
      .from('posts')
      .select('*, profiles:user_id(full_name, avatar_url, role, username), solutions_count:solutions(count)');

    if (postId) {
      query = query.eq('id', postId);
    } else if (isDirectFilter) {
      query = query.order('created_at', { ascending: false }).limit(PAGE_SIZE + 1);
      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      if (type === 'problem' || type === 'idea') {
        query = query.eq('type', type);
      }
      if (category) {
        query = query.eq('category', category);
      }
      if (type === 'mine') {
        if (!userId) {
          return NextResponse.json({ posts: [], nextCursor: null, hasMore: false });
        }
        query = query.eq('user_id', userId);
      } else if (type === 'saved') {
        if (!savedIds) {
          return NextResponse.json({ posts: [], nextCursor: null, hasMore: false });
        }
        const idsArray = savedIds.split(',').filter(Boolean);
        if (idsArray.length === 0) {
          return NextResponse.json({ posts: [], nextCursor: null, hasMore: false });
        }
        query = query.in('id', idsArray);
      }
    } else {
      const admin = createClient(supabaseUrl, supabaseServiceKey);
      const { offset, excludeIds } = parseRecommendationCursor(cursor);

      const baseSelect = '*, profiles:user_id(full_name, avatar_url, role, username), solutions_count:solutions(count)';
      const [recentRes, engagedRes] = await Promise.all([
        admin
          .from('posts')
          .select(baseSelect)
          .order('created_at', { ascending: false })
          .limit(160),
        admin
          .from('posts')
          .select(baseSelect)
          .order('upvotes', { ascending: false })
          .order('comments_count', { ascending: false })
          .limit(160),
      ]);

      if (recentRes.error || engagedRes.error) {
        const error = recentRes.error || engagedRes.error;
        console.error('[posts/list] Recommendation query error:', JSON.stringify(error));
        return NextResponse.json({ error: error?.message || 'Failed to load feed' }, { status: 500 });
      }

      const byId = new Map<string, any>();
      [...(recentRes.data || []), ...(engagedRes.data || [])].forEach((post: any) => byId.set(post.id, post));
      
      const excludeSet = new Set(excludeIds);
      const candidates = normalizePostRows(
        Array.from(byId.values()).filter((post: any) => !excludeSet.has(post.id))
      );

      const interests = await getUserInterests(admin, userId);
      const seenIds = await getSeenPostIds(admin, userId, cursor ? 10 * 60 * 1000 : 0);
      const ranked = rankPosts(candidates, interests, {
        offset: 0, // Since seen ids are filtered out of candidates pool, offset is always 0
        pageSize: PAGE_SIZE,
        newUser: !hasEnoughInterest(interests),
        seenIds,
        type,
      });

      const hasMore = ranked.length > PAGE_SIZE;
      const posts = hasMore ? ranked.slice(0, PAGE_SIZE) : ranked;
      await recordPostImpressions(admin, userId, posts);

      const nextCursorSeenIds = [...excludeIds, ...posts.map(p => p.id)].join(',');

      return NextResponse.json({
        posts,
        nextCursor: hasMore ? `rec:${offset + PAGE_SIZE}:${nextCursorSeenIds}` : null,
        hasMore,
      });
    }

    let { data, error } = await query;

    if (error && (error.message.includes('username') || error.message.includes('slug') || error.message.includes('solutions'))) {
      console.warn('[posts/list] Fallback: optional profile, slug, or solutions relation missing. Retrying basic query.');
      let fallbackQuery = supabase
        .from('posts')
        .select('*, profiles:user_id(full_name, avatar_url, role, username)');

      if (postId) {
        fallbackQuery = fallbackQuery.eq('id', postId);
      } else {
        fallbackQuery = fallbackQuery.order('created_at', { ascending: false }).limit(PAGE_SIZE + 1);
        if (cursor) {
          fallbackQuery = fallbackQuery.lt('created_at', cursor);
        }

        if (type === 'problem' || type === 'idea') {
          fallbackQuery = fallbackQuery.eq('type', type);
        }
        if (category) {
          fallbackQuery = fallbackQuery.eq('category', category);
        }
        if (type === 'mine') {
          if (userId) {
            fallbackQuery = fallbackQuery.eq('user_id', userId);
          }
        } else if (type === 'saved') {
          if (savedIds) {
            const idsArray = savedIds.split(',').filter(Boolean);
            if (idsArray.length > 0) {
              fallbackQuery = fallbackQuery.in('id', idsArray);
            }
          }
        }
      }
      const fallbackRes = await fallbackQuery;
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error) {
      console.error('[posts/list] Supabase error:', JSON.stringify(error));
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const postsWithSolvedState = normalizePostRows(data || []);

    if (postId) {
      return NextResponse.json({
        posts: postsWithSolvedState,
        nextCursor: null,
        hasMore: false,
      });
    }

    const hasMore = postsWithSolvedState.length > PAGE_SIZE;
    const posts = hasMore ? postsWithSolvedState.slice(0, PAGE_SIZE) : postsWithSolvedState;
    const nextCursor = hasMore ? posts[posts.length - 1].created_at : null;

    return NextResponse.json({
      posts,
      nextCursor,
      hasMore,
    });
  } catch (err) {
    console.error('[posts/list] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function normalizePostRows(rows: any[]) {
  return rows.map((post: any) => {
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
}
