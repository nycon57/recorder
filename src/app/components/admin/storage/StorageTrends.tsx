'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Skeleton } from '@/app/components/ui/skeleton';
import { formatBytes, formatCurrency } from '@/lib/utils/formatting';

interface TrendData {
  date: string;
  storage: number;
  cost: number;
  savings: number;
}

interface TrendsData {
  storageGrowth: TrendData[];
  costTrends: TrendData[];
  savingsTrends: TrendData[];
  growthRate: number;
  costChange: number;
}

export default function StorageTrends() {
  const { data, isLoading, error } = useQuery<TrendsData, Error>({
    queryKey: ['analytics', 'metrics', 'storage-trends'],
    queryFn: async ({ signal }) => {
      const response = await fetch(
        '/api/analytics/metrics?includeTrends=true&trendDays=30',
        { signal },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch trends data');
      }

      const { data: metricsData } = await response.json();

      return {
        storageGrowth: metricsData.trends?.storage || [],
        costTrends: metricsData.trends?.costs || [],
        savingsTrends: metricsData.trends?.savings || [],
        growthRate: metricsData.trends?.growthRate || 0,
        costChange: metricsData.trends?.costChange || 0,
      };
    },
  });

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[200px]" />
            <Skeleton className="h-4 w-[300px] mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">
            Error loading trends data: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  // Simple chart placeholders - can be replaced with recharts later
  const maxStorage =
    data.storageGrowth.length > 0
      ? Math.max(...data.storageGrowth.map((d) => d.storage))
      : 0;
  const maxCost =
    data.costTrends.length > 0
      ? Math.max(...data.costTrends.map((d) => d.cost))
      : 0;
  const maxSavings =
    data.savingsTrends.length > 0
      ? Math.max(...data.savingsTrends.map((d) => d.savings))
      : 0;

  return (
    <div className="space-y-6">
      {/* Storage Growth Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Storage Growth Trend</span>
            <Badge
              variant={data.growthRate > 0 ? 'default' : 'secondary'}
              className="flex items-center gap-1"
            >
              {data.growthRate > 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {data.growthRate.toFixed(1)}%
            </Badge>
          </CardTitle>
          <CardDescription>Storage usage over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.storageGrowth.length > 0 ? (
              <div className="flex items-end justify-between gap-1 h-[200px]">
                {data.storageGrowth.map((point, index) => {
                  const height = (point.storage / maxStorage) * 100;
                  return (
                    <div
                      key={JSON.stringify(point)}
                      className="flex-1 flex flex-col items-center gap-2"
                    >
                      <div
                        className="w-full bg-primary rounded-t transition-all hover:opacity-80"
                        style={{ height: `${height}%` }}
                        title={`${formatDate(point.date)}: ${formatBytes(point.storage)}`}
                      />
                      {index % 5 === 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(point.date)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                <p className="text-sm">No data available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cost Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Cost Trend Analysis</span>
            <Badge
              variant={data.costChange > 0 ? 'destructive' : 'default'}
              className="flex items-center gap-1"
            >
              {data.costChange > 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {Math.abs(data.costChange).toFixed(1)}%
            </Badge>
          </CardTitle>
          <CardDescription>Storage costs over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.costTrends.length > 0 ? (
              <div className="flex items-end justify-between gap-1 h-[200px]">
                {data.costTrends.map((point, index) => {
                  const height = (point.cost / maxCost) * 100;
                  return (
                    <div
                      key={JSON.stringify(point)}
                      className="flex-1 flex flex-col items-center gap-2"
                    >
                      <div
                        className="w-full bg-blue-500 rounded-t transition-all hover:opacity-80"
                        style={{ height: `${height}%` }}
                        title={`${formatDate(point.date)}: ${formatCurrency(point.cost)}`}
                      />
                      {index % 5 === 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(point.date)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                <p className="text-sm">No data available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Optimization Savings */}
      <Card>
        <CardHeader>
          <CardTitle>Optimization Savings Trend</CardTitle>
          <CardDescription>
            Cost savings from compression and deduplication
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.savingsTrends.length > 0 ? (
              <div className="flex items-end justify-between gap-1 h-[200px]">
                {data.savingsTrends.map((point, index) => {
                  const height = (point.savings / maxSavings) * 100;
                  return (
                    <div
                      key={JSON.stringify(point)}
                      className="flex-1 flex flex-col items-center gap-2"
                    >
                      <div
                        className="w-full bg-green-600 rounded-t transition-all hover:opacity-80"
                        style={{ height: `${height}%` }}
                        title={`${formatDate(point.date)}: ${formatCurrency(point.savings)} saved`}
                      />
                      {index % 5 === 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(point.date)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                <p className="text-sm">No data available</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {data.savingsTrends.length > 0
                    ? formatCurrency(
                        data.savingsTrends.reduce(
                          (sum, p) => sum + p.savings,
                          0,
                        ),
                      )
                    : '$0.00'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Total Savings (30d)
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {data.savingsTrends.length > 0
                    ? formatCurrency(
                        data.savingsTrends.reduce(
                          (sum, p) => sum + p.savings,
                          0,
                        ) / data.savingsTrends.length,
                      )
                    : '$0.00'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Avg. Daily Savings
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {data.savingsTrends.length > 0
                    ? formatCurrency(
                        (data.savingsTrends.reduce(
                          (sum, p) => sum + p.savings,
                          0,
                        ) /
                          data.savingsTrends.length) *
                          365,
                      )
                    : '$0.00'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Projected Annual Savings
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
