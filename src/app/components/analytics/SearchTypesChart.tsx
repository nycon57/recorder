'use client';

import { useQuery } from '@tanstack/react-query';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from '@/app/components/analytics/dynamic-recharts';

interface SearchTypesChartProps {
  timeRange: string;
}

interface ChartDataPoint {
  name: string;
  value: number;
  percentage: number;
  [key: string]: string | number; // Index signature for recharts compatibility
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium">{payload[0].name}</p>
        <p className="text-sm text-muted-foreground">
          {payload[0].value} searches ({payload[0].payload.percentage}%)
        </p>
      </div>
    );
  }
  return null;
};

export default function SearchTypesChart({ timeRange }: SearchTypesChartProps) {
  const {
    data = [],
    isLoading,
    error,
  } = useQuery<ChartDataPoint[], Error>({
    queryKey: ['analytics', 'user', 'charts', 'types', timeRange],
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/analytics/user/charts/types?timeRange=${timeRange}`,
        { signal },
      );

      if (!response.ok) {
        throw new Error('Failed to load search types data');
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
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({
            name,
            percentage,
          }: {
            name: string;
            percentage: number;
          }) => `${name}: ${percentage}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  );
}
