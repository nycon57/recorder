import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  requireAdmin,
  successResponse,
  parseBody,
  parseSearchParams,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';
import {
  logActivitySchema,
  listActivityQuerySchema,
  type LogActivityInput,
  type ListActivityQueryInput,
} from '@/lib/validations/api';

/**
 * GET /api/activity - Get activity feed
 *
 * Query params:
 * - limit: Number of results
 * - offset: Pagination offset
 * - user_id: Filter by user
 * - action: Filter by action type
 * - resource_type: Filter by resource type
 * - date_from: Filter activities after this date
 * - date_to: Filter activities before this date
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const query = parseSearchParams<ListActivityQueryInput>(
    request,
    listActivityQuerySchema
  );
  const supabase = await createClient();

  // Build query for activity log with user info
  let activityQuery = supabase
    .from('activity_log')
    .select(
      `
      id,
      user_id,
      action,
      resource_type,
      resource_id,
      metadata,
      created_at,
      users!inner(
        id,
        name,
        avatar_url
      )
    `,
      { count: 'exact' }
    )
    .eq('org_id', orgId);

  // Apply filters
  if (query.user_id) {
    activityQuery = activityQuery.eq('user_id', query.user_id);
  }

  if (query.action) {
    activityQuery = activityQuery.eq('action', query.action);
  }

  if (query.resource_type) {
    activityQuery = activityQuery.eq('resource_type', query.resource_type);
  }

  if (query.date_from) {
    activityQuery = activityQuery.gte('created_at', query.date_from);
  }

  if (query.date_to) {
    activityQuery = activityQuery.lte('created_at', query.date_to);
  }

  // Order by most recent first
  activityQuery = activityQuery.order('created_at', { ascending: false });

  // Apply pagination
  const { data: activities, error, count } = await activityQuery.range(
    query.offset,
    query.offset + query.limit - 1
  );

  if (error) {
    console.error('[GET /api/activity] Error fetching activity:', error);
    throw new Error('Failed to fetch activity');
  }

  // Collect all resource IDs grouped by resource type
  const resourcesByType: Record<
    string,
    Set<string>
  > = {};

  for (const activity of activities || []) {
    if (activity.resource_id && activity.resource_type) {
      if (!resourcesByType[activity.resource_type]) {
        resourcesByType[activity.resource_type] = new Set();
      }
      resourcesByType[activity.resource_type].add(activity.resource_id);
    }
  }

  // Build lookup maps for each resource type
  const recordingTitles = new Map<string, string>();
  const collectionNames = new Map<string, string>();
  const tagNames = new Map<string, string>();
  const documentTitles = new Map<string, string>();

  // Batch fetch recordings
  if (resourcesByType['recording']?.size > 0) {
    try {
      const { data: recordings } = await supabase
        .from('content')
        .select('id, title')
        .in('id', Array.from(resourcesByType['recording']));

      if (recordings) {
        for (const recording of recordings) {
          recordingTitles.set(recording.id, recording.title);
        }
      }
    } catch (err) {
      // Continue without titles if query fails
    }
  }

  // Batch fetch collections
  if (resourcesByType['collection']?.size > 0) {
    try {
      const { data: collections } = await supabase
        .from('collections')
        .select('id, name')
        .in('id', Array.from(resourcesByType['collection']));

      if (collections) {
        for (const collection of collections) {
          collectionNames.set(collection.id, collection.name);
        }
      }
    } catch (err) {
      // Continue without names if query fails
    }
  }

  // Batch fetch tags
  if (resourcesByType['tag']?.size > 0) {
    try {
      const { data: tags } = await supabase
        .from('tags')
        .select('id, name')
        .in('id', Array.from(resourcesByType['tag']));

      if (tags) {
        for (const tag of tags) {
          tagNames.set(tag.id, tag.name);
        }
      }
    } catch (err) {
      // Continue without names if query fails
    }
  }

  // Batch fetch documents with recording titles
  if (resourcesByType['document']?.size > 0) {
    try {
      const { data: documents } = await supabase
        .from('documents')
        .select('id, recording_id, recordings(title)')
        .in('id', Array.from(resourcesByType['document']));

      if (documents) {
        for (const doc of documents) {
          const title = (doc.recordings as any)?.title;
          if (title) {
            documentTitles.set(doc.id, title);
          }
        }
      }
    } catch (err) {
      // Continue without titles if query fails
    }
  }

  // Transform the data using lookup maps
  const activitiesWithDetails = (activities || []).map((activity: any) => {
    let resourceTitle: string | null = null;

    // Look up resource title from the appropriate map
    if (activity.resource_id && activity.resource_type) {
      if (activity.resource_type === 'recording') {
        resourceTitle = recordingTitles.get(activity.resource_id) || null;
      } else if (activity.resource_type === 'collection') {
        resourceTitle = collectionNames.get(activity.resource_id) || null;
      } else if (activity.resource_type === 'tag') {
        resourceTitle = tagNames.get(activity.resource_id) || null;
      } else if (activity.resource_type === 'document') {
        resourceTitle = documentTitles.get(activity.resource_id) || null;
      }
    }

    return {
      id: activity.id,
      user_id: activity.user_id,
      user_name: activity.users?.name || null,
      user_avatar: activity.users?.avatar_url || null,
      action: activity.action,
      resource_type: activity.resource_type,
      resource_id: activity.resource_id,
      resource_title: resourceTitle,
      metadata: activity.metadata,
      created_at: activity.created_at,
    };
  });

  return successResponse({
    activities: activitiesWithDetails,
    pagination: {
      total: count || 0,
      limit: query.limit,
      offset: query.offset,
      hasMore: (count || 0) > query.offset + query.limit,
    },
  });
});

/**
 * POST /api/activity - Log activity (internal/admin use)
 *
 * Body:
 * - action: Activity action type
 * - resource_type: Resource type
 * - resource_id: Resource ID (optional)
 * - metadata: Additional metadata (optional)
 *
 * Note: This endpoint is primarily for internal use. Most activity
 * logging happens automatically within other API endpoints.
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  const body = await parseBody<LogActivityInput>(request, logActivitySchema);
  const supabase = await createClient();

  // Insert activity log
  const { data: activity, error } = await supabase
    .from('activity_log')
    .insert({
      org_id: orgId,
      user_id: userId,
      action: body.action,
      resource_type: body.resource_type,
      resource_id: body.resource_id || null,
      metadata: body.metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error('[POST /api/activity] Error logging activity:', error);
    throw new Error('Failed to log activity');
  }

  return successResponse(activity, undefined, 201);
});
