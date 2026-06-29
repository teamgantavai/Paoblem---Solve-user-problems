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

export async function countUnreadMessages(userId: string): Promise<number> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Fetch active conversation IDs where this user is a participant and not blocked
  const { data: participants, error: partError } = await supabaseAdmin
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId)
    .is('blocked_at', null);

  if (partError || !participants?.length) return 0;
  const conversationIds = participants.map((p: any) => p.conversation_id);

  // 2. Fetch all messages in these conversations not sent by this user
  const { data: messages, error: msgError } = await supabaseAdmin
    .from('messages')
    .select('id, conversation_id')
    .in('conversation_id', conversationIds)
    .neq('sender_id', userId)
    .is('deleted_at', null);

  if (msgError || !messages?.length) return 0;
  const messageIds = messages.map((m: any) => m.id);

  // 3. Fetch read receipts for these messages
  const { data: readReceipts, error: readError } = await supabaseAdmin
    .from('message_reads')
    .select('message_id')
    .in('message_id', messageIds)
    .eq('user_id', userId);

  if (readError) return 0;
  const readMessageIds = new Set(readReceipts?.map((r: any) => r.message_id) || []);

  // 4. Count unread messages
  return messages.filter((m: any) => !readMessageIds.has(m.id)).length;
}

export async function sendChatNotificationEmail(receiverId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Fetch user's profile and last_chat_email_sent_at
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, username, last_chat_email_sent_at')
    .eq('id', receiverId)
    .single();

  if (profileErr || !profile) {
    console.error(`[Email Notification] Profile not found for user ${receiverId}:`, profileErr);
    return;
  }

  // 2. Double check the 30-minute window
  const now = new Date();
  const lastSent = profile.last_chat_email_sent_at ? new Date(profile.last_chat_email_sent_at) : null;
  if (lastSent && (now.getTime() - lastSent.getTime() < 30 * 60 * 1000)) {
    console.log(`[Email Notification] Email already sent within last 30 minutes for user ${receiverId}. Skipping.`);
    return;
  }

  // 3. Count unread messages
  const unreadCount = await countUnreadMessages(receiverId);
  if (unreadCount === 0) {
    console.log(`[Email Notification] User ${receiverId} has 0 unread messages. Skipping email.`);
    return;
  }

  // 4. Try to atomically update last_chat_email_sent_at to current time
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
  const { data: updatedProfile, error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ last_chat_email_sent_at: now.toISOString() })
    .eq('id', receiverId)
    .or(`last_chat_email_sent_at.is.null,last_chat_email_sent_at.lt.${thirtyMinutesAgo}`)
    .select('id')
    .maybeSingle();

  if (updateError) {
    console.error(`[Email Notification] Failed to update last_chat_email_sent_at for user ${receiverId}:`, updateError);
    return;
  }

  if (!updatedProfile) {
    console.log(`[Email Notification] Race condition or concurrent update occurred. Skipping email for user ${receiverId}.`);
    return;
  }

  // 5. Fetch user's email address from auth.users
  const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(receiverId);
  if (userError || !user?.email) {
    console.error(`[Email Notification] Failed to fetch auth user email for user ${receiverId}:`, userError);
    return;
  }
  const receiverEmail = user.email;

  // 6. Send the email
  const appUrl = getAppUrl();
  const chatUrl = `${appUrl}/chats`;
  const subject = `You have ${unreadCount} unread message${unreadCount > 1 ? 's' : ''} on Paoblem`;
  const plural = unreadCount > 1 ? 's' : '';
  const html = `
<div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0d0e12; color: #e4e4e7; padding: 50px 20px; min-height: 100%;">
  <div style="max-width: 540px; margin: 0 auto; background-color: #15171e; border: 1px solid #272a34; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4);">
    <!-- Decorative Gradient Top Bar -->
    <div style="height: 6px; background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);"></div>
    
    <div style="padding: 40px 32px;">
      <!-- Logo Section -->
      <div style="text-align: center; margin-bottom: 32px;">
        <img src="https://res.cloudinary.com/dh7fjswdt/image/upload/f_auto,q_auto/p_n7ajqn" alt="Paoblem Logo" style="height: 36px; display: inline-block;" />
      </div>
      
      <!-- Greeting / Header -->
      <h2 style="font-size: 22px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 12px; text-align: center; letter-spacing: -0.02em;">
        New messages are waiting
      </h2>
      
      <!-- Body Text -->
      <p style="font-size: 15px; color: #a1a1aa; line-height: 1.6; margin-top: 0; margin-bottom: 24px; text-align: center;">
        Hi <strong>${profile.full_name || profile.username || 'there'}</strong>, you have <span style="color: #3b82f6; font-weight: 600; font-size: 16px;">${unreadCount}</span> new message${plural} waiting in your chat.
      </p>

      <!-- Message Alert Callout -->
      <div style="background-color: #1c1e26; border-left: 4px solid #8b5cf6; border-radius: 8px; padding: 18px; margin-bottom: 32px;">
        <p style="font-size: 14px; color: #d4d4d8; margin: 0; line-height: 1.5;">
          💬 Don't miss out on the conversation. Click below to reply and keep collaborating with fellow builders.
        </p>
      </div>

      <!-- Action Button -->
      <div style="text-align: center; margin-bottom: 16px;">
        <a href="${chatUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; font-weight: 600; font-size: 15px; border-radius: 10px; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);">
          Open Chats
        </a>
      </div>
      
      <!-- Footer Info -->
      <hr style="border: 0; border-top: 1px solid #272a34; margin: 32px 0 20px 0;" />
      
      <p style="font-size: 12px; color: #71717a; text-align: center; line-height: 1.5; margin: 0;">
        You are receiving this email because notifications are enabled on your account.<br />
        If you have any questions, visit <a href="${appUrl}" style="color: #3b82f6; text-decoration: none;">Paoblem</a>.
      </p>
    </div>
  </div>
</div>
  `;

  await sendEmail({
    to: receiverEmail,
    subject,
    html,
  });

  console.log(`[Email Notification] Successfully sent aggregated chat notification email to ${receiverEmail} (${unreadCount} unread)`);
}

