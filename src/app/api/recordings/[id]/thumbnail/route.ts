/**
 * PUT/DELETE /api/recordings/[id]/thumbnail
 *
 * Update or delete thumbnail for existing content.
 * Unlike upload-url (for initial upload), this handles post-upload modifications.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  generateRequestId,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'thumbnail-update' });

/**
 * Validation schema for PUT request
 */
const updateThumbnailSchema = z.object({
  thumbnailData: z.string().min(1, 'Thumbnail data is required'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    errorMap: () => ({ message: 'Invalid mime type. Allowed: image/jpeg, image/png, image/webp' }),
  }),
});

/**
 * Map mime type to file extension
 */
const mimeToExtension: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * PUT /api/recordings/[id]/thumbnail
 *
 * Update thumbnail for existing content (crop or replace)
 */
export const PUT = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const requestId = generateRequestId();
  const { orgId } = await requireOrg();
  const { id: recordingId } = await params;
  const supabase = supabaseAdmin;

  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = updateThumbnailSchema.safeParse(body);

    if (!validation.success) {
      logger.warn('Invalid thumbnail update request', {
        context: { requestId, recordingId },
        data: { errors: validation.error.errors },
      });
      return errors.badRequest(
        'Invalid request data',
        { errors: validation.error.errors },
        requestId
      );
    }

    const { thumbnailData, mimeType } = validation.data;

    logger.info('Updating thumbnail', {
      context: { requestId, orgId, recordingId },
      data: { mimeType, dataLength: thumbnailData.length },
    });

    // Verify content exists and belongs to org
    const { data: recording, error: fetchError } = await supabase
      .from('content')
      .select('id, org_id, thumbnail_url')
      .eq('id', recordingId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !recording) {
      logger.warn('Content not found', {
        context: { requestId, recordingId, orgId },
      });
      return errors.notFound('Content not found', requestId);
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(thumbnailData, 'base64');
    const extension = mimeToExtension[mimeType];
    const storagePath = `org_${orgId}/recordings/${recordingId}/thumbnail.${extension}`;

    // Delete old thumbnail if exists with different extension
    if (recording.thumbnail_url) {
      const oldPathMatch = recording.thumbnail_url.match(/thumbnail\.\w+$/);
      if (oldPathMatch) {
        const oldPath = `org_${orgId}/recordings/${recordingId}/${oldPathMatch[0]}`;
        if (oldPath !== storagePath) {
          logger.info('Removing old thumbnail with different extension', {
            context: { requestId, recordingId },
            data: { oldPath, newPath: storagePath },
          });
          await supabase.storage.from('thumbnails').remove([oldPath]);
        }
      }
    }

    // Upload new thumbnail
    const { error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      logger.error('Thumbnail upload failed', {
        context: { requestId, recordingId },
        error: uploadError as Error,
      });
      return errors.internalError(requestId);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('thumbnails')
      .getPublicUrl(storagePath);

    const thumbnailUrl = urlData.publicUrl;

    // Update content record
    const { error: updateError } = await supabase
      .from('content')
      .update({
        thumbnail_url: thumbnailUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordingId);

    if (updateError) {
      logger.error('Database update failed', {
        context: { requestId, recordingId },
        error: updateError as Error,
      });
      return errors.internalError(requestId);
    }

    logger.info('Thumbnail updated successfully', {
      context: { requestId, recordingId },
      data: { thumbnailUrl, storagePath },
    });

    return successResponse({ thumbnailUrl, storagePath }, requestId);
  } catch (error: any) {
    logger.error('Thumbnail update error', {
      context: { requestId, orgId, recordingId },
      error: error as Error,
    });
    return errors.internalError(requestId);
  }
});

/**
 * DELETE /api/recordings/[id]/thumbnail
 *
 * Remove thumbnail entirely from content
 */
export const DELETE = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const requestId = generateRequestId();
  const { orgId } = await requireOrg();
  const { id: recordingId } = await params;
  const supabase = supabaseAdmin;

  try {
    logger.info('Deleting thumbnail', {
      context: { requestId, orgId, recordingId },
    });

    // Verify content exists and belongs to org
    const { data: recording, error: fetchError } = await supabase
      .from('content')
      .select('id, org_id, thumbnail_url')
      .eq('id', recordingId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !recording) {
      logger.warn('Content not found', {
        context: { requestId, recordingId, orgId },
      });
      return errors.notFound('Content not found', requestId);
    }

    // Delete from storage if exists
    if (recording.thumbnail_url) {
      // Extract path from URL: org_{orgId}/recordings/{recordingId}/thumbnail.{ext}
      const pathMatch = recording.thumbnail_url.match(
        /org_[^/]+\/recordings\/[^/]+\/thumbnail\.\w+/
      );
      if (pathMatch) {
        logger.info('Removing thumbnail from storage', {
          context: { requestId, recordingId },
          data: { storagePath: pathMatch[0] },
        });

        const { error: deleteError } = await supabase.storage
          .from('thumbnails')
          .remove([pathMatch[0]]);

        if (deleteError) {
          logger.warn('Failed to delete thumbnail from storage (continuing anyway)', {
            context: { requestId, recordingId },
            error: deleteError as Error,
          });
          // Continue anyway - we still want to clear the database reference
        }
      }
    }

    // Set thumbnail_url to null
    const { error: updateError } = await supabase
      .from('content')
      .update({
        thumbnail_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordingId);

    if (updateError) {
      logger.error('Database update failed', {
        context: { requestId, recordingId },
        error: updateError as Error,
      });
      return errors.internalError(requestId);
    }

    logger.info('Thumbnail deleted successfully', {
      context: { requestId, recordingId },
    });

    return successResponse({ success: true, message: 'Thumbnail removed' }, requestId);
  } catch (error: any) {
    logger.error('Thumbnail delete error', {
      context: { requestId, orgId, recordingId },
      error: error as Error,
    });
    return errors.internalError(requestId);
  }
});

/**
 * GET/POST not supported - use upload-url for initial uploads
 */
export const GET = apiHandler(async () => {
  return errors.badRequest('Method not allowed. Use PUT to update or DELETE to remove thumbnail.');
});

export const POST = apiHandler(async () => {
  return errors.badRequest('Method not allowed. Use PUT to update or DELETE to remove thumbnail.');
});
