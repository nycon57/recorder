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
    .select('mode')
    .eq('user_id', internalUserId)
    .gte('created_at', startDate.toISOString());

  if (!searches || searches.length === 0) {
    return successResponse([]);
  }

  // Count by type
  const typeCount: Record<string, number> = {};
  const totalSearches = searches.length;

  searches.forEach((search) => {
    const type = search.mode || 'standard';
    typeCount[type] = (typeCount[type] || 0) + 1;
  });

  // Format for pie chart
  const chartData = Object.entries(typeCount).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    percentage: Math.round((value / totalSearches) * 100),
  }));

  return successResponse(chartData);
});
