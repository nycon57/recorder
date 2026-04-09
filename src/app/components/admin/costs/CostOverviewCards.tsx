'use client';

import { useEffect, useState, useRef } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Calendar, Zap } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils/formatting';

interface CostMetrics {
  currentMonth: number;
  lastMonth: number;
  ytd: number;
  projected: number;
  monthOverMonthChange: number;
  projectedChange: number;
  savingsOpportunity: number;
}

export default function CostOverviewCards() {
  const [metrics, setMetrics] = useState<CostMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      // Abort previous request if it exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this fetch
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/analytics/costs/overview', {
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch cost metrics');
        }

        const { data } = await response.json();
        setMetrics(data);
        setError(null);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        console.error('Error fetching cost metrics:', err);
        setError(err instanceof Error ? err.message : 'Failed to load metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();

    // Auto-refresh every 30 seconds
    intervalRef.current = setInterval(fetchMetrics, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
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
          <p className="text-sm text-destructive">Error loading cost metrics: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  const isIncreasing = metrics.monthOverMonthChange > 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Current Month Cost */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Current Month</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(metrics.currentMonth)}</div>
          <div className="flex items-center gap-1 mt-1">
            {isIncreasing ? (
              <TrendingUp className="h-3 w-3 text-red-600" />
            ) : (
              <TrendingDown className="h-3 w-3 text-green-600" />
            )}
            <p className={`text-xs ${isIncreasing ? 'text-red-600' : 'text-green-600'}`}>
              {isIncreasing ? '+' : ''}{metrics.monthOverMonthChange.toFixed(1)}% vs last month
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Projected Month Cost */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Projected (EOM)</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(metrics.projected)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Based on current usage trends
          </p>
        </CardContent>
      </Card>

      {/* Year to Date */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Year to Date</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(metrics.ytd)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatCurrency(metrics.ytd / Math.max(1, new Date().getMonth() + 1))} monthly average
          </p>
        </CardContent>
      </Card>

      {/* Optimization Savings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Savings (This Month)</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(metrics.savingsOpportunity)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            From compression & optimization
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
