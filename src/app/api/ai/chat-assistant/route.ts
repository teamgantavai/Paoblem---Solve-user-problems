import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const GROQ_FALLBACK_MODELS = [
  GROQ_MODEL,
  'openai/gpt-oss-20b',
  'qwen/qwen3.6-27b',
  'llama-3.1-8b-instant',
].filter((model, index, models) => model && models.indexOf(model) === index);
const cache = new Map<string, { expires: number; value: unknown }>();
const rateLimit = new Map<string, { count: number; reset: number }>();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey);

function jsonFromText(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
}

async function callGroq(prompt: string) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured');

  let lastError = '';
  for (const model of GROQ_FALLBACK_MODELS) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 900,
        response_format: { type: 'json_object' },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || '{}';
    }

    lastError = await res.text();
  }

  throw new Error(lastError || 'Groq request failed');
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const now = Date.now();
    const bucket = rateLimit.get(user.id) || { count: 0, reset: now + 60_000 };
    if (now > bucket.reset) {
      bucket.count = 0;
      bucket.reset = now + 60_000;
    }
    bucket.count += 1;
    rateLimit.set(user.id, bucket);
    if (bucket.count > 30) {
      return NextResponse.json({ error: 'AI rate limit reached. Try again shortly.' }, { status: 429 });
    }

    const { mode, messages = [], draft = '', tone = 'professional', conversationId = 'unknown' } = await req.json();
    const looksLikeUuid = typeof conversationId === 'string' && /^[0-9a-f-]{36}$/i.test(conversationId);
    if (looksLikeUuid) {
      const { data: membership } = await supabaseAdmin
        .from('conversation_participants')
        .select('conversation_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!membership) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const compactMessages = messages
      .slice(-40)
      .map((m: any) => `${m.sender_name || 'User'}: ${(m.body || '').slice(0, 500)}`)
      .join('\n');
    const cacheKey = JSON.stringify({ mode, conversationId, draft, tone, tail: compactMessages.slice(-2500) });
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > now) {
      return NextResponse.json(cached.value);
    }

    if (mode === 'summary' && looksLikeUuid) {
      const messageCount = Array.isArray(messages) ? messages.length : 0;
      const lastMessageId = [...messages].reverse().find((message: any) => message.id)?.id || null;
      const { data: cachedSummary } = await supabaseAdmin
        .from('chat_ai_summaries')
        .select('summary, message_count, last_message_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (
        cachedSummary?.summary &&
        cachedSummary.last_message_id === lastMessageId &&
        Math.abs((cachedSummary.message_count || 0) - messageCount) < 8
      ) {
        return NextResponse.json(cachedSummary.summary);
      }
    }

    const prompts: Record<string, string> = {
      summary: `Return JSON with keys summary, keyPoints, actionItems, decisions. Summarize this chat in 1-2 short paragraphs and extract useful bullets.\n\n${compactMessages}`,
      suggestions: `Return JSON with key suggestions as exactly 3 short natural reply suggestions for the latest chat context. No markdown.\n\n${compactMessages}`,
      prediction: `Return JSON with key prediction as one likely next reply. Keep it under 18 words. Never send it automatically.\n\n${compactMessages}`,
      rewrite: `Return JSON with keys professional, friendly, formal, shorter. Rewrite this draft in each requested tone, preserving meaning:\n"${draft}"`,
    };

    const prompt = prompts[mode];
    if (!prompt) {
      return NextResponse.json({ error: 'Invalid AI mode' }, { status: 400 });
    }

    const text = await callGroq(prompt);
    const value = jsonFromText(text);
    cache.set(cacheKey, { value, expires: now + (mode === 'summary' ? 10 * 60_000 : 45_000) });
    if (mode === 'summary' && looksLikeUuid) {
      const messageCount = Array.isArray(messages) ? messages.length : 0;
      const lastMessageId = [...messages].reverse().find((message: any) => message.id)?.id || null;
      await supabaseAdmin
        .from('chat_ai_summaries')
        .upsert({
          conversation_id: conversationId,
          user_id: user.id,
          last_message_id: lastMessageId,
          message_count: messageCount,
          summary: value,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'conversation_id,user_id' });
    }
    return NextResponse.json(value);
  } catch (err: any) {
    console.error('[POST /api/ai/chat-assistant]', err);
    return NextResponse.json({ error: 'AI assistant unavailable' }, { status: 503 });
  }
}
