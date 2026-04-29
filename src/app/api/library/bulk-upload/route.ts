import { apiHandler, requireOrg } from '@/lib/utils/api';

const REPLACEMENT_UPLOAD_ENDPOINT = '/api/library/upload';

/**
 * POST /api/library/bulk-upload
 *
 * Deprecated: this JSON initializer used to create `uploading` rows without a
 * guaranteed storage upload or processing handoff. Use `/api/library/upload`
 * for first-party multi-file ingestion.
 */
export const POST = apiHandler(async () => {
  await requireOrg();

  return Response.json(
    {
      error: 'bulk_upload_deprecated',
      message:
        'This bulk upload initializer has been retired. Upload files with /api/library/upload so records are created, stored, and queued together.',
      replacement_endpoint: REPLACEMENT_UPLOAD_ENDPOINT,
    },
    { status: 410 },
  );
});
