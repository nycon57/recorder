'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Badge } from '@/app/components/ui/badge';
import { Progress } from '@/app/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import {
  HardDrive,
  Users,
  AlertTriangle,
  TrendingUp,
  Package,
} from 'lucide-react';

interface QuotasData {
  totalOrgs: number;
  orgsNearSearchLimit: number;
  orgsNearStorageLimit: number;
  totalStorageUsedGb: number;
  totalStorageLimitGb: number;
  planDistribution: Record<string, number>;
  orgs: Array<{
    id: string;
    name: string;
    plan: string;
    storageUsed: number;
    storageLimit: number;
    searchesUsed: number;
    searchesLimit: number;
  }>;
}

export default function AdminQuotasPage() {
  const [data, setData] = useState<QuotasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Quota Management - Admin';
    fetchQuotas();

    // Refresh every 30 seconds
    const interval = setInterval(fetchQuotas, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchQuotas() {
    try {
      const response = await fetch('/api/admin/quotas');

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied. System admin privileges required.');
        }
        throw new Error('Failed to fetch quotas');
      }

      const result = await response.json();
      setData(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function getPlanBadgeVariant(plan: string) {
    switch (plan.toLowerCase()) {
      case 'enterprise':
        return 'default';
      case 'pro':
        return 'secondary';
      case 'free':
        return 'outline';
      default:
        return 'outline';
    }
  }

  if (loading && !data) {
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

  if (!data) {
    return null;
  }

  const storageUtilization = (data.totalStorageUsedGb / data.totalStorageLimitGb) * 100;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Quota Management</h1>
          <p className="text-muted-foreground">Monitor organization usage and limits</p>
        </div>

        <Badge variant="outline" className="text-sm">
          Auto-refresh: 30s
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalOrgs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Near Search Limit</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.orgsNearSearchLimit}</div>
            <p className="text-xs text-muted-foreground">
              {((data.orgsNearSearchLimit / data.totalOrgs) * 100).toFixed(0)}% of orgs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Near Storage Limit</CardTitle>
            <HardDrive className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.orgsNearStorageLimit}</div>
            <p className="text-xs text-muted-foreground">
              {((data.orgsNearStorageLimit / data.totalOrgs) * 100).toFixed(0)}% of orgs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.totalStorageUsedGb.toFixed(0)}GB
            </div>
            <p className="text-xs text-muted-foreground">
              of {data.totalStorageLimitGb}GB ({storageUtilization.toFixed(1)}%)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Plan Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Distribution</CardTitle>
          <CardDescription>Organizations by subscription tier</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(data.planDistribution).map(([plan, count]) => {
              const percentage = (count / data.totalOrgs) * 100;
              return (
                <div key={plan} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={getPlanBadgeVariant(plan)}>
                        {plan.toUpperCase()}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {count} organizations
                      </span>
                    </div>
                    <span className="text-sm font-medium">{percentage.toFixed(1)}%</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Organizations Near Limits */}
      {data.orgs && data.orgs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Organizations Near Limits</CardTitle>
            <CardDescription>Organizations using &gt; 80% of their quota</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Storage Usage</TableHead>
                  <TableHead>Search Usage</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.orgs.map((org) => {
                  const storagePercent = (org.storageUsed / org.storageLimit) * 100;
                  const searchPercent = (org.searchesUsed / org.searchesLimit) * 100;
                  const nearLimit = storagePercent > 80 || searchPercent > 80;

                  return (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell>
                        <Badge variant={getPlanBadgeVariant(org.plan)}>
                          {org.plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">
                            {org.storageUsed.toFixed(1)} / {org.storageLimit} GB
                          </div>
                          <Progress
                            value={storagePercent}
                            className={`h-1 ${storagePercent > 90 ? 'bg-red-100' : ''}`}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">
                            {org.searchesUsed.toLocaleString()} / {org.searchesLimit.toLocaleString()}
                          </div>
                          <Progress
                            value={searchPercent}
                            className={`h-1 ${searchPercent > 90 ? 'bg-red-100' : ''}`}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {nearLimit && (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Near Limit
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
