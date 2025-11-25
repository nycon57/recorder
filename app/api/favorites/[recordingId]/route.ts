import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';

/**
 * DELETE /api/favorites/[recordingId] - Remove item from favorites
 */
export const DELETE = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ recordingId: string }> }) => {
    const { orgId, userId } = await requireOrg();
    const supabase = await createClient();
    const { recordingId } = await params;

    // Verify favorite exists for this user
    const { data: existing, error: fetchError } = await supabase
      .from('favorites')
      .select('user_id, recording_id')
      .eq('user_id', userId)
      .eq('content_id', recordingId)
      .single();

    if (fetchError || !existing) {
      return errors.notFound('Favorite', undefined);
    }

    // Get recording title for activity log
    const { data: recording } = await supabase
      .from('content')
      .select('title')
      .eq('id', recordingId)
      .single();

    // Remove from favorites
    const { error: deleteError } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('content_id', recordingId);

    if (deleteError) {
      console.error('[DELETE /api/favorites/[recordingId]] Error removing favorite:', deleteError);
      throw new Error('Failed to remove favorite');
    }

    // Log activity
    await supabase.from('activity_log').insert({
      org_id: orgId,
      user_id: userId,
      action: 'recording.unfavorited',
      resource_type: 'recording',
      resource_id: recordingId,
      metadata: { title: recording?.title },
    });

    return successResponse({ deleted: true });
  }
);
