import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { NotificationJobData } from './lib/queue';
import { sendChatNotificationEmail } from './lib/email';

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

    const data: NotificationJobData = job.data;
    console.log(`Processing notification job ${job.id} for user ${data.user_id}`);

    try {
      // Fetch the actor's profile to get their username and name
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('username, full_name')
        .eq('id', data.actor_id)
        .single();
        
      const actingName = profile?.username ? `@${profile.username}` : (profile?.full_name || 'Someone');
      const body = data.bodyTemplate.replace('{name}', actingName);

      // Insert the notification into Supabase
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
      
      console.log(`Successfully sent notification to ${data.user_id}`);
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

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  await worker.close();
  process.exit(0);
});
process.on('SIGINT', async () => {
  console.log('Shutting down worker...');
  await worker.close();
  process.exit(0);
});
