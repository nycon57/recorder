'use client';

import { useQuery } from '@tanstack/react-query';
import { HardDrive, DollarSign, TrendingUp, Activity } from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';
import {
  formatBytes,
  formatCurrency,
  formatPercentage,
} from '@/lib/utils/formatting';

interface PlatformMetrics {
  totalStorage: number;
  monthlyCost: number;
  optimizationRate: number;
  healthScore: number;
}

export default function PlatformOverviewCards() {
  const {
    data: metrics,
    isLoading,
    error,
  } = useQuery<PlatformMetrics, Error>({
    queryKey: ['analytics', 'metrics', 'platform-overview'],
    queryFn: async ({ signal }) => {
      const response = await fetch(
        '/api/analytics/metrics?includeHealth=true',
        { signal },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const { data } = await response.json();

      return {
        totalStorage: data.summary?.totalStorage || 0,
        monthlyCost: data.costs?.currentMonth || 0,
        optimizationRate: data.optimization?.compressionRate || 0,
        healthScore: data.health?.score || 0,
      };
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          'platform-card-1',
          'platform-card-2',
          'platform-card-3',
          'platform-card-4',
        ].map((skeletonId) => (
          <Card key={skeletonId}>
            <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="size-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[120px] mb-2" />
              <Skeleton className="h-3 w-[80px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">
            Error loading metrics: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Storage Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Platform Storage
          </CardTitle>
          <HardDrive className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatBytes(metrics.totalStorage)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Across all organizations
          </p>
        </CardContent>
      </Card>

      {/* Monthly Cost Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Monthly Storage Cost
          </CardTitle>
          <DollarSign className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(metrics.monthlyCost)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Current billing cycle
          </p>
        </CardContent>
      </Card>

      {/* Optimization Rate Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Optimization Rate
          </CardTitle>
          <TrendingUp className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatPercentage(metrics.optimizationRate)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Average compression savings
          </p>
        </CardContent>
      </Card>

      {/* Health Score Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">System Health</CardTitle>
          <Activity className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatPercentage(metrics.healthScore)}
          </div>
          <p
            className={`text-xs mt-1 ${
              metrics.healthScore >= 90
                ? 'text-green-600 dark:text-green-500'
                : metrics.healthScore >= 70
                  ? 'text-yellow-600 dark:text-yellow-500'
                  : 'text-red-600 dark:text-red-500'
            }`}
          >
            {metrics.healthScore >= 90
              ? 'Excellent'
              : metrics.healthScore >= 70
                ? 'Good'
                : 'Needs Attention'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
