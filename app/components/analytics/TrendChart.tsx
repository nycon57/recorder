'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Button } from '@/app/components/ui/button';
import { Download, TrendingUp, TrendingDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { UsageTrend } from '@/lib/types/phase8';

interface TrendChartProps {
  orgId?: string;
  className?: string;
}

type MetricType = 'uploads' | 'searches' | 'shares' | 'storage' | 'users';
type GranularityType = 'hour' | 'day' | 'week' | 'month';

const METRIC_COLORS: Record<MetricType, string> = {
  uploads: '#3b82f6',
  searches: '#10b981',
  shares: '#f59e0b',
  storage: '#8b5cf6',
  users: '#ec4899',
};

const METRIC_LABELS: Record<MetricType, string> = {
  uploads: 'Uploads',
  searches: 'Searches',
  shares: 'Shares',
  storage: 'Storage (GB)',
  users: 'Active Users',
};

export function TrendChart({ orgId, className }: TrendChartProps) {
  const [data, setData] = useState<UsageTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('uploads');
  const [granularity, setGranularity] = useState<GranularityType>('day');

  const fetchTrendData = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (orgId) params.append('org_id', orgId);
      params.append('metric', selectedMetric);
      params.append('granularity', granularity);

      const response = await fetch(`/api/analytics/trends?${params.toString()}`);

      if (!response.ok) throw new Error('Failed to fetch trend data');

      const result = await response.json();
      setData(result.data.trends || []);
    } catch (error) {
      console.error('Error fetching trend data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, selectedMetric, granularity]);

  useEffect(() => {
    fetchTrendData();
  }, [fetchTrendData]);

  const formatXAxis = (value: string) => {
    const date = parseISO(value);
    switch (granularity) {
      case 'hour':
        return format(date, 'HH:mm');
      case 'day':
        return format(date, 'MMM dd');
      case 'week':
        return format(date, 'MMM dd');
      case 'month':
        return format(date, 'MMM yyyy');
      default:
        return value;
    }
  };

  const calculateTrend = () => {
    if (data.length < 2) return null;

    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));

    const firstAvg = firstHalf.reduce((sum, d) => sum + d.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.value, 0) / secondHalf.length;

    // Guard against division by zero
    if (firstAvg === 0) {
      // If first period is zero and second is also zero, no change
      if (secondAvg === 0) {
        return { value: 0, isPositive: false };
      }
      // If first is zero but second isn't, it's infinite growth - return null to skip display
      return null;
    }

    const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;

    return {
      value: percentChange,
      isPositive: percentChange > 0,
    };
  };

  const trend = calculateTrend();
  const average = data.length > 0
    ? data.reduce((sum, d) => sum + d.value, 0) / data.length
    : 0;

  const handleExport = () => {
    const csv = [
      ['Period', METRIC_LABELS[selectedMetric]],
      ...data.map(d => [d.period, d.value.toString()]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedMetric}-trends-${granularity}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Usage Trends</CardTitle>
            <CardDescription>
              {trend && (
                <div className="flex items-center gap-2 mt-1">
                  <span>
                    {trend.isPositive ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                  </span>
                  <span className={trend.isPositive ? 'text-green-600' : 'text-red-600'}>
                    {trend.isPositive ? '+' : ''}{trend.value.toFixed(1)}% vs previous period
                  </span>
                </div>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedMetric} onValueChange={(v) => setSelectedMetric(v as MetricType)}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uploads">Uploads</SelectItem>
                <SelectItem value="searches">Searches</SelectItem>
                <SelectItem value="shares">Shares</SelectItem>
                <SelectItem value="storage">Storage</SelectItem>
                <SelectItem value="users">Active Users</SelectItem>
              </SelectContent>
            </Select>
            <Select value={granularity} onValueChange={(v) => setGranularity(v as GranularityType)}>
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">Hourly</SelectItem>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleExport}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No trend data available
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={data}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickFormatter={formatXAxis}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <Tooltip
                  labelFormatter={(value) => formatXAxis(value as string)}
                  formatter={(value: number) => [
                    value.toLocaleString(),
                    METRIC_LABELS[selectedMetric]
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Legend />
                <ReferenceLine
                  y={average}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="5 5"
                  label={{ value: 'Average', fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={METRIC_COLORS[selectedMetric]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name={METRIC_LABELS[selectedMetric]}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-semibold">
                  {data.reduce((sum, d) => sum + d.value, 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Average</p>
                <p className="text-lg font-semibold">
                  {average.toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Peak</p>
                <p className="text-lg font-semibold">
                  {Math.max(...data.map(d => d.value)).toLocaleString()}
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}