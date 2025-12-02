/**
 * Concept Extractor Service
 *
 * Extracts key concepts from content (transcripts, documents) using Gemini AI.
 * Part of the Knowledge Graph MOAT feature.
 *
 * Concepts are:
 * - Tools, technologies, and platforms (e.g., "Supabase", "React", "Docker")
 * - Processes and workflows (e.g., "deployment", "code review", "onboarding")
 * - Technical terms (e.g., "API endpoint", "database migration", "authentication")
 * - People and organizations (when relevant to the content)
 * - Domain-specific terms unique to the organization
 */

import { GoogleGenAI } from '@google/genai';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/utils/logger';
import { GOOGLE_CONFIG } from '@/lib/google/client';

const logger = createLogger({ service: 'concept-extractor' });

// Concept types for classification
export type ConceptType =
  | 'tool'
  | 'process'
  | 'person'
  | 'organization'
  | 'technical_term'
  | 'general';

// Extracted concept from AI
export interface ExtractedConcept {
  name: string;
  normalizedName: string;
  type: ConceptType;
  description?: string;
  confidence: number;
  context: string;
  timestampSec?: number;
}

// Stored concept from database
// Note: Some fields are nullable because different RPC functions return different subsets
export interface StoredConcept {
  id: string;
  orgId: string | null; // Not returned by get_content_concepts, find_similar_concepts
  name: string;
  normalizedName: string | null; // Not returned by get_content_concepts, find_similar_concepts
  conceptType: ConceptType;
  description: string | null; // Not returned by get_content_concepts, find_similar_concepts
  mentionCount: number;
  embedding?: number[];
  firstSeenAt: Date | null; // Not returned by get_content_concepts, find_similar_concepts
  lastSeenAt: Date | null; // Not returned by get_content_concepts, find_similar_concepts
  // Additional fields from specific RPCs
  confidence?: number; // From get_content_concepts
  context?: string; // From get_content_concepts
  contentCount?: number; // From get_top_concepts
}

// Concept mention with content link
export interface ConceptMention {
  conceptId: string;
  contentId: string;
  chunkId?: string;
  context: string;
  timestampSec?: number;
  confidence: number;
}

// Options for concept extraction
export interface ExtractionOptions {
  maxConcepts?: number;
  minConfidence?: number;
  includeContext?: boolean;
  generateEmbeddings?: boolean;
}

const DEFAULT_OPTIONS: ExtractionOptions = {
  maxConcepts: 30,
  minConfidence: 0.6,
  includeContext: true,
  generateEmbeddings: true,
};

// Lazy-initialized Gemini client
let genaiClient: GoogleGenAI | null = null;

function getGenAIClient(): GoogleGenAI {
  if (!genaiClient) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
    }
    genaiClient = new GoogleGenAI({ apiKey });
  }
  return genaiClient;
}

/**
 * Normalize a concept name for deduplication
 * - Lowercase
 * - Remove extra whitespace
 * - Basic stemming/normalization
 */
export function normalizeConcept(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '') // Remove special chars except hyphens
    .replace(/\b(the|a|an)\b/g, '') // Remove articles
    .trim();
}

/**
 * Extract concepts from text using Gemini AI
 */
