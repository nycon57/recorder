'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Search, Clock, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';

interface MetricsData {
  activeSearches: number;
  qps: number;
  avgLatency: number;
  cacheHitRate: number;
  timestamp: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  suffix?: string;
  loading?: boolean;
}

function MetricCard({ title, value, icon, trend, suffix = '', loading }: MetricCardProps) {
  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-green-600 dark:text-green-400';
    if (trend < 0) return 'text-red-600 dark:text-red-400';
    return 'text-muted-foreground';
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4" />;
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-24 bg-muted animate-pulse rounded" />
        ) : (
          <>
            <div className="text-2xl font-bold">
              {value}
              {suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>}
            </div>
            {trend !== undefined && trend !== 0 && (
              <div className={`flex items-center gap-1 mt-1 text-xs ${getTrendColor(trend)}`}>
                {getTrendIcon(trend)}
                <span>
                  {Math.abs(trend).toFixed(1)}% from previous
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function RealTimeMetrics() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previousMetrics, setPreviousMetrics] = useState<MetricsData | null>(null);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/admin/metrics/realtime');

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }

      const data = await response.json();

      setPreviousMetrics(metrics);
      setMetrics(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching real-time metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    // Update every 2 seconds
    const interval = setInterval(fetchMetrics, 2000);

    return () => clearInterval(interval);
  }, []);

  const calculateTrend = (current: number, previous: number | undefined): number => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const trends = previousMetrics && metrics ? {
    activeSearches: calculateTrend(metrics.activeSearches, previousMetrics.activeSearches),
    qps: calculateTrend(metrics.qps, previousMetrics.qps),
    avgLatency: calculateTrend(metrics.avgLatency, previousMetrics.avgLatency) * -1, // Inverted: lower is better
    cacheHitRate: calculateTrend(metrics.cacheHitRate, previousMetrics.cacheHitRate),
  } : undefined;

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">Error loading real-time metrics: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Real-Time Metrics</h2>
          <p className="text-muted-foreground">Live system performance (updates every 2s)</p>
        </div>
        <Badge variant="outline" className="gap-2">
          <Activity className="h-3 w-3 animate-pulse" />
          Live
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Searches"
          value={metrics?.activeSearches ?? 0}
          icon={<Search className="h-4 w-4" />}
          trend={trends?.activeSearches}
          loading={loading}
        />

        <MetricCard
          title="Queries Per Second"
          value={metrics?.qps ?? 0}
          icon={<Activity className="h-4 w-4" />}
          suffix="qps"
          trend={trends?.qps}
          loading={loading}
        />

        <MetricCard
          title="Avg Latency"
          value={metrics?.avgLatency ?? 0}
          icon={<Clock className="h-4 w-4" />}
          suffix="ms"
          trend={trends?.avgLatency}
          loading={loading}
        />

        <MetricCard
          title="Cache Hit Rate"
          value={metrics?.cacheHitRate ? `${metrics.cacheHitRate.toFixed(1)}%` : '0%'}
          icon={<Database className="h-4 w-4" />}
          trend={trends?.cacheHitRate}
          loading={loading}
        />
      </div>

      {metrics && (
        <p className="text-xs text-muted-foreground text-right">
          Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
