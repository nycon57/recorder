'use client';

import { useEffect, useState, useRef } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';

interface Service {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'down';
  uptime: number;
  lastChecked: string;
}

export default function ServiceStatusGrid() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      // Create new AbortController for this fetch
      abortControllerRef.current = new AbortController();
      const controller = abortControllerRef.current;

      // Set timeout to abort after 15 seconds
      timeoutIdRef.current = setTimeout(() => {
        controller.abort();
      }, 15000);

      try {
        const response = await fetch('/api/analytics/metrics?includeHealth=true', {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch service status');
        }

        const { data } = await response.json();
        setServices(data.health?.services || []);
        setError(null);

        // Clear timeout on success
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current);
          timeoutIdRef.current = null;
        }
      } catch (err) {
        // Handle abort specifically
        if (err instanceof Error && err.name === 'AbortError') {
          setError('Request timed out. Please check your connection.');
        } else {
          // Log only sanitized message, not full error object
          console.error('Service status fetch error:', err instanceof Error ? err.message : 'Unknown error');
          setError('Failed to load service status');
        }
      } finally {
        // Clear timeout if still set
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current);
          timeoutIdRef.current = null;
        }
        setLoading(false);
      }
    };

    fetchServices();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchServices, 30000);

    return () => {
      clearInterval(interval);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'degraded':
        return <Loader2 className="h-5 w-5 text-yellow-600 animate-spin" />;
      case 'down':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20';
      case 'degraded':
        return 'border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/20';
      case 'down':
        return 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20';
      default:
        return 'border-muted';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'operational':
        return 'Operational';
      case 'degraded':
        return 'Degraded Performance';
      case 'down':
        return 'Service Down';
      default:
        return status;
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[200px]" />
          <Skeleton className="h-4 w-[300px] mt-2" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
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
          <p className="text-sm text-destructive">Error loading service status: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Status</CardTitle>
        <CardDescription>
          Real-time status of all storage-related services
        </CardDescription>
      </CardHeader>
      <CardContent>
        {services.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <div
                key={service.id}
                className={`border rounded-lg p-4 space-y-3 ${getStatusColor(service.status)}`}
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-medium text-sm">{service.name}</h3>
                  {getStatusIcon(service.status)}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium">{getStatusLabel(service.status)}</p>
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>Uptime</span>
                    <span className="font-medium">{service.uptime.toFixed(2)}%</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Checked {formatTimestamp(service.lastChecked)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No service data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
