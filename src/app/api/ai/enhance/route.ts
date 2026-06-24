import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { text, tone = 'professional' } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ 
        original: text, 
        enhanced: `${text} (AI Enhance: GROQ_API_KEY not configured)` 
      });
    }

    const prompt = `You are a professional communication assistant on an innovation platform. 
Enhance the following text to make it sound more ${tone}, polite, and polished. Keep it concise and natural:
"${text}"
Output only the enhanced text itself, with no quotation marks or introductory phrases.`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You are an AI description enhancer and grammar fixer. Your goal is to improve the readability, grammar, spelling, and professionalism of the user\'s input description while preserving its original meaning and core message. Output ONLY the enhanced description text itself, with no quotation marks, introductory phrases, or explanations.'
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.7,
        max_tokens: 400
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Groq API error:', errText);
      try {
        const parsed = JSON.parse(errText);
        return NextResponse.json({ error: parsed.error?.message || 'Groq API request failed' }, { status: res.status });
      } catch {
        return NextResponse.json({ error: `Groq API returned status ${res.status}` }, { status: res.status });
      }
    }

    const data = await res.json();
    const enhanced = data.choices?.[0]?.message?.content?.trim() || text;

    return NextResponse.json({ original: text, enhanced });
  } catch (err: any) {
    console.error('[POST /api/ai/enhance]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
