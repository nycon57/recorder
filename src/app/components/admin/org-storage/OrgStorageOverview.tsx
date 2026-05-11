'use client';

import { useQuery } from '@tanstack/react-query';
import {
  HardDrive,
  TrendingUp,
  DollarSign,
  Users,
  FileVideo,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Skeleton } from '@/app/components/ui/skeleton';
import {
  formatBytes,
  formatCurrency,
  formatPercentage,
} from '@/lib/utils/formatting';

interface OrgMetrics {
  name: string;
  totalStorage: number;
  recordingCount: number;
  userCount: number;
  monthlyCost: number;
  growthRate: number;
  compressionRate: number;
  tier: 'hot' | 'warm' | 'cold' | 'glacier';
}

interface OrgStorageOverviewProps {
  organizationId: string;
}

export default function OrgStorageOverview({
  organizationId,
}: OrgStorageOverviewProps) {
  const {
    data: metrics,
    isLoading,
    error,
  } = useQuery<OrgMetrics, Error>({
    queryKey: ['analytics', 'organizations', organizationId, 'metrics'],
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/analytics/organizations/${organizationId}/metrics`,
        { signal },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch organization metrics');
      }

      const { data } = await response.json();
      return data;
    },
    refetchInterval: 30000,
  });

  const getTierColor = (tier: string): string => {
    switch (tier) {
      case 'hot':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'warm':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'cold':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'glacier':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[200px]" />
          </CardHeader>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            'org-storage-1',
            'org-storage-2',
            'org-storage-3',
            'org-storage-4',
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
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">
            Error loading organization metrics: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Organization Name and Tier */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">{metrics.name}</CardTitle>
            <Badge className={getTierColor(metrics.tier)}>
              {metrics.tier.toUpperCase()} Tier
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Storage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
            <HardDrive className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(metrics.totalStorage)}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <TrendingUp
                className={`size-3 ${
                  metrics.growthRate > 0 ? 'text-orange-600' : 'text-green-600'
                }`}
              />
              <p className="text-xs text-muted-foreground">
                {metrics.growthRate > 0 ? '+' : ''}
                {metrics.growthRate.toFixed(1)}% this month
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Cost */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
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

        {/* Recordings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Recordings
            </CardTitle>
            <FileVideo className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.recordingCount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg.{' '}
              {formatBytes(
                metrics.totalStorage / Math.max(metrics.recordingCount, 1),
              )}{' '}
              per file
            </p>
          </CardContent>
        </Card>

        {/* Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.userCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatBytes(
                metrics.totalStorage / Math.max(metrics.userCount, 1),
              )}{' '}
              per user
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Compression Efficiency */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Compression Efficiency
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Compression Rate
            </span>
            <span className="text-sm font-medium">
              {formatPercentage(metrics.compressionRate)}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${metrics.compressionRate}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Saving{' '}
            {formatBytes(
              metrics.totalStorage * (metrics.compressionRate / 100),
            )}{' '}
            through compression
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
