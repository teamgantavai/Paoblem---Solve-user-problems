import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeader, getAdminClient } from '@/lib/auth-fast';

const db = getAdminClient();

/**
 * GET /api/notifications/count
 * Returns only the unread count — used by the Navbar badge.
 * Extremely fast: JWT decoded locally, single COUNT query.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = getUserIdFromHeader(req.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ count: 0 });
    }

    const { count, error } = await db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;

    return NextResponse.json(
      { count: count ?? 0 },
      { headers: { 'Cache-Control': 'private, max-age=0, stale-while-revalidate=30' } }
    );
  } catch (err) {
    console.error('[GET /api/notifications/count]', err);
    return NextResponse.json({ count: 0 });
  }
}
