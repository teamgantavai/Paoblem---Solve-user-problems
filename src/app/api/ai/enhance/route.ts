import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const charCount = text.trim().length;
    if (charCount < 15) {
      return NextResponse.json(
        { error: 'Text must contain at least 15 characters for enhancement' },
        { status: 400 }
      );
    }

    // If GROQ API key is available, use real AI enhancement
    if (GROQ_API_KEY) {
      try {
        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama3-8b-8192',
            messages: [
              {
                role: 'system',
                content: `You are an expert writing assistant that enhances problem and idea descriptions posted on a community platform called Paoblem. 
Your task is to improve the clarity, structure, and impact of the text while preserving the original meaning and voice.

Rules:
- Fix grammar, spelling, and punctuation errors
- Improve sentence structure and flow
- Make the text clearer and more compelling
- Keep the same language as the original
- Preserve the core message and all key details
- Don't add information that wasn't implied in the original
- Keep a similar length (don't pad unnecessarily)
- Return ONLY the enhanced text, no explanations or meta-commentary`,
              },
              {
                role: 'user',
                content: text,
              },
            ],
            temperature: 0.5,
            max_tokens: 1024,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const enhanced = data.choices?.[0]?.message?.content?.trim();
          if (enhanced) {
            return NextResponse.json({ original: text, enhanced });
          }
        }
        // Fall through to local enhancement if GROQ fails
      } catch (groqError) {
        console.error('[ai/enhance] GROQ API error, falling back to local:', groqError);
      }
    }

    // Fallback: local rule-based enhancement
    const enhanced = enhanceTextLocally(text);
    return NextResponse.json({ original: text, enhanced });
  } catch (err) {
    console.error('[ai/enhance] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function enhanceTextLocally(text: string): string {
  let result = text.trim();

  // Fix multiple spaces
  result = result.replace(/\s{2,}/g, ' ');

  // Capitalize first letter of sentences
  result = result.replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix, letter) => {
    return prefix + letter.toUpperCase();
  });

  // Fix missing periods at end
  if (!/[.!?]$/.test(result)) {
    result += '.';
  }

  // Fix double punctuation
  result = result.replace(/([.!?]){2,}/g, '$1');

  // Smart paragraph breaks
  const sentences = result.match(/[^.!?]+[.!?]+/g) || [result];
  const paragraphs: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length > 300 && current.length > 0) {
      paragraphs.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) paragraphs.push(current.trim());
  result = paragraphs.join('\n\n');

  // Fix common typos
  const typoMap: Record<string, string> = {
    'teh': 'the', 'recieve': 'receive', 'occured': 'occurred',
    'definately': 'definitely', 'seperate': 'separate',
    'neccessary': 'necessary', 'thier': 'their', 'untill': 'until',
    'wierd': 'weird', 'beleive': 'believe', 'acheive': 'achieve',
  };

  for (const [wrong, right] of Object.entries(typoMap)) {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    result = result.replace(regex, right);
  }

  return result;
}
