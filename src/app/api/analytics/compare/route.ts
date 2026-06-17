import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, fetchCompareAnalytics } from '@/lib/analytics-server';
import type { DateRange } from '@/lib/analytics-demo';
import { generateDemoCompareResponse } from '@/lib/analytics-demo';

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

    const { searchParams } = req.nextUrl;
    const postsParam = searchParams.get('posts');
    const range = (searchParams.get('range') || '30d') as DateRange;

    if (!postsParam) {
      return NextResponse.json({ error: 'posts parameter is required' }, { status: 400 });
    }

    const postIds = postsParam.split(',').map(s => s.trim()).filter(Boolean);
    if (postIds.length < 2) {
      return NextResponse.json({ error: 'At least 2 posts required for comparison' }, { status: 400 });
    }

    const data = await fetchCompareAnalytics(auth.supabase, auth.user.id, postIds, range);
    return NextResponse.json(data);
  } catch {
    const postsParam = req.nextUrl.searchParams.get('posts') || 'demo-1,demo-2';
    const range = (req.nextUrl.searchParams.get('range') || '30d') as DateRange;
    const postIds = postsParam.split(',').map(s => s.trim()).filter(Boolean);
    return NextResponse.json(generateDemoCompareResponse(postIds, range));
  }
}
