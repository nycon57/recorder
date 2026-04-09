import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  parseBody,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';
import {
  bulkUploadSchema,
  type BulkUploadInput,
} from '@/lib/validations/api';

/**
 * POST /api/library/bulk-upload - Handle multiple file uploads
 *
 * Body:
 * - items: Array of items to upload (1-50 items)
 * - collection_id: Optional collection to add items to
 * - tags: Optional array of tag IDs to apply to all items
 *
 * This endpoint creates placeholder recordings for bulk uploads.
 * The actual file upload happens via Supabase Storage separately.
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  const body = await parseBody<BulkUploadInput>(request, bulkUploadSchema);
  const supabase = await createClient();

  // Verify collection exists if provided
  if (body.collection_id) {
    const { data: collection, error: collectionError } = await supabase
      .from('collections')
      .select('id')
      .eq('id', body.collection_id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .single();

    if (collectionError || !collection) {
      return errors.notFound('Collection', undefined);
    }
  }

  // Verify tags exist if provided
  if (body.tags && body.tags.length > 0) {
    const { data: tags, error: tagsError } = await supabase
      .from('tags')
      .select('id')
      .in('id', body.tags)
      .eq('org_id', orgId)
      .is('deleted_at', null);

    if (tagsError || !tags || tags.length !== body.tags.length) {
      return errors.badRequest('One or more tags not found');
    }
  }

  const results: Array<{
    success: boolean;
    recording_id?: string;
    error?: string;
    item: any;
  }> = [];

  // Process each item
  for (const item of body.items) {
    try {
      // Create recording placeholder
      const { data: recording, error: insertError } = await supabase
        .from('content')
        .insert({
          org_id: orgId,
          created_by: userId,
          title: item.title,
          description: item.description || null,
          content_type: item.content_type,
          original_filename: item.file_name,
          mime_type: item.mime_type,
          file_size: item.file_size,
          status: 'uploading',
          metadata: item.metadata || {},
        })
        .select()
        .single();

      if (insertError || !recording) {
        results.push({
          success: false,
          error: insertError?.message || 'Failed to create recording',
          item,
        });
        continue;
      }

      const warnings: string[] = [];

      // Add to collection if specified
      if (body.collection_id) {
        try {
          const { error: collectionError } = await supabase.from('collection_items').insert({
            collection_id: body.collection_id,
            recording_id: recording.id,
            added_by: userId,
          });
          if (collectionError) {
            warnings.push(`Failed to add to collection: ${collectionError.message}`);
          }
        } catch (collectionErr: any) {
          warnings.push(`Failed to add to collection: ${collectionErr.message}`);
        }
      }

      // Apply tags if specified
      if (body.tags && body.tags.length > 0) {
        try {
          const tagInserts = body.tags.map((tagId) => ({
            recording_id: recording.id,
            tag_id: tagId,
          }));
          const { error: tagsError } = await supabase.from('content_tags').insert(tagInserts);
          if (tagsError) {
            warnings.push(`Failed to apply tags: ${tagsError.message}`);
          }
        } catch (tagsErr: any) {
          warnings.push(`Failed to apply tags: ${tagsErr.message}`);
        }
      }

      // Log activity (non-blocking)
      try {
        await supabase.from('activity_log').insert({
          org_id: orgId,
          user_id: userId,
          action: 'recording.created',
          resource_type: 'recording',
          resource_id: recording.id,
          metadata: {
            title: recording.title,
            content_type: recording.content_type,
            bulk_upload: true,
          },
        });
      } catch (activityErr) {
        console.error('[POST /api/library/bulk-upload] Failed to log activity:', activityErr);
        // Don't add to warnings as activity logging is non-critical
      }

      results.push({
        success: true,
        recording_id: recording.id,
        item,
        ...(warnings.length > 0 && { warnings }),
      });
    } catch (error: any) {
      results.push({
        success: false,
        error: error.message || 'Unknown error',
        item,
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  return successResponse({
    results,
    summary: {
      total: body.items.length,
      successful: successCount,
      failed: failureCount,
    },
  });
});
