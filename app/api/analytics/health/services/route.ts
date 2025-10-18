import { NextRequest } from 'next/server';

import { apiHandler, requireAuth, successResponse } from '@/lib/utils/api';
import { checkExternalServices } from '@/lib/utils/health-checks';

/**
 * GET /api/analytics/health/services
 *
 * Get external service status
 *
 * Returns:
 * - services: Array of external service status objects
 */
export const GET = apiHandler(async (request: NextRequest) => {
  await requireAuth();

  const services = await checkExternalServices(true);

  return successResponse({
    services,
    timestamp: new Date().toISOString(),
  });
});
