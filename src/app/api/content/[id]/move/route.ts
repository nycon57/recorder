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

const moveContentSchema = z.object({
  collection_id: z.string().uuid().nullable(),
});

type MoveContentInput = z.infer<typeof moveContentSchema>;

/**
 * POST /api/content/[id]/move
 * Move a content item to a different collection
 *
 * Body:
 * - collection_id: UUID of target collection, or null to remove from collection
 */
export const POST = apiHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { orgId, userId } = await requireOrg();
    const { id: contentId } = await params;
    const body = await parseBody<MoveContentInput>(request, moveContentSchema);
    const supabase = supabaseAdmin;

    // 1. Verify content exists and belongs to this org
    const { data: content, error: contentError } = await supabase
      .from('content')
      .select('id, title, collection_id')
      .eq('id', contentId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .single();

    if (contentError || !content) {
      return errors.notFound('Content');
    }

    // 2. If target collection specified, verify it exists and belongs to this org
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

    // 3. Get previous collection name for logging (if any)
    let previousCollectionName: string | null = null;
    if (content.collection_id) {
      const { data: prevCollection } = await supabase
        .from('collections')
        .select('name')
        .eq('id', content.collection_id)
        .single();
      previousCollectionName = prevCollection?.name || null;
    }

    // 4. Update the content's collection_id
    const { data: updated, error: updateError } = await supabase
      .from('content')
      .update({
        collection_id: body.collection_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentId)
      .eq('org_id', orgId)
      .select('id, title, collection_id')
      .single();

    if (updateError) {
      console.error('[POST /api/content/[id]/move] Update error:', updateError);
      throw new Error('Failed to move content');
    }

    // 5. Log activity (non-blocking)
    try {
      await supabase.from('activity_log').insert({
        org_id: orgId,
        user_id: userId,
        action: body.collection_id ? 'content.moved' : 'content.removed_from_collection',
        resource_type: 'content',
        resource_id: contentId,
        metadata: {
          title: content.title,
          from_collection_id: content.collection_id,
          from_collection_name: previousCollectionName,
          to_collection_id: body.collection_id,
        },
      });
    } catch (activityError) {
      console.error('[POST /api/content/[id]/move] Failed to log activity:', activityError);
    }

    return successResponse({
      content: updated,
      moved: true,
      from_collection_id: content.collection_id,
      to_collection_id: body.collection_id,
    });
  }
);

/**
 * POST /api/content/[id]/move/batch
 * Move multiple content items to a collection
 * (This is handled separately in bulk-move endpoint)
 */
