import { NextRequest } from 'next/server';

import { getExtensionDebugSessionReview } from '@/lib/services/extension-debug-sessions';
import {
  apiHandler,
  errors,
  requireAdmin,
  successResponse,
} from '@/lib/utils/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export const GET = apiHandler(
  async (_request: NextRequest, context: RouteContext) => {
    const review = await Promise.all([requireAdmin(), context.params]).then(
      ([{ orgId }, { sessionId }]) =>
        getExtensionDebugSessionReview({
          orgId,
          sessionId,
        }),
    );

    if (!review) {
      return errors.notFound('Extension debug session');
    }

    return successResponse(review);
  },
);
