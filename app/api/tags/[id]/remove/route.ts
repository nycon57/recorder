import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  parseBody,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { z } from 'zod';

interface RouteParams {
  params: {
    id: string;
  };
}

const removeTagRequestSchema = z.object({
  recording_ids: z.array(z.string().uuid()).min(1, 'At least one recording ID required').max(100, 'Maximum 100 recordings at once'),
});

type RemoveTagRequest = z.infer<typeof removeTagRequestSchema>;

/**
 * DELETE /api/tags/[id]/remove - Remove tag from recordings
 *
 * Body:
 * - recording_ids: Array of recording IDs to untag
 */
export const DELETE = apiHandler(async (request: NextRequest, { params }: RouteParams) => {
  const { orgId, userId } = await requireOrg();
  const { id: tagId } = params;
  const body = await parseBody<RemoveTagRequest>(request, removeTagRequestSchema);

  // Verify tag exists and belongs to org
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

  // Verify recordings exist and belong to org
  const { data: recordings, error: recordingsError } = await supabaseAdmin
    .from('content')
    .select('id, title')
    .in('id', body.recording_ids)
    .eq('org_id', orgId);

  if (recordingsError) {
    console.error('[DELETE /api/tags/[id]/remove] Error fetching recordings:', recordingsError);
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
    console.error('[DELETE /api/tags/[id]/remove] Error removing tags:', deleteError);
    throw new Error('Failed to remove tags');
  }

  // Log activity for each recording
  const activityLogs = recordings
    .filter(recording => deleted?.some(d => d.content_id === recording.id))
    .map(recording => ({
      org_id: orgId,
      user_id: userId,
      action: 'tag.removed',
      resource_type: 'recording',
      resource_id: recording.id,
      metadata: {
        tag_id: tagId,
        tag_name: tag.name,
        recording_title: recording.title,
      },
    }));

  if (activityLogs.length > 0) {
    await supabaseAdmin.from('activity_log').insert(activityLogs);
  }

  return successResponse({
    success: true,
    removed_count: deleted?.length || 0,
    total_requested: body.recording_ids.length,
  });
});
