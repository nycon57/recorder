/**
 * Knowledge Health Service
 *
 * Computes knowledge health metrics and an overall score (0–100) for an org.
 * All queries run in parallel to minimise latency.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  fetchKnowledgeStatusSummary,
  KNOWLEDGE_STATUS,
  type KnowledgeStatusSummary,
} from '@/lib/services/knowledge-status';
import {
  listReviewQueueItems,
  type ReviewQueueKind,
} from '@/lib/services/review-queue';

export interface KnowledgeHealthData {
  curatorEnabled: boolean;
  totalItems: number;
  itemsThisWeek: number;
  itemsThisMonth: number;
  duplicateAlerts: number;
  staleAlerts: number;
  uniqueConcepts: number;
  freshItems: number;
  healthScore: number;
  hasContent: boolean;
  knowledgeStatus: KnowledgeStatusSummary;
}

export type KnowledgeBottleneckKind =
  | 'routing'
  | 'review'
  | 'publication'
  | 'vendor-gap'
  | 'processing';

export interface KnowledgeFlowBottleneck {
  key: KnowledgeBottleneckKind;
  label: string;
  count: number;
}

export interface KnowledgeOperationalMetrics {
  knowledgeStatus: KnowledgeStatusSummary;
  reviewQueueCounts: Record<ReviewQueueKind, number>;
  pendingReviewCount: number;
  routingBacklog: number;
  reviewBacklog: number;
  publicationBacklog: number;
  vendorGapCount: number;
  processingCount: number;
  primaryBottleneck: KnowledgeFlowBottleneck | null;
}

export function summarizeReviewQueueKindCounts(
  queueKinds: ReviewQueueKind[],
): Record<ReviewQueueKind, number> {
  const counts: Record<ReviewQueueKind, number> = {
    contradiction: 0,
    routing: 0,
    'manual-publication': 0,
  };

  for (const kind of queueKinds) {
    counts[kind] += 1;
  }

  return counts;
}

export function deriveKnowledgeOperationalMetrics(input: {
  knowledgeStatus: KnowledgeStatusSummary;
  reviewQueueCounts: Record<ReviewQueueKind, number>;
}): KnowledgeOperationalMetrics {
  const { knowledgeStatus, reviewQueueCounts } = input;
  const routingBacklog =
    knowledgeStatus.counts[KNOWLEDGE_STATUS.NEEDS_ROUTING] +
    reviewQueueCounts.routing;
  const reviewBacklog =
    knowledgeStatus.counts[KNOWLEDGE_STATUS.NEEDS_REVIEW] +
    reviewQueueCounts.contradiction;
  const publicationBacklog = reviewQueueCounts['manual-publication'];
  const vendorGapCount = knowledgeStatus.counts[KNOWLEDGE_STATUS.VENDOR_ONLY];
  const processingCount = knowledgeStatus.counts[KNOWLEDGE_STATUS.PROCESSING];
  const pendingReviewCount =
    reviewQueueCounts.contradiction +
    reviewQueueCounts.routing +
    reviewQueueCounts['manual-publication'];

  const bottleneckCandidates: KnowledgeFlowBottleneck[] = [
    { key: 'routing', label: 'Routing', count: routingBacklog },
    { key: 'review', label: 'Review', count: reviewBacklog },
    { key: 'publication', label: 'Publication', count: publicationBacklog },
    { key: 'vendor-gap', label: 'Vendor gaps', count: vendorGapCount },
    { key: 'processing', label: 'Processing', count: processingCount },
  ];

  let primaryBottleneck: KnowledgeFlowBottleneck | null = null;
  for (const candidate of bottleneckCandidates) {
    if (candidate.count <= 0) continue;
    if (!primaryBottleneck || candidate.count > primaryBottleneck.count) {
      primaryBottleneck = candidate;
    }
  }

  return {
    knowledgeStatus,
    reviewQueueCounts,
    pendingReviewCount,
    routingBacklog,
    reviewBacklog,
    publicationBacklog,
    vendorGapCount,
    processingCount,
    primaryBottleneck,
  };
}

/**
 * Health score formula (0–100, rounded):
 *   40% — content freshness (% updated in last 90 days)
 *   30% — duplicate ratio (0 duplicates = 100; penalises proportionally)
 *   30% — concept coverage (rewards ~0.5 concepts per item; capped at 100)
 *
 * Returns 0 when there are no content items.
 */
