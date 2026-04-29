import { NextRequest } from 'next/server';

import {
  apiHandler,
  errors,
  requireSystemAdmin,
  successResponse,
} from '@/lib/utils/api';
import { createVendorSourceOpsService } from '@/lib/services/vendor-source-ops';
import { createVendorSourceRegistryService } from '@/lib/services/vendor-source-registry';
import { vendorIngestInputSchema } from '@/lib/schemas/vendor-source';

export const GET = apiHandler(async () => {
  await requireSystemAdmin();

  const service = createVendorSourceOpsService();
  const snapshot = await service.getSnapshot();

  return successResponse(snapshot);
});

export const POST = apiHandler(async (request: NextRequest) => {
  await requireSystemAdmin();

  const rawBody = await request.json().catch(() => null);
  const parsed = vendorIngestInputSchema.safeParse(rawBody);

  if (!parsed.success) {
    return errors.badRequest(
      parsed.error.issues.map((issue) => issue.message).join('; '),
    );
  }

  const sourceUrl = new URL(parsed.data.url);
  const registry = createVendorSourceRegistryService();
  const source = await registry.upsertSource({
    app: parsed.data.app,
    sourceKind: 'documentation',
    sourceUrl: sourceUrl.toString(),
    publisherHostname: derivePublisherHostname(sourceUrl.hostname),
    officialSource: true,
    fetchStrategy: 'sanctioned_crawl',
    termsReviewStatus: 'approved',
  });

  return successResponse({ source }, undefined, 201);
});

function derivePublisherHostname(hostname: string): string {
  const normalized = hostname.trim().toLowerCase().replace(/^www\./, '');
  const parts = normalized.split('.').filter(Boolean);

  if (parts.length <= 2) {
    return normalized;
  }

  return parts.slice(-2).join('.');
}
