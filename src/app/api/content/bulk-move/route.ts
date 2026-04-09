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

const bulkMoveSchema = z.object({
  content_ids: z.array(z.string().uuid()).min(1).max(100),
  collection_id: z.string().uuid().nullable(),
});

type BulkMoveInput = z.infer<typeof bulkMoveSchema>;

/**
 * POST /api/content/bulk-move
 * Move multiple content items to a collection
 *
 * Body:
 * - content_ids: Array of content UUIDs to move
 * - collection_id: Target collection UUID, or null to remove from collections
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  const body = await parseBody<BulkMoveInput>(request, bulkMoveSchema);
  const supabase = supabaseAdmin;

  // 1. If target collection specified, verify it exists and belongs to this org
  if (body.collection_id) {
    const { data: targetCollection, error: collectionError } = await supabase
      .from('collections')
      .select('id, name, depth')
      .eq('id', body.collection_id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .single();

    if (collectionError || !targetCollection) {
      return errors.notFound('Target collection');
    }
  }

  // 2. Verify all content items exist and belong to this org
  const { data: existingContent, error: contentError } = await supabase
    .from('content')
    .select('id, title, collection_id')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .in('id', body.content_ids);

  if (contentError) {
    console.error('[POST /api/content/bulk-move] Content lookup error:', contentError);
    throw new Error('Failed to verify content items');
  }

  const foundIds = new Set(existingContent?.map(c => c.id) || []);
  const notFoundIds = body.content_ids.filter(id => !foundIds.has(id));

  if (notFoundIds.length > 0) {
    return errors.badRequest(`Content items not found: ${notFoundIds.slice(0, 5).join(', ')}${notFoundIds.length > 5 ? '...' : ''}`);
  }

  // 3. Update all content items
  const { data: updated, error: updateError } = await supabase
    .from('content')
    .update({
      collection_id: body.collection_id,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .in('id', body.content_ids)
    .select('id, title, collection_id');

  if (updateError) {
    console.error('[POST /api/content/bulk-move] Update error:', updateError);
    throw new Error('Failed to move content items');
  }

  // 4. Log activity (non-blocking)
  try {
    await supabase.from('activity_log').insert({
      org_id: orgId,
      user_id: userId,
      action: body.collection_id ? 'content.bulk_moved' : 'content.bulk_removed_from_collection',
      resource_type: 'content',
      resource_id: body.content_ids[0], // Primary reference
      metadata: {
        content_ids: body.content_ids,
        count: body.content_ids.length,
        to_collection_id: body.collection_id,
      },
    });
  } catch (activityError) {
    console.error('[POST /api/content/bulk-move] Failed to log activity:', activityError);
  }

  return successResponse({
    moved_count: updated?.length || 0,
    content_ids: updated?.map(c => c.id) || [],
    to_collection_id: body.collection_id,
  });
});
