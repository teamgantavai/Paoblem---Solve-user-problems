import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type');

    if (!userId || !type) {
      return new NextResponse('Missing parameters', { status: 400 });
    }

    // Determine target column
    let column = '';
    let categoryName = '';
    if (type === 'saves') {
      column = 'pref_receive_saves';
      categoryName = 'Someone saves my post';
    } else if (type === 'analytics') {
      column = 'pref_receive_analytics';
      categoryName = 'Post analytics digest';
    } else if (type === 'solutions') {
      column = 'pref_receive_solutions';
      categoryName = 'Someone is solving my problem';
    } else if (type === 'replies') {
      column = 'pref_receive_replies';
      categoryName = 'Replies to my comments';
    } else {
      return new NextResponse('Invalid unsubscribe type', { status: 400 });
    }

    // Update profiles table settings
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ [column]: false })
      .eq('id', userId);

    if (error) {
      console.error('[Unsubscribe API] DB Error:', error);
      return new NextResponse('Failed to process unsubscribe request', { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed from Paoblem</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #0d0e12;
      color: #e4e4e7;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .card {
      background-color: #15171e;
      border: 1px solid #272a34;
      border-radius: 20px;
      padding: 44px 32px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4);
    }
    .icon {
      font-size: 52px;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      margin-top: 0;
      margin-bottom: 12px;
      letter-spacing: -0.02em;
    }
    p {
      font-size: 14.5px;
      color: #a1a1aa;
      line-height: 1.6;
      margin-top: 0;
      margin-bottom: 32px;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      color: #ffffff;
      text-decoration: none;
      padding: 12px 30px;
      font-weight: 600;
      font-size: 14.5px;
      border-radius: 10px;
      box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
      transition: all 0.2s;
    }
    .btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔕</div>
    <h1>Successfully Unsubscribed</h1>
    <p>You have been unsubscribed from <strong>"${categoryName}"</strong> notifications. You can change your notification settings at any time in your profile dashboard.</p>
    <a href="${appUrl}" class="btn">Go to Paoblem</a>
  </div>
</body>
</html>
    `;

    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (err: any) {
    console.error('[Unsubscribe API] Catch Error:', err);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
