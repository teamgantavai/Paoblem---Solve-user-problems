import { createClient } from '@supabase/supabase-js';

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

const RESEND_API_URL = 'https://api.resend.com/emails';

export async function sendEmail({ to, subject, html, text }: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'Paoblem <noreply@paoblem.com>';

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend email failed: ${body}`);
  }

  return response.json();
}

export function getAppUrl(requestOrigin?: string | null) {
  return process.env.NEXT_PUBLIC_APP_URL || requestOrigin || 'http://localhost:3000';
}

// ─────────────────────────────────────────────────────────────────
// Clean white SaaS email layout (Stripe / Linear / Notion style)
// ─────────────────────────────────────────────────────────────────
function getEmailLayout(title: string, bodyContent: string, unsubscribeLink?: string) {
  const appUrl = getAppUrl();

  const unsubscribeSection = unsubscribeLink
    ? `<p style="font-size:11px;color:#9ca3af;text-align:center;margin:16px 0 0 0;">
         You received this because you have notifications enabled on your account.&nbsp;
         <a href="${unsubscribeLink}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
       </p>`
    : `<p style="font-size:11px;color:#9ca3af;text-align:center;margin:16px 0 0 0;">
         You received this because you have notifications enabled on your account.
       </p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Logo header -->
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <a href="${appUrl}" style="text-decoration:none;display:inline-block;">
                <img src="https://res.cloudinary.com/dh7fjswdt/image/upload/f_auto,q_auto/p_n7ajqn" alt="Paoblem" height="28" style="display:block;" />
              </a>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
              <!-- Top accent line -->
              <div style="height:4px;background:linear-gradient(90deg,#2563eb 0%,#7c3aed 100%);"></div>
              <!-- Card body -->
              <div style="padding:40px 40px 32px 40px;">
                ${bodyContent}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="font-size:12px;color:#6b7280;margin:0 0 6px 0;">
                <a href="${appUrl}" style="color:#2563eb;text-decoration:none;font-weight:500;">Paoblem</a>
                &nbsp;·&nbsp;Where builders solve real problems
              </p>
              ${unsubscribeSection}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────
// Reusable white-layout sub-components
// ─────────────────────────────────────────────────────────────────

function ctaButton(text: string, href: string, color = '#2563eb') {
  return `<div style="text-align:center;margin:28px 0 8px 0;">
    <a href="${href}"
       style="display:inline-block;background-color:${color};color:#ffffff;text-decoration:none;
              padding:13px 32px;font-weight:600;font-size:15px;border-radius:8px;
              letter-spacing:-0.01em;">
      ${text}
    </a>
  </div>`;
}

function infoRow(label: string, value: string) {
  return `<tr>
    <td style="padding:10px 0;font-size:13px;color:#6b7280;font-weight:500;width:120px;vertical-align:top;">${label}</td>
    <td style="padding:10px 0;font-size:13px;color:#111827;font-weight:600;vertical-align:top;">${value}</td>
  </tr>`;
}

function infoCard(rows: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;
                 padding:4px 20px;margin:20px 0;">
    <tbody>${rows}</tbody>
  </table>`;
}

// ─────────────────────────────────────────────────────────────────
// countUnreadMessages  (unchanged helper)
// ─────────────────────────────────────────────────────────────────
export async function countUnreadMessages(userId: string): Promise<number> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: participants, error: partError } = await supabaseAdmin
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId)
    .is('blocked_at', null);

  if (partError || !participants?.length) return 0;
  const conversationIds = participants.map((p: any) => p.conversation_id);

  const { data: messages, error: msgError } = await supabaseAdmin
    .from('messages')
    .select('id, conversation_id')
    .in('conversation_id', conversationIds)
    .neq('sender_id', userId)
    .is('deleted_at', null);

  if (msgError || !messages?.length) return 0;
  const messageIds = messages.map((m: any) => m.id);

  const { data: readReceipts, error: readError } = await supabaseAdmin
    .from('message_reads')
    .select('message_id')
    .in('message_id', messageIds)
    .eq('user_id', userId);

  if (readError) return 0;
  const readMessageIds = new Set(readReceipts?.map((r: any) => r.message_id) || []);
  return messages.filter((m: any) => !readMessageIds.has(m.id)).length;
}

// ─────────────────────────────────────────────────────────────────
// sendChatNotificationEmail  (redesigned)
// ─────────────────────────────────────────────────────────────────
export async function sendChatNotificationEmail(receiverId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, username, last_chat_email_sent_at')
    .eq('id', receiverId)
    .single();

  if (profileErr || !profile) {
    console.error(`[Email] Profile not found for ${receiverId}:`, profileErr);
    return;
  }

  const now = new Date();
  const lastSent = profile.last_chat_email_sent_at ? new Date(profile.last_chat_email_sent_at) : null;
  if (lastSent && (now.getTime() - lastSent.getTime() < 30 * 60 * 1000)) return;

  const unreadCount = await countUnreadMessages(receiverId);
  if (unreadCount === 0) return;

  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
  const { data: updatedProfile } = await supabaseAdmin
    .from('profiles')
    .update({ last_chat_email_sent_at: now.toISOString() })
    .eq('id', receiverId)
    .or(`last_chat_email_sent_at.is.null,last_chat_email_sent_at.lt.${thirtyMinutesAgo}`)
    .select('id')
    .maybeSingle();

  if (!updatedProfile) return;

  const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(receiverId);
  if (userError || !user?.email) return;

  const appUrl = getAppUrl();
  const chatUrl = `${appUrl}/chats`;
  const displayName = profile.full_name || profile.username || 'there';
  const plural = unreadCount > 1 ? 's' : '';

  const bodyContent = `
    <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px 0;text-align:center;">
      New message${plural} waiting
    </h1>
    <p style="font-size:15px;color:#4b5563;text-align:center;margin:0 0 28px 0;line-height:1.6;">
      Hi <strong>${displayName}</strong> — you have
      <strong style="color:#2563eb;">${unreadCount} unread message${plural}</strong>
      on Paoblem.
    </p>
    ${ctaButton('Open Chats →', chatUrl)}
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:20px 0 0 0;">
      Reply directly to continue the conversation.
    </p>
  `;

  const html = getEmailLayout('New messages on Paoblem', bodyContent);

  await sendEmail({
    to: user.email,
    subject: `You have ${unreadCount} unread message${plural} on Paoblem`,
    html,
  });

  console.log(`[Email] Chat notification sent to ${user.email} (${unreadCount} unread)`);
}

// ─────────────────────────────────────────────────────────────────
// Group email functions — NEW
// ─────────────────────────────────────────────────────────────────

/** Sent to the invited user when an admin invites them to a group */
export async function sendGroupInviteEmail(
  toEmail: string,
  inviteeName: string,
  inviterName: string,
  groupName: string,
  inviteId: string,
  groupId: string
) {
  const appUrl = getAppUrl();
  const acceptUrl = `${appUrl}/chats?invite=${inviteId}&group=${groupId}&action=accept`;
  const declineUrl = `${appUrl}/chats?invite=${inviteId}&group=${groupId}&action=decline`;

  const bodyContent = `
    <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px 0;text-align:center;">
      You're invited to join a group
    </h1>
    <p style="font-size:15px;color:#4b5563;text-align:center;margin:0 0 24px 0;line-height:1.6;">
      Hi <strong>${inviteeName}</strong>, <strong>${inviterName}</strong> has invited you to join
      <strong style="color:#111827;">${groupName}</strong>.
    </p>

    ${infoCard(
      infoRow('Group', groupName) +
      infoRow('Invited by', inviterName)
    )}

    <p style="font-size:14px;color:#4b5563;text-align:center;margin:24px 0 0 0;line-height:1.6;">
      You can accept or decline below. You will not be added until you accept.
    </p>

    ${ctaButton('Accept Invitation →', acceptUrl)}

    <div style="text-align:center;margin-top:12px;">
      <a href="${declineUrl}"
         style="font-size:13px;color:#6b7280;text-decoration:underline;">
        Decline this invitation
      </a>
    </div>
  `;

  const html = getEmailLayout(`You're invited to join ${groupName}`, bodyContent);
  try {
    await sendEmail({ to: toEmail, subject: `You're invited to join "${groupName}" on Paoblem`, html });
    console.log(`[Email] Group invite sent to ${toEmail} for group "${groupName}"`);
  } catch (e) {
    console.error('[Email] sendGroupInviteEmail failed:', e);
  }
}

/** Sent to the new member when their invitation is accepted */
export async function sendGroupInviteAcceptedEmail(
  toEmail: string,
  memberName: string,
  groupName: string,
  groupId: string
) {
  const appUrl = getAppUrl();
  const groupUrl = `${appUrl}/chats?group=${groupId}`;

  const bodyContent = `
    <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px 0;text-align:center;">
      Welcome to ${groupName}! 🎉
    </h1>
    <p style="font-size:15px;color:#4b5563;text-align:center;margin:0 0 28px 0;line-height:1.6;">
      Hi <strong>${memberName}</strong>, you are now a member of
      <strong style="color:#111827;">${groupName}</strong>.
      Start chatting and connecting with the group.
    </p>
    ${ctaButton('Open Group Chat →', groupUrl)}
  `;

  const html = getEmailLayout(`Welcome to ${groupName}`, bodyContent);
  try {
    await sendEmail({ to: toEmail, subject: `Welcome to "${groupName}" on Paoblem`, html });
    console.log(`[Email] Invite accepted email sent to ${toEmail}`);
  } catch (e) {
    console.error('[Email] sendGroupInviteAcceptedEmail failed:', e);
  }
}

/** Sent to owner/admin when a user requests to join a public group */
export async function sendGroupJoinRequestEmail(
  toEmail: string,
  requesterName: string,
  groupName: string,
  groupId: string
) {
  const appUrl = getAppUrl();
  const reviewUrl = `${appUrl}/chats?group=${groupId}&tab=requests`;

  const bodyContent = `
    <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px 0;text-align:center;">
      New join request
    </h1>
    <p style="font-size:15px;color:#4b5563;text-align:center;margin:0 0 24px 0;line-height:1.6;">
      <strong>${requesterName}</strong> has requested to join
      <strong style="color:#111827;">${groupName}</strong>.
    </p>

    ${infoCard(
      infoRow('Group', groupName) +
      infoRow('Requester', requesterName)
    )}

    <p style="font-size:14px;color:#4b5563;text-align:center;margin:24px 0 0 0;line-height:1.6;">
      Open the group settings to approve or reject this request.
    </p>

    ${ctaButton('Review Request →', reviewUrl)}
  `;

  const html = getEmailLayout(`New join request for ${groupName}`, bodyContent);
  try {
    await sendEmail({ to: toEmail, subject: `New join request for "${groupName}" on Paoblem`, html });
    console.log(`[Email] Join request email sent to ${toEmail} for "${groupName}"`);
  } catch (e) {
    console.error('[Email] sendGroupJoinRequestEmail failed:', e);
  }
}

/** Sent to the requester when their join request is approved */
export async function sendGroupJoinApprovedEmail(
  toEmail: string,
  memberName: string,
  groupName: string,
  groupId: string
) {
  const appUrl = getAppUrl();
  const groupUrl = `${appUrl}/chats?group=${groupId}`;

  const bodyContent = `
    <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px 0;text-align:center;">
      Your request was approved
    </h1>
    <p style="font-size:15px;color:#4b5563;text-align:center;margin:0 0 28px 0;line-height:1.6;">
      Hi <strong>${memberName}</strong> — great news! Your request to join
      <strong style="color:#111827;">${groupName}</strong> has been approved.
      You are now a member.
    </p>
    ${ctaButton('Open Group Chat →', groupUrl)}
  `;

  const html = getEmailLayout(`Approved — join ${groupName}`, bodyContent);
  try {
    await sendEmail({ to: toEmail, subject: `Your request to join "${groupName}" was approved`, html });
    console.log(`[Email] Join approved email sent to ${toEmail}`);
  } catch (e) {
    console.error('[Email] sendGroupJoinApprovedEmail failed:', e);
  }
}

// ─────────────────────────────────────────────────────────────────
// sendSaveNotificationEmail  (redesigned)
// ─────────────────────────────────────────────────────────────────
export async function sendSaveNotificationEmail(ownerId: string, saverId: string, postId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('pref_receive_saves')
    .eq('id', ownerId)
    .single();

  if (profile && !profile.pref_receive_saves) return;

  const { data: { user: ownerUser } } = await supabaseAdmin.auth.admin.getUserById(ownerId);
  if (!ownerUser?.email) return;

  const { data: saver } = await supabaseAdmin
    .from('profiles')
    .select('username, full_name, avatar_url')
    .eq('id', saverId)
    .single();

  const saverName = saver?.full_name || (saver?.username ? `@${saver.username}` : 'Someone');
  const saverAvatar = saver?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${saverId}`;

  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('title, saves')
    .eq('id', postId)
    .single();

  if (!post) return;

  const appUrl = getAppUrl();
  const postUrl = `${appUrl}/post/${postId}`;
  const unsubscribeLink = `${appUrl}/api/auth/unsubscribe?userId=${ownerId}&type=saves`;
  const savesCount = post.saves || 1;

  const bodyContent = `
    <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px 0;text-align:center;">
      Someone saved your post
    </h1>
    <p style="font-size:15px;color:#4b5563;text-align:center;margin:0 0 24px 0;line-height:1.6;">
      Your problem is gaining attention.
    </p>

    <div style="display:flex;align-items:center;gap:12px;background:#f9fafb;border:1px solid #e5e7eb;
                border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <img src="${saverAvatar}" width="40" height="40"
           style="border-radius:50%;object-fit:cover;background:#e5e7eb;" />
      <div>
        <div style="font-size:14px;font-weight:700;color:#111827;">${saverName}</div>
        <div style="font-size:13px;color:#6b7280;">saved your post</div>
      </div>
    </div>

    ${infoCard(
      infoRow('Post', `"${post.title}"`) +
      infoRow('Total saves', String(savesCount))
    )}

    ${ctaButton('View your post →', postUrl)}
  `;

  const html = getEmailLayout('Someone saved your post', bodyContent, unsubscribeLink);
  await sendEmail({ to: ownerUser.email, subject: 'Someone saved your post on Paoblem', html });
  console.log(`[Email] Save notification sent to ${ownerUser.email}`);
}

// ─────────────────────────────────────────────────────────────────
// sendSolvedNotificationEmail  (redesigned)
// ─────────────────────────────────────────────────────────────────
export async function sendSolvedNotificationEmail(
  ownerId: string,
  solverId: string,
  postId: string,
  status: 'building' | 'launched'
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('pref_receive_solutions')
    .eq('id', ownerId)
    .single();

  if (profile && !profile.pref_receive_solutions) return;

  const { data: { user: ownerUser } } = await supabaseAdmin.auth.admin.getUserById(ownerId);
  if (!ownerUser?.email) return;

  const { data: solver } = await supabaseAdmin
    .from('profiles')
    .select('username, full_name, avatar_url, role')
    .eq('id', solverId)
    .single();

  const solverName = solver?.full_name || (solver?.username ? `@${solver.username}` : 'A Builder');
  const solverAvatar = solver?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${solverId}`;
  const solverRole = solver?.role || 'Builder';

  const { data: post } = await supabaseAdmin.from('posts').select('title').eq('id', postId).single();
  if (!post) return;

  const { data: solution } = await supabaseAdmin
    .from('solutions')
    .select('title, body, id')
    .eq('user_id', solverId)
    .eq('problem_id', postId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const solutionTitle = solution?.title || 'A proposed solution';
  const solutionBody = solution?.body || '';

  const appUrl = getAppUrl();
  const profileUrl = `${appUrl}/user/${solver?.username || solverId}`;
  const unsubscribeLink = `${appUrl}/api/auth/unsubscribe?userId=${ownerId}&type=solutions`;

  const subject = status === 'building'
    ? 'Someone is building a solution to your problem!'
    : 'Someone built a solution to your problem!';
  const emoji = status === 'building' ? '🚀' : '🎉';

  const bodyContent = `
    <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px 0;text-align:center;">
      ${emoji} ${status === 'building' ? 'Solution in progress' : 'Solution launched'}
    </h1>

    <div style="display:flex;align-items:center;gap:12px;background:#f9fafb;border:1px solid #e5e7eb;
                border-radius:8px;padding:16px 20px;margin:20px 0;">
      <img src="${solverAvatar}" width="40" height="40"
           style="border-radius:50%;object-fit:cover;background:#e5e7eb;" />
      <div>
        <div style="font-size:14px;font-weight:700;color:#111827;">${solverName}</div>
        <div style="font-size:13px;color:#6b7280;">${solverRole}</div>
      </div>
    </div>

    ${infoCard(
      infoRow('Your problem', `"${post.title}"`) +
      infoRow('Solution', `"${solutionTitle}"`) +
      (solutionBody ? infoRow('Details', `"${solutionBody.slice(0, 120)}${solutionBody.length > 120 ? '…' : ''}"`) : '')
    )}

    ${ctaButton('See what they\'re building →', profileUrl)}
  `;

  const html = getEmailLayout(subject, bodyContent, unsubscribeLink);
  await sendEmail({ to: ownerUser.email, subject, html });
  console.log(`[Email] Solution notification sent to ${ownerUser.email}`);
}

// ─────────────────────────────────────────────────────────────────
// sendBatchedReplyEmail  (redesigned)
// ─────────────────────────────────────────────────────────────────
export async function sendBatchedReplyEmail(receiverId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('pref_receive_replies, last_reply_email_sent_at')
    .eq('id', receiverId)
    .single();

  if (profile && !profile.pref_receive_replies) return;

  const now = new Date();
  const lastSentDate = profile?.last_reply_email_sent_at ? new Date(profile.last_reply_email_sent_at) : null;
  if (lastSentDate && (now.getTime() - lastSentDate.getTime() < 60 * 60 * 1000)) return;

  const lastSent = profile?.last_reply_email_sent_at
    ? new Date(profile.last_reply_email_sent_at).toISOString()
    : new Date(0).toISOString();

  const { data: myComments } = await supabaseAdmin
    .from('comments')
    .select('id, body')
    .eq('user_id', receiverId);

  if (!myComments || myComments.length === 0) return;

  const myCommentIds = myComments.map((c: any) => c.id);
  const myCommentMap = new Map(myComments.map((c: any) => [c.id, c.body]));

  const { data: replies } = await supabaseAdmin
    .from('comments')
    .select('id, parent_id, body, created_at, user_id, post_id, posts:post_id(title)')
    .in('parent_id', myCommentIds)
    .gt('created_at', lastSent)
    .order('created_at', { ascending: true });

  if (!replies || replies.length === 0) return;

  const replierIds = Array.from(new Set(replies.map((r: any) => r.user_id)));
  const { data: repliers } = await supabaseAdmin
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .in('id', replierIds);

  const replierMap = new Map((repliers || []).map((p: any) => [p.id, p]));

  await supabaseAdmin
    .from('profiles')
    .update({ last_reply_email_sent_at: now.toISOString() })
    .eq('id', receiverId);

  const { data: { user: receiverUser } } = await supabaseAdmin.auth.admin.getUserById(receiverId);
  if (!receiverUser?.email) return;

  const appUrl = getAppUrl();
  const unsubscribeLink = `${appUrl}/api/auth/unsubscribe?userId=${receiverId}&type=replies`;

  let repliesHtml = '';
  replies.forEach((reply: any) => {
    const replier = replierMap.get(reply.user_id);
    const replierName = replier?.full_name || (replier?.username ? `@${replier.username}` : 'Someone');
    const replierAvatar = replier?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${reply.user_id}`;
    const origText = myCommentMap.get(reply.parent_id) || '';
    const origSnippet = origText.length > 90 ? origText.slice(0, 90) + '…' : origText;
    const postTitle = (reply.posts as any)?.title || 'your post';
    const postUrl = `${appUrl}/post/${reply.post_id}`;

    repliesHtml += `
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <img src="${replierAvatar}" width="32" height="32"
               style="border-radius:50%;object-fit:cover;background:#e5e7eb;" />
          <div>
            <span style="font-size:14px;font-weight:700;color:#111827;">${replierName}</span>
            <span style="font-size:12px;color:#6b7280;margin-left:4px;">replied on "${postTitle}"</span>
          </div>
        </div>
        <div style="border-left:3px solid #d1d5db;padding-left:12px;font-size:13px;color:#6b7280;
                    font-style:italic;margin-bottom:8px;">"${origSnippet}"</div>
        <div style="font-size:14px;color:#111827;line-height:1.5;margin-bottom:10px;">
          <strong>Reply:</strong> "${reply.body}"
        </div>
        <a href="${postUrl}" style="font-size:13px;color:#2563eb;text-decoration:none;font-weight:600;">
          View conversation →
        </a>
      </div>
    `;
  });

  const plural = replies.length > 1 ? 's' : '';
  const bodyContent = `
    <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px 0;text-align:center;">
      You have ${replies.length} new reply${plural}
    </h1>
    <p style="font-size:15px;color:#4b5563;text-align:center;margin:0 0 24px 0;line-height:1.6;">
      Here's a summary of recent replies to your comments on Paoblem:
    </p>
    ${repliesHtml}
  `;

  const html = getEmailLayout('New replies on Paoblem', bodyContent, unsubscribeLink);
  await sendEmail({ to: receiverUser.email, subject: `You got ${replies.length} new reply${plural} on Paoblem`, html });
  console.log(`[Email] Batched reply email sent to ${receiverUser.email} (${replies.length} replies)`);
}

// ─────────────────────────────────────────────────────────────────
// sendPostAnalyticsEmail  (redesigned)
// ─────────────────────────────────────────────────────────────────
export async function sendPostAnalyticsEmail(
  ownerId: string,
  postId: string,
  stats: { views: number; upvotes: number; saves: number; comments: number; shares: number },
  comparisons: { views: string; upvotes: string; saves: string; comments: string; shares: string }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user: ownerUser } } = await supabaseAdmin.auth.admin.getUserById(ownerId);
  if (!ownerUser?.email) return;

  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('title, type, body, profiles:user_id(full_name, username, avatar_url, role)')
    .eq('id', postId)
    .single();

  if (!post) return;

  const appUrl = getAppUrl();
  const dashboardUrl = `${appUrl}/analytics`;
  const unsubscribeLink = `${appUrl}/api/auth/unsubscribe?userId=${ownerId}&type=analytics`;

  const statRow = (label: string, icon: string, value: number, delta: string) => {
    const isUp = delta.startsWith('↑');
    const isDown = delta.startsWith('↓');
    const color = isUp ? '#16a34a' : isDown ? '#dc2626' : '#6b7280';
    return `<tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:12px 4px;font-size:14px;color:#374151;">${icon} ${label}</td>
      <td style="padding:12px 4px;text-align:right;font-size:15px;font-weight:700;color:#111827;">${value}</td>
      <td style="padding:12px 4px;text-align:right;font-size:13px;font-weight:600;color:${color};">${delta}</td>
    </tr>`;
  };

  const bodyContent = `
    <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px 0;text-align:center;">
      Post performance report
    </h1>
    <p style="font-size:15px;color:#4b5563;text-align:center;margin:0 0 24px 0;">
      Here's how <strong>"${post.title}"</strong> performed over the last 48 hours.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:28px;">
      <thead>
        <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb;">
          <th style="padding:10px 4px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">Metric</th>
          <th style="padding:10px 4px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Total</th>
          <th style="padding:10px 4px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">vs Last</th>
        </tr>
      </thead>
      <tbody>
        ${statRow('Views', '👁', stats.views, comparisons.views)}
        ${statRow('Upvotes', '⬆️', stats.upvotes, comparisons.upvotes)}
        ${statRow('Saves', '🔖', stats.saves, comparisons.saves)}
        ${statRow('Comments', '💬', stats.comments, comparisons.comments)}
        ${statRow('Shares', '🔗', stats.shares, comparisons.shares)}
      </tbody>
    </table>

    ${ctaButton('View full analytics →', dashboardUrl)}
  `;

  const html = getEmailLayout('Post performance digest', bodyContent, unsubscribeLink);
  await sendEmail({ to: ownerUser.email, subject: 'Your post performance — last 48 hours', html });
  console.log(`[Email] Analytics digest sent to ${ownerUser.email}`);
}

// ─────────────────────────────────────────────────────────────────
// Startup application emails  (redesigned)
// ─────────────────────────────────────────────────────────────────

export async function sendNewApplicationEmail({
  founderEmail, founderName, startupName, startupId, applicantName, role, introText,
}: {
  founderEmail: string; founderName: string; startupName: string; startupId: string;
  applicantName: string; role: string; introText: string;
}) {
  const appUrl = getAppUrl();
  const ctaUrl = `${appUrl}/startups/${startupId}?tab=applicants`;

  const bodyContent = `
    <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px 0;text-align:center;">
      New application for ${startupName}
    </h1>
    <p style="font-size:15px;color:#4b5563;text-align:center;margin:0 0 24px 0;line-height:1.6;">
      Hi <strong>${founderName}</strong> — someone just applied to join your startup.
    </p>
    ${infoCard(
      infoRow('Applicant', applicantName) +
      infoRow('Role', role) +
      (introText ? infoRow('Message', `"${introText.slice(0, 200)}${introText.length > 200 ? '…' : ''}"`) : '')
    )}
    ${ctaButton('Review Application →', ctaUrl)}
  `;

  const html = getEmailLayout(`New Application for ${startupName}`, bodyContent);
  try {
    await sendEmail({ to: founderEmail, subject: `New Application for ${startupName}`, html });
  } catch (e) { console.error('[Email] sendNewApplicationEmail', e); }
}

export async function sendApplicationAcceptedEmail({
  applicantEmail, applicantName, startupName, startupId, role, founderName,
}: {
  applicantEmail: string; applicantName: string; startupName: string; startupId: string;
  role: string; founderName: string;
}) {
  const appUrl = getAppUrl();
  const chatUrl = `${appUrl}/chats`;
  const startupUrl = `${appUrl}/startups/${startupId}`;

  const bodyContent = `
    <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px 0;text-align:center;">
      Congratulations! 🎉
    </h1>
    <p style="font-size:15px;color:#4b5563;text-align:center;margin:0 0 24px 0;line-height:1.6;">
      Hi <strong>${applicantName}</strong> — your application to
      <strong style="color:#111827;">${startupName}</strong> has been accepted.
    </p>
    ${infoCard(
      infoRow('Startup', startupName) +
      infoRow('Role', role) +
      infoRow('Founder', founderName)
    )}
    <p style="font-size:14px;color:#4b5563;text-align:center;margin:24px 0 0 0;line-height:1.6;">
      The founder is excited to have you on board. Open a chat to discuss next steps.
    </p>
    ${ctaButton(`Open Chat with ${founderName} →`, chatUrl, '#059669')}
    <div style="text-align:center;margin-top:12px;">
      <a href="${startupUrl}" style="font-size:13px;color:#6b7280;text-decoration:underline;">
        View Startup Page
      </a>
    </div>
  `;

  const html = getEmailLayout(`Accepted to ${startupName}`, bodyContent);
  try {
    await sendEmail({ to: applicantEmail, subject: `Congratulations! Your application to ${startupName} has been accepted 🎉`, html });
  } catch (e) { console.error('[Email] sendApplicationAcceptedEmail', e); }
}

export async function sendApplicationRejectedEmail({
  applicantEmail, applicantName, startupName, role,
}: {
  applicantEmail: string; applicantName: string; startupName: string; role: string;
}) {
  const appUrl = getAppUrl();

  const bodyContent = `
    <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px 0;text-align:center;">
      Thanks for applying to ${startupName}
    </h1>
    <p style="font-size:15px;color:#4b5563;text-align:center;margin:0 0 24px 0;line-height:1.6;">
      Hi <strong>${applicantName}</strong>, thank you for applying for
      <strong>${role}</strong> at <strong>${startupName}</strong>.
    </p>
    <div style="background:#f9fafb;border-left:4px solid #d1d5db;border-radius:0 8px 8px 0;
                padding:16px 20px;margin-bottom:28px;">
      <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0;">
        After careful consideration, the founder has decided to move forward with other candidates
        at this time. Keep building — the right opportunity is out there.
      </p>
    </div>
    ${ctaButton('Explore More Startups →', `${appUrl}/startups`)}
  `;

  const html = getEmailLayout(`Your application to ${startupName}`, bodyContent);
  try {
    await sendEmail({ to: applicantEmail, subject: `Your application to ${startupName}`, html });
  } catch (e) { console.error('[Email] sendApplicationRejectedEmail', e); }
}
