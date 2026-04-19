import { NextRequest } from 'next/server';

import { buildKnowledgeDocsList } from '@/lib/services/knowledge-docs';
import { knowledgeDocsQuerySchema } from '@/lib/types/knowledge-docs';
import {
  apiHandler,
  parseSearchParams,
  requireOrg,
  successResponse,
} from '@/lib/utils/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/knowledge/docs
 *
 * Canonical compiled docs list (org wiki pages) with operational filters:
 * - type
 * - status
 * - app
 * - vendor coverage
 * - cluster
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const query = parseSearchParams(request, knowledgeDocsQuerySchema);

  const payload = await buildKnowledgeDocsList({
    orgId,
    query,
  });

  return successResponse(payload);
});
