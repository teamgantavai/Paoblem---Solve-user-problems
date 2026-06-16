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
        model: 'mixtral-8x7b-32768',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 250
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Groq API error:', errText);
      return NextResponse.json({ original: text, enhanced: text });
    }

    const data = await res.json();
    const enhanced = data.choices?.[0]?.message?.content?.trim() || text;

    return NextResponse.json({ original: text, enhanced });
  } catch (err: any) {
    console.error('[POST /api/ai/enhance]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
