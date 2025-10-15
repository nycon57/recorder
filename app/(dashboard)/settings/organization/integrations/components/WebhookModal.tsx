'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Loader2,
  RefreshCw,
  Plus,
  X,
  Globe,
  Shield,
  TestTube,
  AlertTriangle
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Switch } from '@/app/components/ui/switch';
import { useToast } from '@/app/components/ui/use-toast';
import { Alert, AlertDescription } from '@/app/components/ui/alert';

interface WebhookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook?: {
    id: string;
    name: string;
    url: string;
    events: string[];
    enabled: boolean;
  } | null;
  onSuccess?: () => void;
}

const AVAILABLE_EVENTS = [
  { value: 'recording.completed', label: 'Recording Completed' },
  { value: 'recording.failed', label: 'Recording Failed' },
  { value: 'user.created', label: 'User Created' },
  { value: 'user.deleted', label: 'User Deleted' },
  { value: 'user.updated', label: 'User Updated' },
  { value: 'organization.updated', label: 'Organization Updated' },
  { value: 'api_key.created', label: 'API Key Created' },
  { value: 'api_key.revoked', label: 'API Key Revoked' },
];

export function WebhookModal({ open, onOpenChange, webhook, onSuccess }: WebhookModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([]);
  const [retryEnabled, setRetryEnabled] = useState(true);
  const [maxRetries, setMaxRetries] = useState('3');
  const [timeout, setTimeout] = useState('30');

  const { toast } = useToast();
  const isEditing = !!webhook;

  useEffect(() => {
    if (webhook) {
      setName(webhook.name);
      setUrl(webhook.url);
      setEvents(webhook.events);
    } else {
      // Generate a new secret for new webhooks
      setSecret(generateSecret());
    }
  }, [webhook]);

  const generateSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'whsec_';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const endpoint = isEditing
        ? `/api/organizations/webhooks/${webhook.id}`
        : '/api/organizations/webhooks';
      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          url,
          secret: isEditing ? undefined : secret,
          events,
          custom_headers: customHeaders.reduce((acc, h) => {
            if (h.key && h.value) acc[h.key] = h.value;
            return acc;
          }, {} as Record<string, string>),
          retry_enabled: retryEnabled,
          max_retries: parseInt(maxRetries),
          timeout_ms: parseInt(timeout) * 1000,
        }),
      });

      if (!response.ok) throw new Error('Failed to save webhook');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: isEditing ? 'Webhook updated' : 'Webhook created',
        description: `The webhook has been ${isEditing ? 'updated' : 'created'} successfully.`,
      });
      onSuccess?.();
      handleClose();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: `Failed to ${isEditing ? 'update' : 'create'} webhook. Please try again.`,
        variant: 'destructive',
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/organizations/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, secret, events: events[0] }),
      });

      if (!response.ok) throw new Error('Test failed');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Test successful',
        description: 'Test payload was sent successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Test failed',
        description: 'Failed to send test payload. Please check your URL.',
        variant: 'destructive',
      });
    },
  });

  const handleEventChange = (event: string, checked: boolean) => {
    if (checked) {
      setEvents([...events, event]);
    } else {
      setEvents(events.filter(e => e !== event));
    }
  };

  const addCustomHeader = () => {
    setCustomHeaders([...customHeaders, { key: '', value: '' }]);
  };

  const removeCustomHeader = (index: number) => {
    setCustomHeaders(customHeaders.filter((_, i) => i !== index));
  };

  const updateCustomHeader = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customHeaders];
    updated[index][field] = value;
    setCustomHeaders(updated);
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset form after animation
    setTimeout(() => {
      setName('');
      setUrl('');
      setSecret(generateSecret());
      setEvents([]);
      setCustomHeaders([]);
      setRetryEnabled(true);
      setMaxRetries('3');
      setTimeout('30');
    }, 200);
  };

  const canSave = name && url && url.startsWith('https://') && events.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Webhook' : 'Create Webhook'}</DialogTitle>
          <DialogDescription>
            Configure a webhook to receive real-time notifications about events
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Production Webhook"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">
              <Globe className="h-3 w-3 inline mr-1" />
              Webhook URL *
            </Label>
            <Input
              id="url"
              type="url"
              placeholder="https://your-domain.com/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            {url && !url.startsWith('https://') && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Webhook URLs must use HTTPS for security
                </AlertDescription>
              </Alert>
            )}
          </div>

          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="secret">
                <Shield className="h-3 w-3 inline mr-1" />
                Webhook Secret
              </Label>
              <div className="flex gap-2">
                <Input
                  id="secret"
                  value={secret}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setSecret(generateSecret())}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use this secret to verify webhook signatures
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Events *</Label>
            <div className="grid grid-cols-2 gap-3">
              {AVAILABLE_EVENTS.map(event => (
                <div key={event.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={event.value}
                    checked={events.includes(event.value)}
                    onCheckedChange={(checked) =>
                      handleEventChange(event.value, checked as boolean)
                    }
                  />
                  <Label
                    htmlFor={event.value}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {event.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Custom Headers</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCustomHeader}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Header
              </Button>
            </div>
            {customHeaders.length > 0 && (
              <div className="space-y-2">
                {customHeaders.map((header, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Header name"
                      value={header.key}
                      onChange={(e) => updateCustomHeader(index, 'key', e.target.value)}
                    />
                    <Input
                      placeholder="Header value"
                      value={header.value}
                      onChange={(e) => updateCustomHeader(index, 'value', e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeCustomHeader(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="retry">Enable Retries</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically retry failed webhook deliveries
                </p>
              </div>
              <Switch
                id="retry"
                checked={retryEnabled}
                onCheckedChange={setRetryEnabled}
              />
            </div>

            {retryEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxRetries">Max Retries</Label>
                  <Input
                    id="maxRetries"
                    type="number"
                    min="0"
                    max="10"
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeout">Timeout (seconds)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    min="5"
                    max="60"
                    value={timeout}
                    onChange={(e) => setTimeout(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {url && url.startsWith('https://') && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}
              >
                {testMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test Webhook
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!canSave || saveMutation.isPending}
          >
            {saveMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {isEditing ? 'Update' : 'Create'} Webhook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Label({ children, htmlFor, className }: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={className || "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"}>
      {children}
    </label>
  );
}