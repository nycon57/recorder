'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, Shield, Zap, Calendar, Activity, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';

interface ApiKeyDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiKey: {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    created_at: string;
    last_used: string | null;
    rate_limit: number;
    ip_whitelist: string[];
    expires_at: string | null;
  };
}

interface ApiKeyStats {
  total_calls: number;
  last_7_days: Array<{
    date: string;
    count: number;
  }>;
  success_rate: number;
  average_latency: number;
}

export function ApiKeyDetailModal({ open, onOpenChange, apiKey }: ApiKeyDetailModalProps) {
  // Fetch usage statistics
  const { data: stats, isLoading } = useQuery<ApiKeyStats>({
    queryKey: ['api-key-stats', apiKey.id],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/api-keys/${apiKey.id}/stats`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      return data.data;
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>API Key Details</DialogTitle>
          <DialogDescription>{apiKey.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Key Information */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Key Prefix</h4>
              <code className="text-sm bg-muted px-2 py-1 rounded">{apiKey.prefix}***</code>
            </div>

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Scopes</h4>
              <div className="flex flex-wrap gap-2">
                {apiKey.scopes.map(scope => (
                  <Badge key={scope} variant="secondary">
                    {scope}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">
                  <Zap className="h-3 w-3 inline mr-1" />
                  Rate Limit
                </h4>
                <p className="text-sm">{apiKey.rate_limit} requests/hour</p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">
                  <Shield className="h-3 w-3 inline mr-1" />
                  IP Whitelist
                </h4>
                <p className="text-sm">
                  {apiKey.ip_whitelist.length > 0
                    ? `${apiKey.ip_whitelist.length} IPs configured`
                    : 'All IPs allowed'}
                </p>
              </div>
            </div>

            {apiKey.ip_whitelist.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Whitelisted IPs</h4>
                <div className="bg-muted p-3 rounded-md space-y-1">
                  {apiKey.ip_whitelist.map((ip, index) => (
                    <code key={index} className="text-xs block">
                      {ip}
                    </code>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Created
                </h4>
                <p className="text-sm">
                  {format(new Date(apiKey.created_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">
                  <Clock className="h-3 w-3 inline mr-1" />
                  Last Used
                </h4>
                <p className="text-sm">
                  {apiKey.last_used
                    ? formatDistanceToNow(new Date(apiKey.last_used), { addSuffix: true })
                    : 'Never'}
                </p>
              </div>
            </div>

            {apiKey.expires_at && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Expires</h4>
                <p className="text-sm">
                  {format(new Date(apiKey.expires_at), 'MMM d, yyyy')}
                  {new Date(apiKey.expires_at) < new Date() && (
                    <Badge variant="destructive" className="ml-2">Expired</Badge>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Usage Statistics */}
          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Usage Statistics
            </h3>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : stats ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Calls</p>
                    <p className="text-2xl font-semibold">{stats.total_calls.toLocaleString()}</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                    <p className="text-2xl font-semibold">{stats.success_rate.toFixed(1)}%</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">Avg Latency</p>
                    <p className="text-2xl font-semibold">{stats.average_latency}ms</p>
                  </div>
                </div>

                {/* Simple chart representation */}
                {stats.last_7_days && stats.last_7_days.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Last 7 Days</h4>
                    <div className="flex items-end gap-1 h-24">
                      {stats.last_7_days.map((day, index) => {
                        const maxCount = Math.max(...stats.last_7_days.map(d => d.count), 1);
                        const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;

                        return (
                          <div
                            key={index}
                            className="flex-1 bg-primary/20 rounded-t"
                            style={{ height: `${height}%` }}
                            title={`${day.date}: ${day.count} requests`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{stats.last_7_days[0]?.date}</span>
                      <span>{stats.last_7_days[stats.last_7_days.length - 1]?.date}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No recent activity</div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No usage data available</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}