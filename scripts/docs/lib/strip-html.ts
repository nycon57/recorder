/**
 * strip-html.ts
 *
 * Convert compiled HTML to plain text for the search index.
 * Removes all tags and decodes common HTML entities.
 * Input is already sanitized (rehype-sanitize ran at compile time).
 */

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&#x2F;': '/',
  '&#x60;': '`',
  '&#x3D;': '=',
};

/**
 * Strip HTML tags and decode entities, returning plain text.
 * Multiple whitespace sequences are collapsed to a single space.
 */
export function stripHtml(html: string): string {
  return html
    // Remove script/style blocks entirely
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    // Remove all tags
    .replace(/<[^>]+>/g, ' ')
    // Decode named entities
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITY_MAP[entity] ?? ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
