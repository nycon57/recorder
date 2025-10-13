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
    .select('created_at, latency_ms')
    .eq('user_id', internalUserId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });

  if (!searches || searches.length === 0) {
    return successResponse([]);
  }

  // Group by date and calculate latency stats
  const dataMap = new Map<string, { latencies: number[] }>();

  searches.forEach((search) => {
    if (!search.latency_ms) return;

    const date = new Date(search.created_at);
    let key: string;

    if (groupByFormat === 'day') {
      key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (groupByFormat === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay() + 1);
      key = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    if (!dataMap.has(key)) {
      dataMap.set(key, { latencies: [] });
    }
    dataMap.get(key)!.latencies.push(search.latency_ms);
  });

  const chartData = Array.from(dataMap.entries()).map(([date, data]) => {
    const latencies = data.latencies.sort((a, b) => a - b);
    const avgLatency = Math.round(latencies.reduce((sum, l) => sum + l, 0) / latencies.length);

    // Calculate P95
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95Latency = latencies[p95Index] || avgLatency;

    return {
      date,
      avgLatency,
      p95Latency,
    };
  });

  return successResponse(chartData);
});
