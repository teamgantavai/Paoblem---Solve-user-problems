import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, logAdminAction } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// GET list of posts with detailed fields and filters
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    const { searchParams } = new URL(req.url);

    const search = searchParams.get('search')?.toLowerCase() || '';
    const type = searchParams.get('type') || ''; // 'problem', 'idea', or '' (all)
    const category = searchParams.get('category') || '';
    const filter = searchParams.get('filter') || 'newest'; // 'newest', 'oldest', 'most_viewed', 'most_reported', 'trending', 'highest_quality', 'lowest_quality', 'featured', 'pinned'
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;

    // Fetch posts with author profiles
    let query = supabaseAdmin
      .from('posts')
      .select('*, profiles(id, full_name, avatar_url, username, role)', { count: 'exact' });

    // Apply filters
    if (type) {
      query = query.eq('type', type);
    }
    if (category) {
      query = query.eq('category', category);
    }

    // Apply sorting/filtering rules
    switch (filter) {
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'most_viewed':
        query = query.order('views_count', { ascending: false });
        break;
      case 'most_reported':
        query = query.order('reports', { ascending: false });
        break;
      case 'trending':
        query = query.eq('is_trending', true).order('created_at', { ascending: false });
        break;
      case 'highest_quality':
        query = query.order('quality_score', { ascending: false, nullsFirst: false });
        break;
      case 'lowest_quality':
        query = query.order('quality_score', { ascending: true, nullsFirst: false });
        break;
      case 'featured':
        query = query.eq('is_featured', true).order('created_at', { ascending: false });
        break;
      case 'pinned':
        query = query.eq('is_pinned', true).order('created_at', { ascending: false });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    const { data: posts, count, error } = await query;
    if (error) throw error;

    let filteredPosts = posts || [];

    // Search filter (handles author name or post title search)
    if (search) {
      filteredPosts = filteredPosts.filter(p => {
        const titleMatch = p.title?.toLowerCase().includes(search);
        const authorNameMatch = p.profiles?.full_name?.toLowerCase().includes(search) || p.profiles?.username?.toLowerCase().includes(search);
        return titleMatch || authorNameMatch;
      });
    }

    const total = count || filteredPosts.length;
    const paginatedPosts = filteredPosts.slice(offset, offset + limit);

    return NextResponse.json({
      posts: paginatedPosts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    console.error('[Admin Posts API] GET Error:', err);
    return NextResponse.json({ error: err.message || 'Access Denied' }, { status: 403 });
  }
}

// POST actions for post items
export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    const body = await req.json();
    const { postId, action, payload } = body;

    if (!postId || !action) {
      return NextResponse.json({ error: 'Missing postId or action' }, { status: 400 });
    }

    // Load existing post to verify it exists
    const { data: post, error: fetchErr } = await supabaseAdmin
      .from('posts')
      .select('title')
      .eq('id', postId)
      .single();

    if (fetchErr || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    let result: any = null;

    switch (action) {
      case 'edit':
        const { title, body: postBody, category, tags } = payload || {};
        result = await supabaseAdmin
          .from('posts')
          .update({
            title,
            body: postBody,
            category,
            tags,
          })
          .eq('id', postId);
        
        await logAdminAction(admin.id, 'edit_post', 'post', postId, { title });
        break;

      case 'delete':
        // Hard delete post
        result = await supabaseAdmin
          .from('posts')
          .delete()
          .eq('id', postId);

        await logAdminAction(admin.id, 'delete_post', 'post', postId, { title: post.title });
        break;

      case 'hide':
        // Moderate post as rejected
        result = await supabaseAdmin
          .from('posts')
          .update({ moderation_status: 'rejected' })
          .eq('id', postId);

        await logAdminAction(admin.id, 'hide_post', 'post', postId);
        break;

      case 'restore':
        // Moderate post back as approved
        result = await supabaseAdmin
          .from('posts')
          .update({ moderation_status: 'approved' })
          .eq('id', postId);

        await logAdminAction(admin.id, 'restore_post', 'post', postId);
        break;

      case 'feature':
        result = await supabaseAdmin
          .from('posts')
          .update({ is_featured: true })
          .eq('id', postId);

        await logAdminAction(admin.id, 'feature_post', 'post', postId);
        break;

      case 'unfeature':
        result = await supabaseAdmin
          .from('posts')
          .update({ is_featured: false })
          .eq('id', postId);

        await logAdminAction(admin.id, 'unfeature_post', 'post', postId);
        break;

      case 'pin':
        result = await supabaseAdmin
          .from('posts')
          .update({ is_pinned: true })
          .eq('id', postId);

        await logAdminAction(admin.id, 'pin_post', 'post', postId);
        break;

      case 'unpin':
        result = await supabaseAdmin
          .from('posts')
          .update({ is_pinned: false })
          .eq('id', postId);

        await logAdminAction(admin.id, 'unpin_post', 'post', postId);
        break;

      case 'lock':
        result = await supabaseAdmin
          .from('posts')
          .update({ locked: true })
          .eq('id', postId);

        await logAdminAction(admin.id, 'lock_comments', 'post', postId);
        break;

      case 'unlock':
        result = await supabaseAdmin
          .from('posts')
          .update({ locked: false })
          .eq('id', postId);

        await logAdminAction(admin.id, 'unlock_comments', 'post', postId);
        break;

      case 'trending':
        result = await supabaseAdmin
          .from('posts')
          .update({ is_trending: true })
          .eq('id', postId);

        await logAdminAction(admin.id, 'mark_trending', 'post', postId);
        break;

      case 'untrending':
        result = await supabaseAdmin
          .from('posts')
          .update({ is_trending: false })
          .eq('id', postId);

        await logAdminAction(admin.id, 'unmark_trending', 'post', postId);
        break;

      case 'recalculate_quality':
        // Perform RPC calculation
        const { data: recData, error: recErr } = await supabaseAdmin.rpc('recalculate_quality_score', {
          p_post_id: postId,
        });
        if (recErr) throw recErr;

        await logAdminAction(admin.id, 'recalculate_quality', 'post', postId);
        return NextResponse.json({ success: true, new_scores: recData });

      default:
        return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    if (result && result.error) {
      throw result.error;
    }

    return NextResponse.json({ success: true, message: `Action ${action} completed successfully` });
  } catch (err: any) {
    console.error('[Admin Posts Action API] Error:', err);
    return NextResponse.json({ error: err.message || 'Action failed' }, { status: 500 });
  }
}
