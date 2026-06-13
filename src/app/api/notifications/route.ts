import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Stateful in-memory store for mock notifications (persists during dev server lifecycle)
let mockNotifications = [
  {
    id: 'n-1',
    user_id: '',
    type: 'upvote' as const,
    title: 'New Upvote on your Problem',
    body: 'Your problem "Why designing Sucks!!!" was upvoted by Dylan Field.',
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(), // 12m ago
    post_id: null
  },
  {
    id: 'n-2',
    user_id: '',
    type: 'comment' as const,
    title: 'New Comment',
    body: 'Ryan Roslansky left a comment: "This is a key issue we are actively looking into resolver solutions for."',
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45m ago
    post_id: null
  },
  {
    id: 'n-3',
    user_id: '',
    type: 'system' as const,
    title: 'Welcome to Paoblem!',
    body: 'Verify your email profile details to complete your startup registration checklist.',
    read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4h ago
    post_id: null
  }
];

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Adapt user-specific IDs in the mock
    const notifications = mockNotifications.map(n => ({
      ...n,
      user_id: user.id
    }));

    return NextResponse.json({ notifications });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { id, read } = await req.json();
    mockNotifications = mockNotifications.map(n => {
      if (n.id === id) {
        return { ...n, read: !!read };
      }
      return n;
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
