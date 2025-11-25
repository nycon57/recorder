import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/utils/logger';

// GET /api/recordings/[id] - Get a specific recording
export const GET = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const supabase = await createClient();
    const { id } = await params;

    // Check for includeDeleted flag (for trash view)
    const url = new URL(request.url);
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';

    // Fetch content with related data
    let query = supabase
      .from('content')
      .select(
        `
      *,
      transcripts (*),
      documents (*)
    `
      )
      .eq('id', id)
      .eq('org_id', orgId);

    // Filter out soft-deleted items unless explicitly requested
    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    const { data: recording, error } = await query.single();

    if (error || !recording) {
      return errors.notFound('Recording');
    }

    // Generate signed video URLs if available
    // Prefer processed (MP4) for playback, fallback to raw (WEBM)
    let videoUrl = null;
    let downloadUrl = null;

    // Use processed version if available (MP4)
    if (recording.storage_path_processed) {
      const { data: urlData } = await supabase.storage
        .from('recordings')
        .createSignedUrl(recording.storage_path_processed, 3600); // 1 hour expiry

      videoUrl = urlData?.signedUrl || null;
      downloadUrl = videoUrl; // Prefer MP4 for download
    }

    // Fallback to raw version (WEBM)
    if (!videoUrl && recording.storage_path_raw) {
      const { data: urlData } = await supabase.storage
        .from('recordings')
        .createSignedUrl(recording.storage_path_raw, 3600); // 1 hour expiry

      videoUrl = urlData?.signedUrl || null;
      downloadUrl = videoUrl;
    }

    return successResponse({
      ...recording,
      videoUrl,
      downloadUrl,
    });
  }
);

// PUT /api/recordings/[id] - Update a recording
export const PUT = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId, userId } = await requireOrg();
    const supabase = await createClient();
    const { id } = await params;

    const body = await request.json();
    const { title, description, metadata } = body;

    // Update content
    const { data: recording, error } = await supabase
      .from('content')
      .update({
        title,
        description,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error || !recording) {
      return errors.notFound('Recording');
    }

    // PERFORMANCE OPTIMIZATION: Invalidate stats cache when content is updated
    const { CacheInvalidation } = await import('@/lib/services/cache');
    await CacheInvalidation.invalidateContent(orgId);

    return successResponse(recording);
  }
);

