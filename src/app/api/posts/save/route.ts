import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { enqueueNotification } from '@/lib/queue';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { postId } = await req.json();
    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch post owner
    const { data: post, error: postErr } = await admin
      .from('posts')
      .select('id, user_id, title')
      .eq('id', postId)
      .single();

    if (postErr || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // 2. Check if already saved
    const { data: existingSave } = await admin
      .from('post_saves')
      .select('id')
      .eq('user_id', user.id)
      .eq('post_id', postId)
      .maybeSingle();

    let saved = false;

    if (existingSave) {
      // Unsave
      const { error: deleteErr } = await admin
        .from('post_saves')
        .delete()
        .eq('id', existingSave.id);
      if (deleteErr) throw deleteErr;
      saved = false;
    } else {
      // Save
      const { error: insertErr } = await admin
        .from('post_saves')
        .insert({
          user_id: user.id,
          post_id: postId,
        });
      if (insertErr) throw insertErr;
      saved = true;

      // Trigger notification to the post owner if it's not their own post
      if (post.user_id !== user.id) {
        try {
          await enqueueNotification('save', {
            user_id: post.user_id,
            actor_id: user.id,
            type: 'system', // we will handle 'save' in worker or maps to system/saves icon
            title: 'Post Bookmarked',
            bodyTemplate: `{name} found your problem valuable and saved it.`,
            post_id: postId,
          });
        } catch (notifErr) {
          console.error('[Save Post API] Notification enqueue error:', notifErr);
        }
      }
    }

    // 3. Fetch latest saves count on the post
    const { data: updatedPost } = await admin
      .from('posts')
      .select('saves')
      .eq('id', postId)
      .single();

    const savesCount = updatedPost?.saves || 0;

    return NextResponse.json({
      success: true,
      saved,
      savesCount,
    });
  } catch (err: any) {
    console.error('[Save Post API] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await admin.auth.getUser(token);
      userId = user?.id || null;
    }

    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      if (userId) {
        const { data, error } = await admin
          .from('post_saves')
          .select('post_id')
          .eq('user_id', userId);
        if (error) throw error;
        return NextResponse.json({
          savedIds: data?.map((d: any) => d.post_id) || [],
        });
      }
      return NextResponse.json({ savedIds: [] });
    }

    let isSaved = false;
    if (userId) {
      const { data } = await admin
        .from('post_saves')
        .select('id')
        .eq('user_id', userId)
        .eq('post_id', postId)
        .maybeSingle();
      isSaved = !!data;
    }

    const { data: post } = await admin
      .from('posts')
      .select('saves')
      .eq('id', postId)
      .single();

    return NextResponse.json({
      saved: isSaved,
      savesCount: post?.saves || 0,
    });
  } catch (err: any) {
    console.error('[Save Post API] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
