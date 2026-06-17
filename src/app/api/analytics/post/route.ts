import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/analytics-server';
import { fetchPostAnalyticsDetail } from '@/lib/analytics-simple';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const auth = await authenticateUser(token);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const postId = req.nextUrl.searchParams.get('postId');
    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 });
    }

    const data = await fetchPostAnalyticsDetail(auth.supabase, postId, auth.user.id);
    if (!data) {
      return NextResponse.json({ error: 'Post not found or access denied' }, { status: 403 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
