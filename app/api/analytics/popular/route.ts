import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  parseSearchParams,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  popularItemsQuerySchema,
  type PopularItemsQueryInput,
} from '@/lib/validations/api';

/**
 * GET /api/analytics/popular - Get most accessed/popular items
 *
 * Query params:
 * - limit: Number of results (1-100, default: 10)
 * - timeframe: Time period (7d, 30d, 90d, all)
 * - metric: What to measure (views, shares, favorites, searches)
 * - content_type: Filter by content type
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const query = parseSearchParams<PopularItemsQueryInput>(
    request,
    popularItemsQuerySchema
  );
  const supabase = supabaseAdmin;

  // Calculate date threshold based on timeframe
  let dateThreshold: string | null = null;
  if (query.timeframe !== 'all') {
    const days = parseInt(query.timeframe.replace('d', ''));
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);
    dateThreshold = threshold.toISOString();
  }

  let popularItems: any[] = [];

  // Get popular items based on metric
  switch (query.metric) {
    case 'favorites':
      {
        let favQuery = supabase
          .from('favorites')
          .select(
            `
            recording_id,
            recordings!inner(
              id,
              title,
              content_type,
              created_at,
              org_id,
              deleted_at
            )
          `
          )
          .eq('recordings.org_id', orgId)
          .is('recordings.deleted_at', null);

        if (dateThreshold) {
          favQuery = favQuery.gte('created_at', dateThreshold);
        }

        if (query.content_type) {
          favQuery = favQuery.eq('recordings.content_type', query.content_type);
        }

        const { data: favorites } = await favQuery;

        // Count favorites per recording
        const favCounts = (favorites || []).reduce((acc: any, fav: any) => {
          const recId = fav.recording_id;
          if (!acc[recId]) {
            acc[recId] = {
              recording_id: recId,
              title: fav.recordings.title,
              content_type: fav.recordings.content_type,
              created_at: fav.recordings.created_at,
              count: 0,
            };
          }
          acc[recId].count += 1;
          return acc;
        }, {});

        popularItems = Object.values(favCounts)
          .sort((a: any, b: any) => b.count - a.count)
          .slice(0, query.limit);
      }
      break;

    case 'shares':
      {
        let shareQuery = supabase
          .from('shares')
          .select(
            `
            target_id,
            access_count,
            recordings!inner(
              id,
              title,
              content_type,
              created_at,
              org_id,
              deleted_at
            )
          `
          )
          .eq('target_type', 'recording')
          .eq('recordings.org_id', orgId)
          .is('recordings.deleted_at', null)
          .is('revoked_at', null);

        if (dateThreshold) {
          shareQuery = shareQuery.gte('created_at', dateThreshold);
        }

        if (query.content_type) {
          shareQuery = shareQuery.eq('recordings.content_type', query.content_type);
        }

        const { data: shares } = await shareQuery;

        // Sum access counts per recording
        const shareCounts = (shares || []).reduce((acc: any, share: any) => {
          const recId = share.target_id;
          if (!acc[recId]) {
            acc[recId] = {
              recording_id: recId,
              title: share.recordings.title,
              content_type: share.recordings.content_type,
              created_at: share.recordings.created_at,
              count: 0,
            };
          }
          acc[recId].count += share.access_count || 0;
          return acc;
        }, {});

        popularItems = Object.values(shareCounts)
          .sort((a: any, b: any) => b.count - a.count)
          .slice(0, query.limit);
      }
      break;

    case 'searches':
      {
        // Note: This requires search analytics tracking from search_analytics table
        // For now, return empty array as search analytics may not be fully implemented
        popularItems = [];
      }
      break;

    case 'views':
    default:
      {
        // For views, we'd need a views tracking table
        // As a fallback, use a combination of shares + favorites
        const { data: shares } = await supabase
          .from('shares')
          .select('target_id, access_count')
          .eq('target_type', 'recording')
          .is('revoked_at', null);

        const { data: favorites } = await supabase
          .from('favorites')
          .select('recording_id');

        const combinedMetrics = [...(shares || []), ...(favorites || [])].reduce((acc: any, item: any) => {
          const recId = item.target_id || item.recording_id;
          if (!acc[recId]) {
            acc[recId] = { recording_id: recId, count: 0 };
          }
          acc[recId].count += item.access_count || 1;
          return acc;
        }, {});

        // Get recording details
        const recordingIds = Object.keys(combinedMetrics);
        if (recordingIds.length > 0) {
          let recQuery = supabase
            .from('recordings')
            .select('id, title, content_type, created_at')
            .in('id', recordingIds)
            .eq('org_id', orgId)
            .is('deleted_at', null);

          if (query.content_type) {
            recQuery = recQuery.eq('content_type', query.content_type);
          }

          const { data: recordings } = await recQuery;

          popularItems = (recordings || [])
            .map((rec: any) => ({
              recording_id: rec.id,
              title: rec.title,
              content_type: rec.content_type,
              created_at: rec.created_at,
              count: combinedMetrics[rec.id].count,
            }))
            .sort((a: any, b: any) => b.count - a.count)
            .slice(0, query.limit);
        }
      }
      break;
  }

  // Transform to expected format
  const formattedItems = popularItems.map((item: any) => ({
    recording_id: item.recording_id,
    title: item.title,
    content_type: item.content_type,
    metric_value: item.count,
    created_at: item.created_at,
  }));

  return successResponse({
    items: formattedItems,
    timeframe: query.timeframe,
    metric: query.metric,
  });
});
