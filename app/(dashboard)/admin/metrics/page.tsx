'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Badge } from '@/app/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  Activity,
  Zap,
  Search,
  Clock,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';

interface MetricsData {
  timeRange: string;
  summary: {
    totalSearches: number;
    p95Latency: number;
    cacheHitRate: number;
    activeJobs: number;
    criticalAlerts: number;
  };
  search: {
    totalSearches: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    cacheHitRate: number;
    cacheLayerDistribution: Record<string, number>;
    modeDistribution: Record<string, number>;
  };
  cache: {
    hitRate: number;
    hits: number;
    misses: number;
    layerDistribution: Record<string, number>;
  };
}

export default function AdminMetricsPage() {
  const [timeRange, setTimeRange] = useState('24h');
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'System Metrics - Admin';
    fetchMetrics();

    // Refresh every 10 seconds
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, [timeRange]);

  async function fetchMetrics() {
    try {
      const response = await fetch(`/api/admin/metrics?timeRange=${timeRange}`);

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied. System admin privileges required.');
        }
        throw new Error('Failed to fetch metrics');
      }

      const data = await response.json();
      setMetrics(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-normal">System Metrics</h1>
          <p className="text-muted-foreground">Real-time performance monitoring</p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>

          <Badge variant="outline" className="text-sm">
            Auto-refresh: 10s
          </Badge>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Searches</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.search.totalSearches.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              in {timeRange}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.search.avgLatencyMs}ms</div>
            <p className="text-xs text-muted-foreground">Mean response time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">P95 Latency</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.search.p95LatencyMs}ms</div>
            <p className="text-xs text-muted-foreground">95th percentile</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(metrics.cache.hitRate * 100).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics.cache.hits} hits / {metrics.cache.misses} misses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="search" className="space-y-4">
        <TabsList>
          <TabsTrigger value="search">
            <Search className="h-4 w-4 mr-2" />
            Search Performance
          </TabsTrigger>
          <TabsTrigger value="cache">
            <Zap className="h-4 w-4 mr-2" />
            Cache Statistics
          </TabsTrigger>
          <TabsTrigger value="distribution">
            <Activity className="h-4 w-4 mr-2" />
            Distribution
          </TabsTrigger>
        </TabsList>

        {/* Search Performance Tab */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Latency Metrics</CardTitle>
              <CardDescription>Response time distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Average (Mean)</span>
                  <Badge variant="outline">{metrics.search.avgLatencyMs}ms</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">P95 (95th percentile)</span>
                  <Badge variant={metrics.search.p95LatencyMs > 500 ? "destructive" : "default"}>
                    {metrics.search.p95LatencyMs}ms
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">P99 (99th percentile)</span>
                  <Badge variant={metrics.search.p99LatencyMs > 1000 ? "destructive" : "default"}>
                    {metrics.search.p99LatencyMs}ms
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cache Statistics Tab */}
        <TabsContent value="cache" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cache Layer Distribution</CardTitle>
              <CardDescription>Hits by cache layer</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(metrics.cache.layerDistribution).map(([layer, count]) => (
                  <div key={layer} className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground capitalize">{layer}</span>
                    <Badge variant="secondary">{count.toLocaleString()}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Distribution Tab */}
        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search Mode Distribution</CardTitle>
              <CardDescription>Searches by mode type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(metrics.search.modeDistribution).map(([mode, count]) => (
                  <div key={mode} className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground capitalize">{mode}</span>
                    <Badge variant="outline">{count.toLocaleString()}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
