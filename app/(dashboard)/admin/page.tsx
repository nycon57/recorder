'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, TrendingUp, Server } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Badge } from '@/app/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';

// Component imports
import RealTimeMetrics from './components/RealTimeMetrics';
import MetricsChart from './components/MetricsChart';
import AlertsList from './components/AlertsList';
import JobsQueue from './components/JobsQueue';

interface DashboardSummary {
  totalSearches: number;
  p95Latency: number;
  cacheHitRate: number;
  activeJobs: number;
  criticalAlerts: number;
}

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  // Set page title
  useEffect(() => {
    document.title = 'Admin Dashboard - Record';
  }, []);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch('/api/admin/metrics');

        if (!response.ok) {
          throw new Error('Failed to fetch dashboard summary');
        }

        const data = await response.json();
        // The API wraps response in { data: ... }
        setSummary(data.data?.summary || data.summary || null);
      } catch (err) {
        console.error('Error fetching dashboard summary:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();

    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchSummary, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Server className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground">System monitoring and analytics</p>
          </div>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {summary && summary.criticalAlerts > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Critical Alerts Active</AlertTitle>
          <AlertDescription>
            There are {summary.criticalAlerts} critical alert{summary.criticalAlerts > 1 ? 's' : ''} requiring immediate attention.
            Please check the Alerts tab.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Searches
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {summary?.totalSearches?.toLocaleString() ?? '0'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Last 24 hours</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                P95 Latency
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {summary?.p95Latency ?? 0}
                  <span className="text-sm font-normal text-muted-foreground ml-1">ms</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">95th percentile</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cache Hit Rate
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {summary?.cacheHitRate?.toFixed(1) ?? '0'}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">Query cache efficiency</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Jobs
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {summary?.activeJobs ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Pending + Processing</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="realtime" className="w-full">
        <TabsList>
          <TabsTrigger value="realtime">
            <Activity className="h-4 w-4 mr-2" />
            Real-Time
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <TrendingUp className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="jobs">
            <Server className="h-4 w-4 mr-2" />
            Job Queue
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Alerts
            {summary && summary.criticalAlerts > 0 && (
              <Badge variant="destructive" className="ml-2">
                {summary.criticalAlerts}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Real-Time Tab */}
        <TabsContent value="realtime" className="space-y-4">
          <RealTimeMetrics />

          {/* Quick Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <MetricsChart
              metric="search_latency"
              timeRange="1h"
              chartType="line"
              title="Search Latency"
              description="Last hour, updated every minute"
            />
            <MetricsChart
              metric="cache_hit_rate"
              timeRange="1h"
              chartType="area"
              title="Cache Performance"
              description="Hit rate over last hour"
            />
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {/* Time Range Selector */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
              <p className="text-muted-foreground">Historical metrics and trends</p>
            </div>
            <div className="flex gap-2">
              {(['1h', '24h', '7d', '30d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {range.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Analytics Charts */}
          <div className="grid gap-4">
            <MetricsChart
              metric="search_volume"
              timeRange={timeRange}
              chartType="bar"
              title="Search Volume"
              description="Total searches over time"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <MetricsChart
                metric="p95_latency"
                timeRange={timeRange}
                chartType="line"
                title="P95 Latency"
                description="95th percentile response time"
              />
              <MetricsChart
                metric="p99_latency"
                timeRange={timeRange}
                chartType="line"
                title="P99 Latency"
                description="99th percentile response time"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <MetricsChart
                metric="cache_hit_rate"
                timeRange={timeRange}
                chartType="area"
                title="Cache Hit Rate"
                description="Query cache efficiency"
              />
              <MetricsChart
                metric="rerank_usage"
                timeRange={timeRange}
                chartType="bar"
                title="Reranking Usage"
                description="Queries using reranking"
              />
            </div>

            <MetricsChart
              metric="embedding_generation"
              timeRange={timeRange}
              chartType="bar"
              title="Embedding Generation"
              description="New embeddings created"
            />
          </div>
        </TabsContent>

        {/* Job Queue Tab */}
        <TabsContent value="jobs" className="space-y-4">
          <JobsQueue />
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <AlertsList />
        </TabsContent>
      </Tabs>

      {/* Footer Info */}
      <div className="text-xs text-muted-foreground text-center border-t pt-4">
        Dashboard auto-refreshes every 10 seconds. Real-time metrics update every 2 seconds.
      </div>
    </div>
  );
}
