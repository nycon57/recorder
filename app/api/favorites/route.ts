import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  parseBody,
  parseSearchParams,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';
import {
  addToFavoritesSchema,
  listFavoritesQuerySchema,
  type AddToFavoritesInput,
  type ListFavoritesQueryInput,
} from '@/lib/validations/api';

/**
 * GET /api/favorites - List user's favorited items
 *
 * Query params:
 * - limit: Number of results
 * - offset: Pagination offset
 * - content_type: Filter by content type
 * - sort: Sort order (created_asc, created_desc, favorited_asc, favorited_desc)
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { userId } = await requireOrg();
  const query = parseSearchParams<ListFavoritesQueryInput>(
    request,
    listFavoritesQuerySchema
  );
  const supabase = await createClient();

  // Build query for favorites with recordings
  let favoritesQuery = supabase
    .from('favorites')
    .select(
      `
      recording_id,
      created_at as favorited_at,
      recordings!inner(
        id,
        title,
        content_type,
        created_at,
        deleted_at
      )
    `,
      { count: 'exact' }
    )
    .eq('user_id', userId)
    .is('recordings.deleted_at', null);

  // Apply content_type filter
  if (query.content_type) {
    favoritesQuery = favoritesQuery.eq('recordings.content_type', query.content_type);
  }

  // Apply sorting
  switch (query.sort) {
    case 'created_asc':
      favoritesQuery = favoritesQuery.order('recordings(created_at)', { ascending: true });
      break;
    case 'created_desc':
      favoritesQuery = favoritesQuery.order('recordings(created_at)', { ascending: false });
      break;
    case 'favorited_asc':
      favoritesQuery = favoritesQuery.order('created_at', { ascending: true });
      break;
    case 'favorited_desc':
      favoritesQuery = favoritesQuery.order('created_at', { ascending: false });
      break;
    default:
      favoritesQuery = favoritesQuery.order('created_at', { ascending: false });
  }

  // Apply pagination
  const { data: favorites, error, count } = await favoritesQuery.range(
    query.offset,
    query.offset + query.limit - 1
  );

  if (error) {
    console.error('[GET /api/favorites] Error fetching favorites:', error);
    throw new Error('Failed to fetch favorites');
  }

  // Transform the data
  const formattedFavorites = (favorites || []).map((item: any) => ({
    recording_id: item.recordings.id,
    title: item.recordings.title,
    content_type: item.recordings.content_type,
    created_at: item.recordings.created_at,
    favorited_at: item.favorited_at,
  }));

  return successResponse({
    favorites: formattedFavorites,
    pagination: {
      total: count || 0,
      limit: query.limit,
      offset: query.offset,
      hasMore: (count || 0) > query.offset + query.limit,
    },
  });
});

/**
 * POST /api/favorites - Add item to favorites
 *
 * Body:
 * - recording_id: Recording ID to favorite
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  const body = await parseBody<AddToFavoritesInput>(request, addToFavoritesSchema);
  const supabase = await createClient();

  // Verify recording exists and belongs to this org
  const { data: recording, error: recordingError } = await supabase
    .from('content')
    .select('id, title')
    .eq('id', body.recording_id)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .single();

  if (recordingError || !recording) {
    return errors.notFound('Recording', undefined);
  }

  // Add to favorites (ignore if already exists)
  const { data: favorite, error: insertError } = await supabase
    .from('favorites')
    .upsert(
      {
        user_id: userId,
        recording_id: body.recording_id,
      },
      {
        onConflict: 'user_id,recording_id',
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  if (insertError) {
    console.error('[POST /api/favorites] Error adding favorite:', insertError);
    throw new Error('Failed to add favorite');
  }

  // Log activity
  await supabase.from('activity_log').insert({
    org_id: orgId,
    user_id: userId,
    action: 'recording.favorited',
    resource_type: 'recording',
    resource_id: body.recording_id,
    metadata: { title: recording.title },
  });

  return successResponse(favorite, undefined, 201);
});
