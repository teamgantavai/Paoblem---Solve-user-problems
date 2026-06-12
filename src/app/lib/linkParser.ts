/**
 * Parses a text string and splits it into segments of plain text and URLs.
 * URLs found inline in the text will be detected and returned as link segments.
 * Handles URLs with or without protocol (e.g., https://example.com, www.example.com, example.com/path).
 */

export interface TextSegment {
  type: 'text';
  content: string;
}

export interface LinkSegment {
  type: 'link';
  url: string;       // The full, navigable URL (with https:// prefix)
  display: string;   // The original text as typed by the user
}

export type Segment = TextSegment | LinkSegment;

// Regex that matches:
// 1. Full URLs with protocol: https://..., http://...
// 2. URLs starting with www. (no protocol)
// 3. Domain-like patterns: word.tld/path (common TLDs only, to avoid false positives)
const URL_REGEX = /(?:https?:\/\/[^\s<>]+|www\.[^\s<>]+)/gi;

/**
 * Ensures a URL has a protocol prefix.
 * If it starts with www. or has no protocol, prepends https://
 */
function ensureProtocol(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `https://${url}`;
}

/**
 * Cleans trailing punctuation that was likely not part of the URL
 * e.g., "Check https://example.com." -> the trailing "." is not part of the URL
 */
function cleanTrailingPunctuation(url: string): { cleaned: string; trailing: string } {
  // Match trailing punctuation that's likely not part of URL
  const trailingMatch = url.match(/([.,;:!?)]+)$/);
  if (trailingMatch) {
    // But don't strip if it looks like a valid URL path character
    // Check for balanced parentheses
    const openParens = (url.match(/\(/g) || []).length;
    const closeParens = (url.match(/\)/g) || []).length;
    
    if (trailingMatch[1] === ')' && openParens >= closeParens) {
      return { cleaned: url, trailing: '' };
    }
    
    return {
      cleaned: url.slice(0, -trailingMatch[1].length),
      trailing: trailingMatch[1]
    };
  }
  return { cleaned: url, trailing: '' };
}

/**
 * Parses body text into an array of text and link segments.
 */
export function parseLinksInText(text: string): Segment[] {
  if (!text) return [];

  const segments: Segment[] = [];
  let lastIndex = 0;

  // Reset regex state
  URL_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = URL_REGEX.exec(text)) !== null) {
    const matchStart = match.index;
    let rawUrl = match[0];

    // Clean trailing punctuation
    const { cleaned, trailing } = cleanTrailingPunctuation(rawUrl);
    rawUrl = cleaned;

    // Add preceding text segment
    if (matchStart > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, matchStart)
      });
    }

    // Add the link segment
    segments.push({
      type: 'link',
      url: ensureProtocol(rawUrl),
      display: rawUrl
    });

    // Update lastIndex, accounting for any trailing punctuation we stripped
    lastIndex = matchStart + rawUrl.length;
    
    // If we stripped trailing chars, back up the regex so we don't skip them
    if (trailing) {
      URL_REGEX.lastIndex = lastIndex;
    }
  }

  // Add any remaining text after the last match
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }

  return segments;
}
