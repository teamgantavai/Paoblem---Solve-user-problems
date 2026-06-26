import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/auth-fast';

const db = getAdminClient();

export async function GET(req: NextRequest) {
  try {
    // Attempt to insert a post of type 'startup'
    const { data, error } = await db
      .from('posts')
      .insert({
        user_id: '9bfdbde9-1524-45f6-a855-92bedc9df9dc', // Trilok's user id (from notifications)
        title: 'Test Startup Post',
        body: 'Test Body',
        type: 'startup',
      })
      .select();

    if (error) {
      return NextResponse.json({ success: false, error: error.message, details: error.details, hint: error.hint });
    }
    
    // Clean up if it succeeded
    if (data && data.length > 0) {
      await db.from('posts').delete().eq('id', data[0].id);
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