function computeHealthScore(
  totalItems: number,
  freshItems: number,
  duplicateAlerts: number,
  uniqueConcepts: number,
): number {
  if (totalItems === 0) return 0;

  const freshnessScore = (freshItems / totalItems) * 100;
  const duplicateScore = Math.max(0, 100 - (duplicateAlerts / totalItems) * 200);
  const conceptScore = Math.min(100, (uniqueConcepts / totalItems) * 200);

  return Math.round(freshnessScore * 0.4 + duplicateScore * 0.3 + conceptScore * 0.3);
}

/**
 * Fetch all knowledge health metrics for an org.
 *
 * @param orgId Internal org UUID (from the users table, not the Clerk org ID).
 */
export async function fetchKnowledgeHealth(orgId: string): Promise<KnowledgeHealthData> {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalItems },
    { count: itemsThisWeek },
    { count: itemsThisMonth },
    { count: freshItems },
    { count: duplicateAlerts },
    { count: staleAlerts },
    { count: uniqueConcepts },
    { data: agentSettings },
    knowledgeStatus,
  ] = await Promise.all([
    supabaseAdmin
      .from('content')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at', null),

    supabaseAdmin
      .from('content')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .gte('created_at', sevenDaysAgo),

    supabaseAdmin
      .from('content')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .gte('created_at', thirtyDaysAgo),

    supabaseAdmin
      .from('content')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .gte('updated_at', ninetyDaysAgo),

    supabaseAdmin
      .from('agent_activity_log')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('action_type', 'detect_duplicate'),

    supabaseAdmin
      .from('agent_activity_log')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('action_type', 'detect_stale'),

    supabaseAdmin
      .from('knowledge_concepts')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId),

    supabaseAdmin
      .from('org_agent_settings')
      .select('curator_enabled, global_agent_enabled')
      .eq('org_id', orgId)
      .maybeSingle(),

    fetchKnowledgeStatusSummary(orgId),
  ]);

  // Curator is enabled only when both the global toggle and the curator toggle are on.
  const curatorEnabled =
    (agentSettings?.curator_enabled ?? false) &&
    (agentSettings?.global_agent_enabled ?? true);

  const total = totalItems ?? 0;
  const fresh = freshItems ?? 0;
  const dupes = duplicateAlerts ?? 0;
  const concepts = uniqueConcepts ?? 0;

  return {
    curatorEnabled,
    totalItems: total,
    itemsThisWeek: itemsThisWeek ?? 0,
    itemsThisMonth: itemsThisMonth ?? 0,
    duplicateAlerts: dupes,
    staleAlerts: staleAlerts ?? 0,
    uniqueConcepts: concepts,
    freshItems: fresh,
    healthScore: computeHealthScore(total, fresh, dupes, concepts),
    hasContent: total > 0,
    knowledgeStatus,
  };
}

export async function fetchKnowledgeOperationalMetrics(
  orgId: string,
): Promise<KnowledgeOperationalMetrics> {
  const [knowledgeStatus, reviewQueueKinds] = await Promise.all([
    fetchKnowledgeStatusSummary(orgId),
    listReviewQueueItems(orgId)
      .then((items) => items.map((item) => item.kind))
      .catch((error) => {
        console.warn(
          '[knowledge-health] Failed to load review queue items for operational metrics:',
          error,
        );
        return [] as ReviewQueueKind[];
      }),
  ]);

  const reviewQueueCounts = summarizeReviewQueueKindCounts(reviewQueueKinds);
  return deriveKnowledgeOperationalMetrics({
    knowledgeStatus,
    reviewQueueCounts,
  });
}
