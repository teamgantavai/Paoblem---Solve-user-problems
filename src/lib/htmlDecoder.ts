/**
 * Safely decodes HTML entities commonly inserted by backend sanitization.
 * Supports legacy posts that store entities like &#x27; or &quot; in the database.
 */
export function decodeHTMLEntities(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#39;/g, "'"); // Just in case a standard single quote is used
}
