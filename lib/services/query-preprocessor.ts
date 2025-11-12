/**
 * Query Preprocessor
 *
 * Transforms user queries to optimize vector search results.
 * Extracts core topics from meta-questions about recordings.
 * Expands short queries for better recall.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Patterns for detecting meta-questions about recordings
 * These ask about the existence or availability of recordings rather than their content
 */
const META_QUESTION_PATTERNS = [
  // "Do I have recordings about X?" → "X"
  {
    pattern: /^do (i|you|we) have (any )?recordings? (about|on|regarding|for|of) (.+?)(\?|$)/i,
    topicGroup: 4,
  },
  // "What recordings do I have about X?" → "X"
  {
    pattern: /^what recordings (do (i|you|we) have|are there|exist) (about|on|regarding|for|of) (.+?)(\?|$)/i,
    topicGroup: 4,
  },
  // "Tell me what recordings I have about X" → "X"
  {
    pattern: /^tell me (what|which) recordings (i|you|we) have (about|on|regarding|for|of) (.+?)(\?|$)/i,
    topicGroup: 4,
  },
  // "Show me recordings about X" → "X"
  {
    pattern: /^show me (any |the )?recordings? (about|on|regarding|for|of) (.+?)(\?|$)/i,
    topicGroup: 3,
  },
  // "Search for recordings about X" → "X"
  {
    pattern: /^search (for )?(any |the )?recordings? (about|on|regarding|for|of) (.+?)(\?|$)/i,
    topicGroup: 4,
  },
  // "Find recordings about X" → "X"
  {
    pattern: /^find (me )?(any |the )?recordings? (about|on|regarding|for|of) (.+?)(\?|$)/i,
    topicGroup: 4,
  },
  // "Are there recordings about X?" → "X"
  {
    pattern: /^(are|is) there (any )?recordings? (about|on|regarding|for|of) (.+?)(\?|$)/i,
    topicGroup: 4,
  },
];

/**
 * Extract topic from meta-questions about recordings
 *
 * Examples:
 * - "Do I have recordings about Total Expert?" → "Total Expert"
 * - "What recordings do you have about authentication?" → "authentication"
 * - "Show me recordings about cloud migration" → "cloud migration"
 *
 * @param query - The user's query
 * @returns The extracted topic, or null if not a meta-question
 */
export function extractTopicFromMetaQuestion(query: string): string | null {
  const trimmedQuery = query.trim();

  for (const { pattern, topicGroup } of META_QUESTION_PATTERNS) {
    const match = trimmedQuery.match(pattern);
    if (match && match[topicGroup]) {
      const topic = match[topicGroup].trim();
      // Remove trailing punctuation
      return topic.replace(/[?.!,;:]+$/, '').trim();
    }
  }

  return null;
}

/**
 * Expand short queries using user's library context
 *
 * Example: "accelerate" → "Accelerate Journey Panel marketing automation"
 *
 * @param query - The original search query
 * @param orgId - Organization ID for context
 * @returns Expanded query string
 */
export async function expandShortQuery(
  query: string,
  orgId: string
): Promise<string> {
  const wordCount = query.trim().split(/\s+/).length;

  // Only expand very short queries (1-2 words)
  if (wordCount > 2) {
    return query;
  }

  console.log('[Query Preprocessor] Expanding short query:', query);

  try {
    // Search for recordings with matching titles
    const { data: recordings } = await supabaseAdmin
      .from('recordings')
      .select('title, description')
      .eq('org_id', orgId)
      .ilike('title', `%${query}%`)
      .limit(3);

    if (!recordings || recordings.length === 0) {
      console.log('[Query Preprocessor] No matching recordings found for expansion');
      return query;
    }

    // Extract key terms from matching recordings
    const titleWords = new Set<string>();
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
      'for', 'with', 'to', 'from', 'in', 'of', 'as', 'by', 'that', 'this',
    ]);

    recordings.forEach(r => {
      // Extract meaningful words from titles (skip common words)
      const words = r.title
        .split(/[\s\-_]+/)
        .filter(w => w.length > 3)
        .filter(w => !stopWords.has(w.toLowerCase()));

      words.forEach(w => titleWords.add(w));
    });

    // Limit expansion to avoid too long queries
    const expansionTerms = Array.from(titleWords)
      .slice(0, 5)
      .join(' ');

    const expandedQuery = expansionTerms ? `${query} ${expansionTerms}` : query;

    console.log('[Query Preprocessor] Expanded query:', {
      original: query,
      expanded: expandedQuery,
      addedTerms: expansionTerms,
    });

    return expandedQuery;
  } catch (error) {
    console.error('[Query Preprocessor] Error expanding query:', error);
    return query; // Return original query on error
  }
}

/**
 * Preprocess query for optimal vector search
 *
 * Applies various transformations:
 * 1. Extracts core topic from meta-questions about recordings
 * 2. Expands short queries with context from library
 * 3. Removes filler words that dilute semantic meaning
 * 4. Normalizes whitespace
 *
 * @param query - The user's query
 * @param orgId - Optional organization ID for context-aware expansion
 * @returns The preprocessed query optimized for vector search
 */
export async function preprocessQuery(
  query: string,
  orgId?: string
): Promise<{
  originalQuery: string;
  processedQuery: string;
  wasTransformed: boolean;
  transformation?: string;
}> {
  const originalQuery = query.trim();

  // Check if this is a meta-question about recordings
  const extractedTopic = extractTopicFromMetaQuestion(originalQuery);

  if (extractedTopic) {
    // If we have an orgId and the extracted topic is short, expand it
    let finalQuery = extractedTopic;
    if (orgId) {
      finalQuery = await expandShortQuery(extractedTopic, orgId);
    }

    return {
      originalQuery,
      processedQuery: finalQuery,
      wasTransformed: true,
      transformation: 'meta-question-extraction-and-expansion',
    };
  }

  // For regular queries, check if we should expand short queries
  if (orgId) {
    const expandedQuery = await expandShortQuery(originalQuery, orgId);
    if (expandedQuery !== originalQuery) {
      return {
        originalQuery,
        processedQuery: expandedQuery,
        wasTransformed: true,
        transformation: 'short-query-expansion',
      };
    }
  }

  // No transformation needed
  return {
    originalQuery,
    processedQuery: originalQuery,
    wasTransformed: false,
  };
}

/**
 * Test helper to verify pattern matching
 */
export async function testQueryPreprocessing(queries: string[]): Promise<void> {
  console.log('\n=== Query Preprocessing Tests ===\n');

  for (const query of queries) {
    const result = await preprocessQuery(query);
    console.log(`Original: "${result.originalQuery}"`);
    console.log(`Processed: "${result.processedQuery}"`);
    console.log(`Transformed: ${result.wasTransformed ? 'Yes' : 'No'}`);
    if (result.transformation) {
      console.log(`Method: ${result.transformation}`);
    }
    console.log('---');
  }
}
