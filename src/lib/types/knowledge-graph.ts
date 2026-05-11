import { z } from 'zod';

const KNOWLEDGE_GRAPH_NODE_KINDS = [
  'org_page',
  'vendor_page',
  'cluster',
] as const;

type KnowledgeGraphNodeKind =
  (typeof KNOWLEDGE_GRAPH_NODE_KINDS)[number];

const KNOWLEDGE_GRAPH_EDGE_KINDS = [
  'org_relationship',
  'org_in_cluster',
  'org_matches_vendor',
] as const;

type KnowledgeGraphEdgeKind =
  (typeof KNOWLEDGE_GRAPH_EDGE_KINDS)[number];

export const WIKI_RELATIONSHIP_TYPES = [
  'requires',
  'precedes',
  'contradicts',
  'related',
] as const;

export type WikiRelationshipType =
  (typeof WIKI_RELATIONSHIP_TYPES)[number];

export const WIKI_RELATIONSHIP_SOURCE_TYPES = [
  'extracted',
  'inferred',
  'manual',
] as const;

export type WikiRelationshipSourceType =
  (typeof WIKI_RELATIONSHIP_SOURCE_TYPES)[number];

/**
 * Query schema for the operational knowledge graph endpoint.
 * Defaults favor a UI-safe payload size while still returning a useful
 * multi-entity graph in one round-trip.
 */
export const knowledgeGraphQuerySchema = z.object({
  orgPageLimit: z.coerce.number().int().min(1).max(1000).default(300),
  vendorPageLimit: z.coerce.number().int().min(1).max(1000).default(300),
  clusterLimit: z.coerce.number().int().min(1).max(500).default(200),
  relationshipLimit: z.coerce.number().int().min(1).max(5000).default(2000),
  vendorMatchesPerOrgPage: z.coerce
    .number()
    .int()
    .min(1)
    .max(20)
    .default(3),
  includeSuperseded: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
});

export type KnowledgeGraphQueryInput = z.infer<
  typeof knowledgeGraphQuerySchema
>;

interface KnowledgeGraphNodeBase {
  id: string;
  kind: KnowledgeGraphNodeKind;
  label: string;
  rawId: string;
}

interface OrgPageGraphNode extends KnowledgeGraphNodeBase {
  kind: 'org_page';
  topic: string;
  app: string | null;
  screen: string | null;
  confidence: number;
  status: 'active' | 'superseded';
  clusterId: string | null;
  updatedAt: string;
}

interface VendorPageGraphNode extends KnowledgeGraphNodeBase {
  kind: 'vendor_page';
  app: string;
  screen: string;
  sourceUrl: string | null;
}

interface ClusterGraphNode extends KnowledgeGraphNodeBase {
  kind: 'cluster';
  name: string;
  memberCount: number;
  centralPageId: string | null;
  modularity: number | null;
  computedAt: string;
}

export type KnowledgeGraphNode =
  | OrgPageGraphNode
  | VendorPageGraphNode
  | ClusterGraphNode;

interface KnowledgeGraphEdgeBase {
  id: string;
  kind: KnowledgeGraphEdgeKind;
  source: string;
  target: string;
}

interface OrgRelationshipGraphEdge extends KnowledgeGraphEdgeBase {
  kind: 'org_relationship';
  relationshipType: WikiRelationshipType;
  sourceType: WikiRelationshipSourceType;
  confidence: number;
  evidence: string | null;
}

interface OrgClusterMembershipGraphEdge
  extends KnowledgeGraphEdgeBase {
  kind: 'org_in_cluster';
}

interface OrgVendorMatchGraphEdge extends KnowledgeGraphEdgeBase {
  kind: 'org_matches_vendor';
  matchKey: string;
}

export type KnowledgeGraphEdge =
  | OrgRelationshipGraphEdge
  | OrgClusterMembershipGraphEdge
  | OrgVendorMatchGraphEdge;

interface KnowledgeGraphMeta {
  generatedAt: string;
  orgId: string;
  limits: {
    orgPageLimit: number;
    vendorPageLimit: number;
    clusterLimit: number;
    relationshipLimit: number;
    vendorMatchesPerOrgPage: number;
    includeSuperseded: boolean;
  };
  counts: {
    nodes: number;
    edges: number;
    orgPages: number;
    vendorPages: number;
    clusters: number;
    orgRelationships: number;
    clusterMemberships: number;
    vendorMatches: number;
  };
}

export interface KnowledgeGraphPayload {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  meta: KnowledgeGraphMeta;
}
