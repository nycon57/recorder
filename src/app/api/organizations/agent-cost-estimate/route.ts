import {
  apiHandler,
  requireAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { estimateMonthlyAgentCost } from '@/lib/services/agent-cost-estimator';

export const GET = apiHandler(async () => {
  const { orgId } = await requireAdmin();

  const { count, error } = await supabaseAdmin
    .from('content')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (error) {
    console.error('[agent-cost-estimate] Failed to count content:', error.message);
    return errors.internalError();
  }

  const contentCount = count ?? 0;

  return successResponse({
    contentCount,
    ...estimateMonthlyAgentCost(contentCount),
  });
});
