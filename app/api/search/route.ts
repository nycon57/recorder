/**
 * Search API
 *
 * Semantic search across all recordings using vector similarity.
 * Supports filtering by recording, date range, and source type.
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse, parseBody } from '@/lib/utils/api';
import { vectorSearch, hybridSearch } from '@/lib/services/vector-search-google';
import { rerankResults, isCohereConfigured } from '@/lib/services/reranking';
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
  rerank: z.boolean().optional().default(false),
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
    rerank,
  } = body as SearchBody;

  // Build search options
  const searchOptions = {
    orgId,
    limit: rerank ? limit * 3 : limit, // Fetch 3x more results for reranking
    threshold,
    recordingIds,
    source,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
  };

  const searchStartTime = Date.now();

  // Execute search based on mode
  let results =
    mode === 'hybrid'
      ? await hybridSearch(query, searchOptions)
      : await vectorSearch(query, searchOptions);

  const searchTime = Date.now() - searchStartTime;

  // Apply reranking if requested and Cohere is configured
  let rerankingTime = 0;
  let rerankMetadata;

  if (rerank) {
    if (!isCohereConfigured()) {
      console.warn('[Search API] Reranking requested but COHERE_API_KEY not configured');
    } else {
      const rerankResult = await rerankResults(query, results, {
        topN: limit,
        timeoutMs: 500,
      });

      results = rerankResult.results;
      rerankingTime = rerankResult.rerankingTime;
      rerankMetadata = {
        originalCount: rerankResult.originalCount,
        rerankedCount: rerankResult.rerankedCount,
        tokensUsed: rerankResult.tokensUsed,
        costEstimate: rerankResult.costEstimate,
      };
    }
  }

    return successResponse({
      query,
      results,
      count: results.length,
      mode,
      reranked: rerank && isCohereConfigured(),
      timings: {
        searchMs: searchTime,
        rerankMs: rerankingTime,
        totalMs: searchTime + rerankingTime,
      },
      ...(rerankMetadata && { rerankMetadata }),
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
