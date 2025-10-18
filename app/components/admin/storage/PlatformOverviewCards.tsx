'use client';

import { useEffect, useState } from 'react';
import { HardDrive, DollarSign, TrendingUp, Activity } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';
import { formatBytes, formatCurrency, formatPercentage } from '@/lib/utils/formatting';

interface PlatformMetrics {
  totalStorage: number;
  monthlyCost: number;
  optimizationRate: number;
  healthScore: number;
}

export default function PlatformOverviewCards() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let interval: NodeJS.Timeout | null = null;

    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/analytics/metrics?includeHealth=true', {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch metrics');
        }

        const { data } = await response.json();

        setMetrics({
          totalStorage: data.summary?.totalStorage || 0,
          monthlyCost: data.costs?.currentMonth || 0,
          optimizationRate: data.optimization?.compressionRate || 0,
          healthScore: data.health?.score || 0,
        });
        setError(null);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        console.error('Error fetching platform metrics:', err);
        setError(err instanceof Error ? err.message : 'Failed to load metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();

    // Auto-refresh every 30 seconds
    interval = setInterval(fetchMetrics, 30000);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
      controller.abort();
    };
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-4 rounded-full" />
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
          <p className="text-sm text-destructive">Error loading metrics: {error}</p>
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Platform Storage</CardTitle>
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatBytes(metrics.totalStorage)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Across all organizations
          </p>
        </CardContent>
      </Card>

      {/* Monthly Cost Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Storage Cost</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(metrics.monthlyCost)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Current billing cycle
          </p>
        </CardContent>
      </Card>

      {/* Optimization Rate Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Optimization Rate</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatPercentage(metrics.optimizationRate)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Average compression savings
          </p>
        </CardContent>
      </Card>

      {/* Health Score Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">System Health</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatPercentage(metrics.healthScore)}</div>
          <p className={`text-xs mt-1 ${
            metrics.healthScore >= 90 ? 'text-green-600 dark:text-green-500' :
            metrics.healthScore >= 70 ? 'text-yellow-600 dark:text-yellow-500' :
            'text-red-600 dark:text-red-500'
          }`}>
            {metrics.healthScore >= 90 ? 'Excellent' :
             metrics.healthScore >= 70 ? 'Good' :
             'Needs Attention'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
