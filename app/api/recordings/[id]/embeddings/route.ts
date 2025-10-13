import { NextRequest } from 'next/server';
import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import {
  checkEmbeddingsStatus,
  getStalenessMessage,
  triggerEmbeddingsRefresh,
} from '@/lib/utils/embeddings';

/**
 * GET /api/recordings/[id]/embeddings
 * Check embeddings status for a recording
 * Returns staleness information and refresh recommendations
 */
export const GET = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const { id } = await params;

    // Check embeddings status
    const status = await checkEmbeddingsStatus(id);

    return successResponse({
      recordingId: id,
      exists: status.exists,
      isStale: status.isStale,
      needsRefresh: status.needsRefresh,
      lastUpdated: status.lastUpdated,
      chunkCount: status.chunkCount,
      message: getStalenessMessage(status),
      staleness: status.staleness,
      recommendation: status.isStale
        ? 'Embeddings should be refreshed to ensure accurate search results'
        : 'Embeddings are up to date',
    });
  }
);

/**
 * POST /api/recordings/[id]/embeddings
 * Trigger embeddings refresh for a recording
 * Deletes old chunks and enqueues regeneration
 */
export const POST = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const { id } = await params;

    try {
      const result = await triggerEmbeddingsRefresh(id, orgId);

      return successResponse(
        {
          recordingId: id,
          jobId: result.jobId,
          message: result.message,
          status: 'Embeddings will be regenerated shortly',
        },
        undefined,
        202 // Accepted
      );
    } catch (error) {
      console.error('[POST /embeddings] Error:', error);

      if (error instanceof Error) {
        if (error.message.includes('transcript and document')) {
          return errors.badRequest(error.message);
        }
      }

      return errors.internalError();
    }
  }
);
