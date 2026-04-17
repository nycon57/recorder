import { NextRequest } from 'next/server';

import {
  getLatestExtensionDebugSessionReview,
  parseExtensionDebugSessionFilters,
} from '@/lib/services/extension-debug-sessions';
import {
  apiHandler,
  errors,
  requireAdmin,
  successResponse,
} from '@/lib/utils/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireAdmin();
  const { searchParams } = new URL(request.url);
  const filters = parseExtensionDebugSessionFilters({
    app: searchParams.get('app') ?? undefined,
    host: searchParams.get('host') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    q: searchParams.get('q') ?? undefined,
    since: searchParams.get('since') ?? undefined,
    limit: '1',
  });

  const review = await getLatestExtensionDebugSessionReview({
    orgId,
    filters,
  });

  if (!review) {
    return errors.notFound('Extension debug session');
  }

  return successResponse(review);
});
