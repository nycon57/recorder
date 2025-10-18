/**
 * Deduplication Statistics API
 *
 * Provides real-time deduplication metrics and analytics for organizations.
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { getDeduplicationAnalytics } from '@/lib/workers/handlers/deduplicate-file';

/**
 * GET /api/storage/deduplication-stats
 *
 * Get deduplication statistics for the authenticated user's organization.
 *
 * Returns:
 * - Total files vs unique files
 * - Duplicate count and percentage
 * - Total storage vs actual storage used
 * - Space saved (bytes and percentage)
 * - Deduplication ratio
 * - Potential monthly cost savings
 *
 * @example
 * GET /api/storage/deduplication-stats
 * Response:
 * {
 *   "success": true,
 *   "stats": {
 *     "totalFiles": 1000,
 *     "uniqueFiles": 700,
 *     "duplicateFiles": 300,
 *     "totalStorageBytes": 5368709120,
 *     "actualStorageBytes": 3758096384,
 *     "spaceSavedBytes": 1610612736,
 *     "spaceSavedPercent": 30,
 *     "deduplicationRatio": 1.43,
 *     "potentialSavingsPerMonth": 0.03
 *   }
 * }
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();

  // Get deduplication analytics for the organization
  const analytics = await getDeduplicationAnalytics(orgId);

  if (!analytics.success) {
    return successResponse({
      success: false,
      error: analytics.error,
      stats: null,
    });
  }

  return successResponse({
    success: true,
    stats: analytics.stats,
    timestamp: new Date().toISOString(),
  });
});
