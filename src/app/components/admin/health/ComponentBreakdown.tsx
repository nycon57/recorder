'use client';

import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Database,
  Cloud,
  Cpu,
  Zap,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Progress } from '@/app/components/ui/progress';
import { Skeleton } from '@/app/components/ui/skeleton';

interface Component {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  health: number;
  message?: string;
}

export default function ComponentBreakdown() {
  const {
    data: components = [],
    isLoading,
    error,
  } = useQuery<Component[], Error>({
    queryKey: ['analytics', 'metrics', 'components'],
    queryFn: async ({ signal }) => {
      const response = await fetch(
        '/api/analytics/metrics?includeHealth=true',
        { signal },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch component health');
      }

      const { data } = await response.json();
      return data.health?.components || [];
    },
    refetchInterval: 30000,
  });

  const getComponentIcon = (id: string) => {
    switch (id) {
      case 'storage':
        return <Database className="size-5" />;
      case 'api':
        return <Zap className="size-5" />;
      case 'workers':
        return <Cpu className="size-5" />;
      case 'cdn':
        return <Cloud className="size-5" />;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="size-4 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="size-4 text-yellow-600" />;
      case 'down':
        return <XCircle className="size-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBadgeVariant = (
    status: string,
  ): 'default' | 'secondary' | 'destructive' => {
    switch (status) {
      case 'healthy':
        return 'default';
      case 'degraded':
        return 'secondary';
      case 'down':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[200px]" />
          <Skeleton className="h-4 w-[300px] mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {['component-1', 'component-2', 'component-3', 'component-4'].map(
              (skeletonId) => (
                <Skeleton key={skeletonId} className="h-20 w-full" />
              ),
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">
            Error loading component health: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Component Health Breakdown</CardTitle>
        <CardDescription>
          Individual health status of storage system components
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {components.length > 0 ? (
            components.map((component) => (
              <div key={component.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-muted-foreground">
                      {getComponentIcon(component.id)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {component.name}
                        </span>
                        <Badge
                          variant={getStatusBadgeVariant(component.status)}
                        >
                          {component.status.toUpperCase()}
                        </Badge>
                      </div>
                      {component.message && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {component.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(component.status)}
                    <span className="text-sm font-medium">
                      {component.health}%
                    </span>
                  </div>
                </div>
                <Progress value={component.health} className="h-2" />
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No component data available</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
