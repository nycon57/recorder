import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// GET /api/recordings/[id] - Get a specific recording
export const GET = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const supabase = await createClient();
    const { id } = await params;

    // Check for includeDeleted flag (for trash view)
    const url = new URL(request.url);
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';

    // Fetch recording with related data
    let query = supabase
      .from('recordings')
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

    // Update recording
    const { data: recording, error } = await supabase
      .from('recordings')
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

    console.log('[DELETE Recording] Attempting delete:', { id, orgId, permanent, reason });

    // Check if recording exists and belongs to org
    const { data: recording, error: fetchError } = await supabase
      .from('recordings')
      .select('storage_path_raw, storage_path_processed, deleted_at')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (!recording) {
      console.log('[DELETE Recording] Recording not found');
      return errors.notFound('Recording');
    }

    // Permanent delete (hard delete with CASCADE)
    if (permanent) {
      // Enforce that permanent deletions are only allowed on trashed items
      if (!recording.deleted_at) {
        console.log('[DELETE Recording] Permanent delete attempted on non-trashed item:', id);
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

      console.log('[DELETE Recording] Performing permanent delete');

      // Delete storage files
      const filesToDelete = [
        recording.storage_path_raw,
        recording.storage_path_processed,
      ].filter(Boolean);

      if (filesToDelete.length > 0) {
        await supabase.storage.from('recordings').remove(filesToDelete);
      }

      // Delete database record (cascades to transcripts, documents, chunks)
      const { error } = await supabase
        .from('recordings')
        .delete()
        .eq('id', id)
        .eq('org_id', orgId);

      if (error) {
        console.error('[DELETE Recording] Error in permanent delete:', error);
        return errors.internalError();
      }

      console.log('[DELETE Recording] Permanently deleted:', id);

      // PERFORMANCE OPTIMIZATION: Invalidate stats cache
      const { CacheInvalidation } = await import('@/lib/services/cache');
      await CacheInvalidation.invalidateContent(orgId);

      return successResponse({
        success: true,
        message: 'Recording permanently deleted',
        permanent: true
      });
    }

    // Soft delete (default)
    console.log('[DELETE Recording] Performing soft delete');

    const { error } = await supabase
      .from('recordings')
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
