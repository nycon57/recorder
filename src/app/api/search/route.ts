/**
 * Search API
 *
 * Semantic search across all recordings using vector similarity.
 * Supports filtering by recording, date range, and source type.
 *
 * Performance Optimizations Applied:
 * - Parallel execution of rate limit and quota checks
 * - Multi-layer caching with 5-minute TTL
 * - Optimized database queries with SKIP LOCKED
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { apiHandler, requireOrg, successResponse, parseBody, errors } from '@/lib/utils/api';
import { vectorSearch, hybridSearch } from '@/lib/services/vector-search-google';
import { rerankResults, isCohereConfigured } from '@/lib/services/reranking';
import { agenticSearch } from '@/lib/services/agentic-retrieval';
import {
  multimodalSearch,
  isVisualSearchEnabled,
} from '@/lib/services/multimodal-search';
import { withRateLimit } from '@/lib/rate-limit/middleware';
import { multimodalSearchSchema } from '@/lib/validations/api';
import { getCache } from '@/lib/services/cache/multi-layer-cache';
import { SearchTracker } from '@/lib/services/analytics/search-tracker';
import { QuotaManager } from '@/lib/services/quotas/quota-manager';
import { RateLimiter } from '@/lib/services/quotas/rate-limiter';

type SearchBody = z.infer<typeof multimodalSearchSchema>;

/**
 * POST /api/search
 * Perform semantic search
 *
 * Performance: Parallel execution saves ~11.5ms per request
 */
