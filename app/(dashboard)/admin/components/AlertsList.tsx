'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';

interface AlertItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  metric: string;
  message: string;
  value: number;
  threshold: number;
  status: 'active' | 'acknowledged' | 'resolved';
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

interface AlertsListProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export default function AlertsList({ autoRefresh = true, refreshInterval = 10000 }: AlertsListProps) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/admin/alerts');

      if (!response.ok) {
        throw new Error(`Failed to fetch alerts: ${response.statusText}`);
      }

      const data = await response.json();
      setAlerts(data.alerts || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    if (autoRefresh) {
      const interval = setInterval(fetchAlerts, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const handleAcknowledge = async (alertId: string) => {
    setActionLoading(alertId);

    try {
      const response = await fetch(`/api/admin/alerts/${alertId}/acknowledge`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to acknowledge alert');
      }

      // Refresh alerts
      await fetchAlerts();
    } catch (err) {
      console.error('Error acknowledging alert:', err);
      alert('Failed to acknowledge alert');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async (alertId: string) => {
    setActionLoading(alertId);

    try {
      const response = await fetch(`/api/admin/alerts/${alertId}/resolve`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to resolve alert');
      }

      // Refresh alerts
      await fetchAlerts();
    } catch (err) {
      console.error('Error resolving alert:', err);
      alert('Failed to resolve alert');
    } finally {
      setActionLoading(null);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-5 w-5" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />;
      case 'info':
        return <Info className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const getSeverityVariant = (severity: string): 'default' | 'destructive' | 'warning' | 'success' => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="destructive">Active</Badge>;
      case 'acknowledged':
        return <Badge variant="outline">Acknowledged</Badge>;
      case 'resolved':
        return <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400">Resolved</Badge>;
      default:
        return null;
    }
  };

  const groupedAlerts = {
    critical: alerts.filter(a => a.severity === 'critical' && a.status === 'active'),
    warning: alerts.filter(a => a.severity === 'warning' && a.status === 'active'),
    info: alerts.filter(a => a.severity === 'info' && a.status === 'active'),
    acknowledged: alerts.filter(a => a.status === 'acknowledged'),
    resolved: alerts.filter(a => a.status === 'resolved'),
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const hasActiveAlerts = groupedAlerts.critical.length > 0 || groupedAlerts.warning.length > 0 || groupedAlerts.info.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Alerts</h2>
          <p className="text-muted-foreground">Monitor and manage system alerts</p>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveAlerts ? (
            <Badge variant="destructive" className="gap-2">
              <AlertCircle className="h-3 w-3" />
              {groupedAlerts.critical.length + groupedAlerts.warning.length + groupedAlerts.info.length} Active
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-2 border-green-500 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3" />
              All Clear
            </Badge>
          )}
        </div>
      </div>

      {/* Critical Alerts */}
      {groupedAlerts.critical.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-destructive flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Critical ({groupedAlerts.critical.length})
          </h3>
          <div className="space-y-2">
            {groupedAlerts.critical.map((alert) => (
              <Alert key={alert.id} variant="destructive">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <AlertTitle className="flex items-center gap-2">
                      {alert.metric}
                      {getStatusBadge(alert.status)}
                    </AlertTitle>
                    <AlertDescription className="mt-2">
                      {alert.message}
                      <div className="mt-2 text-xs">
                        <span className="font-semibold">Value:</span> {alert.value} |
                        <span className="font-semibold ml-2">Threshold:</span> {alert.threshold}
                      </div>
                      <div className="mt-1 text-xs opacity-75">
                        Triggered: {new Date(alert.triggeredAt).toLocaleString()}
                      </div>
                    </AlertDescription>
                  </div>
                  <div className="flex gap-2">
                    {alert.status === 'active' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAcknowledge(alert.id)}
                          disabled={actionLoading === alert.id}
                        >
                          Acknowledge
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleResolve(alert.id)}
                          disabled={actionLoading === alert.id}
                        >
                          Resolve
                        </Button>
                      </>
                    )}
                    {alert.status === 'acknowledged' && (
                      <Button
                        size="sm"
                        onClick={() => handleResolve(alert.id)}
                        disabled={actionLoading === alert.id}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        </div>
      )}

      {/* Warning Alerts */}
      {groupedAlerts.warning.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Warning ({groupedAlerts.warning.length})
          </h3>
          <div className="space-y-2">
            {groupedAlerts.warning.map((alert) => (
              <Alert key={alert.id} variant="warning">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <AlertTitle className="flex items-center gap-2">
                      {alert.metric}
                      {getStatusBadge(alert.status)}
                    </AlertTitle>
                    <AlertDescription className="mt-2">
                      {alert.message}
                      <div className="mt-2 text-xs">
                        <span className="font-semibold">Value:</span> {alert.value} |
                        <span className="font-semibold ml-2">Threshold:</span> {alert.threshold}
                      </div>
                      <div className="mt-1 text-xs opacity-75">
                        Triggered: {new Date(alert.triggeredAt).toLocaleString()}
                      </div>
                    </AlertDescription>
                  </div>
                  <div className="flex gap-2">
                    {alert.status === 'active' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAcknowledge(alert.id)}
                          disabled={actionLoading === alert.id}
                        >
                          Acknowledge
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleResolve(alert.id)}
                          disabled={actionLoading === alert.id}
                        >
                          Resolve
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        </div>
      )}

      {/* Info Alerts */}
      {groupedAlerts.info.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Info className="h-5 w-5" />
            Info ({groupedAlerts.info.length})
          </h3>
          <div className="space-y-2">
            {groupedAlerts.info.map((alert) => (
              <Alert key={alert.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <AlertTitle className="flex items-center gap-2">
                      {alert.metric}
                      {getStatusBadge(alert.status)}
                    </AlertTitle>
                    <AlertDescription className="mt-2">
                      {alert.message}
                      <div className="mt-2 text-xs text-muted-foreground">
                        Triggered: {new Date(alert.triggeredAt).toLocaleString()}
                      </div>
                    </AlertDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleResolve(alert.id)}
                    disabled={actionLoading === alert.id}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Alert>
            ))}
          </div>
        </div>
      )}

      {!hasActiveAlerts && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>All Systems Operational</AlertTitle>
          <AlertDescription>
            No active alerts. All metrics are within normal thresholds.
          </AlertDescription>
        </Alert>
      )}

      {/* Acknowledged/Resolved - Collapsed by default */}
      {(groupedAlerts.acknowledged.length > 0 || groupedAlerts.resolved.length > 0) && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            View Acknowledged/Resolved ({groupedAlerts.acknowledged.length + groupedAlerts.resolved.length})
          </summary>
          <div className="mt-4 space-y-2">
            {[...groupedAlerts.acknowledged, ...groupedAlerts.resolved].map((alert) => (
              <div
                key={alert.id}
                className="rounded-lg border bg-muted/50 p-4 text-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      {alert.metric}
                      {getStatusBadge(alert.status)}
                    </div>
                    <p className="mt-1 text-muted-foreground">{alert.message}</p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {alert.status === 'resolved' && alert.resolvedAt && (
                        <span>Resolved: {new Date(alert.resolvedAt).toLocaleString()}</span>
                      )}
                      {alert.status === 'acknowledged' && alert.acknowledgedAt && (
                        <span>Acknowledged: {new Date(alert.acknowledgedAt).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
