export const KNOWLEDGE_STATUS = {
  PROCESSING: 'processing',
  NEEDS_ROUTING: 'needs_routing',
  LIVE: 'live',
  NEEDS_REVIEW: 'needs_review',
  SUPERSEDED: 'superseded',
  VENDOR_ONLY: 'vendor_only',
} as const;

export type KnowledgeStatus =
  (typeof KNOWLEDGE_STATUS)[keyof typeof KNOWLEDGE_STATUS];

type KnowledgeStatusBadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline';

export interface KnowledgeStatusMeta {
  label: string;
  shortLabel: string;
  badgeVariant: KnowledgeStatusBadgeVariant;
  badgeClassName: string;
  description: string;
}

export type KnowledgeStatusCounts = Record<KnowledgeStatus, number>;

export const KNOWLEDGE_STATUS_DISPLAY_ORDER: KnowledgeStatus[] = [
  KNOWLEDGE_STATUS.PROCESSING,
  KNOWLEDGE_STATUS.NEEDS_ROUTING,
  KNOWLEDGE_STATUS.LIVE,
  KNOWLEDGE_STATUS.NEEDS_REVIEW,
  KNOWLEDGE_STATUS.SUPERSEDED,
  KNOWLEDGE_STATUS.VENDOR_ONLY,
];
