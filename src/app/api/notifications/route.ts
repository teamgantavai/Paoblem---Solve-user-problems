import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeader, getAdminClient } from '@/lib/auth-fast';

const db = getAdminClient();

/* Columns that are guaranteed to exist in the notifications table.
   Using explicit names avoids fetching large/unknown columns and prevents
   crashes if optional columns (post_image, grouped_actors, etc.) don't exist. */
const SAFE_COLUMNS = 'id,user_id,type,title,body,read,created_at,post_id';

function parseActorUsername(body: string): string | null {
  const m = (body || '').match(/^@([a-zA-Z0-9_]+)/);
  return m ? m[1] : null;
}

// ─── GET /api/notifications ───────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    // ① Zero-latency auth: decode JWT locally, no Supabase network call
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url    = new URL(req.url);
    const cursor = url.searchParams.get('cursor');
    const limit  = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);

    // ② Notifications query (explicit safe columns)
    let q = db
      .from('notifications')
      .select(SAFE_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (cursor) q = q.lt('created_at', cursor);

    // ③ Batch-fetch actor profiles — single IN query, runs after notifications
    const { data: notifications, error } = await q;
    if (error) throw error;

    const items   = notifications || [];
    const hasMore = items.length > limit;
    const page    = hasMore ? items.slice(0, limit) : items;

    // ④ Collect unique actor usernames, then fetch profiles in one query
    const usernames = [...new Set(
      page.map((n: any) => parseActorUsername(n.body)).filter(Boolean)
    )] as string[];

    let profileMap: Record<string, { id: string; username: string | null; full_name: string | null; avatar_url: string | null }> = {};
    if (usernames.length > 0) {
      const { data: profiles } = await db
        .from('profiles')
        .select('id,username,full_name,avatar_url')
        .in('username', usernames);
      profiles?.forEach((p: any) => {
        if (p.username) profileMap[p.username] = p;
      });
    }

    // ⑤ Enrich
    const enriched = page.map((n: any) => {
      const username = parseActorUsername(n.body);
      const profile  = username ? profileMap[username] : null;

      // Extract the actual comment/reply text from body
      let commentPreview: string | null = null;
      if (['comment', 'reply'].includes(n.type)) {
        let rest = (n.body || '').replace(/^@[a-zA-Z0-9_]+\s*/i, '').trim();
        rest = rest.replace(/^(?:commented|replied|said|mentioned you)[:\s]+/i, '').trim();
        rest = rest.replace(/^["'""]|["'""]$/g, '').trim();
        commentPreview = rest || null;
      }

      return {
        ...n,
        actor_id:        profile?.id ?? null,
        actor_username:  username,
        actor_name:      profile?.full_name || username,
        actor_avatar:    profile?.avatar_url ?? null,
        comment_preview: commentPreview,
      };
    });

    const nextCursor = hasMore ? page[page.length - 1]?.created_at ?? null : null;

    return NextResponse.json(
      { notifications: enriched, nextCursor, hasMore },
      {
        headers: {
          // Browser may serve stale response instantly while revalidating
          'Cache-Control': 'private, max-age=0, stale-while-revalidate=180',
        },
      }
    );
  } catch (err: any) {
    console.error('[GET /api/notifications]', err?.message ?? err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PUT /api/notifications ───────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    if (url.searchParams.get('markAllRead') === 'true') {
      await db.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
      return NextResponse.json({ success: true });
    }

    const { id, read } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await db
      .from('notifications')
      .update({ read: !!read })
      .eq('id', id)
      .eq('user_id', userId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[PUT /api/notifications]', err?.message ?? err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/notifications ────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const id  = url.searchParams.get('id');

    if (id) {
      await db.from('notifications').delete().eq('id', id).eq('user_id', userId);
    } else {
      await db.from('notifications').delete().eq('user_id', userId);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /api/notifications]', err?.message ?? err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
