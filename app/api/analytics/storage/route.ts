import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  parseSearchParams,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  storageAnalyticsQuerySchema,
  type StorageAnalyticsQueryInput,
} from '@/lib/validations/api';

/**
 * GET /api/analytics/storage - Get storage usage analytics
 *
 * Query params:
 * - groupBy: Group by content_type, user, or date
 * - date_from: Filter data after this date
 * - date_to: Filter data before this date
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const query = parseSearchParams<StorageAnalyticsQueryInput>(
    request,
    storageAnalyticsQuerySchema
  );
  const supabase = supabaseAdmin;

  // Base query
  let recordingsQuery = supabase
    .from('content')
    .select('content_type, file_size, created_by, created_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .not('file_size', 'is', null);

  // Apply date filters
  if (query.date_from) {
    recordingsQuery = recordingsQuery.gte('created_at', query.date_from);
  }
  if (query.date_to) {
    recordingsQuery = recordingsQuery.lte('created_at', query.date_to);
  }

  const { data: recordings, error } = await recordingsQuery;

  if (error) {
    console.error('[GET /api/analytics/storage] Error fetching recordings:', error);
    throw new Error('Failed to fetch storage analytics');
  }

  const totalSizeBytes = recordings?.reduce((sum, r) => sum + (r.file_size || 0), 0) || 0;
  const totalItems = recordings?.length || 0;

  let responseData: any = {
    total_size_bytes: totalSizeBytes,
    total_items: totalItems,
  };

  // Group by content_type
  if (query.groupBy === 'content_type') {
    const byContentType = recordings?.reduce((acc: any, recording) => {
      const type = recording.content_type || 'unknown';
      if (!acc[type]) {
        acc[type] = { total_size_bytes: 0, item_count: 0 };
      }
      acc[type].total_size_bytes += recording.file_size || 0;
      acc[type].item_count += 1;
      return acc;
    }, {});

    const formattedByContentType = Object.entries(byContentType || {}).map(
      ([contentType, data]: [string, any]) => ({
        content_type: contentType,
        total_size_bytes: data.total_size_bytes,
        item_count: data.item_count,
        percentage: totalSizeBytes > 0 ? (data.total_size_bytes / totalSizeBytes) * 100 : 0,
      })
    );

    responseData.by_content_type = formattedByContentType;
  }

  // Group by user
  if (query.groupBy === 'user') {
    const byUser = recordings?.reduce((acc: any, recording) => {
      const userId = recording.created_by || 'unknown';
      if (!acc[userId]) {
        acc[userId] = { total_size_bytes: 0, item_count: 0 };
      }
      acc[userId].total_size_bytes += recording.file_size || 0;
      acc[userId].item_count += 1;
      return acc;
    }, {});

    // Fetch user names
    const userIds = Object.keys(byUser || {}).filter((id) => id !== 'unknown');
    let userNames: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name')
        .in('id', userIds);

      if (users) {
        userNames = users.reduce((acc: any, user) => {
          acc[user.id] = user.name;
          return acc;
        }, {});
      }
    }

    const formattedByUser = Object.entries(byUser || {}).map(
      ([userId, data]: [string, any]) => ({
        user_id: userId,
        user_name: userNames[userId] || null,
        total_size_bytes: data.total_size_bytes,
        item_count: data.item_count,
      })
    );

    responseData.by_user = formattedByUser;
  }

  // Group by date
  if (query.groupBy === 'date') {
    const byDate = recordings?.reduce((acc: any, recording) => {
      const date = recording.created_at.split('T')[0]; // YYYY-MM-DD
      if (!acc[date]) {
        acc[date] = { total_size_bytes: 0, item_count: 0 };
      }
      acc[date].total_size_bytes += recording.file_size || 0;
      acc[date].item_count += 1;
      return acc;
    }, {});

    const formattedByDate = Object.entries(byDate || {})
      .map(([date, data]: [string, any]) => ({
        date,
        total_size_bytes: data.total_size_bytes,
        item_count: data.item_count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    responseData.by_date = formattedByDate;
  }

  return successResponse(responseData);
});
