import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** GET /api/knowledge-gaps - List open and acknowledged knowledge gaps for the org, ranked by impact. */
export const GET = apiHandler(async () => {
  const { orgId } = await requireOrg();

  const { data, error } = await supabaseAdmin
    .from('knowledge_gaps')
    .select('*')
    .eq('org_id', orgId)
    .in('status', ['open', 'acknowledged'])
    .order('impact_score', { ascending: false });

  if (error) {
    console.error('[GET /api/knowledge-gaps]', error);
    throw new Error('Failed to fetch knowledge gaps');
  }

  return successResponse({ gaps: data ?? [] });
});
