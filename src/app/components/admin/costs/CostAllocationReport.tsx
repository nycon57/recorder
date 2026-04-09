'use client';

import { useEffect, useState } from 'react';
import { FileText, Download, Calendar, Filter, Building2, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton';
import { formatCurrency, formatBytes } from '@/lib/utils/formatting';

interface AllocationEntry {
  organizationId: string;
  organizationName: string;
  totalCost: number;
  storage: number;
  tier: 'hot' | 'warm' | 'cold' | 'glacier';
  userCount: number;
  recordingCount: number;
  costPerUser: number;
  costPerGB: number;
  trend: number;
}

interface AllocationData {
  allocations: AllocationEntry[];
  totals: {
    totalCost: number;
    totalStorage: number;
    totalUsers: number;
    totalRecordings: number;
  };
}

export default function CostAllocationReport() {
  const [data, setData] = useState<AllocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'cost' | 'storage' | 'users'>('cost');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const fetchAllocationData = async () => {
      try {
        const response = await fetch('/api/analytics/costs/allocation');

        if (!response.ok) {
          throw new Error('Failed to fetch allocation report');
        }

        const { data: allocationData } = await response.json();
        setData(allocationData);
      } catch (err) {
        console.error('Error fetching allocation data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load allocation data');
      } finally {
        setLoading(false);
      }
    };

    fetchAllocationData();
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    let url: string | null = null;

    try {
      const response = await fetch('/api/analytics/costs/allocation/export', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to export report');
      }

      const blob = await response.blob();
      url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cost-allocation-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error exporting report:', err);
      const { toast } = await import('@/app/components/ui/use-toast');
      toast({
        title: 'Export Failed',
        description: err instanceof Error ? err.message : 'Failed to export report',
        variant: 'destructive',
      });
    } finally {
      if (url) {
        window.URL.revokeObjectURL(url);
      }
      setIsExporting(false);
    }
  };

  const getSortedEntries = () => {
    if (!data) return [];

    const entries = [...data.allocations];
    switch (sortBy) {
      case 'cost':
        return entries.sort((a, b) => b.totalCost - a.totalCost);
      case 'storage':
        return entries.sort((a, b) => b.storage - a.storage);
      case 'users':
        return entries.sort((a, b) => b.userCount - a.userCount);
      default:
        return entries;
    }
  };

  const getCurrentPeriod = (): string => {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  const getGeneratedTime = (): string => {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
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
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">Error loading allocation report: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const sortedEntries = getSortedEntries();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Cost Allocation Report
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Calendar className="h-3 w-3" />
              {getCurrentPeriod()} • Generated {getGeneratedTime()}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border rounded-lg p-1">
              <Button
                size="sm"
                variant={sortBy === 'cost' ? 'default' : 'ghost'}
                onClick={() => setSortBy('cost')}
                className="h-7 text-xs"
              >
                Cost
              </Button>
              <Button
                size="sm"
                variant={sortBy === 'storage' ? 'default' : 'ghost'}
                onClick={() => setSortBy('storage')}
                className="h-7 text-xs"
              >
                Storage
              </Button>
              <Button
                size="sm"
                variant={sortBy === 'users' ? 'default' : 'ghost'}
                onClick={() => setSortBy('users')}
                className="h-7 text-xs"
              >
                Users
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={handleExport} disabled={isExporting}>
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sortedEntries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4" />
            <p className="text-sm">No allocation data available</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
              <div className="col-span-3">Organization</div>
              <div className="col-span-2">Total Cost</div>
              <div className="col-span-2">Storage</div>
              <div className="col-span-1">Tier</div>
              <div className="col-span-1">Users</div>
              <div className="col-span-2">Cost/User</div>
              <div className="col-span-1">Trend</div>
            </div>

            {/* Table Rows */}
            {sortedEntries.map((entry) => (
              <Link
                key={entry.organizationId}
                href={`/admin/organizations/${entry.organizationId}/storage`}
                className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-muted/50 rounded-lg transition-colors"
              >
                {/* Organization */}
                <div className="col-span-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{entry.organizationName}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.recordingCount} recordings
                    </p>
                  </div>
                </div>

                {/* Total Cost */}
                <div className="col-span-2">
                  <Badge variant="secondary" className="text-xs">
                    {formatCurrency(entry.totalCost)}
                  </Badge>
                </div>

                {/* Storage */}
                <div className="col-span-2">
                  <p className="text-sm">{formatBytes(entry.storage)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(entry.costPerGB)}/GB
                  </p>
                </div>

                {/* Tier */}
                <div className="col-span-1">
                  <Badge variant="outline" className="text-xs">
                    {entry.tier.toUpperCase()}
                  </Badge>
                </div>

                {/* Users */}
                <div className="col-span-1">
                  <p className="text-sm font-medium">{entry.userCount}</p>
                </div>

                {/* Cost per User */}
                <div className="col-span-2">
                  <p className="text-sm">{formatCurrency(entry.costPerUser)}</p>
                </div>

                {/* Trend */}
                <div className="col-span-1">
                  <div className="flex items-center gap-1">
                    {entry.trend > 0 ? (
                      <TrendingUp className="h-3 w-3 text-red-600" />
                    ) : entry.trend < 0 ? (
                      <TrendingDown className="h-3 w-3 text-green-600" />
                    ) : null}
                    <span
                      className={`text-xs ${
                        entry.trend > 0
                          ? 'text-red-600'
                          : entry.trend < 0
                          ? 'text-green-600'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {entry.trend > 0 ? '+' : ''}{entry.trend.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </Link>
            ))}

            {/* Total Row */}
            <div className="grid grid-cols-12 gap-4 px-4 py-3 border-t bg-muted/50 rounded-lg font-semibold">
              <div className="col-span-3">Total Platform</div>
              <div className="col-span-2">
                <Badge className="text-xs">{formatCurrency(data.totals.totalCost)}</Badge>
              </div>
              <div className="col-span-7"></div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
