'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { useToast } from '@/app/components/ui/use-toast';
import {
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  Clock,
  Code
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface WebhookDeliveriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhookId: string;
}

interface Delivery {
  id: string;
  webhook_id: string;
  event: string;
  status: 'success' | 'failure';
  timestamp: string;
  duration_ms: number;
  response_code: number;
  request_body: string;
  response_body: string;
  retry_count: number;
}

export function WebhookDeliveriesModal({
  open,
  onOpenChange,
  webhookId,
}: WebhookDeliveriesModalProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failure'>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { toast } = useToast();

  // Fetch deliveries
  const { data: deliveries, isLoading, refetch } = useQuery<Delivery[]>({
    queryKey: ['webhook-deliveries', webhookId],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/webhooks/${webhookId}/deliveries`);
      if (!response.ok) throw new Error('Failed to fetch deliveries');
      const data = await response.json();
      return data.data || [];
    },
    enabled: open,
  });

  // Retry failed deliveries mutation
  const retryMutation = useMutation({
    mutationFn: async (deliveryId: string) => {
      const response = await fetch(
        `/api/organizations/webhooks/${webhookId}/deliveries/${deliveryId}/retry`,
        {
          method: 'POST',
        }
      );
      if (!response.ok) throw new Error('Failed to retry delivery');
      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast({
        title: 'Retry initiated',
        description: 'The webhook delivery is being retried.',
      });
    },
    onError: () => {
      toast({
        title: 'Retry failed',
        description: 'Failed to retry the webhook delivery.',
        variant: 'destructive',
      });
    },
  });

  const toggleRowExpanded = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const filteredDeliveries = deliveries?.filter((d) => {
    if (statusFilter === 'all') return true;
    return d.status === statusFilter;
  }) || [];

  const successCount = deliveries?.filter(d => d.status === 'success').length || 0;
  const failureCount = deliveries?.filter(d => d.status === 'failure').length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Webhook Deliveries</DialogTitle>
          <DialogDescription>
            View delivery history and debug webhook issues
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stats and Filters */}
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">
                  <strong>{successCount}</strong> Successful
                </span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm">
                  <strong>{failureCount}</strong> Failed
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failure">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Deliveries Table */}
          <div className="rounded-md border max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredDeliveries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No deliveries found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Response Code</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeliveries.map((delivery) => {
                    const isExpanded = expandedRows.has(delivery.id);
                    return (
                      <>
                        <TableRow key={delivery.id}>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => toggleRowExpanded(delivery.id)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{delivery.event}</Badge>
                          </TableCell>
                          <TableCell>
                            {delivery.status === 'success' ? (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Success
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" />
                                Failed
                              </Badge>
                            )}
                            {delivery.retry_count > 0 && (
                              <Badge variant="secondary" className="ml-1">
                                Retry {delivery.retry_count}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatDistanceToNow(new Date(delivery.timestamp), {
                                addSuffix: true,
                              })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(delivery.timestamp), 'MMM d, h:mm:ss a')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {delivery.duration_ms}ms
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {delivery.response_code}
                            </code>
                          </TableCell>
                          <TableCell>
                            {delivery.status === 'failure' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => retryMutation.mutate(delivery.id)}
                                disabled={retryMutation.isPending}
                              >
                                {retryMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3 w-3" />
                                )}
                                Retry
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-muted/20">
                              <div className="p-4 space-y-4">
                                <div>
                                  <h4 className="font-medium mb-2 flex items-center gap-2">
                                    <Code className="h-4 w-4" />
                                    Request Body
                                  </h4>
                                  <pre className="bg-background p-3 rounded-md text-xs overflow-x-auto">
                                    {JSON.stringify(JSON.parse(delivery.request_body), null, 2)}
                                  </pre>
                                </div>
                                <div>
                                  <h4 className="font-medium mb-2 flex items-center gap-2">
                                    <Code className="h-4 w-4" />
                                    Response Body
                                  </h4>
                                  <pre className="bg-background p-3 rounded-md text-xs overflow-x-auto">
                                    {delivery.response_body || 'No response body'}
                                  </pre>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Retry All Failed Button */}
          {failureCount > 0 && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  // Implement retry all failed deliveries
                  toast({
                    title: 'Retrying failed deliveries',
                    description: `Retrying ${failureCount} failed deliveries...`,
                  });
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry All Failed ({failureCount})
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}