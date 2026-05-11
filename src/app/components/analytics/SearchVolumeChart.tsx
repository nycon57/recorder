'use client';

import { useQuery } from '@tanstack/react-query';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from '@/app/components/analytics/dynamic-recharts';

interface SearchVolumeChartProps {
  timeRange: string;
}

interface ChartDataPoint {
  date: string;
  searches: number;
}

export default function SearchVolumeChart({
  timeRange,
}: SearchVolumeChartProps) {
  const {
    data = [],
    isLoading,
    error,
  } = useQuery<ChartDataPoint[], Error>({
    queryKey: ['analytics', 'user', 'charts', 'volume', timeRange],
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/analytics/user/charts/volume?timeRange=${timeRange}`,
        { signal },
      );

      if (!response.ok) {
        throw new Error('Failed to load volume data');
      }

      const result = await response.json();
      return result.data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center">
        <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center">
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          className="text-xs"
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis
          className="text-xs"
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
        />
        <Line
          type="monotone"
          dataKey="searches"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ fill: 'hsl(var(--primary))', r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
