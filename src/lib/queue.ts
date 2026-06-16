import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Reuse existing Redis connection if it exists in the environment, otherwise default to local
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const notificationQueue = new Queue('notifications', {
  connection: connection as any,
});

// Type definition for Notification Job Data
export interface NotificationJobData {
  user_id: string; // The user receiving the notification
  actor_id: string; // The user performing the action
  type: 'upvote' | 'comment' | 'follow' | 'system';
  title: string;
  bodyTemplate: string; // e.g., "{name} upvoted your post"
  post_id?: string;
}
