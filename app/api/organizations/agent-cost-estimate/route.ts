import {
  apiHandler,
  requireAdmin,
  successResponse,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { estimateMonthlyAgentCost } from '@/lib/services/agent-cost-estimator';

/**
 * GET /api/organizations/agent-cost-estimate
 * Returns the estimated monthly agent cost based on current content volume.
 */
export const GET = apiHandler(async () => {
  const { orgId } = await requireAdmin();

  const { count, error } = await supabaseAdmin
    .from('content')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (error) {
    console.error('[agent-cost-estimate] Failed to count content:', error.message);
  }

  const estimate = estimateMonthlyAgentCost(count ?? 0);

  return successResponse({
    contentCount: count ?? 0,
    ...estimate,
  });
});
