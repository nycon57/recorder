'use client';

import { useEffect, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Skeleton } from '@/app/components/ui/skeleton';
import { formatBytes, calculatePercentage } from '@/lib/utils/formatting';

interface TierData {
  hot: number;
  warm: number;
  cold: number;
  glacier: number;
}

interface ProviderData {
  supabase: number;
  r2: number;
}

interface DistributionData {
  tiers: TierData;
  providers: ProviderData;
  totalFiles: number;
}

export default function StorageDistribution() {
  const [data, setData] = useState<DistributionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        const response = await fetch('/api/analytics/metrics', {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch distribution data');
        }

        const { data: metricsData } = await response.json();

        setData({
          tiers: metricsData.distribution?.tiers || { hot: 0, warm: 0, cold: 0, glacier: 0 },
          providers: metricsData.distribution?.providers || { supabase: 0, r2: 0 },
          totalFiles: metricsData.summary?.totalFiles || 0,
        });
        setError(null);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        console.error('Error fetching distribution data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      controller.abort();
    };
  }, []);

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[200px]" />
            <Skeleton className="h-4 w-[300px] mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[200px]" />
            <Skeleton className="h-4 w-[300px] mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">Error loading distribution data: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const totalTierStorage = data.tiers.hot + data.tiers.warm + data.tiers.cold + data.tiers.glacier;
  const totalProviderStorage = data.providers.supabase + data.providers.r2;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Storage Tier Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Storage Tier Distribution</CardTitle>
          <CardDescription>
            Files distributed across storage tiers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Hot Tier */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm font-medium">Hot (Frequently Accessed)</span>
              </div>
              <Badge variant="secondary">
                {formatBytes(data.tiers.hot)}
              </Badge>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full transition-all"
                style={{ width: `${calculatePercentage(data.tiers.hot, totalTierStorage)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {calculatePercentage(data.tiers.hot, totalTierStorage).toFixed(1)}% of total storage
            </p>
          </div>

          {/* Warm Tier */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-sm font-medium">Warm (Regular Access)</span>
              </div>
              <Badge variant="secondary">
                {formatBytes(data.tiers.warm)}
              </Badge>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-yellow-500 h-2 rounded-full transition-all"
                style={{ width: `${calculatePercentage(data.tiers.warm, totalTierStorage)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {calculatePercentage(data.tiers.warm, totalTierStorage).toFixed(1)}% of total storage
            </p>
          </div>

          {/* Cold Tier */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm font-medium">Cold (Infrequent Access)</span>
              </div>
              <Badge variant="secondary">
                {formatBytes(data.tiers.cold)}
              </Badge>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${calculatePercentage(data.tiers.cold, totalTierStorage)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {calculatePercentage(data.tiers.cold, totalTierStorage).toFixed(1)}% of total storage
            </p>
          </div>

          {/* Glacier Tier */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan-500" />
                <span className="text-sm font-medium">Glacier (Archive)</span>
              </div>
              <Badge variant="secondary">
                {formatBytes(data.tiers.glacier)}
              </Badge>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-cyan-500 h-2 rounded-full transition-all"
                style={{ width: `${calculatePercentage(data.tiers.glacier, totalTierStorage)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {calculatePercentage(data.tiers.glacier, totalTierStorage).toFixed(1)}% of total storage
            </p>
          </div>

          <div className="pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Total Storage</span>
              <span className="font-bold">{formatBytes(totalTierStorage)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground mt-1">
              <span>Total Files</span>
              <span>{data.totalFiles.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Storage Provider Distribution</CardTitle>
          <CardDescription>
            Storage across different providers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Supabase */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-600" />
                <span className="text-sm font-medium">Supabase Storage</span>
              </div>
              <Badge variant="secondary">
                {formatBytes(data.providers.supabase)}
              </Badge>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{ width: `${calculatePercentage(data.providers.supabase, totalProviderStorage)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {calculatePercentage(data.providers.supabase, totalProviderStorage).toFixed(1)}% of total storage
            </p>
          </div>

          {/* Cloudflare R2 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-600" />
                <span className="text-sm font-medium">Cloudflare R2</span>
              </div>
              <Badge variant="secondary">
                {formatBytes(data.providers.r2)}
              </Badge>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-orange-600 h-2 rounded-full transition-all"
                style={{ width: `${calculatePercentage(data.providers.r2, totalProviderStorage)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {calculatePercentage(data.providers.r2, totalProviderStorage).toFixed(1)}% of total storage
            </p>
          </div>

          <div className="pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Total Storage</span>
              <span className="font-bold">{formatBytes(totalProviderStorage)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
