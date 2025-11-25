/**
 * Cost Analysis API
 *
 * GET /api/analytics/costs
 * - Returns detailed cost breakdown and projections
 *
 * POST /api/analytics/costs/forecast
 * - Generate cost forecast for specified period
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse, errors, parseBody } from '@/lib/utils/api';
import {
  calculateCostBreakdown,
  generateCostForecast,
  generateComparisonReport,
} from '@/lib/services/cost-analysis';
import { z } from 'zod';

/**
 * GET /api/analytics/costs
 *
 * Get detailed cost breakdown and analysis
 *
 * Query parameters:
 * - includeComparison: boolean (default: false) - Include optimized vs current comparison
 *
 * @example
 * GET /api/analytics/costs?includeComparison=true
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();

  const { searchParams } = new URL(request.url);
  const includeComparison = searchParams.get('includeComparison') === 'true';

  try {
    const costBreakdown = await calculateCostBreakdown(orgId);

    let comparison = undefined;
    if (includeComparison) {
      comparison = await generateComparisonReport(orgId);
    }

    return successResponse({
      costs: costBreakdown,
      comparison,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Analytics Costs] Error:', error);
    throw new Error(
      `Failed to fetch cost analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});

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

  // Check if this is a forecast or what-if request
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname.endsWith('/forecast')) {
    const body = await parseBody(request, forecastSchema);

    try {
      // Type assertion for parsed body
      const { period } = body as { period: '30d' | '90d' | '180d' | '365d' };
      const forecast = await generateCostForecast(orgId, period);

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
  }

  throw errors.notFound('Endpoint not found');
});
