import { NextRequest } from 'next/server';

import { apiHandler, requireAuth, successResponse } from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';

export const GET = apiHandler(async (request: NextRequest) => {
  const { userId } = await requireAuth();
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const timeRange = searchParams.get('timeRange') || '30d';

  // Calculate date range
  const now = new Date();
  let startDate = new Date();

  switch (timeRange) {
    case '7d':
      startDate.setDate(now.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(now.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(now.getDate() - 90);
      break;
    case 'all':
      startDate = new Date(0); // Beginning of time
      break;
    default:
      startDate.setDate(now.getDate() - 30);
  }

  // Get user's internal UUID
  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_id', userId)
    .single();

  if (!userData) {
    return successResponse({
      summary: {
        totalSearches: 0,
        searchesTrend: 0,
        mostActiveDay: { day: 'N/A', count: 0 },
        avgSearchTime: 0,
        topQueryType: { type: 'N/A', count: 0, percentage: 0 },
      },
      topQueries: [],
      topRecordings: [],
    });
  }

  const internalUserId = userData.id;

  // Fetch summary metrics
  const { data: searches } = await supabase
    .from('search_analytics')
    .select('*')
    .eq('user_id', internalUserId)
    .gte('created_at', startDate.toISOString());

  const totalSearches = searches?.length || 0;

  // Calculate trend (compare with previous period)
  const previousStartDate = new Date(startDate);
  const daysDiff = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  previousStartDate.setDate(previousStartDate.getDate() - daysDiff);

  const { data: previousSearches } = await supabase
    .from('search_analytics')
    .select('id')
    .eq('user_id', internalUserId)
    .gte('created_at', previousStartDate.toISOString())
    .lt('created_at', startDate.toISOString());

  const previousCount = previousSearches?.length || 0;
  const searchesTrend = previousCount > 0
    ? Math.round(((totalSearches - previousCount) / previousCount) * 100)
    : 0;

  // Most active day
  const dayCount: Record<string, number> = {};
  searches?.forEach((search) => {
    const day = new Date(search.created_at).toLocaleDateString('en-US', { weekday: 'short' });
    dayCount[day] = (dayCount[day] || 0) + 1;
  });

  const mostActiveDay = Object.entries(dayCount).sort(([, a], [, b]) => b - a)[0] || ['N/A', 0];

  // Average search time
  const avgSearchTime = searches?.length
    ? Math.round(searches.reduce((sum, s) => sum + (s.latency_ms || 0), 0) / searches.length)
    : 0;

  // Top query type
  const typeCount: Record<string, number> = {};
  searches?.forEach((search) => {
    const type = search.mode || 'standard';
    typeCount[type] = (typeCount[type] || 0) + 1;
  });

  const topTypeEntry = Object.entries(typeCount).sort(([, a], [, b]) => b - a)[0];
  const topQueryType = topTypeEntry
    ? {
        type: topTypeEntry[0],
        count: topTypeEntry[1],
        percentage: Math.round((topTypeEntry[1] / totalSearches) * 100),
      }
    : { type: 'N/A', count: 0, percentage: 0 };

  // Top queries
  const queryMap = new Map<string, { count: number; lastSearched: string; feedbacks: number[] }>();

  searches?.forEach((search) => {
    const query = search.query;
    const existing = queryMap.get(query);

    if (existing) {
      existing.count += 1;
      existing.lastSearched = search.created_at > existing.lastSearched ? search.created_at : existing.lastSearched;
      if (search.user_feedback !== null) {
        existing.feedbacks.push(search.user_feedback);
      }
    } else {
      queryMap.set(query, {
        count: 1,
        lastSearched: search.created_at,
        feedbacks: search.user_feedback !== null ? [search.user_feedback] : [],
      });
    }
  });

  const topQueries = Array.from(queryMap.entries())
    .map(([query, data]) => ({
      query,
      count: data.count,
      lastSearched: data.lastSearched,
      avgFeedback: data.feedbacks.length > 0
        ? data.feedbacks.reduce((sum, f) => sum + f, 0) / data.feedbacks.length
        : null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top recordings - fetch with real view counts
  const { data: recordings } = await supabase
    .from('content')
    .select('id, title, duration_sec, created_at')
    .eq('created_by', internalUserId)
    .order('created_at', { ascending: false })
    .limit(20); // Get more to filter by view count

  // Get view counts for these recordings
  const recordingIds = recordings?.map(r => r.id) || [];
  const { data: viewCounts } = recordingIds.length > 0
    ? await supabase
        .from('recording_view_counts')
        .select('recording_id, total_views, last_viewed_at')
        .in('content_id', recordingIds)
    : { data: null };

  // Create a map of view counts
  const viewCountMap = new Map(
    viewCounts?.map(vc => [vc.recording_id, {
      count: vc.total_views,
      lastViewed: vc.last_viewed_at
    }]) || []
  );

  // Combine and sort by view count
  const topRecordings = recordings?.map((rec) => ({
    id: rec.id,
    title: rec.title || 'Untitled Recording',
    viewCount: viewCountMap.get(rec.id)?.count || 0,
    duration: rec.duration_sec || 0,
    lastViewed: viewCountMap.get(rec.id)?.lastViewed ?? null,
  }))
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 5) || [];

  return successResponse({
    summary: {
      totalSearches,
      searchesTrend,
      mostActiveDay: {
        day: mostActiveDay[0],
        count: mostActiveDay[1],
      },
      avgSearchTime,
      topQueryType,
    },
    topQueries,
    topRecordings,
  });
});
