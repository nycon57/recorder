import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  parseBody,
  parseSearchParams,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/lib/types/database';
import {
  logActivitySchema,
  listActivityQuerySchema,
  type LogActivityInput,
  type ListActivityQueryInput,
} from '@/lib/validations/api';

type ActivityAction = Database['public']['Enums']['activity_action'];
type ActivityResource = Database['public']['Enums']['activity_resource'];
type ActivityUser = {
  name: string | null;
  avatar_url: string | null;
};
type ActivityWithUser = Database['public']['Tables']['activity_log']['Row'] & {
  users?: ActivityUser | null;
};

const ACTIVITY_ACTIONS = [
  'created',
  'updated',
  'deleted',
  'shared',
  'favorited',
  'unfavorited',
  'tagged',
  'untagged',
  'moved',
  'uploaded',
  'transcribed',
  'processed',
  'viewed',
] as const satisfies readonly ActivityAction[];

const ACTIVITY_RESOURCES = [
  'recording',
  'collection',
  'tag',
  'note',
  'share',
] as const satisfies readonly ActivityResource[];

const isActivityAction = (value: string): value is ActivityAction =>
  ACTIVITY_ACTIONS.includes(value as ActivityAction);

const isActivityResource = (value: string): value is ActivityResource =>
  ACTIVITY_RESOURCES.includes(value as ActivityResource);

const toActivityAction = (value: LogActivityInput['action']): ActivityAction => {
  const action = value.split('.').pop() ?? value;
  if (action === 'item_added' || action === 'applied') return 'tagged';
  if (action === 'item_removed' || action === 'removed') return 'untagged';
  if (action === 'generated') return 'processed';
  if (action === 'login') return 'viewed';
  return isActivityAction(action) ? action : 'updated';
};

const toActivityResource = (
  value: LogActivityInput['resource_type']
): ActivityResource => {
  if (value === 'document') return 'note';
  if (value === 'user') return 'share';
  return isActivityResource(value) ? value : 'recording';
};

const toJson = (value: LogActivityInput['metadata']): Json =>
  value === undefined ? {} : (value as Json);

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
      action_type,
      resource_type,
      resource_id,
      resource_name,
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
    if (isActivityAction(query.action)) {
      activityQuery = activityQuery.eq('action_type', query.action);
    }
  }

  if (query.resource_type && isActivityResource(query.resource_type)) {
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
          recordingTitles.set(recording.id, recording.title ?? 'Untitled recording');
        }
      }
    } catch {
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
    } catch {
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
    } catch {
      // Continue without names if query fails
    }
  }

  // Batch fetch notes/documents
  if (resourcesByType['note']?.size > 0) {
    try {
      const { data: documents } = await supabase
        .from('documents')
        .select('id, summary')
        .in('id', Array.from(resourcesByType['note']));

      if (documents) {
        for (const doc of documents) {
          documentTitles.set(doc.id, doc.summary ?? 'Untitled document');
        }
      }
    } catch {
      // Continue without titles if query fails
    }
  }

  // Transform the data using lookup maps
  const typedActivities = (activities || []) as ActivityWithUser[];
  const activitiesWithDetails = typedActivities.map((activity) => {
    let resourceTitle: string | null = null;

    // Look up resource title from the appropriate map
    if (activity.resource_id && activity.resource_type) {
      if (activity.resource_type === 'recording') {
        resourceTitle = recordingTitles.get(activity.resource_id) || null;
      } else if (activity.resource_type === 'collection') {
        resourceTitle = collectionNames.get(activity.resource_id) || null;
      } else if (activity.resource_type === 'tag') {
        resourceTitle = tagNames.get(activity.resource_id) || null;
      } else if (activity.resource_type === 'note') {
        resourceTitle = documentTitles.get(activity.resource_id) || null;
      }
    }

    return {
      id: activity.id,
      user_id: activity.user_id,
      user_name: activity.users?.name || null,
      user_avatar: activity.users?.avatar_url || null,
      action: activity.action_type,
      resource_type: activity.resource_type,
      resource_id: activity.resource_id,
      resource_title: resourceTitle ?? activity.resource_name,
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
      action_type: toActivityAction(body.action),
      resource_type: toActivityResource(body.resource_type),
      resource_id: body.resource_id ?? '',
      metadata: toJson(body.metadata),
    })
    .select()
    .single();

  if (error) {
    console.error('[POST /api/activity] Error logging activity:', error);
    throw new Error('Failed to log activity');
  }

  return successResponse(activity, undefined, 201);
});
