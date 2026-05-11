import { NextRequest } from 'next/server';

import {
  apiHandler,
  errors,
  requireSystemAdmin,
  successResponse,
} from '@/lib/utils/api';
import { createVendorSourceRegistryService } from '@/lib/services/vendor-source-registry';
import { vendorSourceRetireSchema } from '@/lib/schemas/vendor-source';

export const POST = apiHandler(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;

    if (!id || typeof id !== 'string') {
      return errors.badRequest('Missing source id');
    }

    const [session, rawBody] = await Promise.all([
      requireSystemAdmin(),
      request.json().catch(() => null),
    ]);
    const parsed = vendorSourceRetireSchema.safeParse(rawBody);

    if (!parsed.success) {
      return errors.badRequest(
        parsed.error.issues.map((issue) => issue.message).join('; '),
      );
    }

    const registry = createVendorSourceRegistryService();
    await registry.retireSource({
      sourceId: id,
      retiredBy: session.userId,
      reason: parsed.data.reason,
      replacementSourceId: parsed.data.replacementSourceId ?? null,
    });

    return successResponse({ retired: true, sourceId: id });
  },
);
