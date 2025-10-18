'use client';

import { useEffect, useState, useRef } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Skeleton } from '@/app/components/ui/skeleton';

interface HealthData {
  score: number;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  lastChecked: string;
}

export default function HealthScoreGauge() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      // Create new AbortController for this fetch
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/analytics/metrics?includeHealth=true', {
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch health data');
        }

        const { data } = await response.json();

        const score = data.health?.score || 0;
        setHealth({
          score,
          trend: data.health?.trend || 'stable',
          trendValue: data.health?.trendValue || 0,
          status:
            score >= 90 ? 'excellent' :
            score >= 75 ? 'good' :
            score >= 60 ? 'fair' : 'poor',
          lastChecked: data.health?.lastChecked || new Date().toISOString(),
        });
        setError(null);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        console.error('Error fetching health data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load health data');
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);

    return () => {
      clearInterval(interval);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'text-green-600 dark:text-green-500';
      case 'good':
        return 'text-blue-600 dark:text-blue-500';
      case 'fair':
        return 'text-yellow-600 dark:text-yellow-500';
      case 'poor':
        return 'text-red-600 dark:text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'bg-green-100 dark:bg-green-950/30';
      case 'good':
        return 'bg-blue-100 dark:bg-blue-950/30';
      case 'fair':
        return 'bg-yellow-100 dark:bg-yellow-950/30';
      case 'poor':
        return 'bg-red-100 dark:bg-red-950/30';
      default:
        return 'bg-muted';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[200px]" />
          <Skeleton className="h-4 w-[300px] mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">Error loading health data: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!health) {
    return null;
  }

  // Calculate gauge rotation (0-180 degrees for 0-100%)
  const rotation = (health.score / 100) * 180 - 90;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Overall System Health
        </CardTitle>
        <CardDescription>
          Composite health score based on storage, performance, and reliability metrics
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-8">
          {/* Gauge Visualization */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-64 h-32">
              {/* Gauge Background */}
              <svg viewBox="0 0 200 100" className="w-full h-full">
                {/* Background Arc */}
                <path
                  d="M 20 90 A 80 80 0 0 1 180 90"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="20"
                  className="text-muted/20"
                />
                {/* Colored Sections */}
                <path
                  d="M 20 90 A 80 80 0 0 1 56.5 35"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="20"
                  className="text-red-500/40"
                />
                <path
                  d="M 56.5 35 A 80 80 0 0 1 100 20"
                  fill="none"
                  strokeWidth="20"
                  className="text-yellow-500/40"
                />
                <path
                  d="M 100 20 A 80 80 0 0 1 143.5 35"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="20"
                  className="text-blue-500/40"
                />
                <path
                  d="M 143.5 35 A 80 80 0 0 1 180 90"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="20"
                  className="text-green-500/40"
                />
                {/* Needle */}
                <g transform={`rotate(${rotation} 100 90)`}>
                  <line
                    x1="100"
                    y1="90"
                    x2="100"
                    y2="30"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="text-foreground"
                  />
                  <circle
                    cx="100"
                    cy="90"
                    r="6"
                    fill="currentColor"
                    className="text-foreground"
                  />
                </g>
              </svg>
            </div>

            {/* Score Display */}
            <div className="text-center mt-4">
              <div className={`text-5xl font-bold ${getStatusColor(health.status)}`}>
                {health.score.toFixed(0)}
              </div>
              <Badge
                variant="outline"
                className={`mt-2 ${getStatusColor(health.status)}`}
              >
                {health.status.toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Health Details */}
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-4">Health Status</h3>
              <div className="space-y-3">
                <div className={`rounded-lg p-4 ${getStatusBgColor(health.status)}`}>
                  <p className={`text-sm font-medium ${getStatusColor(health.status)}`}>
                    {health.status === 'excellent' && 'Excellent - All systems operating optimally'}
                    {health.status === 'good' && 'Good - Systems performing well'}
                    {health.status === 'fair' && 'Fair - Some attention needed'}
                    {health.status === 'poor' && 'Poor - Immediate attention required'}
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm text-muted-foreground">Health Trend</span>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(health.trend)}
                    <span className="text-sm font-medium">
                      {health.trend === 'up' && `+${health.trendValue.toFixed(1)}%`}
                      {health.trend === 'down' && `${health.trendValue.toFixed(1)}%`}
                      {health.trend === 'stable' && 'Stable'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm text-muted-foreground">Last Checked</span>
                  <span className="text-sm font-medium">{formatTimestamp(health.lastChecked)}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Score Breakdown</h3>
              <p className="text-xs text-muted-foreground">
                Health score is calculated based on storage availability (40%), job success rate (30%),
                API response times (20%), and alert frequency (10%).
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