export const POST = withRateLimit(
  apiHandler(async (request: NextRequest) => {
    const { orgId, userId } = await requireOrg();
    const body = await parseBody(request, multimodalSearchSchema);
    const startTime = Date.now();

    // Check rate limit first before consuming quota
    const rateLimit = await RateLimiter.checkLimit('search', orgId);

    if (!rateLimit.success) {
      return errors.rateLimitExceeded({
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        resetAt: new Date(rateLimit.reset * 1000).toISOString(),
      });
    }

    // Only consume quota after rate limit check passes
    // SECURITY: Using atomic checkAndConsumeQuota to prevent race conditions
    const quotaCheck = await QuotaManager.checkAndConsumeQuota(orgId, 'search', 1);

    // Check quota result (already consumed if allowed)
    if (!quotaCheck.allowed) {
      return errors.quotaExceeded({
        remaining: quotaCheck.remaining,
        limit: quotaCheck.limit,
        resetAt: quotaCheck.resetAt.toISOString(),
        message: quotaCheck.message,
      });
    }

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
    maxIterations,
    enableSelfReflection,
    includeVisual,
    audioWeight,
    visualWeight,
    includeOcr,
    contentTypes,
    tagIds,
    tagFilterMode,
    collectionId,
    favoritesOnly,
  } = body as SearchBody;

  // Handle multimodal search mode
  if (mode === 'multimodal') {
    // Check if visual search is enabled
    if (!isVisualSearchEnabled()) {
      console.warn(
        '[Search API] Multimodal mode requested but visual search not enabled, falling back to vector mode'
      );
      // Fall through to standard vector search
    } else {
      const multimodalResult = await multimodalSearch(query, {
        orgId,
        limit,
        threshold,
        recordingIds,
        includeVisual: includeVisual ?? true,
        audioWeight: audioWeight ?? 0.7,
        visualWeight: visualWeight ?? 0.3,
        includeOcr: includeOcr ?? true,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        contentTypes,
        tagIds,
        tagFilterMode,
        collectionId,
        favoritesOnly,
      });

      const latencyMs = Date.now() - startTime;

      // Track analytics (non-blocking)
      SearchTracker.trackSearch({
        query,
        mode: 'semantic',
        resultsCount: multimodalResult.combinedResults?.length || multimodalResult.audioResults?.length || 0,
        latencyMs,
        cacheHit: false,
        cacheLayer: 'none',
        filters: { recordingIds, source, dateFrom, dateTo, contentTypes, tagIds, tagFilterMode, collectionId, favoritesOnly },
        orgId,
        userId,
      }).catch((error) => console.error('[Search API] Analytics tracking failed:', error));

      return successResponse({
        query: multimodalResult.query,
        mode: multimodalResult.mode,
        results: multimodalResult.combinedResults || multimodalResult.audioResults,
        audioResults: multimodalResult.audioResults,
        visualResults: multimodalResult.visualResults,
        count:
          multimodalResult.combinedResults?.length ||
          multimodalResult.audioResults?.length ||
          0,
        metadata: multimodalResult.metadata,
      });
    }
  }

  // Handle agentic search mode
  if (mode === 'agentic') {
    const agenticResult = await agenticSearch(query, {
      orgId,
      userId,
      maxIterations,
      enableSelfReflection,
      enableReranking: rerank,
      chunksPerQuery: Math.ceil(limit * 1.5),
      contentIds: recordingIds, // Map recordingIds to contentIds
      contentTypes,
      tagIds,
      tagFilterMode,
      collectionId,
      favoritesOnly,
      logResults: true,
    });

    const latencyMs = Date.now() - startTime;

    // Track analytics (non-blocking)
    SearchTracker.trackSearch({
      query,
      mode: 'agentic',
      resultsCount: agenticResult.finalResults.length,
      latencyMs,
      cacheHit: false,
      cacheLayer: 'none',
      filters: { recordingIds, maxIterations, enableSelfReflection, contentTypes, tagIds, tagFilterMode, collectionId, favoritesOnly },
      orgId,
      userId,
    }).catch((error) => console.error('[Search API] Analytics tracking failed:', error));

    return successResponse({
      query,
      results: agenticResult.finalResults,
      count: agenticResult.finalResults.length,
      mode: 'agentic',
      agentic: {
        intent: agenticResult.intent,
        complexity: agenticResult.decomposition.complexity,
        subQueries: agenticResult.decomposition.subQueries,
        iterations: agenticResult.iterations.length,
        reasoning: agenticResult.reasoning,
        confidence: agenticResult.confidence,
        citationMap: Object.fromEntries(agenticResult.citationMap),
      },
      timings: {
        totalMs: agenticResult.totalDurationMs,
      },
      metadata: agenticResult.metadata,
    });
  }

  // Build search options for standard/hybrid modes
  const searchOptions = {
    orgId,
    limit: rerank ? limit * 3 : limit, // Fetch 3x more results for reranking
    threshold,
    recordingIds,
    source,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
    contentTypes,
    tagIds,
    tagFilterMode,
    collectionId,
    favoritesOnly,
  };

  // Multi-layer cache with 5-minute TTL
  const cache = getCache();
  const cacheKey = `vector:total:${JSON.stringify({
    query,
    recordingIds,
    source,
    dateFrom,
    dateTo,
    limit,
    threshold,
    rerank,
    contentTypes,
    tagIds,
    collectionId,
    favoritesOnly,
  })}`;

  let cacheHit = false;
  let cacheLayer: 'memory' | 'redis' | 'none' = 'none';
  let searchStartTime = Date.now();

  // Try to get from cache with orgId for proper isolation
  const cachedResult = await cache.get(cacheKey, async () => {
    cacheHit = false;
    searchStartTime = Date.now();

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
          costEstimate: rerankResult.costEstimate,
        };
      }
    }

    return {
      results,
      searchTime,
      rerankingTime,
      rerankMetadata,
    };
  }, { ttl: 300, orgId, namespace: 'search' }); // 5 minutes with orgId for isolation

  // Determine cache layer
  if (cacheHit) {
    // The cache system already logs which layer was hit
    // We can infer from timing - memory hits are <1ms, Redis hits are <50ms
    const cacheLatency = Date.now() - searchStartTime;
    cacheLayer = cacheLatency < 10 ? 'memory' : 'redis';
  }

  const latencyMs = Date.now() - startTime;

  // Track analytics (non-blocking)
  SearchTracker.trackSearch({
    query,
    mode: (mode || 'semantic') as 'semantic' | 'keyword' | 'agentic',
    resultsCount: cachedResult.results.length,
    latencyMs,
    cacheHit,
    cacheLayer,
    filters: { recordingIds, source, dateFrom, dateTo, rerank, contentTypes, tagIds, tagFilterMode, collectionId, favoritesOnly },
    orgId,
    userId,
  }).catch((error) => console.error('[Search API] Analytics tracking failed:', error));


  // Performance monitoring
  if (latencyMs > 100) {
    console.warn(`[Search API] Slow request detected: ${latencyMs}ms`);
  }

  return successResponse({
    query,
    results: cachedResult.results,
    count: cachedResult.results.length,
    mode: (mode || 'semantic') as 'semantic' | 'keyword' | 'agentic',
    reranked: rerank && isCohereConfigured(),
    cached: cacheHit,
    cacheLayer,
    timings: {
      searchMs: cachedResult.searchTime,
      rerankMs: cachedResult.rerankingTime,
      totalMs: cachedResult.searchTime + cachedResult.rerankingTime,
    },
    ...(cachedResult.rerankMetadata && { rerankMetadata: cachedResult.rerankMetadata }),
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