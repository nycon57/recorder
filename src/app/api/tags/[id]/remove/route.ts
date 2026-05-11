import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  parseBody,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

const removeTagRequestSchema = z.object({
  recording_ids: z
    .array(z.string().uuid())
    .min(1, 'At least one recording ID required')
    .max(100, 'Maximum 100 recordings at once'),
});

type RemoveTagRequest = z.infer<typeof removeTagRequestSchema>;

/**
 * DELETE /api/tags/[id]/remove - Remove tag from recordings
 *
 * Body:
 * - recording_ids: Array of recording IDs to untag
 */
export const DELETE = apiHandler(
  async (request: NextRequest, { params }: RouteParams) => {
    const { orgId, userId } = await requireOrg();
    const { id: tagId } = await params;
    const { data: tag, error: tagError } = await supabaseAdmin
      .from('tags')
      .select('id, name')
      .eq('id', tagId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .single();

    if (tagError || !tag) {
      return errors.notFound('Tag');
    }

    const body = await parseBody<RemoveTagRequest>(
      request,
      removeTagRequestSchema,
    );

    // Verify recordings exist and belong to org
    const { data: recordings, error: recordingsError } = await supabaseAdmin
      .from('content')
      .select('id, title')
      .in('id', body.recording_ids)
      .eq('org_id', orgId);

    if (recordingsError) {
      console.error(
        '[DELETE /api/tags/[id]/remove] Error fetching recordings:',
        recordingsError,
      );
      throw new Error('Failed to verify recordings');
    }

    if (!recordings || recordings.length === 0) {
      return errors.notFound('Recordings');
    }

    // Remove tag associations
    const { data: deleted, error: deleteError } = await supabaseAdmin
      .from('content_tags')
      .delete()
      .eq('tag_id', tagId)
      .in('content_id', body.recording_ids)
      .select('content_id');

    if (deleteError) {
      console.error(
        '[DELETE /api/tags/[id]/remove] Error removing tags:',
        deleteError,
      );
      throw new Error('Failed to remove tags');
    }

    // Log activity for each recording
    const activityLogs = recordings.flatMap((__item, __index, __array) =>
      deleted?.some((d) => d.content_id === __item.id)
        ? [
            {
              org_id: orgId,
              user_id: userId,
              action_type: 'untagged' as const,
              resource_type: 'recording' as const,
              resource_id: __item.id,
              metadata: {
                tag_id: tagId,
                tag_name: tag.name,
                recording_title: __item.title,
              },
            },
          ]
        : [],
    );

    if (activityLogs.length > 0) {
      await supabaseAdmin.from('activity_log').insert(activityLogs);
    }

    return successResponse({
      success: true,
      removed_count: deleted?.length || 0,
      total_requested: body.recording_ids.length,
    });
  },
);
