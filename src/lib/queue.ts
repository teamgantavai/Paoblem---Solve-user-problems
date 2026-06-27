import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { sendChatNotificationEmail, sendBatchedReplyEmail, sendSaveNotificationEmail, sendSolvedNotificationEmail } from './email';

const isVercel = !!(process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_VERCEL_ENV);

// Only connect to Redis if we are NOT on Vercel
const connection = isVercel ? null : new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  showFriendlyErrorStack: false,
  enableOfflineQueue: false, // Prevents commands from queueing and hanging indefinitely when Redis is down
  connectTimeout: 500,       // Connection establishment timeout
});

if (connection) {
  // Suppress uncaught exception / stderr logging from connection errors when Redis is not running
  connection.on('error', (err) => {
    // Silent suppression of connection logs
  });
}

export const notificationQueue = isVercel ? null : new Queue('notifications', {
  connection: connection as any,
});

if (notificationQueue) {
  notificationQueue.on('error', (err) => {
    // Silent suppression of queue connection logs
  });
}

// Type definition for Notification Job Data
export interface NotificationJobData {
  user_id: string; // The user receiving the notification
  actor_id: string; // The user performing the action
  type: 'upvote' | 'downvote' | 'comment' | 'follow' | 'system' | 'new_post' | 'save' | 'solved' | 'reply';
  title: string;
  bodyTemplate: string; // e.g., "{name} upvoted your post"
  post_id?: string;
}

async function insertNotificationDirectly(data: NotificationJobData) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('username, full_name')
      .eq('id', data.actor_id)
      .single();
      
    const actingName = profile?.username ? `@${profile.username}` : (profile?.full_name || 'Someone');
    const body = data.bodyTemplate.replace('{name}', actingName);

    const { error } = await supabaseAdmin.from('notifications').insert({
      user_id: data.user_id,
      type: data.type,
      title: data.title,
      body: body,
      post_id: data.post_id || null,
    });

    if (error) throw error;

    // Send emails directly in fallback/Vercel mode
    if (data.type === 'save') {
      await sendSaveNotificationEmail(data.user_id, data.actor_id, data.post_id!);
    } else if (data.type === 'solved') {
      const { data: sol } = await supabaseAdmin
        .from('solutions')
        .select('status')
        .eq('user_id', data.actor_id)
        .eq('problem_id', data.post_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const status = sol?.status || 'launched';
      await sendSolvedNotificationEmail(data.user_id, data.actor_id, data.post_id!, status);
    }
  } catch (err) {
    console.error('Failed to insert notification directly:', err);
  }
}

export async function enqueueNotification(jobName: string, data: NotificationJobData) {
  if (isVercel || !notificationQueue || !connection || connection.status !== 'ready') {
    console.log('[Fallback Mode] Bypassing Redis queue and saving notification directly.');
    await insertNotificationDirectly(data);
    return;
  }

  try {
    // Run with a 1-second timeout constraint to prevent any possibility of hanging the request
    await Promise.race([
      notificationQueue.add(jobName, data),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Queue timeout')), 1000))
    ]);
  } catch (err) {
    console.warn('Redis queue is unavailable or timed out, falling back to direct database insert:', err);
    await insertNotificationDirectly(data);
  }
}

export async function enqueueChatEmailNotification(receiverId: string, delayMs: number) {
  if (isVercel || !notificationQueue) {
    console.log('[Queue] Enqueuing chat email notification (fallback setTimeout)...');
    setTimeout(async () => {
      try {
        await sendChatNotificationEmail(receiverId);
      } catch (err) {
        console.error('Failed to send fallback chat email:', err);
      }
    }, delayMs);
  } else {
    try {
      await notificationQueue.add(
        'chat-email-notification',
        { receiverId },
        {
          delay: delayMs,
          jobId: `chat-email-notification:${receiverId}`, // Deduplicate using jobId!
        }
      );
      console.log(`[Queue] Enqueued chat email notification for user ${receiverId} with delay ${delayMs}ms`);
    } catch (err) {
      console.warn('Redis queue is unavailable for chat email, falling back to setTimeout:', err);
      setTimeout(async () => {
        try {
          await sendChatNotificationEmail(receiverId);
        } catch (err) {
          console.error('Failed to send fallback chat email:', err);
        }
      }, delayMs);
    }
  }
}

export async function enqueueReplyEmailNotification(receiverId: string, delayMs: number) {
  if (isVercel || !notificationQueue) {
    console.log('[Queue] Enqueuing reply email notification (fallback setTimeout)...');
    setTimeout(async () => {
      try {
        await sendBatchedReplyEmail(receiverId);
      } catch (err) {
        console.error('Failed to send fallback reply email:', err);
      }
    }, delayMs);
  } else {
    try {
      await notificationQueue.add(
        'reply-email-notification',
        { receiverId },
        {
          delay: delayMs,
          jobId: `reply-email-notification:${receiverId}`, // Deduplicate using jobId!
        }
      );
      console.log(`[Queue] Enqueued reply email notification for user ${receiverId} with delay ${delayMs}ms`);
    } catch (err) {
      console.warn('Redis queue is unavailable for reply email, falling back to setTimeout:', err);
      setTimeout(async () => {
        try {
          await sendBatchedReplyEmail(receiverId);
        } catch (err) {
          console.error('Failed to send fallback reply email:', err);
        }
      }, delayMs);
    }
  }
}

