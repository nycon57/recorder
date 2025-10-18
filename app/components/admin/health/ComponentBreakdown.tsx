'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Database, Cloud, Cpu, Zap } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
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
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchComponents = async () => {
      try {
        const response = await fetch('/api/analytics/metrics?includeHealth=true');

        if (!response.ok) {
          throw new Error('Failed to fetch component health');
        }

        const { data } = await response.json();
        setComponents(data.health?.components || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching component health:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchComponents();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchComponents, 30000);
    return () => clearInterval(interval);
  }, []);

  const getComponentIcon = (id: string) => {
    switch (id) {
      case 'storage':
        return <Database className="h-5 w-5" />;
      case 'api':
        return <Zap className="h-5 w-5" />;
      case 'workers':
        return <Cpu className="h-5 w-5" />;
      case 'cdn':
        return <Cloud className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'down':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' => {
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[200px]" />
          <Skeleton className="h-4 w-[300px] mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
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
          <p className="text-sm text-destructive">Error loading component health: {error}</p>
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
                        <span className="text-sm font-medium">{component.name}</span>
                        <Badge variant={getStatusBadgeVariant(component.status)}>
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
                    <span className="text-sm font-medium">{component.health}%</span>
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
