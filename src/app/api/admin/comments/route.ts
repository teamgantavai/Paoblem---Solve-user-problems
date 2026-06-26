import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, logAdminAction } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// GET list of comments with user profile details
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    const { searchParams } = new URL(req.url);

    const search = searchParams.get('search')?.toLowerCase() || '';
    const postId = searchParams.get('postId') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('comments')
      .select('*, profiles(id, full_name, username, avatar_url), posts(id, title, slug)', { count: 'exact' });

    if (postId) {
      query = query.eq('post_id', postId);
    }

    const { data: comments, count, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    let filteredComments = comments || [];

    // Filter by search text
    if (search) {
      filteredComments = filteredComments.filter(c => {
        const bodyMatch = c.body?.toLowerCase().includes(search);
        const authorMatch = c.profiles?.full_name?.toLowerCase().includes(search) || c.profiles?.username?.toLowerCase().includes(search);
        const postMatch = c.posts?.title?.toLowerCase().includes(search);
        return bodyMatch || authorMatch || postMatch;
      });
    }

    const total = count || filteredComments.length;
    const paginated = filteredComments.slice(offset, offset + limit);

    return NextResponse.json({
      comments: paginated,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    console.error('[Admin Comments API] GET Error:', err);
    return NextResponse.json({ error: err.message || 'Access Denied' }, { status: 403 });
  }
}

// POST actions: delete, hide, restore, pin, unpin
export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    const body = await req.json();
    const { commentId, action } = body;

    if (!commentId || !action) {
      return NextResponse.json({ error: 'Missing commentId or action' }, { status: 400 });
    }

    // Fetch existing comment
    const { data: comment, error: fetchErr } = await supabaseAdmin
      .from('comments')
      .select('body, post_id')
      .eq('id', commentId)
      .single();

    if (fetchErr || !comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    let result: any = null;

    switch (action) {
      case 'delete':
        result = await supabaseAdmin
          .from('comments')
          .delete()
          .eq('id', commentId);

        await logAdminAction(admin.id, 'delete_comment', 'comment', commentId, { post_id: comment.post_id, snippet: comment.body.slice(0, 50) });
        break;

      case 'hide':
        result = await supabaseAdmin
          .from('comments')
          .update({ is_hidden: true })
          .eq('id', commentId);

        await logAdminAction(admin.id, 'hide_comment', 'comment', commentId);
        break;

      case 'restore':
        result = await supabaseAdmin
          .from('comments')
          .update({ is_hidden: false })
          .eq('id', commentId);

        await logAdminAction(admin.id, 'restore_comment', 'comment', commentId);
        break;

      case 'pin':
        result = await supabaseAdmin
          .from('comments')
          .update({ is_pinned: true })
          .eq('id', commentId);

        await logAdminAction(admin.id, 'pin_comment', 'comment', commentId);
        break;

      case 'unpin':
        result = await supabaseAdmin
          .from('comments')
          .update({ is_pinned: false })
          .eq('id', commentId);

        await logAdminAction(admin.id, 'unpin_comment', 'comment', commentId);
        break;

      default:
        return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    if (result && result.error) {
      throw result.error;
    }

    return NextResponse.json({ success: true, message: `Action ${action} completed successfully` });
  } catch (err: any) {
    console.error('[Admin Comments Action API] Error:', err);
    return NextResponse.json({ error: err.message || 'Action failed' }, { status: 500 });
  }
}
