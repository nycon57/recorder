import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { checkUsageLimits } from '@/lib/services/usage-alerts';

/**
 * GET /api/organizations/usage-alert
 *
 * Returns the current usage alert for the org, or null when usage is below
 * the warning threshold (80%). Used by UsageAlertBanner on the agent settings
 * and usage pages.
 */
export const GET = apiHandler(async () => {
  const { orgId } = await requireOrg();
  const alert = await checkUsageLimits(orgId);
  return successResponse(alert);
});
