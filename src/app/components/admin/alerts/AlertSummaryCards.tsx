'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';

interface AlertStats {
  critical: number;
  warning: number;
  info: number;
  resolved: number;
}

export default function AlertSummaryCards() {
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery<AlertStats, Error>({
    queryKey: ['analytics', 'alerts', 'summary'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/analytics/alerts', { signal });

      if (!response.ok) {
        throw new Error('Failed to fetch alert stats');
      }

      const { data } = await response.json();

      return {
        critical: data.summary?.critical || 0,
        warning: data.summary?.warning || 0,
        info: data.summary?.info || 0,
        resolved: data.summary?.resolved || 0,
      };
    },
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          'alert-summary-1',
          'alert-summary-2',
          'alert-summary-3',
          'alert-summary-4',
        ].map((skeletonId) => (
          <Card key={skeletonId}>
            <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="size-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[60px]" />
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
            Error loading alert stats: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Critical Alerts */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
          <AlertCircle className="size-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {stats.critical}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Requires immediate attention
          </p>
        </CardContent>
      </Card>

      {/* Warning Alerts */}
      <Card className="border-yellow-200 dark:border-yellow-900">
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Warnings</CardTitle>
          <AlertTriangle className="size-4 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">
            {stats.warning}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Should be reviewed soon
          </p>
        </CardContent>
      </Card>

      {/* Info Alerts */}
      <Card className="border-blue-200 dark:border-blue-900">
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Informational</CardTitle>
          <Info className="size-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{stats.info}</div>
          <p className="text-xs text-muted-foreground mt-1">
            For your awareness
          </p>
        </CardContent>
      </Card>

      {/* Resolved Alerts */}
      <Card className="border-green-200 dark:border-green-900">
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Resolved (24h)</CardTitle>
          <CheckCircle2 className="size-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {stats.resolved}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Successfully addressed
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
