import { z } from 'zod';

import {
  KNOWLEDGE_STATUS,
  type KnowledgeStatus,
} from '@/lib/types/knowledge-status';

export const KNOWLEDGE_DOC_TYPES = [
  'recording',
  'video',
  'audio',
  'document',
  'text',
  'manual',
  'mixed',
  'unknown',
] as const;

export type KnowledgeDocType = (typeof KNOWLEDGE_DOC_TYPES)[number];

export const KNOWLEDGE_SOURCE_TYPES = [
  'recording',
  'video',
  'audio',
  'document',
  'text',
  'manual',
] as const;

export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

export const KNOWLEDGE_VENDOR_COVERAGE = ['covered', 'gap', 'unrouted'] as const;

export type KnowledgeVendorCoverage =
  (typeof KNOWLEDGE_VENDOR_COVERAGE)[number];

const knowledgeStatusEnum = z.enum(
  Object.values(KNOWLEDGE_STATUS) as [KnowledgeStatus, ...KnowledgeStatus[]]
);

export const knowledgeDocsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  type: z.enum(KNOWLEDGE_DOC_TYPES).optional(),
  status: knowledgeStatusEnum.optional(),
  app: z.string().trim().max(120).optional(),
  vendorCoverage: z.enum(KNOWLEDGE_VENDOR_COVERAGE).optional(),
  cluster: z.string().trim().max(120).optional(),
  sort: z
    .enum(['updated_desc', 'updated_asc', 'topic_asc', 'topic_desc'])
    .default('updated_desc'),
  limit: z.coerce.number().int().min(1).max(250).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export type KnowledgeDocsQueryInput = z.infer<typeof knowledgeDocsQuerySchema>;

export interface KnowledgeDocsListItem {
  id: string;
  topic: string;
  app: string | null;
  screen: string | null;
  confidence: number;
  status: KnowledgeStatus;
  type: KnowledgeDocType;
  vendorCoverage: KnowledgeVendorCoverage;
  sourceTypes: KnowledgeSourceType[];
  clusterId: string | null;
  clusterName: string | null;
  updatedAt: string;
  detailHref: string;
}

export interface KnowledgeDocsFacetOption {
  value: string;
  label: string;
  count: number;
}

export interface KnowledgeDocsClusterFacetOption {
  value: string;
  label: string;
  count: number;
}

export interface KnowledgeDocsPayload {
  items: KnowledgeDocsListItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  facets: {
    types: KnowledgeDocsFacetOption[];
    statuses: KnowledgeDocsFacetOption[];
    apps: KnowledgeDocsFacetOption[];
    vendorCoverage: KnowledgeDocsFacetOption[];
    clusters: KnowledgeDocsClusterFacetOption[];
  };
  filters: KnowledgeDocsQueryInput;
}
