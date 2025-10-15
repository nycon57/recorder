'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, Plus, Trash2, AlertCircle, Lock } from 'lucide-react';
import { updateWebhookSchema, type UpdateWebhookInput } from '@/lib/validations/api';
import toast from 'react-hot-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Webhook {
  id: string;
  name: string;
  url: string;
  description?: string;
  events: string[];
  enabled: boolean;
  headers?: Record<string, string>;
  retry_enabled: boolean;
  max_retries: number;
  timeout_ms: number;
}

interface EditWebhookModalProps {
  webhook: Webhook;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AVAILABLE_EVENTS = [
  {
    value: 'recording.created',
    label: 'Recording Created',
    description: 'When a new recording is created',
  },
  {
    value: 'recording.completed',
    label: 'Recording Completed',
    description: 'When processing is finished',
  },
  {
    value: 'recording.deleted',
    label: 'Recording Deleted',
    description: 'When a recording is deleted',
  },
  {
    value: 'recording.shared',
    label: 'Recording Shared',
    description: 'When a recording is shared',
  },
  {
    value: 'document.generated',
    label: 'Document Generated',
    description: 'When a document is created from a recording',
  },
  {
    value: 'document.updated',
    label: 'Document Updated',
    description: 'When a document is edited',
  },
  {
    value: 'user.created',
    label: 'User Created',
    description: 'When a new user joins the organization',
  },
  {
    value: 'user.updated',
    label: 'User Updated',
    description: 'When user details are changed',
  },
  {
    value: 'user.deleted',
    label: 'User Deleted',
    description: 'When a user is removed',
  },
];

export function EditWebhookModal({ webhook, open, onOpenChange }: EditWebhookModalProps) {
  const queryClient = useQueryClient();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customHeaders, setCustomHeaders] = useState<{ key: string; value: string }[]>([]);

  const form = useForm<UpdateWebhookInput>({
    resolver: zodResolver(updateWebhookSchema),
    defaultValues: {
      name: webhook.name,
      description: webhook.description || '',
      url: webhook.url,
      events: webhook.events,
      enabled: webhook.enabled,
      retry_enabled: webhook.retry_enabled,
      max_retries: webhook.max_retries,
      timeout_ms: webhook.timeout_ms,
    },
  });

  // Initialize headers when webhook changes
  useEffect(() => {
    if (webhook.headers && Object.keys(webhook.headers).length > 0) {
      const headerArray = Object.entries(webhook.headers).map(([key, value]) => ({
        key,
        value,
      }));
      setCustomHeaders(headerArray);
    } else {
      setCustomHeaders([{ key: '', value: '' }]);
    }

    form.reset({
      name: webhook.name,
      description: webhook.description || '',
      url: webhook.url,
      events: webhook.events,
      enabled: webhook.enabled,
      retry_enabled: webhook.retry_enabled,
      max_retries: webhook.max_retries,
      timeout_ms: webhook.timeout_ms,
    });
  }, [webhook, form]);

  const updateWebhookMutation = useMutation({
    mutationFn: async (data: UpdateWebhookInput) => {
      const response = await fetch(`/api/organizations/webhooks/${webhook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update webhook');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook updated successfully');
      handleClose();
    },
    onError: () => {
      toast.error('Failed to update webhook');
    },
  });

  const handleSubmit = (data: UpdateWebhookInput) => {
    // Convert custom headers array to object
    const headers: Record<string, string> = {};
    customHeaders.forEach((header) => {
      if (header.key && header.value) {
        headers[header.key] = header.value;
      }
    });
    data.headers = headers;

    updateWebhookMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    setShowAdvanced(false);
    onOpenChange(false);
  };

  const addHeader = () => {
    setCustomHeaders([...customHeaders, { key: '', value: '' }]);
  };

  const removeHeader = (index: number) => {
    setCustomHeaders(customHeaders.filter((_, i) => i !== index));
  };

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customHeaders];
    updated[index][field] = value;
    setCustomHeaders(updated);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Webhook</DialogTitle>
          <DialogDescription>
            Update the configuration for this webhook endpoint.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Production Webhook" {...field} />
                  </FormControl>
                  <FormDescription>
                    A descriptive name to identify this webhook
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Webhook URL</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="https://api.example.com/webhooks/recorder"
                        {...field}
                      />
                      {field.value && field.value.startsWith('https://') && (
                        <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>
                    The HTTPS endpoint that will receive webhook payloads
                  </FormDescription>
                  {field.value && !field.value.startsWith('https://') && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Webhook URLs must use HTTPS for security
                      </AlertDescription>
                    </Alert>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Sends events to our internal notification system..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>Enabled</FormLabel>
                    <FormDescription>
                      Webhook will receive events when enabled
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="events"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Events</FormLabel>
                  <FormDescription>
                    Select which events should trigger this webhook
                  </FormDescription>
                  <div className="space-y-2 mt-2">
                    {AVAILABLE_EVENTS.map((event) => (
                      <div
                        key={event.value}
                        className="flex items-start space-x-3 space-y-0"
                      >
                        <Checkbox
                          checked={field.value?.includes(event.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              field.onChange([...field.value, event.value]);
                            } else {
                              field.onChange(
                                field.value?.filter((v) => v !== event.value)
                              );
                            }
                          }}
                        />
                        <div className="space-y-1 leading-none">
                          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {event.label}
                          </label>
                          <p className="text-xs text-gray-500">{event.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Custom Headers</label>
                <p className="text-xs text-gray-500">
                  Add custom headers for authentication or identification
                </p>
                <div className="space-y-2">
                  {customHeaders.map((header, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="Header name (e.g., X-API-Key)"
                        value={header.key}
                        onChange={(e) => updateHeader(index, 'key', e.target.value)}
                      />
                      <Input
                        placeholder="Header value"
                        type="password"
                        value={header.value}
                        onChange={(e) => updateHeader(index, 'value', e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeHeader(index)}
                        disabled={customHeaders.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addHeader}
                    className="mt-2"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Header
                  </Button>
                </div>
              </div>

              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex items-center gap-2"
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        showAdvanced ? 'rotate-180' : ''
                      }`}
                    />
                    Advanced Options
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="retry_enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel>Enable Retry</FormLabel>
                          <FormDescription>
                            Automatically retry failed webhook deliveries
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch('retry_enabled') && (
                    <FormField
                      control={form.control}
                      name="max_retries"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Retries</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={10}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum number of retry attempts (0-10)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="timeout_ms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timeout (milliseconds)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1000}
                            max={30000}
                            step={1000}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Request timeout in milliseconds (1000-30000)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CollapsibleContent>
              </Collapsible>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateWebhookMutation.isLoading}>
                {updateWebhookMutation.isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}