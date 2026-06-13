import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let mockMessages = [
  {
    id: 'm-1',
    sender_id: 'user-figma',
    sender_name: 'Dylan Field',
    sender_avatar: 'https://i.pravatar.cc/150?u=dylan2',
    body: 'Hey! I saw your post about designing tools. Let\'s schedule a call next Tuesday to chat about it.',
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString() // 25m ago
  },
  {
    id: 'm-2',
    sender_id: 'user-linkedin',
    sender_name: 'Ryan Roslansky',
    sender_avatar: 'https://i.pravatar.cc/150?u=ryan2',
    body: 'Would you be open to introducing me to your co-founder? We are looking for talented leaders.',
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2.5).toISOString() // 2.5h ago
  },
  {
    id: 'm-3',
    sender_id: 'user-3',
    sender_name: 'Sarah Chen',
    sender_avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=sarah',
    body: 'Yes, I fully agree with your perspective on standard database scaling. Let me know when you release the code.',
    read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() // 1 day ago
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

    return NextResponse.json({ messages: mockMessages });
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
    mockMessages = mockMessages.map(m => {
      if (m.id === id) {
        return { ...m, read: !!read };
      }
      return m;
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
