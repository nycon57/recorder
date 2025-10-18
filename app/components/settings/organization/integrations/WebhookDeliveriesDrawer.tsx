'use client';

import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle,
  XCircle,
  ChevronDown,
  RefreshCcw,
  Clock,
  FileJson,
  ArrowUpDown,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet';
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
import { Skeleton } from '@/app/components/ui/skeleton';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';

interface Webhook {
  id: string;
  name: string;
  url: string;
}

interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  status: 'success' | 'failure';
  status_code: number;
  duration_ms: number;
  request_headers: Record<string, string>;
  request_body: any;
  response_headers: Record<string, string>;
  response_body: any;
  error?: string;
  attempt_count: number;
  created_at: string;
}

interface WebhookDeliveriesDrawerProps {
  webhook: Webhook;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WebhookDeliveriesDrawer({
  webhook,
  open,
  onOpenChange,
}: WebhookDeliveriesDrawerProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failure'>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  // Fetch deliveries
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['webhook-deliveries', webhook.id, page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(
        `/api/organizations/webhooks/${webhook.id}/deliveries?${params}`
      );
      if (!response.ok) throw new Error('Failed to fetch deliveries');
      return response.json();
    },
    enabled: open,
  });

  const deliveries: WebhookDelivery[] = data?.data || [];
  const hasMore = data?.pagination?.hasMore || false;

  const getStatusBadge = (delivery: WebhookDelivery) => {
    if (delivery.status === 'success') {
      return (
        <div className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3 text-green-500" />
          <Badge variant="default" className="text-xs">
            {delivery.status_code}
          </Badge>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1">
        <XCircle className="h-3 w-3 text-red-500" />
        <Badge variant="destructive" className="text-xs">
          {delivery.status_code || 'Failed'}
        </Badge>
      </div>
    );
  };

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Webhook Deliveries</SheetTitle>
          <SheetDescription>
            View the delivery history for {webhook.name}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Deliveries</SelectItem>
                <SelectItem value="success">Success Only</SelectItem>
                <SelectItem value="failure">Failures Only</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : deliveries.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <FileJson className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No deliveries found</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-2">
                {deliveries.map((delivery) => (
                  <Collapsible
                    key={delivery.id}
                    open={expandedRow === delivery.id}
                    onOpenChange={() => toggleRow(delivery.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-3 bg-white border rounded-lg hover:bg-gray-50 cursor-pointer">
                        <div className="flex items-center gap-4">
                          {getStatusBadge(delivery)}
                          <div>
                            <p className="text-sm font-medium">
                              {delivery.event_type.replace('.', ' ')}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(delivery.created_at), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {delivery.duration_ms}ms
                            </p>
                            {delivery.attempt_count > 1 && (
                              <p className="text-xs text-gray-500">
                                Attempt {delivery.attempt_count}
                              </p>
                            )}
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 text-gray-400 transition-transform ${
                              expandedRow === delivery.id ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="mt-2">
                      <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                        <Tabs defaultValue="request" className="w-full">
                          <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="request">Request</TabsTrigger>
                            <TabsTrigger value="response">Response</TabsTrigger>
                            <TabsTrigger value="headers">Headers</TabsTrigger>
                          </TabsList>

                          <TabsContent value="request" className="mt-4">
                            <div className="space-y-2">
                              <Label>Request Body</Label>
                              <ScrollArea className="h-64 rounded-lg border bg-white">
                                <SyntaxHighlighter
                                  language="json"
                                  style={vscDarkPlus}
                                  customStyle={{
                                    margin: 0,
                                    fontSize: '0.75rem',
                                  }}
                                >
                                  {JSON.stringify(delivery.request_body, null, 2)}
                                </SyntaxHighlighter>
                              </ScrollArea>
                            </div>
                          </TabsContent>

                          <TabsContent value="response" className="mt-4">
                            <div className="space-y-2">
                              <Label>Response Body</Label>
                              {delivery.error ? (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                  <p className="text-sm text-red-700">{delivery.error}</p>
                                </div>
                              ) : (
                                <ScrollArea className="h-64 rounded-lg border bg-white">
                                  <SyntaxHighlighter
                                    language="json"
                                    style={vscDarkPlus}
                                    customStyle={{
                                      margin: 0,
                                      fontSize: '0.75rem',
                                    }}
                                  >
                                    {typeof delivery.response_body === 'string'
                                      ? delivery.response_body
                                      : JSON.stringify(delivery.response_body, null, 2)}
                                  </SyntaxHighlighter>
                                </ScrollArea>
                              )}
                            </div>
                          </TabsContent>

                          <TabsContent value="headers" className="mt-4">
                            <div className="space-y-4">
                              <div>
                                <Label>Request Headers</Label>
                                <div className="mt-2 space-y-1">
                                  {Object.entries(delivery.request_headers || {}).map(
                                    ([key, value]) => (
                                      <div
                                        key={key}
                                        className="flex text-xs font-mono bg-white p-2 rounded border"
                                      >
                                        <span className="font-semibold mr-2">{key}:</span>
                                        <span className="text-gray-600">
                                          {key.toLowerCase().includes('auth') ||
                                          key.toLowerCase().includes('key')
                                            ? '••••••••'
                                            : value}
                                        </span>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>

                              <div>
                                <Label>Response Headers</Label>
                                <div className="mt-2 space-y-1">
                                  {Object.entries(delivery.response_headers || {}).map(
                                    ([key, value]) => (
                                      <div
                                        key={key}
                                        className="flex text-xs font-mono bg-white p-2 rounded border"
                                      >
                                        <span className="font-semibold mr-2">{key}:</span>
                                        <span className="text-gray-600">{value}</span>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>

                        <div className="text-xs text-gray-500">
                          <p>Timestamp: {format(new Date(delivery.created_at), 'PPpp')}</p>
                          <p>Delivery ID: {delivery.id}</p>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>

              {(page > 1 || hasMore) && (
                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-500">Page {page}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={!hasMore}
                  >
                    Next
                  </Button>
                </div>
              )}
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <label className="text-sm font-medium">{children}</label>;
}