import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ 
        summary: 'Supabase/Groq API key not configured for AI Summarizer.',
        actionItems: []
      });
    }

    const chatText = messages
      .map((m: any) => `${m.sender_name || 'User'}: ${m.body || m.content || ''}`)
      .join('\n');

    const prompt = `Analyze the following chat conversation on our startup founder/innovator platform:
"""
${chatText}
"""

Provide:
1. A brief summary (max 3 sentences) of the discussion.
2. A list of concrete action items/tasks extracted from the chat.

Format your response EXACTLY as a JSON object with keys "summary" (string) and "actionItems" (array of strings). Do not include markdown code block formatting (like \`\`\`json) or any conversational text around it, just raw JSON.`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Groq API error:', errText);
      return NextResponse.json({ 
        summary: 'Failed to generate summary due to model error.', 
        actionItems: [] 
      });
    }

    const data = await res.json();
    const resultText = data.choices?.[0]?.message?.content?.trim();
    
    try {
      const jsonRes = JSON.parse(resultText);
      return NextResponse.json(jsonRes);
    } catch (parseErr) {
      console.error('Error parsing Groq JSON output:', resultText, parseErr);
      return NextResponse.json({ 
        summary: resultText || 'Failed to parse summary.', 
        actionItems: [] 
      });
    }
  } catch (err: any) {
    console.error('[POST /api/ai/summarize]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
