/**
 * GET /api/recordings/[id]/thumbnail/upload-url
 *
 * Generate a fresh presigned upload URL for a custom thumbnail.
 * This endpoint is called before uploading a custom thumbnail to ensure the URL hasn't expired.
 */

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  generateRequestId,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'thumbnail-upload-url' });

/**
 * GET /api/recordings/[id]/thumbnail/upload-url
 *
 * Generate fresh presigned upload URL for custom thumbnail
 */
export const GET = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const requestId = generateRequestId();
  const { orgId } = await requireOrg();
  const supabase = supabaseAdmin;
  const { id: recordingId } = await params;

  try {
    logger.info('Generating fresh thumbnail upload URL', {
      context: { requestId, orgId, recordingId },
    });

    // Extract and validate contentType query parameter
    const url = new URL(request.url);
    const contentType = url.searchParams.get('contentType') || 'image/jpeg';

    // Map content type to file extension
    const contentTypeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };

    const extension = contentTypeToExt[contentType.toLowerCase()];
    if (!extension) {
      logger.warn('Invalid content type for thumbnail', {
        context: { requestId, contentType },
      });
      return errors.badRequest(
        `Invalid content type. Allowed types: ${Object.keys(contentTypeToExt).join(', ')}`,
        { contentType },
        requestId
      );
    }

    // Verify recording exists and belongs to org
    const { data: recording, error: fetchError } = await supabase
      .from('content')
      .select('id, org_id, status')
      .eq('id', recordingId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !recording) {
      logger.warn('Recording not found', {
        context: { requestId, recordingId, orgId },
      });
      return errors.notFound('Recording not found', requestId);
    }

    // Verify recording is in uploading status
    if (recording.status !== 'uploading') {
      logger.warn('Recording not in uploading status', {
        context: { requestId, recordingId, status: recording.status },
      });
      return errors.badRequest(
        `Recording is not ready for thumbnail upload. Current status: ${recording.status}`,
        { currentStatus: recording.status },
        requestId
      );
    }

    // Generate fresh presigned upload URL for thumbnail with correct extension
    const thumbnailPath = `${orgId}/uploads/${recordingId}/thumbnail.${extension}`;

    const { data: thumbnailUploadData, error: uploadUrlError } = await supabase.storage
      .from('content')
      .createSignedUploadUrl(thumbnailPath, {
        upsert: true, // Allow overwriting existing thumbnail
      });

    if (uploadUrlError || !thumbnailUploadData) {
      logger.error('Failed to generate thumbnail upload URL', {
        context: { requestId, recordingId },
        error: uploadUrlError as Error,
      });
      return errors.internalError(requestId);
    }

    logger.info('Thumbnail upload URL generated', {
      context: { requestId, recordingId },
      data: { thumbnailPath },
    });

    return successResponse(
      {
        uploadUrl: thumbnailUploadData.signedUrl,
        path: thumbnailPath,
        token: thumbnailUploadData.token,
      },
      requestId
    );
  } catch (error: any) {
    logger.error('Thumbnail upload URL generation error', {
      context: { requestId, orgId, recordingId },
      error: error as Error,
    });
    return errors.internalError(requestId);
  }
});

/**
 * POST not supported
 */
export const POST = apiHandler(async () => {
  return errors.badRequest('Method not allowed. Use GET to get upload URL.');
});
