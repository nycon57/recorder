/**
 * Concept Search Service
 *
 * Functions for matching search queries against concepts
 * to enable concept-aware search boosting.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ConceptType } from '@/lib/validations/knowledge';

/**
 * Escape SQL LIKE pattern metacharacters (%, _, \) to treat them as literals.
 * Backslash must be escaped first to avoid double-escaping.
 * SECURITY: Prevents LIKE injection attacks (OWASP reference: Input Validation)
 */
function escapeLike(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

export interface MatchingConcept {
  id: string;
  name: string;
  normalizedName: string;
  conceptType: ConceptType;
  mentionCount: number;
  matchScore: number; // 0-1 relevance to query
}

/**
 * Find concepts that match a search query
 * Uses name matching (exact and fuzzy) to find relevant concepts
 *
 * @param query - The search query
 * @param orgId - Organization ID for scoping
 * @param options - Search options
 * @returns Array of matching concepts with scores
 */
export async function findMatchingConcepts(
  query: string,
  orgId: string,
  options: {
    limit?: number;
    minMentions?: number;
    types?: ConceptType[];
  } = {}
): Promise<MatchingConcept[]> {
  const { limit = 10, minMentions = 1, types } = options;

  // Allowlist for common short technical terms (normalized to lowercase)
  const shortTermAllowlist = new Set([
    'ai', 'ui', 'db', 'c#', 'c', 'r', 'go', 'io', 'ml', 'qa', 'ci', 'cd', 'os', 'vm', 'ip', 'id', 'api', 'aws', 'gcp', 'sql', 'css', 'vue', 'jwt', 'ssh', 'ssl', 'tls', 'url', 'uri', 'xml', 'csv', 'pdf', 'svg', 'png', 'gif', 'jpg', 'mp3', 'mp4', 'cli', 'gui', 'sdk', 'ide', 'git', 'svn', 'npm', 'cdn', 'dns', 'ftp', 'udp', 'tcp', 'oop', 'mvc', 'orm', 'dom', 'spa', 'ssr', 'seo', 'crm', 'erp', 'sms', 'pdf', 'ocr', 'nlp', 'llm', 'rag', 'gpu', 'cpu', 'ram', 'ssd', 'hdd', 'usb', 'lan', 'wan', 'vpn', 'aes', 'md5', 'sha', 'rsa', 'pgp', 'jwt', 'b2b', 'b2c', 'roi', 'kpi', 'mvp', 'poc', 'pr',
  ]);

  // Normalize query for matching
  const normalizedQuery = query.toLowerCase().trim();
  const queryWords = normalizedQuery.split(/\s+/).filter(w =>
    w.length > 1 || shortTermAllowlist.has(w.toLowerCase())
  );

  if (queryWords.length === 0) {
    return [];
  }

  // Build query to find matching concepts
  let dbQuery = supabaseAdmin
    .from('knowledge_concepts')
    .select('id, name, normalized_name, concept_type, mention_count')
    .eq('org_id', orgId)
    .gte('mention_count', minMentions)
    .order('mention_count', { ascending: false })
    .limit(limit * 3); // Get more for scoring

  if (types && types.length > 0) {
    dbQuery = dbQuery.in('concept_type', types);
  }

  const { data: concepts, error } = await dbQuery;

  if (error) {
    console.error('[Concept Search] Error finding concepts:', error);
    return [];
  }

  if (!concepts || concepts.length === 0) {
    return [];
  }

  // Score concepts based on name match
  const scoredConcepts = concepts.map((concept: any) => {
    const conceptName = concept.name.toLowerCase();
    const normalizedName = concept.normalized_name.toLowerCase();

    let score = 0;

    // Exact match (highest score)
    if (conceptName === normalizedQuery || normalizedName === normalizedQuery.replace(/\s+/g, '_')) {
      score = 1.0;
    }
    // Query contains concept name
    else if (normalizedQuery.includes(conceptName)) {
      score = 0.9;
    }
    // Concept name contains query
    else if (conceptName.includes(normalizedQuery)) {
      score = 0.8;
    }
    // Word overlap
    else {
      const conceptWords = conceptName.split(/[\s_-]+/);
      const matchingWords = queryWords.filter(qw =>
        conceptWords.some(cw => cw.includes(qw) || qw.includes(cw))
      );
      if (matchingWords.length > 0) {
        score = 0.5 + (matchingWords.length / Math.max(queryWords.length, conceptWords.length)) * 0.3;
      }
    }

    return {
      id: concept.id,
      name: concept.name,
      normalizedName: concept.normalized_name,
      conceptType: concept.concept_type as ConceptType,
      mentionCount: concept.mention_count,
      matchScore: score,
    };
  });

  // Filter to concepts with some match and sort by score
  return scoredConcepts
    .filter(c => c.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

/**
 * Get content IDs that mention specific concepts
 * Used for boosting search results that contain matching concepts
 *
 * @param conceptIds - Array of concept IDs
 * @param orgId - Organization ID
 * @returns Map of contentId -> number of concept mentions
 */
export async function getConceptContentIds(
  conceptIds: string[],
  orgId: string
): Promise<Map<string, number>> {
  if (conceptIds.length === 0) {
    return new Map();
  }

  const { data: mentions, error } = await supabaseAdmin
    .from('concept_mentions')
    .select('content_id')
    .in('concept_id', conceptIds)
    .eq('org_id', orgId);

  if (error) {
    console.error('[Concept Search] Error getting concept content:', error);
    return new Map();
  }

  // Count mentions per content
  const contentMentions = new Map<string, number>();
  for (const mention of mentions || []) {
    const count = contentMentions.get(mention.content_id) || 0;
    contentMentions.set(mention.content_id, count + 1);
  }

  return contentMentions;
}

/**
 * Search for concepts by name pattern
 * Used for autocomplete and concept discovery
 *
 * @param pattern - Search pattern
 * @param orgId - Organization ID
 * @param limit - Maximum results
 * @returns Matching concepts
 */
export async function searchConceptsByName(
  pattern: string,
  orgId: string,
  limit: number = 10
): Promise<MatchingConcept[]> {
  const normalizedPattern = pattern.toLowerCase().trim();

  if (normalizedPattern.length < 2) {
    return [];
  }

  // SECURITY: Escape LIKE pattern metacharacters to prevent injection
  const escapedPattern = escapeLike(normalizedPattern);

  const { data: concepts, error } = await supabaseAdmin
    .from('knowledge_concepts')
    .select('id, name, normalized_name, concept_type, mention_count')
    .eq('org_id', orgId)
    .ilike('name', `%${escapedPattern}%`)
    .order('mention_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Concept Search] Error searching concepts:', error);
    return [];
  }

  return (concepts || []).map((concept: any) => ({
    id: concept.id,
    name: concept.name,
    normalizedName: concept.normalized_name,
    conceptType: concept.concept_type as ConceptType,
    mentionCount: concept.mention_count,
    matchScore: concept.name.toLowerCase().startsWith(normalizedPattern) ? 1.0 : 0.8,
  }));
}
