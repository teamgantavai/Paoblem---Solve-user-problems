import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, logAdminAction } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// GET moderation reports queue
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status') || 'pending'; // 'pending', 'resolved', 'ignored', or '' (all)
    const contentType = searchParams.get('contentType') || ''; // 'post', 'comment', or ''
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('reports')
      .select('*, reporter:profiles!reports_reporter_id_fkey(id, full_name, username), reported_user:profiles!reports_reported_user_id_fkey(id, full_name, username)', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }
    if (contentType) {
      query = query.eq('content_type', contentType);
    }

    const { data: reports, count, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      // If table doesn't exist yet, return an empty array with helper flags
      if (error.message.includes('relation "public.reports" does not exist')) {
        return NextResponse.json({
          reports: [],
          total: 0,
          migrationsRequired: true,
          message: 'Database moderation tables are missing. Please apply migrations.',
        });
      }
      throw error;
    }

    const reportsList = reports || [];

    // Dynamically fetch details of reported content (posts/comments)
    const enrichedReports = await Promise.all(
      reportsList.map(async (report) => {
        let contentDetails: any = null;

        try {
          if (report.content_type === 'post') {
            const { data: post } = await supabaseAdmin
              .from('posts')
              .select('id, title, type, slug, body')
              .eq('id', report.content_id)
              .single();
            if (post) {
              contentDetails = {
                title: post.title,
                type: post.type,
                slug: post.slug,
                snippet: post.body?.slice(0, 100),
              };
            }
          } else if (report.content_type === 'comment') {
            const { data: comment } = await supabaseAdmin
              .from('comments')
              .select('id, body, post_id, posts(title, slug)')
              .eq('id', report.content_id)
              .single();
            if (comment) {
              contentDetails = {
                snippet: comment.body?.slice(0, 100),
                post_title: (comment.posts as any)?.title,
                post_slug: (comment.posts as any)?.slug,
              };
            }
          }
        } catch {
          // Content was probably deleted already
        }

        return {
          ...report,
          content_details: contentDetails || { deleted: true, snippet: '[Content already deleted]' },
        };
      })
    );

    const total = count || enrichedReports.length;
    const paginated = enrichedReports.slice(offset, offset + limit);

    return NextResponse.json({
      reports: paginated,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      migrationsRequired: false,
    });
  } catch (err: any) {
    console.error('[Admin Moderation API] GET Error:', err);
    return NextResponse.json({ error: err.message || 'Access Denied' }, { status: 403 });
  }
}

// POST resolve actions: resolve, ignore, delete_content, warn_user, ban_user
export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    const body = await req.json();
    const { reportId, action, payload } = body;

    if (!reportId || !action) {
      return NextResponse.json({ error: 'Missing reportId or action' }, { status: 400 });
    }

    // Load existing report
    const { data: report, error: fetchErr } = await supabaseAdmin
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (fetchErr || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    let result: any = null;

    switch (action) {
      case 'ignore':
        result = await supabaseAdmin
          .from('reports')
          .update({ status: 'ignored' })
          .eq('id', reportId);

        await logAdminAction(admin.id, 'ignore_report', 'report', reportId);
        break;

      case 'resolve':
        result = await supabaseAdmin
          .from('reports')
          .update({ status: 'resolved' })
          .eq('id', reportId);

        await logAdminAction(admin.id, 'resolve_report', 'report', reportId);
        break;

      case 'delete_content':
        // 1. Delete content
        if (report.content_type === 'post') {
          await supabaseAdmin.from('posts').delete().eq('id', report.content_id);
        } else if (report.content_type === 'comment') {
          await supabaseAdmin.from('comments').delete().eq('id', report.content_id);
        }

        // 2. Resolve report
        result = await supabaseAdmin
          .from('reports')
          .update({ status: 'resolved' })
          .eq('id', reportId);

        await logAdminAction(admin.id, 'delete_reported_content', report.content_type, report.content_id, { report_id: reportId });
        break;

      case 'warn_user':
        const warningReason = payload?.warning || 'Violating community guidelines';
        
        // Send notification warning
        await supabaseAdmin.from('notifications').insert({
          user_id: report.reported_user_id,
          type: 'system',
          title: '⚠️ Moderation Warning',
          body: `An administrator issued a warning for your content: "${warningReason}". Future violations may lead to account suspension.`,
        });

        // Resolve report
        result = await supabaseAdmin
          .from('reports')
          .update({ status: 'resolved' })
          .eq('id', reportId);

        await logAdminAction(admin.id, 'warn_reported_user', 'user', report.reported_user_id, { report_id: reportId, warning: warningReason });
        break;

      case 'ban_user':
        // Ban in GoTrue auth
        await supabaseAdmin.auth.admin.updateUserById(report.reported_user_id, {
          ban_duration: '876000h',
        });
        // Update profile flags
        await supabaseAdmin
          .from('profiles')
          .update({ is_banned: true })
          .eq('id', report.reported_user_id);

        // Resolve report
        result = await supabaseAdmin
          .from('reports')
          .update({ status: 'resolved' })
          .eq('id', reportId);

        await logAdminAction(admin.id, 'ban_reported_user', 'user', report.reported_user_id, { report_id: reportId });
        break;

      default:
        return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    if (result && result.error) {
      throw result.error;
    }

    return NextResponse.json({ success: true, message: `Action ${action} completed successfully` });
  } catch (err: any) {
    console.error('[Admin Moderation Action API] Error:', err);
    return NextResponse.json({ error: err.message || 'Action failed' }, { status: 500 });
  }
}
