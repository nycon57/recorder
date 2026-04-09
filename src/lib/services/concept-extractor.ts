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
  maxConcepts: 15, // Reduced - quality over quantity
  minConfidence: 0.7, // Raised threshold for higher quality
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

  const prompt = `Extract ONLY high-value, specific concepts from the following text. Be VERY selective - quality over quantity.

**EXTRACT these types of concepts:**
1. **Named Entities**: Specific products, platforms, tools, or systems with proper names (e.g., "Salesforce", "NMBPerks", "Total Expert")
2. **Organizations**: Specific companies, teams, or departments with names (e.g., "Nationwide Mortgage Bankers", "Google Cloud")
3. **People**: Real named individuals mentioned (e.g., "Sarah Chen", "Mike Johnson") - NOT role titles
4. **Domain-Specific Terms**: Technical terminology unique to this field that wouldn't be understood by outsiders (e.g., "Cash-Out Refinance", "HELOC", "LTV Ratio")
5. **Proprietary Processes**: Named internal processes, programs, or methodologies specific to the organization (e.g., "AMP Ambassador Program", "Quarterly Business Review")

**DO NOT EXTRACT:**
- Generic business terms (marketing, strategy, budgeting, planning, workflow)
- Common words found in any dictionary (mortgage, loan, payment, customer, home)
- Role titles without names (Department Heads, Regional Leaders, Branch Managers)
- Outcomes or benefits (lower payments, save money, improve efficiency)
- Vague/fluffy phrases (financial wellness, streamlining, optimization)
- Actions or verbs disguised as concepts (debt consolidation, refinancing - unless it's a specific product name)

**Quality Test**: Before including a concept, ask: "Would this term help connect this document to OTHER documents in a knowledge base?" Generic terms appear everywhere and provide no signal.

For each concept, provide:
- **name**: The exact proper noun or specific term (use title case for proper nouns)
- **type**: One of: tool, process, person, organization, technical_term
- **confidence**: 0.7-1.0 score (only include concepts you're confident about)
- **description**: Brief description of what this SPECIFIC thing is
- **context**: The sentence where this appears

Return ONLY a JSON array. Maximum ${Math.min(opts.maxConcepts || 30, 15)} concepts, ordered by specificity and importance. It's better to return 5 high-quality concepts than 20 generic ones.

Example of GOOD concepts:
[
  {"name": "NMBPerks", "type": "tool", "confidence": 0.95, "description": "NMB's proprietary homeowner rewards platform", "context": "..."},
  {"name": "Total Expert", "type": "tool", "confidence": 0.9, "description": "CRM platform used for mortgage marketing", "context": "..."}
]

Example of BAD concepts (do not extract these):
- "Marketing" (too generic)
- "Homeownership" (dictionary word)
- "Lower Monthly Payments" (outcome, not concept)
- "Department Heads" (role title, not a person)

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
 * Note: 'general' is still accepted for backwards compatibility but new extractions should avoid it
 */
function validateConceptType(type: string): ConceptType {
  const validTypes: ConceptType[] = [
    'tool',
    'process',
    'person',
    'organization',
    'technical_term',
    'general', // Kept for backwards compatibility, but prompt discourages this
  ];
  const normalized = type.toLowerCase().replace(/[_-]/g, '_');
  return validTypes.includes(normalized as ConceptType)
    ? (normalized as ConceptType)
    : 'technical_term'; // Default to technical_term instead of general
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
