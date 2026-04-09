/**
 * What-If Scenario Analysis API
 *
 * POST /api/analytics/costs/what-if
 * - Run custom what-if scenario analysis
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse, errors, parseBody } from '@/lib/utils/api';
import { runWhatIfScenario } from '@/lib/services/cost-analysis';
import { z } from 'zod';

/**
 * POST /api/analytics/costs/what-if
 *
 * Run what-if scenario analysis
 *
 * Request body:
 * - monthlyGrowthRate?: number (percentage)
 * - deduplicationRate?: number (percentage)
 * - compressionRatio?: number (percentage)
 * - tierDistribution?: { hot?: number, warm?: number, cold?: number, glacier?: number }
 *
 * @example
 * POST /api/analytics/costs/what-if
 * Body: {
 *   "deduplicationRate": 30,
 *   "compressionRatio": 25,
 *   "tierDistribution": { "hot": 20, "warm": 50, "cold": 25, "glacier": 5 }
 * }
 */
const whatIfSchema = z.object({
  monthlyGrowthRate: z.number().min(-100).max(1000).optional(),
  deduplicationRate: z.number().min(0).max(100).optional(),
  compressionRatio: z.number().min(0).max(100).optional(),
  tierDistribution: z
    .object({
      hot: z.number().min(0).max(100).optional(),
      warm: z.number().min(0).max(100).optional(),
      cold: z.number().min(0).max(100).optional(),
      glacier: z.number().min(0).max(100).optional(),
    })
    .optional()
    .refine(
      (dist) => {
        if (!dist) return true;
        const total = (dist.hot || 0) + (dist.warm || 0) + (dist.cold || 0) + (dist.glacier || 0);
        return Math.abs(total - 100) < 0.01; // Allow small floating point errors
      },
      { message: 'Tier distribution percentages must sum to 100' }
    ),
});

export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const body = await parseBody(request, whatIfSchema);

  try {
    // Type assertion for parsed body - runWhatIfScenario expects WhatIfScenario['assumptions']
    const scenario = await runWhatIfScenario(orgId, body as any);

    return successResponse({
      scenario,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Analytics What-If] Error:', error);
    throw new Error(
      `Failed to run what-if analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});
