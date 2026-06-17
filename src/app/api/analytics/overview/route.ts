import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/analytics-server';
import { fetchAnalyticsGrid } from '@/lib/analytics-simple';

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

    const data = await fetchAnalyticsGrid(auth.supabase, auth.user.id);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      totals: { views: 0, votes: 0, comments: 0, followsGained: 0 },
      posts: [],
      isDemo: false,
    });
  }
}
