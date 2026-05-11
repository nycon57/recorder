'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Badge } from '@/app/components/ui/badge';

interface AlertIncident {
  id: string;
  ruleName: string;
  severity: 'critical' | 'warning' | 'info';
  metricName: string;
  metricValue: number;
  triggeredAt: string;
  status: 'open' | 'acknowledged' | 'resolved';
}

interface AlertsData {
  totalOpen: number;
  critical: number;
  warning: number;
  info: number;
  recentIncidents: AlertIncident[];
}

export default function AdminAlertsPage() {
  const [data, setData] = useState<AlertsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'System Alerts - Admin';
    fetchAlerts();

    // Refresh every 15 seconds
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, []);

  async function fetchAlerts() {
    try {
      const response = await fetch('/api/admin/alerts');

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied. System admin privileges required.');
        }
        throw new Error('Failed to fetch alerts');
      }

      const result = await response.json();
      setData(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  function getSeverityIcon(severity: string) {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="size-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="size-4 text-yellow-500" />;
      case 'info':
        return <Info className="size-4 text-blue-500" />;
      default:
        return null;
    }
  }

  function getSeverityBadgeVariant(severity: string) {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'default';
      case 'info':
        return 'secondary';
      default:
        return 'secondary';
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleString();
  }

  if (!data && !error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full size-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="trbd-page">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="trbd-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="trbd-page-title">System Alerts</h1>
          <p className="text-muted-foreground">
            Monitor critical system incidents
          </p>
        </div>

        <Badge variant="outline" className="text-sm">
          Auto-refresh: 15s
        </Badge>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Open</CardTitle>
            <AlertCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalOpen}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertTriangle className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.critical}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warning</CardTitle>
            <AlertCircle className="size-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.warning}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Info</CardTitle>
            <Info className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.info}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Incidents */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Incidents</CardTitle>
        </CardHeader>
        <CardContent>
          {!data.recentIncidents || data.recentIncidents.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="size-12 text-green-500 mx-auto mb-4 opacity-50" />
              <p className="text-sm text-muted-foreground">
                No open alerts - system healthy
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.recentIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="mt-0.5">
                    {getSeverityIcon(incident.severity)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{incident.ruleName}</span>
                      <Badge
                        variant={getSeverityBadgeVariant(incident.severity)}
                      >
                        {incident.severity}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-mono">{incident.metricName}</span>:{' '}
                      {incident.metricValue}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Triggered {formatDate(incident.triggeredAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