function getEmailLayout(title: string, bodyContent: string, unsubscribeLink?: string) {
  const appUrl = getAppUrl();
  const unsubscribeSection = unsubscribeLink 
    ? `<p style="font-size: 11px; color: #71717a; text-align: center; margin-top: 24px;">
         You are receiving this because you opted in to notifications.
         <br />
         <a href="${unsubscribeLink}" style="color: #3b82f6; text-decoration: none;">Unsubscribe</a> from this type of email.
       </p>`
    : '';

  return `
<div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0d0e12; color: #e4e4e7; padding: 40px 20px; min-height: 100%;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #15171e; border: 1px solid #272a34; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
    <!-- Decorative Gradient Top Bar -->
    <div style="height: 6px; background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);"></div>
    
    <div style="padding: 40px 32px;">
      <!-- Logo Section -->
      <div style="text-align: center; margin-bottom: 32px;">
        <img src="https://res.cloudinary.com/dh7fjswdt/image/upload/f_auto,q_auto/p_n7ajqn" alt="Paoblem Logo" style="height: 36px; display: inline-block;" />
      </div>
      
      ${bodyContent}
      
      <!-- Footer Info -->
      <hr style="border: 0; border-top: 1px solid #272a34; margin: 32px 0 20px 0;" />
      
      <p style="font-size: 12px; color: #71717a; text-align: center; line-height: 1.5; margin: 0;">
        Visit <a href="${appUrl}" style="color: #3b82f6; text-decoration: none; font-weight: 500;">Paoblem</a> to connect and collaborate.
      </p>
      ${unsubscribeSection}
    </div>
  </div>
</div>
  `;
}

