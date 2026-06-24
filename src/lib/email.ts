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
<div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b0f19; color: #f3f4f6; padding: 40px 20px; text-align: center; min-height: 100%;">
  <div style="max-width: 500px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 32px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); text-align: left;">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="https://res.cloudinary.com/dh7fjswdt/image/upload/f_auto,q_auto/p_n7ajqn" alt="Paoblem Logo" style="height: 40px; display: block; margin: 0 auto;" />
    </div>
    <h2 style="font-size: 20px; font-weight: 600; margin-top: 0; color: #ffffff; text-align: center;">Unread Messages Waiting</h2>
    <p style="font-size: 16px; color: #9ca3af; line-height: 1.5; margin-bottom: 24px; text-align: center;">
      Hello ${profile.full_name || profile.username || 'there'}, you have <strong style="color: #3b82f6;">${unreadCount}</strong> unread message${plural} waiting in your chat.
    </p>
    <div style="text-align: center;">
      <a href="${chatUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
        Open Chats
      </a>
    </div>
    <hr style="border: 0; border-top: 1px solid #1f2937; margin: 32px 0 16px 0;" />
    <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
      You received this because you have notifications enabled. If you have any questions, visit <a href="${appUrl}" style="color: #3b82f6; text-decoration: none;">Paoblem</a>.
    </p>
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


