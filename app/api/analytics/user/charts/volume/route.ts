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
  let groupByFormat = 'day';

  switch (timeRange) {
    case '7d':
      startDate.setDate(now.getDate() - 7);
      groupByFormat = 'day';
      break;
    case '30d':
      startDate.setDate(now.getDate() - 30);
      groupByFormat = 'day';
      break;
    case '90d':
      startDate.setDate(now.getDate() - 90);
      groupByFormat = 'week';
      break;
    case 'all':
      startDate = new Date(0);
      groupByFormat = 'month';
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
    return successResponse([]);
  }

  const internalUserId = userData.id;

  // Fetch search data
  const { data: searches } = await supabase
    .from('search_analytics')
    .select('created_at')
    .eq('user_id', internalUserId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });

  if (!searches || searches.length === 0) {
    return successResponse([]);
  }

  // Group by date
  const dataMap = new Map<string, number>();

  searches.forEach((search) => {
    const date = new Date(search.created_at);
    let key: string;

    if (groupByFormat === 'day') {
      key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (groupByFormat === 'week') {
      // Get week start (Monday)
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay() + 1);
      key = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    dataMap.set(key, (dataMap.get(key) || 0) + 1);
  });

  const chartData = Array.from(dataMap.entries())
    .map(([date, searches]) => ({ date, searches }))
    .sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });

  return successResponse(chartData);
});
