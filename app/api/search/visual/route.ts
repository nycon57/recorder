/**
 * Visual Search API Route
 *
 * POST /api/search/visual - Search video frames by visual content
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { apiHandler, requireOrg, successResponse, parseBody, errors } from '@/lib/utils/api';
import { visualSearchSchema } from '@/lib/validations/api';
import { visualSearch, isVisualSearchEnabled } from '@/lib/services/multimodal-search';
import { withRateLimit } from '@/lib/rate-limit/middleware';

type VisualSearchBody = z.infer<typeof visualSearchSchema>;

/**
 * POST /api/search/visual
 * Perform visual-only search across video frames
 */
export const POST = withRateLimit(
  apiHandler(async (request: NextRequest) => {
    const { orgId, userId } = await requireOrg();
    const body = await parseBody(request, visualSearchSchema);

    const {
      query,
      limit = 20,
      threshold = 0.7,
      recordingIds,
      includeOcr = true,
      dateFrom,
      dateTo,
    } = body as VisualSearchBody;

    console.log('[Visual Search API] Request:', {
      query: query.substring(0, 50),
      orgId,
      userId,
      limit,
      threshold,
    });

    // Check if visual search is enabled
    if (!isVisualSearchEnabled()) {
      return successResponse({
        results: [],
        count: 0,
        query,
        message: 'Visual search is currently disabled. Enable with ENABLE_VISUAL_SEARCH=true',
      });
    }

    const searchStartTime = Date.now();

    // Perform visual search
    const results = await visualSearch(query, {
      orgId,
      limit,
      threshold,
      recordingIds,
      includeOcr,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    });

    const searchTime = Date.now() - searchStartTime;

    return successResponse({
      query,
      results,
      count: results.length,
      mode: 'visual',
      timings: {
        searchMs: searchTime,
      },
      metadata: {
        threshold,
        includeOcr,
        recordingIdsFilter: recordingIds?.length || 0,
      },
    });
  }),
  {
    limiter: 'search',
    identifier: async (req) => {
      const { userId } = await requireOrg();
      return userId;
    },
  }
);