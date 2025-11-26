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

const applyTagRequestSchema = z.object({
  recording_ids: z.array(z.string().uuid()).min(1, 'At least one recording ID required').max(100, 'Maximum 100 recordings at once'),
});

type ApplyTagRequest = z.infer<typeof applyTagRequestSchema>;

/**
 * POST /api/tags/[id]/apply - Apply tag to one or more recordings
 *
 * Body:
 * - recording_ids: Array of recording IDs to tag
 */
export const POST = apiHandler(async (request: NextRequest, { params }: RouteParams) => {
  const { orgId, userId } = await requireOrg();
  const { id: tagId } = params;
  const body = await parseBody<ApplyTagRequest>(request, applyTagRequestSchema);

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
    console.error('[POST /api/tags/[id]/apply] Error fetching recordings:', recordingsError);
    throw new Error('Failed to verify recordings');
  }

  if (!recordings || recordings.length === 0) {
    return errors.notFound('Recordings');
  }

  // Create tag associations (ignore duplicates)
  const associations = recordings.map(recording => ({
    content_id: recording.id,
    tag_id: tagId,
    created_by: userId,
  }));

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('content_tags')
    .upsert(associations, { onConflict: 'content_id,tag_id', ignoreDuplicates: true })
    .select('content_id');

  if (insertError) {
    console.error('[POST /api/tags/[id]/apply] Error applying tags:', insertError);
    throw new Error('Failed to apply tags');
  }

  // Log activity for each recording
  const activityLogs = recordings.map(recording => ({
    org_id: orgId,
    user_id: userId,
    action: 'tag.applied',
    resource_type: 'recording',
    resource_id: recording.id,
    metadata: {
      tag_id: tagId,
      tag_name: tag.name,
      recording_title: recording.title,
    },
  }));

  await supabaseAdmin.from('activity_log').insert(activityLogs);

  return successResponse({
    success: true,
    tagged_count: inserted?.length || 0,
    total_requested: body.recording_ids.length,
  });
});
