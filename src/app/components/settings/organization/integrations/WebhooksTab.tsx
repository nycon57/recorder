'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Webhook,
  Plus,
  MoreHorizontal,
  Edit,
  TestTube,
  Eye,
  Trash2,
  Loader2,
  Globe,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { useToast } from '@/app/components/ui/use-toast';
import { ConfirmationDialog } from '@/app/components/ui/confirmation-dialog';

import { WebhookModal } from './WebhookModal';
import { WebhookDeliveriesModal } from './WebhookDeliveriesModal';

interface WebhookData {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'healthy' | 'degraded' | 'failing';
  enabled: boolean;
  last_triggered: string | null;
  success_rate: number;
  created_at: string;
}

export function WebhooksTab() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookData | null>(null);
  const [viewingDeliveries, setViewingDeliveries] = useState<string | null>(null);
  const [webhookToDelete, setWebhookToDelete] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch webhooks
  const { data: webhooks, isLoading } = useQuery<WebhookData[]>({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const response = await fetch('/api/organizations/webhooks');
      if (!response.ok) throw new Error('Failed to fetch webhooks');
      const data = await response.json();
      return data.data || [];
    },
  });

  // Test webhook mutation
  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/organizations/webhooks/${id}/test`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to test webhook');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Test sent',
        description: 'A test payload has been sent to the webhook endpoint.',
      });
    },
    onError: () => {
      toast({
        title: 'Test failed',
        description: 'Failed to send test payload. Please check the webhook configuration.',
        variant: 'destructive',
      });
    },
  });

  // Delete webhook mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/organizations/webhooks/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete webhook');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast({
        title: 'Webhook deleted',
        description: 'The webhook has been successfully deleted.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete webhook. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleEdit = (webhook: WebhookData) => {
    setEditingWebhook(webhook);
  };

  const handleTest = (id: string) => {
    testMutation.mutate(id);
  };

  const handleViewDeliveries = (id: string) => {
    setViewingDeliveries(id);
  };

  const handleDelete = (id: string) => {
    setWebhookToDelete(id);
  };

  const confirmDelete = () => {
    if (webhookToDelete) {
      deleteMutation.mutate(webhookToDelete);
      setWebhookToDelete(null);
    }
  };

  const getStatusBadge = (status: string, enabled: boolean) => {
    if (!enabled) {
      return <Badge variant="secondary">Disabled</Badge>;
    }

    switch (status) {
      case 'healthy':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Healthy
          </Badge>
        );
      case 'degraded':
        return (
          <Badge variant="default" className="bg-yellow-500">
            <AlertCircle className="h-3 w-3 mr-1" />
            Degraded
          </Badge>
        );
      case 'failing':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failing
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatEvents = (events: string[]) => {
    if (events.length === 0) return null;
    if (events.length <= 2) {
      return events.map(event => (
        <Badge key={event} variant="outline" className="mr-1">
          {event}
        </Badge>
      ));
    }
    return (
      <>
        <Badge variant="outline" className="mr-1">
          {events[0]}
        </Badge>
        <Badge variant="outline">
          +{events.length - 1} more
        </Badge>
      </>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasWebhooks = webhooks && webhooks.length > 0;

  return (
    <>
      <div className="space-y-4">
        {!hasWebhooks ? (
          <div className="text-center py-12 bg-muted/10 rounded-lg border-2 border-dashed">
            <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No webhooks configured</h3>
            <p className="text-muted-foreground mb-4">
              Set up webhooks to receive real-time notifications about events
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Webhook
            </Button>
          </div>
        ) : (
          <>
            <div className="flex justify-end">
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Webhook
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Triggered</TableHead>
                    <TableHead>Success Rate</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((webhook) => (
                    <TableRow key={webhook.id}>
                      <TableCell className="font-medium">{webhook.name}</TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {webhook.url.length > 30
                            ? `${webhook.url.substring(0, 30)}...`
                            : webhook.url}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {formatEvents(webhook.events)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(webhook.status, webhook.enabled)}
                      </TableCell>
                      <TableCell>
                        {webhook.last_triggered
                          ? formatDistanceToNow(new Date(webhook.last_triggered), { addSuffix: true })
                          : 'Never'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={webhook.success_rate >= 95 ? 'text-green-600' : webhook.success_rate >= 80 ? 'text-yellow-600' : 'text-red-600'}>
                            {webhook.success_rate.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(webhook)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleTest(webhook.id)}>
                              <TestTube className="h-4 w-4 mr-2" />
                              Test
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewDeliveries(webhook.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View deliveries
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(webhook.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <WebhookModal
        open={isCreateModalOpen || !!editingWebhook}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateModalOpen(false);
            setEditingWebhook(null);
          }
        }}
        webhook={editingWebhook}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['webhooks'] });
          setIsCreateModalOpen(false);
          setEditingWebhook(null);
        }}
      />

      {viewingDeliveries && (
        <WebhookDeliveriesModal
          open={true}
          onOpenChange={(open) => {
            if (!open) setViewingDeliveries(null);
          }}
          webhookId={viewingDeliveries}
        />
      )}

      {/* Delete confirmation dialog */}
      <ConfirmationDialog
        open={!!webhookToDelete}
        onOpenChange={(open) => !open && setWebhookToDelete(null)}
        title="Delete Webhook"
        description="Are you sure you want to delete this webhook? This action cannot be undone."
        confirmText="Delete Webhook"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={confirmDelete}
        useAlertDialog
      />
    </>
  );
}