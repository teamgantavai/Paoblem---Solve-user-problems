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

    const isDirectFilter = !!postId || type === 'mine' || type === 'saved' || type === 'poll';

    let query = supabase
      .from('posts')
      .select('*, profiles:user_id(full_name, avatar_url, role, username), solutions_count:solutions(count)');

    if (postId) {
      if (postId === 'dylan-post' || postId === 'ryan-post') {
        const mockPost = postId === 'dylan-post' ? {
          id: 'dylan-post',
          user_id: 'user-figma',
          title: 'Why designing Sucks!!!',
          body: 'Design handoff is broken. Redlines are tedious. Prototyping shouldn\'t require rebuilding everything from scratch. We need closer collaboration between design and code, where design files directly map to component trees.',
          type: 'problem',
          image_url: JSON.stringify(['https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80']),
          external_link: 'https://figma.com',
          link_name: 'Figma Design',
          upvotes: 142,
          downvotes: 3,
          comments_count: 2,
          views_count: 420,
          solutions_count: 2,
          solved: true,
          created_at: new Date(Date.now() - 1000 * 3600 * 24).toISOString(),
          updated_at: new Date(Date.now() - 1000 * 3600 * 24).toISOString(),
          profiles: {
            full_name: 'Dylan Field',
            avatar_url: 'https://i.pravatar.cc/150?u=dylan2',
            role: 'CEO of Figma'
          }
        } : {
          id: 'ryan-post',
          user_id: 'user-linkedin',
          title: 'Recruiting in 2026 is totally broken',
          body: 'LinkedIn is full of spam and automated outreach. Founders can\'t find genuine early-stage talent who want to build, and builders are drowned in AI-generated recruiter messages. We need a peer-reviewed network of problem solvers.',
          type: 'problem',
          image_url: JSON.stringify(['https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&auto=format&fit=crop&q=80']),
          external_link: 'https://linkedin.com',
          link_name: 'LinkedIn Recruiting',
          upvotes: 95,
          downvotes: 1,
          comments_count: 1,
          views_count: 310,
          solutions_count: 0,
          solved: false,
          created_at: new Date(Date.now() - 1000 * 3600 * 48).toISOString(),
          updated_at: new Date(Date.now() - 1000 * 3600 * 48).toISOString(),
          profiles: {
            full_name: 'Ryan Roslansky',
            avatar_url: 'https://i.pravatar.cc/150?u=ryan2',
            role: 'CEO of LinkedIn'
          }
        };

        return NextResponse.json({
          posts: [mockPost],
          nextCursor: null,
          hasMore: false,
        });
      }
      query = query.eq('id', postId);
    } else if (isDirectFilter) {
      query = query.order('created_at', { ascending: false }).limit(PAGE_SIZE + 1);
      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      if (type === 'problem' || type === 'idea') {
        query = query.eq('type', type);
      } else if (type === 'poll') {
        query = query.not('poll_question', 'is', null);
      } else if (type === 'mine') {
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
      const { offset } = parseRecommendationCursor(cursor);

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
      const candidates = normalizePostRows(Array.from(byId.values()));
      const interests = await getUserInterests(admin, userId);
      const seenIds = await getSeenPostIds(admin, userId);
      const ranked = rankPosts(candidates, interests, {
        offset,
        pageSize: PAGE_SIZE,
        newUser: !hasEnoughInterest(interests),
        seenIds,
        type,
      });

      const hasMore = ranked.length > PAGE_SIZE;
      const posts = hasMore ? ranked.slice(0, PAGE_SIZE) : ranked;
      await recordPostImpressions(admin, userId, posts);

      return NextResponse.json({
        posts,
        nextCursor: hasMore ? `rec:${offset + PAGE_SIZE}` : null,
        hasMore,
      });
    }

    let { data, error } = await query;

    if (error && (error.message.includes('username') || error.message.includes('slug') || error.message.includes('solutions'))) {
      console.warn('[posts/list] Fallback: optional profile, slug, or solutions relation missing. Retrying basic query.');
      let fallbackQuery = supabase
        .from('posts')
        .select('*, profiles:user_id(full_name, avatar_url, role)');

      if (postId) {
        fallbackQuery = fallbackQuery.eq('id', postId);
      } else {
        fallbackQuery = fallbackQuery.order('created_at', { ascending: false }).limit(PAGE_SIZE + 1);
        if (cursor) {
          fallbackQuery = fallbackQuery.lt('created_at', cursor);
        }

        if (type === 'problem' || type === 'idea') {
          fallbackQuery = fallbackQuery.eq('type', type);
        } else if (type === 'poll') {
          fallbackQuery = fallbackQuery.not('poll_question', 'is', null);
        } else if (type === 'mine') {
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
