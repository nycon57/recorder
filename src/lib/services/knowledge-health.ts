/**
 * Knowledge Health Service
 *
 * Computes knowledge health metrics and an overall score (0–100) for an org.
 * All queries run in parallel to minimise latency.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';

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
  };
}
