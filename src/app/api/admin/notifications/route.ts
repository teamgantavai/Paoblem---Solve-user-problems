import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, logAdminAction } from '@/lib/adminAuth';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    const body = await req.json();
    const { title, textBody, target, channel, categoryName, userIds: selectedUserIds } = body;

    if (!title || !textBody || !target || !channel) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Resolve list of users (IDs and emails)
    let targets: { id: string; email: string }[] = [];

    // Fetch auth users using Auth Admin API
    const { data: { users: authUsers }, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
    if (authErr) throw authErr;

    const emailMap = new Map<string, string>();
    authUsers.forEach(u => {
      if (u.email) emailMap.set(u.id, u.email);
    });

    if (target === 'all') {
      targets = authUsers
        .filter(u => u.email)
        .map(u => ({ id: u.id, email: u.email! }));
    } else if (target === 'verified') {
      const { data: verifiedProfiles, error: profErr } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('is_verified', true);
      
      if (profErr) throw profErr;
      
      verifiedProfiles?.forEach(p => {
        const email = emailMap.get(p.id);
        if (email) targets.push({ id: p.id, email });
      });
    } else if (target === 'category' && categoryName) {
      // Find users who have posts in that category
      const { data: posts, error: postErr } = await supabaseAdmin
        .from('posts')
        .select('user_id')
        .eq('category', categoryName);

      if (postErr) throw postErr;

      const distinctUserIds = Array.from(new Set(posts?.map(p => p.user_id) || []));
      distinctUserIds.forEach(uid => {
        const email = emailMap.get(uid);
        if (email) targets.push({ id: uid, email });
      });
    } else if (target === 'selected' && selectedUserIds && Array.isArray(selectedUserIds)) {
      selectedUserIds.forEach(uid => {
        const email = emailMap.get(uid);
        if (email) targets.push({ id: uid, email });
      });
    }

    if (targets.length === 0) {
      return NextResponse.json({ success: true, message: 'No target users found for selection criteria' });
    }

    // 2. Send In-App Notifications
    if (channel === 'in_app' || channel === 'both') {
      const notifications = targets.map(t => ({
        user_id: t.id,
        type: 'system',
        title: title,
        body: textBody,
        read: false,
      }));

      // Batch insert in chunks of 100 to prevent payload limits
      const chunkSize = 100;
      for (let i = 0; i < notifications.length; i += chunkSize) {
        const chunk = notifications.slice(i, i + chunkSize);
        const { error: insertErr } = await supabaseAdmin
          .from('notifications')
          .insert(chunk);
        if (insertErr) {
          console.warn('[Admin Notifications] Failed to write in-app notifications batch:', insertErr.message);
        }
      }
    }

    // 3. Send Email Notifications (Run concurrently, log errors but don't crash)
    if (channel === 'email' || channel === 'both') {
      const emailPromises = targets.map(async (t) => {
        try {
          await sendEmail({
            to: t.email,
            subject: title,
            html: `
              <div style="font-family: sans-serif; padding: 20px; line-height: 1.5; color: #333;">
                <h2 style="color: #111; margin-top: 0;">${title}</h2>
                <p style="white-space: pre-wrap;">${textBody}</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 0.8rem; color: #777;">You are receiving this update from the Paoblem Platform Administrator.</p>
              </div>
            `,
            text: textBody,
          });
        } catch (err: any) {
          console.error(`[Admin Notifications] Failed to send email to ${t.email}:`, err.message);
        }
      });

      // Fire and forget or resolve in background to prevent request timeout
      void Promise.all(emailPromises);
    }

    await logAdminAction(admin.id, 'send_bulk_notification', 'notification', target, {
      title,
      channel,
      recipient_count: targets.length,
    });

    return NextResponse.json({
      success: true,
      message: `Bulk notification successfully queued for ${targets.length} users via ${channel}`,
    });
  } catch (err: any) {
    console.error('[Admin Notifications API] Error:', err);
    return NextResponse.json({ error: err.message || 'Notification failed' }, { status: 500 });
  }
}