export async function extractConceptsFromText(
  text: string,
  options: ExtractionOptions = {}
): Promise<ExtractedConcept[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const genai = getGenAIClient();

  logger.info('Extracting concepts from text', {
    context: {
      textLength: text.length,
      maxConcepts: opts.maxConcepts,
      minConfidence: opts.minConfidence,
    },
  });

  const prompt = `Extract key concepts from the following text. Focus on identifying:

1. **Tools & Technologies**: Software, platforms, frameworks, libraries (e.g., "React", "Docker", "Supabase")
2. **Processes & Workflows**: Methods, procedures, workflows (e.g., "code review", "deployment", "user onboarding")
3. **Technical Terms**: Domain-specific terminology (e.g., "API endpoint", "database migration", "authentication flow")
4. **People & Organizations**: Key people or companies mentioned (only if significant to the content)
5. **General Concepts**: Other important concepts that don't fit above categories

For each concept, provide:
- **name**: The concept name (use title case for proper nouns, lowercase for general terms)
- **type**: One of: tool, process, person, organization, technical_term, general
- **confidence**: 0.0-1.0 score of how certain you are this is a key concept
- **description**: Brief (1 sentence) description of what this concept means in this context
- **context**: The sentence or phrase where this concept appears

Return ONLY a JSON array with no markdown formatting. Maximum ${opts.maxConcepts} concepts, ordered by importance.

Example output:
[
  {
    "name": "Supabase",
    "type": "tool",
    "confidence": 0.95,
    "description": "Open-source Firebase alternative for backend services",
    "context": "We use Supabase for our database and authentication"
  }
]

TEXT TO ANALYZE:
${text.substring(0, 15000)}
`;

  try {
    const result = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        temperature: 0.2, // Low temperature for consistent extraction
        maxOutputTokens: 4096,
      },
    });

    const responseText = result.text || '';

    // Parse JSON response (handle potential markdown wrapping)
    let concepts: any[];
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        concepts = JSON.parse(jsonMatch[0]);
      } else {
        concepts = JSON.parse(responseText);
      }
    } catch (parseError) {
      logger.warn('Failed to parse concept extraction response', {
        context: {
          responsePreview: responseText.substring(0, 500),
          error: parseError instanceof Error ? parseError.message : String(parseError),
        },
      });
      return [];
    }

    // Validate and transform concepts
    const validConcepts: ExtractedConcept[] = concepts
      .filter((c: any) => {
        return (
          c.name &&
          typeof c.name === 'string' &&
          c.confidence >= (opts.minConfidence || 0) &&
          c.type
        );
      })
      .map((c: any) => ({
        name: c.name.trim(),
        normalizedName: normalizeConcept(c.name),
        type: validateConceptType(c.type),
        description: c.description?.trim(),
        confidence: Math.min(1, Math.max(0, c.confidence)),
        context: c.context?.trim() || '',
        timestampSec: c.timestamp_sec,
      }))
      .slice(0, opts.maxConcepts);

    logger.info('Extracted concepts from text', {
      context: {
        conceptCount: validConcepts.length,
        types: validConcepts.reduce((acc, c) => {
          acc[c.type] = (acc[c.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
    });

    return validConcepts;
  } catch (error) {
    logger.error('Failed to extract concepts', {
      context: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

/**
 * Validate and normalize concept type
 */
function validateConceptType(type: string): ConceptType {
  const validTypes: ConceptType[] = [
    'tool',
    'process',
    'person',
    'organization',
    'technical_term',
    'general',
  ];
  const normalized = type.toLowerCase().replace(/[_-]/g, '_');
  return validTypes.includes(normalized as ConceptType)
    ? (normalized as ConceptType)
    : 'general';
}

/**
 * Generate embedding for a concept name and description
 * Uses the same embedding model as the rest of the system (gemini-embedding-001)
 * to ensure 1536-dimensional embeddings that match the database schema.
 */
async function generateConceptEmbedding(
  name: string,
  description?: string
): Promise<number[]> {
  const genai = getGenAIClient();
  const text = description ? `${name}: ${description}` : name;

  console.log('[Concept Extractor] Generating embedding:', {
    model: GOOGLE_CONFIG.EMBEDDING_MODEL,
    outputDimensionality: GOOGLE_CONFIG.EMBEDDING_DIMENSIONS,
    taskType: GOOGLE_CONFIG.EMBEDDING_TASK_TYPE,
    textPreview: text.substring(0, 50),
  });

  const result = await genai.models.embedContent({
    model: GOOGLE_CONFIG.EMBEDDING_MODEL, // gemini-embedding-001, produces 1536-dim
    contents: text,
    config: {
      taskType: GOOGLE_CONFIG.EMBEDDING_TASK_TYPE, // RETRIEVAL_DOCUMENT
      outputDimensionality: GOOGLE_CONFIG.EMBEDDING_DIMENSIONS, // 1536
    },
  });

  const embedding = result.embeddings?.[0]?.values;
  if (!embedding) {
    throw new Error('Failed to generate concept embedding');
  }

  console.log('[Concept Extractor] Received embedding:', {
    dimensions: embedding.length,
    expected: GOOGLE_CONFIG.EMBEDDING_DIMENSIONS,
    match: embedding.length === GOOGLE_CONFIG.EMBEDDING_DIMENSIONS,
  });

  // Verify dimension matches expected (defense in depth)
  if (embedding.length !== GOOGLE_CONFIG.EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding dimension mismatch: expected ${GOOGLE_CONFIG.EMBEDDING_DIMENSIONS}, got ${embedding.length}`
    );
  }

  return embedding;
}

/**
 * Store extracted concepts in the database
 * Uses upsert to handle duplicates gracefully
 */
export async function storeConceptsForContent(
  contentId: string,
  orgId: string,
  concepts: ExtractedConcept[],
  options: ExtractionOptions = {}
): Promise<{ conceptIds: string[]; newConcepts: number; updatedConcepts: number }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const supabase = createAdminClient();

  logger.info('Storing concepts for content', {
    context: {
      contentId,
      orgId,
      conceptCount: concepts.length,
      generateEmbeddings: opts.generateEmbeddings,
    },
  });

  const conceptIds: string[] = [];
  let newConcepts = 0;
  let updatedConcepts = 0;

  for (const concept of concepts) {
    try {
      // Generate embedding if requested
      let embedding: number[] | null = null;
      if (opts.generateEmbeddings) {
        try {
          embedding = await generateConceptEmbedding(concept.name, concept.description);
        } catch (embError) {
          logger.warn('Failed to generate concept embedding, continuing without', {
            context: {
              conceptName: concept.name,
              error: embError instanceof Error ? embError.message : String(embError),
            },
          });
        }
      }

      // Upsert concept using the database function
      const { data: conceptId, error: upsertError } = await supabase.rpc(
        'upsert_concept',
        {
          p_org_id: orgId,
          p_name: concept.name,
          p_normalized_name: concept.normalizedName,
          p_concept_type: concept.type,
          p_description: concept.description || null,
          p_embedding: embedding ? JSON.stringify(embedding) : null,
        }
      );

      if (upsertError) {
        logger.error('Failed to upsert concept', {
          context: {
            conceptName: concept.name,
            error: upsertError.message,
          },
        });
        continue;
      }

      if (conceptId) {
        conceptIds.push(conceptId);

        // Check if this was a new concept or update
        const { data: existingMention } = await supabase
          .from('concept_mentions')
          .select('id')
          .eq('concept_id', conceptId)
          .eq('content_id', contentId)
          .maybeSingle();

        if (existingMention) {
          updatedConcepts++;
        } else {
          newConcepts++;
        }

        // Create concept mention
        const { error: mentionError } = await supabase
          .from('concept_mentions')
          .upsert(
            {
              concept_id: conceptId,
              content_id: contentId,
              org_id: orgId,
              context: concept.context.substring(0, 500),
              timestamp_sec: concept.timestampSec || null,
              confidence: concept.confidence,
            },
            {
              onConflict: 'concept_id,content_id',
              ignoreDuplicates: false,
            }
          );

        if (mentionError) {
          logger.warn('Failed to create concept mention', {
            context: {
              conceptId,
              contentId,
              error: mentionError.message,
            },
          });
        }
      }
    } catch (error) {
      logger.error('Error processing concept', {
        context: {
          conceptName: concept.name,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  logger.info('Stored concepts for content', {
    context: {
      contentId,
      totalConcepts: conceptIds.length,
      newConcepts,
      updatedConcepts,
    },
  });

  return { conceptIds, newConcepts, updatedConcepts };
}

/**
 * Extract and store concepts for a content item
 * Main entry point for the concept extraction pipeline
 */
export async function extractAndStoreConcepts(
  contentId: string,
  orgId: string,
  text: string,
  options: ExtractionOptions = {}
): Promise<{
  success: boolean;
  conceptCount: number;
  newConcepts: number;
  updatedConcepts: number;
  concepts: ExtractedConcept[];
}> {
  logger.info('Starting concept extraction pipeline', {
    context: {
      contentId,
      orgId,
      textLength: text.length,
    },
  });

  try {
    // Extract concepts from text
    const concepts = await extractConceptsFromText(text, options);

    if (concepts.length === 0) {
      logger.info('No concepts extracted from content', {
        context: { contentId },
      });
      return {
        success: true,
        conceptCount: 0,
        newConcepts: 0,
        updatedConcepts: 0,
        concepts: [],
      };
    }

    // Store concepts in database
    const { conceptIds, newConcepts, updatedConcepts } = await storeConceptsForContent(
      contentId,
      orgId,
      concepts,
      options
    );

    logger.info('Completed concept extraction pipeline', {
      context: {
        contentId,
        conceptCount: conceptIds.length,
        newConcepts,
        updatedConcepts,
      },
    });

    return {
      success: true,
      conceptCount: conceptIds.length,
      newConcepts,
      updatedConcepts,
      concepts,
    };
  } catch (error) {
    logger.error('Concept extraction pipeline failed', {
      context: {
        contentId,
        orgId,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return {
      success: false,
      conceptCount: 0,
      newConcepts: 0,
      updatedConcepts: 0,
      concepts: [],
    };
  }
}

/**
 * Get concepts for a specific content item
 */
export async function getConceptsForContent(
  contentId: string
): Promise<StoredConcept[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('get_content_concepts', {
    p_content_id: contentId,
  });

  if (error) {
    logger.error('Failed to get concepts for content', {
      context: {
        contentId,
        error: error.message,
      },
    });
    return [];
  }

  // get_content_concepts returns: concept_id, concept_name, concept_type, mention_count, confidence, context
  // It does NOT return: org_id, normalized_name, description, first_seen_at, last_seen_at
  return (data || []).map((row: any) => ({
    id: row.concept_id,
    orgId: null, // Not available from this RPC
    name: row.concept_name,
    normalizedName: null, // Not available from this RPC
    conceptType: row.concept_type as ConceptType,
    description: null, // Not available from this RPC
    mentionCount: row.mention_count ?? 0,
    firstSeenAt: null, // Not available from this RPC
    lastSeenAt: null, // Not available from this RPC
    // Additional fields specific to this RPC
    confidence: row.confidence,
    context: row.context,
  }));
}

/**
 * Get top concepts for an organization
 */
export async function getTopConceptsForOrg(
  orgId: string,
  limit: number = 50,
  conceptType?: ConceptType
): Promise<StoredConcept[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('get_top_concepts', {
    p_org_id: orgId,
    p_limit: limit,
    p_concept_type: conceptType || null,
  });

  if (error) {
    logger.error('Failed to get top concepts', {
      context: {
        orgId,
        error: error.message,
      },
    });
    return [];
  }

  // get_top_concepts returns: concept_id, name, normalized_name, concept_type, description,
  //                           mention_count, content_count, first_seen_at, last_seen_at
  return (data || []).map((row: any) => ({
    id: row.concept_id,
    orgId, // We pass this as parameter, so we can use it
    name: row.name,
    normalizedName: row.normalized_name ?? null,
    conceptType: row.concept_type as ConceptType,
    description: row.description ?? null,
    mentionCount: row.mention_count ?? 0,
    firstSeenAt: row.first_seen_at ? new Date(row.first_seen_at) : null,
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at) : null,
    // Additional field from this RPC
    contentCount: row.content_count ? Number(row.content_count) : undefined,
  }));
}

/**
 * Find similar concepts by embedding
 */
export async function findSimilarConcepts(
  orgId: string,
  text: string,
  limit: number = 10,
  threshold: number = 0.7
): Promise<Array<StoredConcept & { similarity: number }>> {
  const supabase = createAdminClient();

  // Generate embedding for the query text
  let embedding: number[];
  try {
    embedding = await generateConceptEmbedding(text);
  } catch (embeddingError) {
    logger.error('Failed to generate embedding for similar concepts search', {
      context: {
        orgId,
        textLength: text.length,
        error: embeddingError instanceof Error ? embeddingError.message : String(embeddingError),
      },
    });
    return [];
  }

  const { data, error } = await supabase.rpc('find_similar_concepts', {
    p_org_id: orgId,
    p_embedding: JSON.stringify(embedding),
    p_limit: limit,
    p_threshold: threshold,
  });

  if (error) {
    logger.error('Failed to find similar concepts', {
      context: {
        orgId,
        error: error.message,
      },
    });
    return [];
  }

  // find_similar_concepts returns: concept_id, name, concept_type, mention_count, similarity
  // It does NOT return: normalized_name, description, first_seen_at, last_seen_at
  return (data || []).map((row: any) => ({
    id: row.concept_id,
    orgId, // We pass this as parameter, so we can use it
    name: row.name,
    normalizedName: null, // Not available from this RPC
    conceptType: row.concept_type as ConceptType,
    description: null, // Not available from this RPC
    mentionCount: row.mention_count ?? 0,
    similarity: row.similarity,
    firstSeenAt: null, // Not available from this RPC
    lastSeenAt: null, // Not available from this RPC
  }));
}

/**
 * Get related concepts for a given concept
 */
export async function getRelatedConcepts(
  conceptId: string,
  limit: number = 20
): Promise<Array<{
  conceptId: string;
  name: string;
  type: ConceptType;
  relationshipType: string;
  strength: number;
}>> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('get_related_concepts', {
    p_concept_id: conceptId,
    p_limit: limit,
  });

  if (error) {
    logger.error('Failed to get related concepts', {
      context: {
        conceptId,
        error: error.message,
      },
    });
    return [];
  }

  return (data || []).map((row: any) => ({
    conceptId: row.related_concept_id,
    name: row.related_name,
    type: row.related_type,
    relationshipType: row.relationship_type,
    strength: row.strength,
  }));
}
