'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Badge } from '@/app/components/ui/badge';
import {
  Activity,
  Search,
  Database,
  Zap,
  AlertTriangle,
  Shield,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { useFetchWithInterval } from '@/app/hooks/useFetchWithAbort';

interface DashboardMetrics {
  summary: {
    totalSearches: number;
    p95Latency: number;
    cacheHitRate: number;
    activeJobs: number;
    criticalAlerts: number;
  };
  jobs: {
    pending: number;
    processing: number;
    failed: number;
  };
  quotas: {
    totalOrgs: number;
    orgsNearSearchLimit: number;
    orgsNearStorageLimit: number;
    totalStorageUsedGb: number;
    totalStorageLimitGb: number;
  };
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ✅ Set document title once (legitimate side effect)
  useEffect(() => {
    document.title = 'System Admin Dashboard - Tribora';
  }, []);

  // ✅ Use interval-based fetch with abort controller (prevents race conditions)
  const { loading, error: fetchError } = useFetchWithInterval<{ data: DashboardMetrics }>(
    '/api/admin/metrics?timeRange=24h',
    30000, // Refresh every 30 seconds
    {
      onSuccess: (data: { data: DashboardMetrics }) => {
        setMetrics(data.data);
        setError(null);
      },
      onError: (err: Error) => {
        const errorMessage = err.message.includes('403')
          ? 'Access denied. System admin privileges required.'
          : err.message || 'Failed to fetch metrics';
        setError(errorMessage);
      },
    }
  );

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
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-normal">System Dashboard</h1>
            <p className="text-muted-foreground">Platform-wide monitoring and metrics</p>
          </div>
        </div>
        <Badge variant="outline" className="text-sm">
          Last updated: {new Date().toLocaleTimeString()}
        </Badge>
      </div>

      {/* Critical Alerts Warning */}
      {metrics.summary.criticalAlerts > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {metrics.summary.criticalAlerts} critical alert{metrics.summary.criticalAlerts > 1 ? 's' : ''} require immediate attention
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Searches */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Searches</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.summary.totalSearches.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        {/* P95 Latency */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">P95 Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.summary.p95Latency}ms</div>
            <p className="text-xs text-muted-foreground">
              95th percentile
            </p>
          </CardContent>
        </Card>

        {/* Cache Hit Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(metrics.summary.cacheHitRate * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Multi-layer cache</p>
          </CardContent>
        </Card>

        {/* Active Jobs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.summary.activeJobs}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.jobs.failed} failed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Job Queue Status */}
        <Card>
          <CardHeader>
            <CardTitle>Job Queue Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pending</span>
                <Badge variant="secondary">{metrics.jobs.pending}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Processing</span>
                <Badge variant="default">{metrics.jobs.processing}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Failed</span>
                <Badge variant="destructive">{metrics.jobs.failed}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quota Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Quota Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Organizations</span>
                <Badge variant="outline">{metrics.quotas.totalOrgs}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Near Search Limit</span>
                <Badge variant={metrics.quotas.orgsNearSearchLimit > 0 ? "destructive" : "secondary"}>
                  {metrics.quotas.orgsNearSearchLimit}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Near Storage Limit</span>
                <Badge variant={metrics.quotas.orgsNearStorageLimit > 0 ? "destructive" : "secondary"}>
                  {metrics.quotas.orgsNearStorageLimit}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Storage</span>
                <span className="text-sm font-medium">
                  {metrics.quotas.totalStorageUsedGb.toFixed(1)} / {metrics.quotas.totalStorageLimitGb} GB
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a href="/admin/metrics">
          <Card className="hover:bg-accent cursor-pointer transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                View Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Real-time system performance metrics
              </p>
            </CardContent>
          </Card>
        </a>

        <a href="/admin/jobs">
          <Card className="hover:bg-accent cursor-pointer transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Manage Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Monitor and retry background jobs
              </p>
            </CardContent>
          </Card>
        </a>

        <a href="/admin/quotas">
          <Card className="hover:bg-accent cursor-pointer transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                View Quotas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Organization quota management
              </p>
            </CardContent>
          </Card>
        </a>
      </div>
    </div>
  );
}
