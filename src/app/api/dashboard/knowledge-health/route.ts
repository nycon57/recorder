import {
  apiHandler,
  requireOrg,
  successResponse,
  generateRequestId,
} from '@/lib/utils/api';
import { fetchKnowledgeHealth } from '@/lib/services/knowledge-health';

/**
 * GET /api/dashboard/knowledge-health
 *
 * Returns knowledge health metrics and an overall score for the authenticated org.
 *
 * @access Protected — requires org context
 *
 * @returns {KnowledgeHealthData} curatorEnabled, totalItems, itemsThisWeek,
 *   itemsThisMonth, duplicateAlerts, staleAlerts, uniqueConcepts, freshItems,
 *   healthScore, hasContent
 */
export const GET = apiHandler(async () => {
  const requestId = generateRequestId();
  const { orgId } = await requireOrg();
  const data = await fetchKnowledgeHealth(orgId);

  return successResponse(data, requestId);
});
