export interface ProfileAiInput {
  full_name: string | null;
  headline: string | null;
  bio: string | null;
  about: string | null;
  skills: string[];
  looking_for: string[];
  preferred_roles: string[];
  availability: string | null;
  work_preference: string | null;
  interests: string[];
  experience: any[];
  projects: any[];
}

export interface ProfileAiOutput {
  ai_summary: string;
  ai_keywords: string[];
  ai_embedding: number[];
  last_ai_update: string;
}

/**
 * Calls Groq API to generate an AI Summary and AI Keywords based on user profile.
 */
export async function generateProfileSummary(input: ProfileAiInput): Promise<{ ai_summary: string; ai_keywords: string[] }> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    console.warn('GROQ_API_KEY is not configured. Falling back to default summary.');
    return {
      ai_summary: `This is a placeholder profile summary. Please configure GROQ_API_KEY to automatically generate a rich professional AI summary summarizing the background, skills, and startup interests of ${input.full_name || 'this user'}.`,
      ai_keywords: [...(input.skills || []), ...(input.preferred_roles || [])].slice(0, 8),
    };
  }

  const prompt = `Analyze the following user profile data on our startup founder/innovator platform:
- Name: ${input.full_name || 'Member'}
- Headline: ${input.headline || ''}
- Bio: ${input.bio || ''}
- About: ${input.about || ''}
- Skills: ${input.skills?.join(', ') || 'None'}
- Startup Interests:
  * Looking For: ${input.looking_for?.join(', ') || 'None'}
  * Preferred Roles: ${input.preferred_roles?.join(', ') || 'None'}
  * Availability: ${input.availability || 'Not Specified'}
  * Work Preference: ${input.work_preference || 'Not Specified'}
- Interests: ${input.interests?.join(', ') || 'None'}
- Experience: ${JSON.stringify(input.experience || [])}
- Projects: ${JSON.stringify(input.projects || [])}

Generate:
1. An AI Summary describing the user background, skills, startup interests, technical abilities, industries, experience, collaboration preference, leadership, and availability. The summary MUST be between 150 and 300 words.
2. A list of 5 to 15 relevant AI Keywords (e.g. "Founder", "AI", "React", "Next.js", "Product Design", "Education", "Startup", "Machine Learning", "Remote", "Full Stack").

Format your response EXACTLY as a JSON object with keys "ai_summary" (string) and "ai_keywords" (array of strings). Do not include markdown code block formatting (like \`\`\`json) or any conversational text around it, just raw JSON.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant specialized in analyzing professional portfolios and startup founder profiles. Output only raw JSON with "ai_summary" and "ai_keywords" keys. Do not output any explanations or markdown wrapping.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      throw new Error(`Groq API returned status ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('Empty response from Groq API');

    const result = JSON.parse(content);
    return {
      ai_summary: result.ai_summary || '',
      ai_keywords: Array.isArray(result.ai_keywords) ? result.ai_keywords : [],
    };
  } catch (err) {
    console.error('Error generating profile AI summary:', err);
    // Graceful fallback
    return {
      ai_summary: `AI Summary generation failed due to service error. ${input.full_name || 'The user'} is building with skills: ${input.skills?.join(', ') || 'various technologies'} and looking for ${input.looking_for?.join(', ') || 'opportunities'}.`,
      ai_keywords: [...new Set([...(input.skills || []), ...(input.preferred_roles || []), 'Innovator'])].slice(0, 10),
    };
  }
}

/**
 * Generates a 1536-dimensional embedding vector for semantic search.
 * Uses OpenAI if OPENAI_API_KEY is available, else falls back to a deterministic normalized unit vector.
 */
export async function generateProfileEmbedding(
  input: ProfileAiInput,
  aiSummary: string
): Promise<number[]> {
  const textToEmbed = [
    input.bio || '',
    input.about || '',
    input.skills?.join(', ') || '',
    JSON.stringify(input.experience || []),
    JSON.stringify(input.projects || []),
    `Looking for: ${input.looking_for?.join(', ') || ''}. Preferred roles: ${input.preferred_roles?.join(', ') || ''}. Availability: ${input.availability || ''}. Work preference: ${input.work_preference || ''}`,
    aiSummary || '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const openAIKey = process.env.OPENAI_API_KEY;
  if (openAIKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAIKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: textToEmbed,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const embedding = data.data?.[0]?.embedding;
        if (Array.isArray(embedding) && embedding.length === 1536) {
          return embedding;
        }
      }
      console.warn('OpenAI Embeddings API returned error:', await response.text());
    } catch (e) {
      console.error('Error calling OpenAI Embeddings API:', e);
    }
  }

  // Fallback: Deterministic mock embedding generator (1536 float values normalized)
  const vector: number[] = new Array(1536).fill(0);
  let hash1 = 5381;
  let hash2 = 89;
  for (let i = 0; i < textToEmbed.length; i++) {
    const char = textToEmbed.charCodeAt(i);
    hash1 = (hash1 * 33) ^ char;
    hash2 = (hash2 * 17) ^ char;
  }

  for (let i = 0; i < 1536; i++) {
    const val = Math.sin((hash1 + i) * 12.9898 + (hash2 - i) * 78.233) * 43758.5453;
    vector[i] = val - Math.floor(val);
  }

  // Normalize vector to unit length
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? vector.map((val) => val / magnitude) : vector;
}

/**
 * Coordinates summary, keyword, and embedding generation for a user profile update.
 */
export async function processProfileAi(input: ProfileAiInput): Promise<ProfileAiOutput> {
  const { ai_summary, ai_keywords } = await generateProfileSummary(input);
  const ai_embedding = await generateProfileEmbedding(input, ai_summary);
  return {
    ai_summary,
    ai_keywords,
    ai_embedding,
    last_ai_update: new Date().toISOString(),
  };
}
