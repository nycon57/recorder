import {
  KNOWLEDGE_STATUS,
  type KnowledgeStatusCounts,
  type KnowledgeStatus,
  type KnowledgeStatusMeta,
} from '../types/knowledge-status';

import {
  SOURCE_STATUS,
  isErrorStatus,
  isProcessingStatus,
  normalizeSourceStatus,
} from './status-helpers';

const KNOWLEDGE_STATUS_META: Record<KnowledgeStatus, KnowledgeStatusMeta> = {
  [KNOWLEDGE_STATUS.PROCESSING]: {
    label: 'Processing',
    shortLabel: 'Processing',
    badgeVariant: 'secondary',
    badgeClassName: 'bg-amber-500/10 text-amber-700 border-amber-200',
    description: 'Source material is still being compiled into organization knowledge.',
  },
  [KNOWLEDGE_STATUS.NEEDS_ROUTING]: {
    label: 'Needs Routing',
    shortLabel: 'Needs Routing',
    badgeVariant: 'outline',
    badgeClassName: 'bg-indigo-500/10 text-indigo-700 border-indigo-200',
    description: 'The knowledge exists, but it still needs a clear app or screen assignment.',
  },
  [KNOWLEDGE_STATUS.LIVE]: {
    label: 'Live',
    shortLabel: 'Live',
    badgeVariant: 'default',
    badgeClassName: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
    description: 'A live organization page is available for this knowledge.',
  },
  [KNOWLEDGE_STATUS.NEEDS_REVIEW]: {
    label: 'Needs Review',
    shortLabel: 'Needs Review',
    badgeVariant: 'secondary',
    badgeClassName: 'bg-rose-500/10 text-rose-700 border-rose-200',
    description: 'A contradiction or governance check needs human review before the page is trusted.',
  },
  [KNOWLEDGE_STATUS.SUPERSEDED]: {
    label: 'Superseded',
    shortLabel: 'Superseded',
    badgeVariant: 'outline',
    badgeClassName: 'bg-slate-500/10 text-slate-700 border-slate-200',
    description: 'A newer knowledge record has replaced this one.',
  },
  [KNOWLEDGE_STATUS.VENDOR_ONLY]: {
    label: 'Vendor Only',
    shortLabel: 'Vendor Only',
    badgeVariant: 'outline',
    badgeClassName: 'bg-sky-500/10 text-sky-700 border-sky-200',
    description: 'Vendor knowledge exists, but your organization has no live page for it yet.',
  },
};

export {
  KNOWLEDGE_STATUS,
  KNOWLEDGE_STATUS_DISPLAY_ORDER,
  type KnowledgeStatusCounts,
  type KnowledgeStatus,
  type KnowledgeStatusMeta,
} from '../types/knowledge-status';

export function getKnowledgeStatusMeta(status: KnowledgeStatus): KnowledgeStatusMeta {
  return KNOWLEDGE_STATUS_META[status];
}

export function resolveKnowledgeStatusForWikiPage(input: {
  validUntil: string | null;
  app: string | null;
  screen: string | null;
  hasPendingReview: boolean;
}): KnowledgeStatus {
  if (input.validUntil) {
    return KNOWLEDGE_STATUS.SUPERSEDED;
  }

  if (input.hasPendingReview) {
    return KNOWLEDGE_STATUS.NEEDS_REVIEW;
  }

  if (!input.app || !input.screen) {
    return KNOWLEDGE_STATUS.NEEDS_ROUTING;
  }

  return KNOWLEDGE_STATUS.LIVE;
}

export function resolveKnowledgeStatusForSource(input: {
  sourceStatus: string;
  wikiPageStatus: KnowledgeStatus | null;
}): KnowledgeStatus {
  const normalizedSourceStatus = normalizeSourceStatus(input.sourceStatus);

  if (
    isProcessingStatus(input.sourceStatus) ||
    (normalizedSourceStatus !== null &&
      normalizedSourceStatus !== SOURCE_STATUS.COMPLETED &&
      !isErrorStatus(normalizedSourceStatus))
  ) {
    return KNOWLEDGE_STATUS.PROCESSING;
  }

  if (input.wikiPageStatus) {
    return input.wikiPageStatus;
  }

  return KNOWLEDGE_STATUS.LIVE;
}

export function resolveSourceWikiPageStatus(
  wikiPageStatuses: KnowledgeStatus[]
): KnowledgeStatus | null {
  if (wikiPageStatuses.length === 0) {
    return null;
  }

  const priorityOrder: KnowledgeStatus[] = [
    KNOWLEDGE_STATUS.NEEDS_REVIEW,
    KNOWLEDGE_STATUS.NEEDS_ROUTING,
    KNOWLEDGE_STATUS.LIVE,
    KNOWLEDGE_STATUS.SUPERSEDED,
    KNOWLEDGE_STATUS.VENDOR_ONLY,
    KNOWLEDGE_STATUS.PROCESSING,
  ];

  const wikiPageStatusSet = new Set(wikiPageStatuses);
  for (const status of priorityOrder) {
    if (wikiPageStatusSet.has(status)) {
      return status;
    }
  }

  return wikiPageStatuses[0] ?? null;
}

export function summarizeKnowledgeStatusCounts(input: {
  processingSources: number;
  wikiPageStatuses: KnowledgeStatus[];
  vendorOnlyCount: number;
}): KnowledgeStatusCounts {
  const counts: KnowledgeStatusCounts = {
    [KNOWLEDGE_STATUS.PROCESSING]: input.processingSources,
    [KNOWLEDGE_STATUS.NEEDS_ROUTING]: 0,
    [KNOWLEDGE_STATUS.LIVE]: 0,
    [KNOWLEDGE_STATUS.NEEDS_REVIEW]: 0,
    [KNOWLEDGE_STATUS.SUPERSEDED]: 0,
    [KNOWLEDGE_STATUS.VENDOR_ONLY]: input.vendorOnlyCount,
  };

  for (const status of input.wikiPageStatuses) {
    counts[status] += 1;
  }

  return counts;
}
