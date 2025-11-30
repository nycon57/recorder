import { z } from 'zod';

/**
 * Knowledge Graph Validation Schemas
 *
 * Validation schemas for concept CRUD operations and queries.
 * Concepts are AI-extracted entities (tools, processes, people, etc.)
 * that create a knowledge graph across content items.
 */

// ============================================================================
// Concept Types
// ============================================================================

/**
 * Valid concept types
 */
export const CONCEPT_TYPES = [
  'tool',
  'process',
  'person',
  'organization',
  'technical_term',
  'general',
] as const;

export type ConceptType = (typeof CONCEPT_TYPES)[number];

/**
 * Concept type colors for UI display
 */
export const CONCEPT_TYPE_COLORS: Record<ConceptType, string> = {
  tool: '#3b82f6',           // blue-500
  process: '#22c55e',        // green-500
  person: '#f97316',         // orange-500
  organization: '#64748b',   // slate-500
  technical_term: '#a855f7', // purple-500
  general: '#eab308',        // yellow-500
};

/**
 * Concept type icons (Lucide icon names)
 */
export const CONCEPT_TYPE_ICONS: Record<ConceptType, string> = {
  tool: 'Wrench',
  process: 'GitBranch',
  person: 'User',
  organization: 'Building',
  technical_term: 'Code',
  general: 'Lightbulb',
};

// ============================================================================
// Query Schemas
// ============================================================================

/**
 * List concepts query schema
 */
export const listConceptsQuerySchema = z.object({
  search: z.string().max(100).optional(),
  type: z.enum(CONCEPT_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z
    .enum(['mention_count_desc', 'last_seen_desc', 'name_asc', 'name_desc'])
    .default('mention_count_desc'),
  minMentions: z.coerce.number().int().min(1).optional(),
});

export type ListConceptsQueryInput = z.infer<typeof listConceptsQuerySchema>;

/**
 * Get single concept query schema
 */
export const getConceptQuerySchema = z.object({
  includeRelated: z.coerce.boolean().default(true),
  includeMentions: z.coerce.boolean().default(true),
  relatedLimit: z.coerce.number().int().min(1).max(50).default(10),
  mentionsLimit: z.coerce.number().int().min(1).max(50).default(10),
});

export type GetConceptQueryInput = z.infer<typeof getConceptQuerySchema>;

/**
 * Get concept content query schema
 */
export const getConceptContentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type GetConceptContentQueryInput = z.infer<typeof getConceptContentQuerySchema>;

/**
 * Get knowledge graph query schema
 */
export const getGraphQuerySchema = z.object({
  maxNodes: z.coerce.number().int().min(10).max(200).default(100),
  minStrength: z.coerce.number().min(0).max(1).default(0.3),
  minMentions: z.coerce.number().int().min(1).default(2),
  types: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').filter(Boolean) : undefined))
    .pipe(z.array(z.enum(CONCEPT_TYPES)).optional()),
  focusConceptId: z.string().uuid().optional(),
});

export type GetGraphQueryInput = z.infer<typeof getGraphQuerySchema>;

/**
 * Get content concepts query schema
 */
export const getContentConceptsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type GetContentConceptsQueryInput = z.infer<typeof getContentConceptsQuerySchema>;

// ============================================================================
// Response Types
// ============================================================================

/**
 * Concept entity
 */
export interface Concept {
  id: string;
  orgId: string;
  name: string;
  normalizedName: string;
  description: string | null;
  conceptType: ConceptType;
  mentionCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Related concept (includes relationship info)
 */
export interface RelatedConcept extends Concept {
  relationshipType: string;
  strength: number;
}

/**
 * Concept mention
 */
export interface ConceptMention {
  id: string;
  conceptId: string;
  contentId: string;
  chunkId: string | null;
  context: string | null;
  timestampSec: number | null;
  confidence: number;
  createdAt: string;
  content?: {
    id: string;
    title: string;
    contentType: string;
    thumbnailUrl: string | null;
  };
}

/**
 * Graph node for visualization
 */
export interface GraphNode {
  id: string;
  name: string;
  type: ConceptType;
  mentionCount: number;
  x?: number;
  y?: number;
}

/**
 * Valid relationship types for graph edges
 */
export const RELATIONSHIP_TYPES = [
  'related',
  'related_to',
  'co-occurs',
  'often_used_with',
  'prerequisite',
  'requires',
  'uses',
  'implements',
  'created_by',
  'works_on',
  'employs',
  'provides',
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

/**
 * Graph edge for visualization
 */
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType | string; // Allow any string for flexibility
  strength: number;
}

/**
 * Knowledge graph data
 */
export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get color for concept type
 */
export function getConceptColor(type: ConceptType): string {
  return CONCEPT_TYPE_COLORS[type] || CONCEPT_TYPE_COLORS.general;
}

/**
 * Get icon name for concept type
 */
export function getConceptIcon(type: ConceptType): string {
  return CONCEPT_TYPE_ICONS[type] || CONCEPT_TYPE_ICONS.general;
}

/**
 * Normalize concept name for comparison
 */
export function normalizeConceptName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '_');
}

/**
 * Check if a string is a valid concept type
 */
export function isValidConceptType(type: string): type is ConceptType {
  return CONCEPT_TYPES.includes(type as ConceptType);
}

// ============================================================================
// Export all schemas
// ============================================================================

export const knowledgeSchemas = {
  listConceptsQuery: listConceptsQuerySchema,
  getConceptQuery: getConceptQuerySchema,
  getConceptContentQuery: getConceptContentQuerySchema,
  getGraphQuery: getGraphQuerySchema,
  getContentConceptsQuery: getContentConceptsQuerySchema,
} as const;