// DELETE /api/recordings/[id] - Delete a recording (soft delete by default)
export const DELETE = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId, userId } = await requireOrg();
    const supabase = supabaseAdmin;
    const { id } = await params;

    // Check for permanent delete flag in query params
    const url = new URL(request.url);
    const permanent = url.searchParams.get('permanent') === 'true';
    const reason = url.searchParams.get('reason') || undefined;

    const logger = createLogger({ orgId, userId, recordingId: id });

    logger.info('DELETE Recording API - Request received', {
      data: {
        url: url.toString(),
        permanent,
        reason,
      },
    });

    // Check if content exists and belongs to org
    const { data: recording, error: fetchError } = await supabase
      .from('content')
      .select('id, org_id, storage_path_raw, storage_path_processed, deleted_at')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    logger.info('DELETE Recording - Fetch result', {
      data: { recording, fetchError },
    });

    if (fetchError) {
      logger.error('DELETE Recording - Error fetching recording', {
        error: fetchError,
      });
      return errors.notFound('Recording');
    }

    if (!recording) {
      logger.info('DELETE Recording - Recording not found');
      return errors.notFound('Recording');
    }

    logger.info('DELETE Recording - Found recording', {
      data: {
        id: recording.id,
        org_id: recording.org_id,
        deleted_at: recording.deleted_at,
        has_raw_storage: !!recording.storage_path_raw,
        has_processed_storage: !!recording.storage_path_processed,
      },
    });

    // Permanent delete (hard delete with CASCADE)
    if (permanent) {
      // Enforce that permanent deletions are only allowed on trashed items
      if (!recording.deleted_at) {
        logger.info('DELETE Recording - Permanent delete attempted on non-trashed item');
        return new Response(
          JSON.stringify({
            error: {
              message: 'Permanent deletion is only allowed for items in trash. Move to trash first.',
              code: 'NOT_IN_TRASH',
            },
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }

      logger.info('DELETE Recording - Performing permanent delete', {
        data: { deleted_at: recording.deleted_at },
      });

      // CRITICAL: Delete database record FIRST (cascades to transcripts, documents, chunks)
      // This ensures we never leave orphaned DB rows if storage deletion fails
      logger.debug('DELETE Recording - About to execute DELETE query');
      const { data: deletedData, error: dbError } = await supabase
        .from('content')
        .delete()
        .eq('id', id)
        .eq('org_id', orgId)
        .select(); // Add select() to get deleted rows

      logger.debug('DELETE Recording - DELETE query executed', {
        data: { deletedData, hasError: !!dbError },
      });

      if (dbError) {
        logger.error('DELETE Recording - Error deleting database record', {
          error: dbError,
        });
        return errors.internalError();
      }

      if (!deletedData || deletedData.length === 0) {
        logger.warn('DELETE Recording - DELETE executed but no rows were affected', {
          data: { deletedData },
        });
      } else {
        logger.info('DELETE Recording - Database record successfully deleted', {
          data: { deletedRowCount: deletedData.length },
        });
      }

      // Only after successful DB deletion, remove storage files
      const filesToDelete = [
        recording.storage_path_raw,
        recording.storage_path_processed,
      ].filter(Boolean);

      if (filesToDelete.length > 0) {
        try {
          const { error: storageError } = await supabase.storage
            .from('recordings')
            .remove(filesToDelete);

          if (storageError) {
            // Log but don't fail the request - storage can be cleaned up later
            console.error(
              '[DELETE Recording] Error deleting storage files (DB record already deleted):',
              storageError,
              { recordingId: id, files: filesToDelete }
            );
            // TODO: Consider enqueueing a cleanup job for retry
          } else {
            console.log('[DELETE Recording] Storage files deleted:', filesToDelete);
          }
        } catch (err) {
          // Log but don't fail - DB record is already deleted
          console.error(
            '[DELETE Recording] Exception deleting storage files:',
            err,
            { recordingId: id, files: filesToDelete }
          );
        }
      }

      console.log('[DELETE Recording] Permanently deleted (complete):', id);

      // QUOTA MANAGEMENT: Release recording quota back to organization
      const { QuotaManager } = await import('@/lib/services/quotas/quota-manager');
      const quotaReleased = await QuotaManager.releaseQuota(orgId, 'recording', 1);
      if (quotaReleased) {
        console.log('[DELETE Recording] Released recording quota for org:', orgId);
      } else {
        console.warn('[DELETE Recording] Failed to release recording quota (non-fatal)');
      }

      // PERFORMANCE OPTIMIZATION: Invalidate stats cache
      const { CacheInvalidation } = await import('@/lib/services/cache');
      await CacheInvalidation.invalidateContent(orgId);

      const responsePayload = {
        success: true,
        message: 'Recording permanently deleted',
        permanent: true,
        id, // Include ID for verification
        deletedRowCount: deletedData?.length || 0,
      };
      logger.info('DELETE Recording - Sending success response', {
        data: responsePayload,
      });

      return successResponse(responsePayload);
    }

    // Soft delete (default)
    console.log('[DELETE Recording] Performing soft delete');

    const { error } = await supabase
      .from('content')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        deletion_reason: reason,
      })
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      console.error('[DELETE Recording] Error in soft delete:', error);
      return errors.internalError();
    }

    console.log('[DELETE Recording] Soft deleted:', id);

    // QUOTA MANAGEMENT: Release recording quota when moving to trash
    // User should get quota back immediately, not wait for permanent deletion
    const { QuotaManager } = await import('@/lib/services/quotas/quota-manager');
    const quotaReleased = await QuotaManager.releaseQuota(orgId, 'recording', 1);
    if (quotaReleased) {
      console.log('[DELETE Recording] Released recording quota for org:', orgId);
    } else {
      console.warn('[DELETE Recording] Failed to release recording quota (non-fatal)');
    }

    // PERFORMANCE OPTIMIZATION: Invalidate stats cache
    const { CacheInvalidation } = await import('@/lib/services/cache');
    await CacheInvalidation.invalidateContent(orgId);

    return successResponse({
      success: true,
      message: 'Recording moved to trash',
      permanent: false,
      canRestore: true
    });
  }
);
