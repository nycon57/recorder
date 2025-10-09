/**
 * Search API
 *
 * Semantic search across all recordings using vector similarity.
 * Supports filtering by recording, date range, and source type.
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse, parseBody } from '@/lib/utils/api';
import { vectorSearch, hybridSearch } from '@/lib/services/vector-search';
import { withRateLimit } from '@/lib/rate-limit/middleware';
import { z } from 'zod';

const searchSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  limit: z.number().int().min(1).max(100).optional().default(10),
  threshold: z.number().min(0).max(1).optional().default(0.7),
  recordingIds: z.array(z.string().uuid()).optional(),
  source: z.enum(['transcript', 'document']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  mode: z.enum(['vector', 'hybrid']).optional().default('vector'),
});

type SearchBody = z.infer<typeof searchSchema>;

/**
 * POST /api/search
 * Perform semantic search
 */
export const POST = withRateLimit(
  apiHandler(async (request: NextRequest) => {
    const { orgId, userId } = await requireOrg();
    const body = await parseBody(request, searchSchema);

  const {
    query,
    limit,
    threshold,
    recordingIds,
    source,
    dateFrom,
    dateTo,
    mode,
  } = body as SearchBody;

  // Build search options
  const searchOptions = {
    orgId,
    limit,
    threshold,
    recordingIds,
    source,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
  };

  // Execute search based on mode
  const results =
    mode === 'hybrid'
      ? await hybridSearch(query, searchOptions)
      : await vectorSearch(query, searchOptions);

    return successResponse({
      query,
      results,
      count: results.length,
      mode,
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
