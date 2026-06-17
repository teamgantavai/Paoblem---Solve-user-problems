import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const PAGE_SIZE = 5;

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

    let query = supabase
      .from('posts')
      .select('*, profiles:user_id(full_name, avatar_url, role, username)');

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
    } else {
      query = query.order('created_at', { ascending: false }).limit(PAGE_SIZE + 1);
      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      if (type === 'problem' || type === 'idea') {
        query = query.eq('type', type);
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
    }

    let { data, error } = await query;

    if (error && (error.message.includes('username') || error.message.includes('slug'))) {
      console.warn('[posts/list] Fallback: profiles.username or posts.slug column missing, retrying query without them.');
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

    if (postId) {
      return NextResponse.json({
        posts: data || [],
        nextCursor: null,
        hasMore: false,
      });
    }

    const hasMore = (data?.length || 0) > PAGE_SIZE;
    const posts = hasMore ? data!.slice(0, PAGE_SIZE) : (data || []);
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
