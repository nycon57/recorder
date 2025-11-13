import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  generateRequestId,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { updateLibraryItemSchema } from '@/lib/validations/library';
import type { ContentType } from '@/lib/types/database';

// Next.js 15 route segment config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/library/[id]
 *
 * Retrieve a single content item with full details including transcript,
 * document, and metadata. Generates signed URLs for file access.
 *
 * @route GET /api/library/[id]
 * @access Protected - Requires organization context
 *
 * @params {
 *   id: string;  // Recording UUID
 * }
 *
 * @returns {
 *   // Base recording data
 *   id: string;
 *   title: string;
 *   description: string | null;
 *   content_type: ContentType;
 *   file_type: string | null;
 *   status: string;
 *   file_size: number | null;
 *   duration_sec: number | null;
 *   thumbnail_url: string | null;
 *   created_at: string;
 *   updated_at: string;
 *   completed_at: string | null;
 *   created_by: string;
 *   metadata: object;
 *
 *   // Related data
 *   transcripts: Array<Transcript>;
 *   documents: Array<Document>;
 *
 *   // Generated URLs (1 hour expiry)
 *   fileUrl: string | null;      // Signed URL for file access
 *   downloadUrl: string | null;  // Signed URL for downloads
 * }
 *
 * @security
 *   - Org-level data isolation via requireOrg()
 *   - RLS policies enforced by Supabase
 *   - Signed URLs expire after 1 hour
 *
 * @errors
 *   - 400: Invalid ID format
 *   - 401: Unauthorized
 *   - 403: Forbidden - No org context
 *   - 404: Content item not found
 *   - 500: Internal server error
 */
export const GET = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const requestId = generateRequestId();
    const { orgId } = await requireOrg();
    const { id } = await params;
    const supabase = await createClient();

    try {
      // Check if viewing deleted items is allowed (for trash view)
      const url = new URL(request.url);
      const includeDeleted = url.searchParams.get('includeDeleted') === 'true';

      // Fetch content item with related data
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

      // Only filter deleted items if not explicitly requesting them
      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      }

      const { data: item, error } = await query.single();

      if (error || !item) {
        return errors.notFound('Content item', requestId);
      }

      // Generate signed URLs for file access (if applicable)
      let fileUrl: string | null = null;
      let downloadUrl: string | null = null;

      // Text notes don't have file URLs (content is in transcript)
      if (item.content_type !== 'text' && item.storage_path_raw) {
        const { data: signedUrlData } = await supabase.storage
          .from('recordings')
          .createSignedUrl(item.storage_path_raw, 3600); // 1 hour expiry

        fileUrl = signedUrlData?.signedUrl || null;
        downloadUrl = fileUrl;

        // For videos, prefer processed (MP4) if available
        if (item.content_type === 'video' && item.storage_path_processed) {
          const { data: processedUrlData } = await supabase.storage
            .from('recordings')
            .createSignedUrl(item.storage_path_processed, 3600);

          if (processedUrlData?.signedUrl) {
            fileUrl = processedUrlData.signedUrl;
            downloadUrl = processedUrlData.signedUrl;
          }
        }
      }

      return successResponse(
        {
          ...item,
          fileUrl,
          downloadUrl,
        },
        requestId
      );
    } catch (error: any) {
      console.error('[Library Item Get] Request error:', error);
      return errors.internalError(requestId);
    }
  }
);

/**
 * PATCH /api/library/[id]
 *
 * Update metadata for a content item (title, description, metadata).
 * Cannot update content itself - use specific endpoints for that.
 *
 * @route PATCH /api/library/[id]
 * @access Protected - Requires organization context
 *
 * @params {
 *   id: string;  // Recording UUID
 * }
 *
 * @body {
 *   title?: string;        // Updated title (1-200 chars)
 *   description?: string;  // Updated description (max 2000 chars)
 *   metadata?: object;     // Updated metadata object
 * }
 *
 * @returns {
 *   id: string;
 *   title: string;
 *   description: string | null;
 *   metadata: object;
 *   updated_at: string;
 * }
 *
 * @security
 *   - Validates ownership via org_id
 *   - Only updates specified fields
 *   - Validates input with Zod schema
 *
 * @errors
 *   - 400: Validation error
 *   - 401: Unauthorized
 *   - 403: Forbidden - No org context
 *   - 404: Content item not found
 *   - 500: Internal server error
 */