export async function sendSaveNotificationEmail(ownerId: string, saverId: string, postId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Check if user has pref_receive_saves enabled
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('pref_receive_saves')
    .eq('id', ownerId)
    .single();

  if (profile && !profile.pref_receive_saves) {
    console.log(`[Email Notification] Save emails disabled for user ${ownerId}. Skipping.`);
    return;
  }

  // Fetch receiver's email
  const { data: { user: ownerUser } } = await supabaseAdmin.auth.admin.getUserById(ownerId);
  if (!ownerUser?.email) return;

  // Fetch saver's profile
  const { data: saver } = await supabaseAdmin
    .from('profiles')
    .select('username, full_name, avatar_url')
    .eq('id', saverId)
    .single();

  const saverName = saver?.full_name || (saver?.username ? `@${saver.username}` : 'Someone');
  const saverAvatar = saver?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${saverId}`;

  // Fetch post details
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
  const plural = savesCount > 1 ? 'people have' : 'person has';

  const bodyContent = `
    <!-- Title -->
    <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 16px; text-align: center;">
      Someone saved your post!
    </h2>

    <!-- Saver Info Card -->
    <div style="background-color: #1c1e26; border: 1px solid #272a34; border-radius: 12px; padding: 20px; margin-bottom: 24px; display: flex; align-items: center; gap: 16px;">
      <img src="${saverAvatar}" width="48" height="48" style="border-radius: 50%; background-color: #272a34; object-fit: cover;" />
      <div>
        <div style="font-size: 15px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">${saverName}</div>
        <div style="font-size: 13px; color: #a1a1aa; line-height: 1.4;">
          found your problem valuable and saved it.
        </div>
      </div>
    </div>

    <!-- Post Info -->
    <div style="background-color: #12131a; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
      <div style="font-size: 11px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Post Title</div>
      <div style="font-size: 15px; font-weight: 600; color: #ffffff; line-height: 1.4;">"${post.title}"</div>
    </div>

    <p style="font-size: 14px; color: #a1a1aa; text-align: center; margin-bottom: 28px;">
      ⭐ <strong>${savesCount}</strong> ${plural} now saved this problem.
    </p>

    <!-- Action Button -->
    <div style="text-align: center; margin-bottom: 8px;">
      <a href="${postUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; font-weight: 600; font-size: 15px; border-radius: 10px; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.25);">
        See who's paying attention →
      </a>
    </div>
  `;

  const html = getEmailLayout('Someone saved your post', bodyContent, unsubscribeLink);

  await sendEmail({
    to: ownerUser.email,
    subject: 'Someone saved your post on Paoblem!',
    html,
  });

  console.log(`[Email Notification] Successfully sent save email to ${ownerUser.email}`);
}

export async function sendSolvedNotificationEmail(ownerId: string, solverId: string, postId: string, status: 'building' | 'launched') {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Check preference
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('pref_receive_solutions')
    .eq('id', ownerId)
    .single();

  if (profile && !profile.pref_receive_solutions) {
    console.log(`[Email Notification] Solution emails disabled for user ${ownerId}. Skipping.`);
    return;
  }

  // Fetch receiver's email
  const { data: { user: ownerUser } } = await supabaseAdmin.auth.admin.getUserById(ownerId);
  if (!ownerUser?.email) return;

  // Fetch solver profile
  const { data: solver } = await supabaseAdmin
    .from('profiles')
    .select('username, full_name, avatar_url, role')
    .eq('id', solverId)
    .single();

  const solverName = solver?.full_name || (solver?.username ? `@${solver.username}` : 'A Builder');
  const solverAvatar = solver?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${solverId}`;
  const solverRole = solver?.role || 'Builder';

  // Fetch post details
  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('title')
    .eq('id', postId)
    .single();

  if (!post) return;

  // Fetch solver's solution details (get the latest solution by this user for this post)
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

  const statusText = status === 'building' ? 'is working on solving' : 'built a solution for';
  const subject = status === 'building' 
    ? 'Someone is building a solution to your problem!' 
    : 'Someone built a solution to your problem!';

  const bodyContent = `
    <!-- Title -->
    <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 16px; text-align: center;">
      ${status === 'building' ? '🚀 Solution in progress!' : '🎉 Solution launched!'}
    </h2>

    <!-- Solver Info Card -->
    <div style="background-color: #1c1e26; border: 1px solid #272a34; border-radius: 12px; padding: 20px; margin-bottom: 24px; display: flex; align-items: center; gap: 16px;">
      <img src="${solverAvatar}" width="48" height="48" style="border-radius: 50%; background-color: #272a34; object-fit: cover;" />
      <div>
        <div style="font-size: 15px; font-weight: 700; color: #ffffff; margin-bottom: 2px;">${solverName}</div>
        <div style="font-size: 12px; color: #71717a; margin-bottom: 6px;">${solverRole}</div>
        <div style="font-size: 13px; color: #a1a1aa; line-height: 1.4;">
          ${statusText} your problem.
        </div>
      </div>
    </div>

    <!-- Problem Title Section -->
    <div style="background-color: #12131a; border-left: 4px solid #8b5cf6; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
      <div style="font-size: 11px; font-weight: 700; color: #8b5cf6; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Your Problem</div>
      <div style="font-size: 15px; font-weight: 600; color: #ffffff; line-height: 1.4;">"${post.title}"</div>
    </div>

    <!-- Solution Details Section -->
    <div style="background-color: #12131a; border-left: 4px solid #ec4899; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 28px;">
      <div style="font-size: 11px; font-weight: 700; color: #ec4899; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">What they're building</div>
      <div style="font-size: 14px; font-weight: 600; color: #ffffff; line-height: 1.4; margin-bottom: 4px;">"${solutionTitle}"</div>
      <div style="font-size: 13px; color: #a1a1aa; line-height: 1.5; font-style: italic;">
        "${solutionBody.slice(0, 160)}${solutionBody.length > 160 ? '...' : ''}"
      </div>
    </div>

    <!-- Action Button -->
    <div style="text-align: center; margin-bottom: 8px;">
      <a href="${profileUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; font-weight: 600; font-size: 15px; border-radius: 10px; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.25);">
        See what they're building →
      </a>
    </div>
  `;

  const html = getEmailLayout(subject, bodyContent, unsubscribeLink);

  await sendEmail({
    to: ownerUser.email,
    subject,
    html,
  });

  console.log(`[Email Notification] Successfully sent solution notification email to ${ownerUser.email}`);
}

