import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { NotificationJobData } from './lib/queue';
import { 
  sendChatNotificationEmail, 
  sendSaveNotificationEmail, 
  sendSolvedNotificationEmail, 
  sendBatchedReplyEmail,
  sendPostAnalyticsEmail
} from './lib/email';

// Environment variables
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  showFriendlyErrorStack: false,
});

connection.on('error', (err) => {
  // Silent suppression of connection logs when Redis is not running
});

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

console.log('Worker started. Waiting for jobs...');

const worker = new Worker(
  'notifications',
  async (job) => {
    console.log(`[Worker] Received job ${job.id} (name: ${job.name})`);
    
    if (job.name === 'chat-email-notification') {
      const { receiverId } = job.data;
      console.log(`[Worker] Processing chat email notification job ${job.id} for user ${receiverId}`);
      try {
        await sendChatNotificationEmail(receiverId);
      } catch (err: any) {
        console.error(`[Worker] Error sending chat notification email for user ${receiverId}:`, err.message);
        throw err;
      }
      return;
    }

    if (job.name === 'reply-email-notification') {
      const { receiverId } = job.data;
      console.log(`[Worker] Processing reply email notification job ${job.id} for user ${receiverId}`);
      try {
        await sendBatchedReplyEmail(receiverId);
      } catch (err: any) {
        console.error(`[Worker] Error sending reply email notification for user ${receiverId}:`, err.message);
        throw err;
      }
      return;
    }

    if (job.name === 'save') {
      const data: NotificationJobData = job.data;
      console.log(`[Worker] Processing save notification job ${job.id} for user ${data.user_id}`);
      try {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('username, full_name')
          .eq('id', data.actor_id)
          .single();
          
        const actingName = profile?.username ? `@${profile.username}` : (profile?.full_name || 'Someone');
        const body = data.bodyTemplate.replace('{name}', actingName);

        // Insert notification in DB
        const { error } = await supabaseAdmin.from('notifications').insert({
          user_id: data.user_id,
          type: 'save',
          title: data.title,
          body: body,
          post_id: data.post_id || null,
        });
        if (error) throw error;

        // Send Email
        await sendSaveNotificationEmail(data.user_id, data.actor_id, data.post_id!);
      } catch (err: any) {
        console.error(`[Worker] Error processing save job ${job.id}:`, err.message);
        throw err;
      }
      return;
    }

    if (job.name === 'solved') {
      const data: NotificationJobData = job.data;
      console.log(`[Worker] Processing solved notification job ${job.id} for user ${data.user_id}`);
      try {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('username, full_name')
          .eq('id', data.actor_id)
          .single();
          
        const actingName = profile?.username ? `@${profile.username}` : (profile?.full_name || 'Someone');
        const body = data.bodyTemplate.replace('{name}', actingName);

        const { data: sol } = await supabaseAdmin
          .from('solutions')
          .select('status')
          .eq('user_id', data.actor_id)
          .eq('problem_id', data.post_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const status = sol?.status || 'launched';

        // Insert notification in DB
        const { error } = await supabaseAdmin.from('notifications').insert({
          user_id: data.user_id,
          type: 'solved',
          title: data.title,
          body: body,
          post_id: data.post_id || null,
        });
        if (error) throw error;

        // Send Email
        await sendSolvedNotificationEmail(data.user_id, data.actor_id, data.post_id!, status);
      } catch (err: any) {
        console.error(`[Worker] Error processing solved job ${job.id}:`, err.message);
        throw err;
      }
      return;
    }

    // Generic Notification inserting logic
    const data: NotificationJobData = job.data;
    console.log(`Processing generic notification job ${job.id} for user ${data.user_id}`);

    try {
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

      if (error) {
        throw new Error(`Failed to insert notification: ${error.message}`);
      }
      
      console.log(`Successfully sent generic notification to ${data.user_id}`);
    } catch (err: any) {
      console.error(`Error processing job ${job.id}:`, err.message);
      throw err;
    }
  },
  { connection: connection as any }
);

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with error:`, err.message);
});

// ── Bi-Daily Post Analytics Scheduler ──
// Checks every 1 hour (3600000 ms)
const ANALYTICS_CHECK_INTERVAL = 60 * 60 * 1000;

async function runPostAnalyticsCheck() {
  console.log('[Analytics Scheduler] Starting periodic check...');
  try {
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const { data: posts, error } = await supabaseAdmin
      .from('posts')
      .select('id, user_id, title, created_at, last_analytics_email_sent_at')
      .or(`last_analytics_email_sent_at.is.null,last_analytics_email_sent_at.lte.${fortyEightHoursAgo.toISOString()}`)
      .lte('created_at', fortyEightHoursAgo.toISOString());

    if (error) {
      console.error('[Analytics Scheduler] Error fetching eligible posts:', error.message);
      return;
    }

    if (!posts || posts.length === 0) {
      console.log('[Analytics Scheduler] No posts eligible for analytics check at this time.');
      return;
    }

    console.log(`[Analytics Scheduler] Found ${posts.length} eligible posts. Processing...`);

    for (const post of posts) {
      try {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('pref_receive_analytics')
          .eq('id', post.user_id)
          .single();

        if (profile && !profile.pref_receive_analytics) {
          await supabaseAdmin
            .from('posts')
            .update({ last_analytics_email_sent_at: now.toISOString() })
            .eq('id', post.id);
          continue;
        }

        const ninetySixHoursAgo = new Date(now.getTime() - 96 * 60 * 60 * 1000);
        const { data: events, error: eventsErr } = await supabaseAdmin
          .from('post_events')
          .select('event_type, created_at')
          .eq('post_id', post.id)
          .gte('created_at', ninetySixHoursAgo.toISOString());

        if (eventsErr) {
          console.error(`[Analytics Scheduler] Error fetching events for post ${post.id}:`, eventsErr.message);
          continue;
        }

        const period1Events = events ? events.filter(e => new Date(e.created_at) >= fortyEightHoursAgo) : [];
        const period2Events = events ? events.filter(e => new Date(e.created_at) >= ninetySixHoursAgo && new Date(e.created_at) < fortyEightHoursAgo) : [];

        if (period1Events.length === 0) {
          await supabaseAdmin
            .from('posts')
            .update({ last_analytics_email_sent_at: now.toISOString() })
            .eq('id', post.id);
          console.log(`[Analytics Scheduler] Post ${post.id} ("${post.title}") has 0 activity in last 48 hours. Skipping.`);
          continue;
        }

        const getStats = (periodEvents: any[]) => {
          const stats = { views: 0, upvotes: 0, saves: 0, comments: 0, shares: 0 };
          periodEvents.forEach(e => {
            if (e.event_type === 'POST_VIEW') stats.views++;
            else if (e.event_type === 'POST_UPVOTE') stats.upvotes++;
            else if (e.event_type === 'POST_SAVE') stats.saves++;
            else if (e.event_type === 'POST_COMMENT') stats.comments++;
            else if (e.event_type === 'POST_SHARE') stats.shares++;
          });
          return stats;
        };

        const statsPeriod1 = getStats(period1Events);
        const statsPeriod2 = getStats(period2Events);

        const getDeltaText = (curr: number, prev: number, label: string) => {
          const diff = curr - prev;
          if (diff > 0) return `↑ ${diff} more ${label} than last period`;
          if (diff < 0) return `↓ ${Math.abs(diff)} fewer ${label} than last period`;
          return `= same number of ${label} as last period`;
        };

        const comparisons = {
          views: getDeltaText(statsPeriod1.views, statsPeriod2.views, 'views'),
          upvotes: getDeltaText(statsPeriod1.upvotes, statsPeriod2.upvotes, 'upvotes'),
          saves: getDeltaText(statsPeriod1.saves, statsPeriod2.saves, 'saves'),
          comments: getDeltaText(statsPeriod1.comments, statsPeriod2.comments, 'comments'),
          shares: getDeltaText(statsPeriod1.shares, statsPeriod2.shares, 'shares'),
        };

        await sendPostAnalyticsEmail(post.user_id, post.id, statsPeriod1, comparisons);

        await supabaseAdmin
          .from('posts')
          .update({ last_analytics_email_sent_at: now.toISOString() })
          .eq('id', post.id);

        console.log(`[Analytics Scheduler] Performance email sent for post ${post.id} to user ${post.user_id}`);
      } catch (postErr: any) {
        console.error(`[Analytics Scheduler] Error processing post ${post.id}:`, postErr.message);
      }
    }
  } catch (err: any) {
    console.error('[Analytics Scheduler] Critical error in periodic check:', err.message);
  }
}

// Start interval
const analyticsInterval = setInterval(runPostAnalyticsCheck, ANALYTICS_CHECK_INTERVAL);
// Also run once on startup after 10 seconds delay
const startupTimer = setTimeout(runPostAnalyticsCheck, 10000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  clearInterval(analyticsInterval);
  clearTimeout(startupTimer);
  await worker.close();
  process.exit(0);
});
process.on('SIGINT', async () => {
  console.log('Shutting down worker...');
  clearInterval(analyticsInterval);
  clearTimeout(startupTimer);
  await worker.close();
  process.exit(0);
});