export const PATCH = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const requestId = generateRequestId();
    const { orgId } = await requireOrg();
    const { id } = await params;
    const supabase = await createClient();

    try {
      // Parse and validate request body
      const body = await request.json();
      const validated = updateLibraryItemSchema.parse(body);

      // Build update object (only include provided fields)
      const updates: any = {
        updated_at: new Date().toISOString(),
      };

      if (validated.title !== undefined) {
        updates.title = validated.title;
      }

      if (validated.description !== undefined) {
        updates.description = validated.description;
      }

      if (validated.metadata !== undefined) {
        updates.metadata = validated.metadata;
      }

      // Update content item
      const { data: item, error } = await supabase
        .from('recordings')
        .update(updates)
        .eq('id', id)
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .select()
        .single();

      if (error || !item) {
        return errors.notFound('Content item', requestId);
      }

      return successResponse(
        {
          id: item.id,
          title: item.title,
          description: item.description,
          metadata: item.metadata,
          updated_at: item.updated_at,
        },
        requestId
      );
    } catch (error: any) {
      console.error('[Library Item Update] Request error:', error);

      // Check if it's a validation error
      if (error.name === 'ZodError') {
        return errors.validationError(error.errors, requestId);
      }

      return errors.internalError(requestId);
    }
  }
);

/**
 * DELETE /api/library/[id]
 *
 * Delete a single content item.
 * Performs soft delete by default (sets deleted_at timestamp).
 * Hard delete removes from database and storage.
 *
 * @route DELETE /api/library/[id]
 * @access Protected - Requires organization context
 *
 * @params {
 *   id: string;  // Recording UUID
 * }
 *
 * @queryParams {
 *   permanent?: boolean;  // If true, performs hard delete (default: false)
 * }
 *
 * @returns {
 *   success: boolean;
 *   message: string;
 *   deleted_at?: string;  // Timestamp for soft delete
 * }
 *
 * @security
 *   - Validates ownership via org_id
 *   - Soft delete by default (can be recovered)
 *   - Hard delete also removes storage files
 *
 * @errors
 *   - 400: Invalid request
 *   - 401: Unauthorized
 *   - 403: Forbidden - No org context
 *   - 404: Content item not found
 *   - 500: Internal server error
 */
export const DELETE = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const requestId = generateRequestId();

    console.log(`[Library Item Delete] Request received`);

    const { orgId } = await requireOrg();
    const resolvedParams = await params;
    const { id } = resolvedParams;

    console.log(`[Library Item Delete] Starting delete for recording ${id}, org ${orgId}`);

    try {
      // Check for permanent delete query param
      const url = new URL(request.url);
      const permanent = url.searchParams.get('permanent') === 'true';

      console.log(`[Library Item Delete] Permanent delete: ${permanent}`);

      if (permanent) {
        // Hard delete - use admin client
        const supabase = supabaseAdmin;

        // Fetch item to get storage paths
        const { data: item, error: fetchError } = await supabase
          .from('recordings')
          .select('storage_path_raw, storage_path_processed, content_type')
          .eq('id', id)
          .eq('org_id', orgId)
          .single();

        if (!item) {
          return errors.notFound('Content item', requestId);
        }

        // Delete storage files (if any)
        const filesToDelete = [
          item.storage_path_raw,
          item.storage_path_processed,
        ].filter(Boolean) as string[];

        if (filesToDelete.length > 0) {
          await supabase.storage.from('recordings').remove(filesToDelete);
        }

        // Delete database record (cascades to related tables)
        const { error } = await supabase
          .from('recordings')
          .delete()
          .eq('id', id)
          .eq('org_id', orgId);

        if (error) {
          console.error('[Library Item Delete] Delete error:', error);
          return errors.internalError(requestId);
        }

        return successResponse(
          {
            success: true,
            message: 'Content item permanently deleted',
          },
          requestId
        );
      } else {
        // Soft delete - use admin client to bypass RLS
        const supabase = supabaseAdmin;

        console.log(`[Library Item Delete] Performing soft delete for ${id}`);

        // First check if item exists and get current state
        const { data: existingItem, error: fetchError } = await supabase
          .from('recordings')
          .select('id, deleted_at')
          .eq('id', id)
          .eq('org_id', orgId)
          .single();

        if (fetchError || !existingItem) {
          console.log(`[Library Item Delete] Item not found: ${id}`, fetchError);
          return errors.notFound('Content item', requestId);
        }

        // If already soft-deleted, return success (idempotent)
        if (existingItem.deleted_at) {
          console.log(`[Library Item Delete] Item already soft deleted: ${id}`);
          return successResponse(
            {
              success: true,
              message: 'Content item already deleted',
              deleted_at: existingItem.deleted_at,
            },
            requestId
          );
        }

        // Perform soft delete
        const deletedAt = new Date().toISOString();
        const { data: item, error } = await supabase
          .from('recordings')
          .update({ deleted_at: deletedAt })
          .eq('id', id)
          .eq('org_id', orgId)
          .select()
          .single();

        if (error) {
          console.error('[Library Item Delete] Soft delete error:', error);
          return errors.internalError(requestId);
        }

        console.log(`[Library Item Delete] Successfully soft deleted ${id}`);
        return successResponse(
          {
            success: true,
            message: 'Content item moved to trash',
            deleted_at: deletedAt,
          },
          requestId
        );
      }
    } catch (error: any) {
      console.error('[Library Item Delete] Request error:', error);
      return errors.internalError(requestId);
    }
  }
);