export async function sendBatchedReplyEmail(receiverId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Fetch user's profile and last_reply_email_sent_at
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('pref_receive_replies, last_reply_email_sent_at')
    .eq('id', receiverId)
    .single();

  if (profile && !profile.pref_receive_replies) {
    console.log(`[Email Notification] Reply emails disabled for user ${receiverId}. Skipping.`);
    return;
  }

  const now = new Date();
  const lastSent = profile?.last_reply_email_sent_at 
    ? new Date(profile.last_reply_email_sent_at).toISOString() 
    : new Date(0).toISOString();

  // 2. Double check 1-hour window for rate-limiting
  const lastSentDate = profile?.last_reply_email_sent_at ? new Date(profile.last_reply_email_sent_at) : null;
  if (lastSentDate && (now.getTime() - lastSentDate.getTime() < 60 * 60 * 1000)) {
    console.log(`[Email Notification] Batched reply email sent too recently for user ${receiverId}. Skipping.`);
    return;
  }

  // 3. Query all comment replies
  const { data: myComments } = await supabaseAdmin
    .from('comments')
    .select('id, body')
    .eq('user_id', receiverId);

  if (!myComments || myComments.length === 0) {
    console.log(`[Email Notification] User ${receiverId} has no comments. Skipping email.`);
    return;
  }

  const myCommentIds = myComments.map(c => c.id);
  const myCommentMap = new Map(myComments.map(c => [c.id, c.body]));

  // Fetch replies to those comments since lastSent
  const { data: replies } = await supabaseAdmin
    .from('comments')
    .select('id, parent_id, body, created_at, user_id, post_id, posts:post_id(title)')
    .in('parent_id', myCommentIds)
    .gt('created_at', lastSent)
    .order('created_at', { ascending: true });

  if (!replies || replies.length === 0) {
    console.log(`[Email Notification] No new replies since last email for user ${receiverId}. Skipping.`);
    return;
  }

  // Fetch profiles of all repliers
  const replierIds = Array.from(new Set(replies.map(r => r.user_id)));
  const { data: repliers } = await supabaseAdmin
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .in('id', replierIds);

  const replierMap = new Map((repliers || []).map(p => [p.id, p]));

  // Update last_reply_email_sent_at to now
  await supabaseAdmin
    .from('profiles')
    .update({ last_reply_email_sent_at: now.toISOString() })
    .eq('id', receiverId);

  // Fetch receiver's email
  const { data: { user: receiverUser } } = await supabaseAdmin.auth.admin.getUserById(receiverId);
  if (!receiverUser?.email) return;

  const appUrl = getAppUrl();
  const unsubscribeLink = `${appUrl}/api/auth/unsubscribe?userId=${receiverId}&type=replies`;

  // Render list of replies in HTML
  let repliesHtml = '';
  replies.forEach((reply: any) => {
    const replier = replierMap.get(reply.user_id);
    const replierName = replier?.full_name || (replier?.username ? `@${replier.username}` : 'Someone');
    const replierAvatar = replier?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${reply.user_id}`;
    
    const origText = myCommentMap.get(reply.parent_id) || '';
    const origSnippet = origText.length > 90 ? origText.slice(0, 90) + '...' : origText;
    const replySnippet = reply.body;
    const postTitle = reply.posts?.title || 'your post';
    const postUrl = `${appUrl}/post/${reply.post_id}`;

    repliesHtml += `
      <div style="background-color: #1c1e26; border: 1px solid #272a34; border-radius: 12px; padding: 20px; margin-bottom: 16px; text-align: left;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <img src="${replierAvatar}" width="32" height="32" style="border-radius: 50%; background-color: #272a34; object-fit: cover;" />
          <div>
            <span style="font-size: 14px; font-weight: 700; color: #ffffff;">${replierName}</span>
            <span style="font-size: 12px; color: #71717a; margin-left: 4px;">replied on "${postTitle}"</span>
          </div>
        </div>
        
        <!-- Original Comment -->
        <div style="border-left: 2px solid #52525b; padding-left: 12px; margin-bottom: 10px; font-size: 13px; color: #a1a1aa; font-style: italic;">
          "${origSnippet}"
        </div>
        
        <!-- Reply Text -->
        <div style="font-size: 14px; color: #ffffff; line-height: 1.5; margin-bottom: 12px;">
          <strong>Reply:</strong> "${replySnippet}"
        </div>
        
        <!-- CTA -->
        <a href="${postUrl}" style="font-size: 13px; color: #3b82f6; text-decoration: none; font-weight: 600;">
          Join the conversation →
        </a>
      </div>
    `;
  });

  const bodyContent = `
    <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 16px; text-align: center;">
      You've received comment replies!
    </h2>
    
    <p style="font-size: 14px; color: #a1a1aa; margin-top: 0; margin-bottom: 24px; text-align: center;">
      Here is a summary of replies to your comments on Paoblem:
    </p>

    ${repliesHtml}
  `;

  const html = getEmailLayout('New replies on Paoblem', bodyContent, unsubscribeLink);

  await sendEmail({
    to: receiverUser.email,
    subject: 'You got a reply on Paoblem',
    html,
  });

  console.log(`[Email Notification] Successfully sent batched reply email to ${receiverUser.email} (${replies.length} replies)`);
}

export async function sendPostAnalyticsEmail(
  ownerId: string,
  postId: string,
  stats: { views: number; upvotes: number; saves: number; comments: number; shares: number },
  comparisons: { views: string; upvotes: string; saves: string; comments: string; shares: string }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch receiver's email
  const { data: { user: ownerUser } } = await supabaseAdmin.auth.admin.getUserById(ownerId);
  if (!ownerUser?.email) return;

  // Fetch post title
  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('title, type, body, profiles:user_id(full_name, username, avatar_url, role)')
    .eq('id', postId)
    .single();

  if (!post) return;

  const profileData = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
  const authorName = profileData?.full_name || profileData?.username || 'Someone';
  const authorRole = profileData?.role || 'Innovator';
  const authorAvatar = profileData?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${ownerId}`;

  const appUrl = getAppUrl();
  const dashboardUrl = `${appUrl}/analytics`;
  const unsubscribeLink = `${appUrl}/api/auth/unsubscribe?userId=${ownerId}&type=analytics`;

  // HTML Cover Card for the top of the email
  const cardCoverHtml = `
<div style="background: linear-gradient(135deg, #0a0b0e 0%, #14161f 100%); border: 1.5px solid #272a34; border-radius: 16px; padding: 24px; margin-bottom: 28px; text-align: left; position: relative; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);">
  <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);"></div>
  
  <div style="float: right; font-size: 10px; font-weight: 700; color: #a1a1aa; background-color: #242735; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; margin-bottom: 12px; font-family: monospace;">
    ${post.type}
  </div>
  <div style="clear: both;"></div>

  <h3 style="font-size: 19px; font-weight: 800; color: #ffffff; margin-top: 0; margin-bottom: 12px; line-height: 1.35; letter-spacing: -0.01em;">
    ${post.title}
  </h3>
  
  <p style="font-size: 13.5px; color: #a1a1aa; line-height: 1.5; margin-top: 0; margin-bottom: 20px;">
    ${post.body.replace(/<[^>]*>/g, '').slice(0, 160)}${post.body.length > 160 ? '...' : ''}
  </p>

  <div style="display: flex; align-items: center; gap: 10px;">
    <img src="${authorAvatar}" width="32" height="32" style="border-radius: 50%; background-color: #272a34; object-fit: cover;" />
    <div>
      <div style="font-size: 13px; font-weight: 700; color: #ffffff;">${authorName}</div>
      <div style="font-size: 11px; color: #71717a;">${authorRole}</div>
    </div>
  </div>
</div>
  `;

  // Render Stats Grid in HTML
  const statRow = (label: string, icon: string, value: number, deltaText: string) => `
    <tr style="border-bottom: 1px solid #272a34;">
      <td style="padding: 14px 0; font-size: 15px; color: #ffffff; font-weight: 600; text-align: left;">
        <span style="margin-right: 8px; font-size: 16px;">${icon}</span> ${label}
      </td>
      <td style="padding: 14px 0; text-align: right; font-size: 16px; color: #ffffff; font-weight: 700;">
        ${value}
      </td>
      <td style="padding: 14px 0; text-align: right; font-size: 13px; color: ${deltaText.startsWith('↑') ? '#22c55e' : deltaText.startsWith('↓') ? '#ef4444' : '#71717a'}; font-weight: 600; width: 50%;">
        ${deltaText}
      </td>
    </tr>
  `;

  const bodyContent = `
    <!-- Designed Cover Card -->
    ${cardCoverHtml}

    <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 12px; text-align: center;">
      📊 Your Post Performance
    </h2>
    <p style="font-size: 14px; color: #a1a1aa; text-align: center; margin-top: 0; margin-bottom: 24px;">
      Here is how your post performed over the last 48 hours:
    </p>

    <!-- Stats Table -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
      <thead>
        <tr style="border-bottom: 1px solid #3f3f46;">
          <th style="padding: 8px 0; text-align: left; font-size: 12px; color: #71717a; text-transform: uppercase;">Metric</th>
          <th style="padding: 8px 0; text-align: right; font-size: 12px; color: #71717a; text-transform: uppercase;">Total</th>
          <th style="padding: 8px 0; text-align: right; font-size: 12px; color: #71717a; text-transform: uppercase;">vs Last Period</th>
        </tr>
      </thead>
      <tbody>
        ${statRow('Total Views', '👁', stats.views, comparisons.views)}
        ${statRow('Upvotes', '⬆️', stats.upvotes, comparisons.upvotes)}
        ${statRow('Saves', '🔖', stats.saves, comparisons.saves)}
        ${statRow('Comments', '💬', stats.comments, comparisons.comments)}
        ${statRow('Shares', '🔗', stats.shares, comparisons.shares)}
      </tbody>
    </table>

    <!-- Action Button -->
    <div style="text-align: center; margin-bottom: 8px;">
      <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; font-weight: 600; font-size: 15px; border-radius: 10px; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.25);">
        View full analytics →
      </a>
    </div>
  `;

  const html = getEmailLayout('Your post performance digest', bodyContent, unsubscribeLink);

  await sendEmail({
    to: ownerUser.email,
    subject: '📊 Your post performance — last 48 hours',
    html,
  });

  console.log(`[Email Notification] Successfully sent analytics digest email to ${ownerUser.email}`);
}

// ── Startup Application Email Notifications ───────────────────────────────

export async function sendNewApplicationEmail({
  founderEmail, founderName, startupName, startupId, applicantName, role, introText,
}: {
  founderEmail: string; founderName: string; startupName: string; startupId: string;
  applicantName: string; role: string; introText: string;
}) {
  const appUrl = getAppUrl();
  const ctaUrl = `${appUrl}/startups/${startupId}?tab=applicants`;
  const bodyContent = `
    <h2 style="font-size:20px;font-weight:700;color:#fff;margin-top:0;margin-bottom:12px;text-align:center;">New Application for ${startupName}</h2>
    <p style="font-size:14px;color:#a1a1aa;text-align:center;margin:0 0 24px;">Hi ${founderName}, someone just applied to join your startup.</p>
    <div style="background:#1c1e26;border:1px solid #272a34;border-radius:12px;padding:20px;margin-bottom:24px;">
      <div style="display:flex;gap:12px;margin-bottom:10px;"><span style="font-size:12px;font-weight:700;color:#a1a1aa;min-width:90px;">Applicant</span><span style="font-size:14px;color:#fff;font-weight:600;">${applicantName}</span></div>
      <div style="display:flex;gap:12px;margin-bottom:${introText ? '10px' : '0'};"><span style="font-size:12px;font-weight:700;color:#a1a1aa;min-width:90px;">Role</span><span style="font-size:14px;color:#fff;font-weight:600;">${role}</span></div>
      ${introText ? `<div style="margin-top:12px;border-top:1px solid #272a34;padding-top:12px;font-size:13px;color:#a1a1aa;line-height:1.6;font-style:italic;">"${introText.slice(0, 200)}${introText.length > 200 ? '…' : ''}"</div>` : ''}
    </div>
    <div style="text-align:center;"><a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;text-decoration:none;padding:14px 32px;font-weight:700;font-size:15px;border-radius:10px;">Review Application →</a></div>`;
  const html = getEmailLayout(`New Application for ${startupName}`, bodyContent);
  try { await sendEmail({ to: founderEmail, subject: `New Application for ${startupName}`, html }); } catch (e) { console.error('[email] sendNewApplicationEmail', e); }
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
    <h2 style="font-size:22px;font-weight:700;color:#fff;margin-top:0;margin-bottom:12px;text-align:center;">Congratulations! 🎉</h2>
    <p style="font-size:15px;color:#a1a1aa;text-align:center;margin:0 0 24px;">Hi ${applicantName}, your application to <strong style="color:#fff;">${startupName}</strong> has been accepted.</p>
    <div style="background:#1c1e26;border:1px solid #272a34;border-radius:12px;padding:20px;margin-bottom:24px;">
      <div style="display:flex;gap:12px;margin-bottom:10px;"><span style="font-size:12px;font-weight:700;color:#a1a1aa;min-width:90px;">Startup</span><span style="font-size:14px;color:#fff;font-weight:600;">${startupName}</span></div>
      <div style="display:flex;gap:12px;margin-bottom:10px;"><span style="font-size:12px;font-weight:700;color:#a1a1aa;min-width:90px;">Role</span><span style="font-size:14px;color:#fff;font-weight:600;">${role}</span></div>
      <div style="display:flex;gap:12px;"><span style="font-size:12px;font-weight:700;color:#a1a1aa;min-width:90px;">Founder</span><span style="font-size:14px;color:#fff;font-weight:600;">${founderName}</span></div>
    </div>
    <p style="font-size:14px;color:#a1a1aa;line-height:1.6;margin-bottom:24px;text-align:center;">The founder is excited to have you on board. Open a chat to discuss next steps.</p>
    <div style="text-align:center;margin-bottom:12px;"><a href="${chatUrl}" style="display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:#fff;text-decoration:none;padding:14px 32px;font-weight:700;font-size:15px;border-radius:10px;">Open Chat with ${founderName} →</a></div>
    <div style="text-align:center;"><a href="${startupUrl}" style="font-size:13px;color:#3b82f6;text-decoration:none;">View Startup Page</a></div>`;
  const html = getEmailLayout(`Accepted to ${startupName}`, bodyContent);
  try { await sendEmail({ to: applicantEmail, subject: `Congratulations! Your application to ${startupName} has been accepted 🎉`, html }); } catch (e) { console.error('[email] sendApplicationAcceptedEmail', e); }
}

export async function sendApplicationRejectedEmail({
  applicantEmail, applicantName, startupName, role,
}: {
  applicantEmail: string; applicantName: string; startupName: string; role: string;
}) {
  const appUrl = getAppUrl();
  const bodyContent = `
    <h2 style="font-size:20px;font-weight:700;color:#fff;margin-top:0;margin-bottom:12px;text-align:center;">Thanks for applying to ${startupName}</h2>
    <p style="font-size:15px;color:#a1a1aa;text-align:center;margin:0 0 24px;">Hi ${applicantName}, thank you for your application for <strong style="color:#fff;">${role}</strong> at <strong style="color:#fff;">${startupName}</strong>.</p>
    <div style="background:#1c1e26;border-left:4px solid #6b7280;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;"><p style="font-size:14px;color:#a1a1aa;line-height:1.6;margin:0;">After careful consideration, the founder has decided to move forward with other candidates at this time. Keep building — the right opportunity is out there.</p></div>
    <div style="text-align:center;"><a href="${appUrl}/startups" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;text-decoration:none;padding:14px 32px;font-weight:700;font-size:15px;border-radius:10px;">Explore More Startups →</a></div>`;
  const html = getEmailLayout(`Your application to ${startupName}`, bodyContent);
  try { await sendEmail({ to: applicantEmail, subject: `Your application to ${startupName}`, html }); } catch (e) { console.error('[email] sendApplicationRejectedEmail', e); }
}
