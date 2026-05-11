import { NextRequest } from 'next/server';

import { buildKnowledgeGraph } from '@/lib/services/knowledge-graph';
import {
  knowledgeGraphQuerySchema,
  type KnowledgeGraphQueryInput,
} from '@/lib/types/knowledge-graph';
import {
  apiHandler,
  parseSearchParams,
  requireOrg,
  successResponse,
} from '@/lib/utils/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/knowledge/graph
 *
 * Returns a normalized operational graph over:
 * - org wiki pages
 * - vendor wiki pages
 * - wiki relationships
 * - wiki clusters
 *
 * Shape:
 *   {
 *     nodes: [...],
 *     edges: [...],
 *     meta: { counts, limits, generatedAt, orgId }
 *   }
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const query = parseSearchParams<KnowledgeGraphQueryInput>(
    request,
    knowledgeGraphQuerySchema,
  );

  const [payload, { CacheControlHeaders, generateETag }] = await Promise.all([
    buildKnowledgeGraph({
      orgId,
      query,
    }),
    import('@/lib/services/cache'),
  ]);
  const response = successResponse(payload);
  response.headers.set('Cache-Control', CacheControlHeaders.metadata);
  response.headers.set('ETag', generateETag(payload));

  return response;
});
