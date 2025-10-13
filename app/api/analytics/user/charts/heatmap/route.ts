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
      startDate = new Date(0);
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
    .gte('created_at', startDate.toISOString());

  if (!searches || searches.length === 0) {
    return successResponse([]);
  }

  // Count by day and hour
  const heatmapData = new Map<string, number>();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  searches.forEach((search) => {
    const date = new Date(search.created_at);
    const day = days[date.getDay()];
    const hour = date.getHours();
    const key = `${day}-${hour}`;

    heatmapData.set(key, (heatmapData.get(key) || 0) + 1);
  });

  // Format for heatmap
  const chartData = Array.from(heatmapData.entries()).map(([key, count]) => {
    const [day, hourStr] = key.split('-');
    return {
      day,
      hour: parseInt(hourStr),
      count,
    };
  });

  return successResponse(chartData);
});
