import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { createClient } from '@supabase/supabase-js';

const isVercel = !!(process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_VERCEL_ENV);

// Only connect to Redis if we are NOT on Vercel
const connection = isVercel ? null : new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const notificationQueue = isVercel ? null : new Queue('notifications', {
  connection: connection as any,
});

// Type definition for Notification Job Data
export interface NotificationJobData {
  user_id: string; // The user receiving the notification
  actor_id: string; // The user performing the action
  type: 'upvote' | 'downvote' | 'comment' | 'follow' | 'system';
  title: string;
  bodyTemplate: string; // e.g., "{name} upvoted your post"
  post_id?: string;
}

export async function enqueueNotification(jobName: string, data: NotificationJobData) {
  if (isVercel || !notificationQueue) {
    console.log('[Vercel Mode] Bypassing Redis queue and saving notification directly.');
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
    } catch (err) {
      console.error('Failed to insert notification directly on Vercel:', err);
    }
  } else {
    // Local Docker mode: Use the Redis queue
    await notificationQueue.add(jobName, data);
  }
}
