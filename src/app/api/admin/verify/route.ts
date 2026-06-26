import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    return NextResponse.json({ success: true, user: admin });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Access Denied' }, { status: 403 });
  }
}
