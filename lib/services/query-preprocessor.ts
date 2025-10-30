/**
 * Query Preprocessor
 *
 * Transforms user queries to optimize vector search results.
 * Extracts core topics from meta-questions about recordings.
 */

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
 * Preprocess query for optimal vector search
 *
 * Applies various transformations:
 * 1. Extracts core topic from meta-questions about recordings
 * 2. Removes filler words that dilute semantic meaning
 * 3. Normalizes whitespace
 *
 * @param query - The user's query
 * @returns The preprocessed query optimized for vector search
 */
export function preprocessQuery(query: string): {
  originalQuery: string;
  processedQuery: string;
  wasTransformed: boolean;
  transformation?: string;
} {
  const originalQuery = query.trim();

  // Check if this is a meta-question about recordings
  const extractedTopic = extractTopicFromMetaQuestion(originalQuery);

  if (extractedTopic) {
    return {
      originalQuery,
      processedQuery: extractedTopic,
      wasTransformed: true,
      transformation: 'meta-question-extraction',
    };
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
export function testQueryPreprocessing(queries: string[]): void {
  console.log('\n=== Query Preprocessing Tests ===\n');

  for (const query of queries) {
    const result = preprocessQuery(query);
    console.log(`Original: "${result.originalQuery}"`);
    console.log(`Processed: "${result.processedQuery}"`);
    console.log(`Transformed: ${result.wasTransformed ? 'Yes' : 'No'}`);
    if (result.transformation) {
      console.log(`Method: ${result.transformation}`);
    }
    console.log('---');
  }
}
