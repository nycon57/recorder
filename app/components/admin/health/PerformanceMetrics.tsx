'use client';

import { useEffect, useState } from 'react';
import { Activity, Clock, Zap, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';

interface PerformanceData {
  apiResponseTime: number;
  jobProcessingTime: number;
  storageLatency: number;
  throughput: number;
}

export default function PerformanceMetrics() {
  const [metrics, setMetrics] = useState<PerformanceData | null>(null);
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
          throw new Error('Failed to fetch performance metrics');
        }

        const { data } = await response.json();

        setMetrics({
          apiResponseTime: data.performance?.apiResponseTime || 0,
          jobProcessingTime: data.performance?.jobProcessingTime || 0,
          storageLatency: data.performance?.storageLatency || 0,
          throughput: data.performance?.throughput || 0,
        });
        setError(null);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        console.error('Error fetching performance metrics:', err);
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

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getPerformanceStatus = (value: number, thresholds: { good: number; ok: number }): 'good' | 'ok' | 'poor' => {
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.ok) return 'ok';
    return 'poor';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'text-green-600 dark:text-green-500';
      case 'ok':
        return 'text-yellow-600 dark:text-yellow-500';
      case 'poor':
        return 'text-red-600 dark:text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[200px]" />
          <Skeleton className="h-4 w-[300px] mt-2" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">Error loading performance metrics: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  const apiStatus = getPerformanceStatus(metrics.apiResponseTime, { good: 100, ok: 300 });
  const jobStatus = getPerformanceStatus(metrics.jobProcessingTime, { good: 60000, ok: 180000 });
  const storageStatus = getPerformanceStatus(metrics.storageLatency, { good: 50, ok: 150 });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Performance Metrics Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Performance Metrics
          </CardTitle>
          <CardDescription>
            Real-time performance measurements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* API Response Time */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">API Response Time</span>
                </div>
                <span className={`text-sm font-bold ${getStatusColor(apiStatus)}`}>
                  {formatTime(metrics.apiResponseTime)}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    apiStatus === 'good' ? 'bg-green-600' :
                    apiStatus === 'ok' ? 'bg-yellow-600' :
                    'bg-red-600'
                  }`}
                  style={{
                    width: `${Math.min((metrics.apiResponseTime / 500) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Target: &lt;100ms (Excellent) | &lt;300ms (Good)
              </p>
            </div>

            {/* Job Processing Time */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Avg. Job Processing Time</span>
                </div>
                <span className={`text-sm font-bold ${getStatusColor(jobStatus)}`}>
                  {formatTime(metrics.jobProcessingTime)}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    jobStatus === 'good' ? 'bg-green-600' :
                    jobStatus === 'ok' ? 'bg-yellow-600' :
                    'bg-red-600'
                  }`}
                  style={{
                    width: `${Math.min((metrics.jobProcessingTime / 300000) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Target: &lt;1min (Excellent) | &lt;3min (Good)
              </p>
            </div>

            {/* Storage Latency */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Storage Latency</span>
                </div>
                <span className={`text-sm font-bold ${getStatusColor(storageStatus)}`}>
                  {formatTime(metrics.storageLatency)}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    storageStatus === 'good' ? 'bg-green-600' :
                    storageStatus === 'ok' ? 'bg-yellow-600' :
                    'bg-red-600'
                  }`}
                  style={{
                    width: `${Math.min((metrics.storageLatency / 300) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Target: &lt;50ms (Excellent) | &lt;150ms (Good)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Capacity Planning Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Capacity Planning
          </CardTitle>
          <CardDescription>
            Resource utilization and scaling recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Throughput */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Current Throughput</span>
                <span className="text-sm font-bold">{metrics.throughput.toFixed(0)} req/s</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min((metrics.throughput / 1000) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Capacity: 1000 req/s
              </p>
            </div>

            {/* Recommendations */}
            <div className="space-y-3 pt-2">
              <h4 className="text-sm font-medium">Recommendations</h4>
              <div className="space-y-2">
                {metrics.throughput > 800 && (
                  <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-3">
                    <p className="text-xs font-medium text-yellow-900 dark:text-yellow-100">
                      High Load Detected
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                      Consider scaling up workers to handle increased load.
                    </p>
                  </div>
                )}
                {metrics.apiResponseTime > 200 && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
                    <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
                      API Performance
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Response times are elevated. Review database query performance.
                    </p>
                  </div>
                )}
                {metrics.apiResponseTime <= 100 && metrics.throughput < 500 && (
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-3">
                    <p className="text-xs font-medium text-green-900 dark:text-green-100">
                      Optimal Performance
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      All systems operating within optimal parameters.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
