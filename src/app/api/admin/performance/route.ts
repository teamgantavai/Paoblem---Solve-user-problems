import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin } from '@/lib/adminAuth';
import IORedis from 'ioredis';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    // 1. Measure DB health & latency
    const startDb = Date.now();
    let dbStatus = 'healthy';
    let dbMessage = 'Connected successfully';
    let dbLatencyMs = 0;
    
    try {
      const { data, error } = await supabaseAdmin.from('profiles').select('id').limit(1);
      dbLatencyMs = Date.now() - startDb;
      if (error) {
        dbStatus = 'degraded';
        dbMessage = error.message;
      }
    } catch (err: any) {
      dbStatus = 'unhealthy';
      dbMessage = err.message;
      dbLatencyMs = Date.now() - startDb;
    }

    // 2. Check Cache Status (Redis)
    let cacheStatus = 'disconnected';
    let cacheLatencyMs = 0;
    let cacheMessage = 'Redis URL not configured';
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      const startRedis = Date.now();
      try {
        const redis = new IORedis(redisUrl, {
          connectTimeout: 1000,
          maxRetriesPerRequest: 0,
        });
        const pong = await redis.ping();
        cacheLatencyMs = Date.now() - startRedis;
        if (pong === 'PONG') {
          cacheStatus = 'healthy';
          cacheMessage = 'Redis is online';
        } else {
          cacheStatus = 'degraded';
          cacheMessage = `Unexpected ping response: ${pong}`;
        }
        await redis.quit();
      } catch (err: any) {
        cacheStatus = 'unhealthy';
        cacheMessage = err.message || 'Connection failed';
        cacheLatencyMs = Date.now() - startRedis;
      }
    }

    // 3. Background Jobs stats (Mock queue sizes if Redis offline)
    let pendingJobs = 0;
    let failedJobs = 0;
    if (cacheStatus === 'healthy' && redisUrl) {
      try {
        const redis = new IORedis(redisUrl);
        // BullMQ structures queues as redis hashes/lists: bull:notifications:wait, etc.
        pendingJobs = await redis.llen('bull:notifications:wait');
        const failedIds = await redis.smembers('bull:notifications:failed');
        failedJobs = failedIds?.length || 0;
        await redis.quit();
      } catch {
        // Fallback to 0 if queue parsing fails
      }
    }

    // 4. Audit Logs (Handle missing table case gracefully)
    let auditLogs: any[] = [];
    let auditTotal = 0;
    let migrationsRequired = false;

    try {
      const { data, count, error: auditErr } = await supabaseAdmin
        .from('admin_audit_logs')
        .select('*, profiles:profiles!admin_audit_logs_admin_id_fkey(full_name, username, avatar_url)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (auditErr) {
        if (auditErr.message.includes('relation "public.admin_audit_logs" does not exist')) {
          migrationsRequired = true;
        } else {
          throw auditErr;
        }
      } else {
        auditLogs = data || [];
        auditTotal = count || 0;
      }
    } catch {
      migrationsRequired = true;
    }

    // 5. System Error Logs (Aggregated from audit logs with failure actions)
    let systemErrorLogs: any[] = [];
    if (!migrationsRequired) {
      try {
        const { data: errors } = await supabaseAdmin
          .from('admin_audit_logs')
          .select('*')
          .ilike('action', '%fail%')
          .order('created_at', { ascending: false })
          .limit(10);
        systemErrorLogs = errors || [];
      } catch {
        // Suppress
      }
    }

    return NextResponse.json({
      health: {
        database: {
          status: dbStatus,
          latency: dbLatencyMs,
          message: dbMessage,
        },
        cache: {
          status: cacheStatus,
          latency: cacheLatencyMs,
          message: cacheMessage,
        },
        backgroundJobs: {
          pending: pendingJobs,
          failed: failedJobs,
        },
        storage: {
          bucketName: 'post-images',
          status: 'healthy',
          provider: 'supabase-storage',
        },
      },
      auditLogs,
      auditTotal,
      systemErrorLogs,
      migrationsRequired,
      page,
      totalPages: Math.ceil(auditTotal / limit),
    });
  } catch (err: any) {
    console.error('[Admin Performance API] GET Error:', err);
    return NextResponse.json({ error: err.message || 'Access Denied' }, { status: 403 });
  }
}
