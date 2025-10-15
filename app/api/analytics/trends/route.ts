import { NextRequest } from 'next/server';
import { subDays, formatISO } from 'date-fns';

import {
  apiHandler,
  requireOrg,
  successResponse,
  parseSearchParams,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  usageTrendsQuerySchema,
  type UsageTrendsQueryInput,
} from '@/lib/validations/api';

/**
 * GET /api/analytics/trends - Get usage trends over time
 *
 * Query params:
 * - metric: What to measure (uploads, searches, shares, storage, users)
 * - granularity: Time grouping (hour, day, week, month)
 * - date_from: Start date
 * - date_to: End date
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const query = parseSearchParams<UsageTrendsQueryInput>(
    request,
    usageTrendsQuerySchema
  );
  const supabase = supabaseAdmin;

  // Set default date range if not provided
  const dateTo = query.date_to || formatISO(new Date());
  const dateFrom =
    query.date_from ||
    formatISO(subDays(new Date(dateTo), 30)); // 30 days ago

  let trends: Array<{ period: string; value: number }> = [];

  switch (query.metric) {
    case 'uploads':
      {
        const { data: recordings } = await supabase
          .from('recordings')
          .select('created_at')
          .eq('org_id', orgId)
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo)
          .order('created_at');

        trends = groupByPeriod(
          recordings || [],
          'created_at',
          query.granularity
        );
      }
      break;

    case 'searches':
      {
        const { data: searches } = await supabase
          .from('search_analytics')
          .select('created_at')
          .eq('org_id', orgId)
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo)
          .order('created_at');

        trends = groupByPeriod(
          searches || [],
          'created_at',
          query.granularity
        );
      }
      break;

    case 'shares':
      {
        const { data: shares } = await supabase
          .from('shares')
          .select('created_at')
          .eq('org_id', orgId)
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo)
          .order('created_at');

        trends = groupByPeriod(
          shares || [],
          'created_at',
          query.granularity
        );
      }
      break;

    case 'storage':
      {
        const { data: recordings } = await supabase
          .from('recordings')
          .select('created_at, file_size')
          .eq('org_id', orgId)
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo)
          .not('file_size', 'is', null)
          .order('created_at');

        trends = groupByPeriod(
          recordings || [],
          'created_at',
          query.granularity,
          'file_size'
        );
      }
      break;

    case 'users':
      {
        const { data: users } = await supabase
          .from('users')
          .select('created_at')
          .eq('org_id', orgId)
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo)
          .order('created_at');

        trends = groupByPeriod(
          users || [],
          'created_at',
          query.granularity
        );
      }
      break;
  }

  return successResponse({
    trends,
    metric: query.metric,
    granularity: query.granularity,
    date_from: dateFrom,
    date_to: dateTo,
  });
});

/**
 * Helper function to group data by time period
 */
function groupByPeriod(
  data: any[],
  dateField: string,
  granularity: 'hour' | 'day' | 'week' | 'month',
  valueField?: string
): Array<{ period: string; value: number }> {
  const grouped: Record<string, number> = {};

  data.forEach((item) => {
    const date = new Date(item[dateField]);
    let period: string;

    switch (granularity) {
      case 'hour':
        period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
        break;
      case 'day':
        period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        break;
      case 'week': {
        // ISO week calculation
        // Clone the date and shift to Thursday of the target week
        const thursday = new Date(date);
        thursday.setDate(date.getDate() + 4 - (date.getDay() || 7));

        // Get the year for the ISO week (from Thursday)
        const isoYear = thursday.getFullYear();

        // Get January 1st of the ISO year
        const jan1 = new Date(isoYear, 0, 1);

        // Calculate the number of days between Thursday and Jan 1
        const daysDifference = Math.floor((thursday.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000));

        // Calculate ISO week number
        const isoWeek = Math.ceil((daysDifference + 1) / 7);

        period = `${isoYear}-W${String(isoWeek).padStart(2, '0')}`;
        break;
      }
      case 'month':
        period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
    }

    if (!grouped[period]) {
      grouped[period] = 0;
    }

    if (valueField && item[valueField] !== undefined) {
      grouped[period] += item[valueField];
    } else {
      grouped[period] += 1;
    }
  });

  return Object.entries(grouped)
    .map(([period, value]) => ({ period, value }))
    .sort((a, b) => a.period.localeCompare(b.period));
}
