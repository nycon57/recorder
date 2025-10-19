/**
 * Cost Forecast API
 *
 * POST /api/analytics/costs/forecast
 * - Generate cost forecast for specified period
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse, errors, parseBody } from '@/lib/utils/api';
import { generateCostForecast } from '@/lib/services/cost-analysis';
import { z } from 'zod';

/**
 * POST /api/analytics/costs/forecast
 *
 * Generate cost forecast for specified period
 *
 * Request body:
 * - period: '30d' | '90d' | '180d' | '365d' (default: '90d')
 *
 * @example
 * POST /api/analytics/costs/forecast
 * Body: { "period": "180d" }
 */
const forecastSchema = z.object({
  period: z.enum(['30d', '90d', '180d', '365d']).optional().default('90d'),
});

export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const body = await parseBody(request, forecastSchema);

  try {
    const forecast = await generateCostForecast(orgId, body.period);

    return successResponse({
      forecast,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Analytics Forecast] Error:', error);
    throw new Error(
      `Failed to generate cost forecast: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});
