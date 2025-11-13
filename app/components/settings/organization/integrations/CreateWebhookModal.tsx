'use client';

import { useState } from 'react';
import { ChevronDown, AlertCircle, Lock } from 'lucide-react';

import { createWebhookSchema, type CreateWebhookInput } from '@/lib/validations/api';

import { FormDialog } from '@/app/components/ui/form-dialog';
import {
  DynamicFieldArray,
  type KeyValuePair,
  keyValuePairsToObject,
} from '@/app/components/ui/dynamic-field-array';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/components/ui/form';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Switch } from '@/app/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible';
import { Alert, AlertDescription } from '@/app/components/ui/alert';

interface CreateWebhookModalProps {
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

export function CreateWebhookModal({ open, onOpenChange }: CreateWebhookModalProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customHeaders, setCustomHeaders] = useState<KeyValuePair[]>([
    { key: '', value: '' },
  ]);

  const handleSubmit = async (data: CreateWebhookInput) => {
    // Convert custom headers array to object
    data.headers = keyValuePairsToObject(customHeaders);

    const response = await fetch('/api/organizations/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create webhook');
    return response.json();
  };

  const handleCleanup = () => {
    setCustomHeaders([{ key: '', value: '' }]);
    setShowAdvanced(false);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create Webhook"
      description="Configure a webhook endpoint to receive real-time notifications about events in your organization."
      size="2xl"
      schema={createWebhookSchema}
      defaultValues={{
        name: '',
        description: '',
        url: '',
        events: [],
        headers: {},
        retry_enabled: true,
        max_retries: 3,
        timeout_ms: 5000,
      }}
      mutationFn={handleSubmit}
      queryKey={['webhooks']}
      successMessage="Webhook created successfully"
      errorMessage="Failed to create webhook"
      submitLabel="Create Webhook"
      loadingLabel="Creating..."
      onCleanup={handleCleanup}
    >
      {(form) => (
        <>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
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
                  <FormLabel>Webhook URL *</FormLabel>
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
              name="events"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Events *</FormLabel>
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
                              // TYPE SAFETY: No cast needed - event.value is string
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

            <DynamicFieldArray
              value={customHeaders}
              onChange={setCustomHeaders}
              type="key-value"
              label="Custom Headers"
              description="Add custom headers for authentication or identification"
              keyPlaceholder="Header name (e.g., X-API-Key)"
              valuePlaceholder="Header value"
              valueFieldType="password"
              addButtonLabel="Add Header"
              minItems={1}
            />

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
          </>
        )}
    </FormDialog>
  );
}