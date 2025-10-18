'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Copy,
  FileJson
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Badge } from '@/app/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { ScrollArea } from '@/app/components/ui/scroll-area';

interface Webhook {
  id: string;
  name: string;
  url: string;
}

interface TestWebhookModalProps {
  webhook: Webhook;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TEST_EVENTS = [
  { value: 'recording.created', label: 'Recording Created' },
  { value: 'recording.completed', label: 'Recording Completed' },
  { value: 'recording.deleted', label: 'Recording Deleted' },
  { value: 'recording.shared', label: 'Recording Shared' },
  { value: 'document.generated', label: 'Document Generated' },
  { value: 'document.updated', label: 'Document Updated' },
  { value: 'user.created', label: 'User Created' },
  { value: 'user.updated', label: 'User Updated' },
  { value: 'user.deleted', label: 'User Deleted' },
];

const SAMPLE_PAYLOADS: Record<string, any> = {
  'recording.created': {
    event: 'recording.created',
    timestamp: new Date().toISOString(),
    data: {
      id: 'rec_1234567890',
      title: 'Product Demo Recording',
      duration: 1800,
      user: {
        id: 'user_123',
        name: 'John Doe',
        email: 'john@example.com',
      },
      created_at: new Date().toISOString(),
    },
  },
  'recording.completed': {
    event: 'recording.completed',
    timestamp: new Date().toISOString(),
    data: {
      id: 'rec_1234567890',
      title: 'Product Demo Recording',
      duration: 1800,
      status: 'completed',
      transcript: {
        id: 'trans_123',
        confidence: 0.95,
        word_count: 2500,
      },
      document: {
        id: 'doc_123',
        markdown_length: 5000,
      },
      completed_at: new Date().toISOString(),
    },
  },
  'document.generated': {
    event: 'document.generated',
    timestamp: new Date().toISOString(),
    data: {
      id: 'doc_1234567890',
      recording_id: 'rec_123',
      title: 'Product Demo Documentation',
      word_count: 1500,
      created_at: new Date().toISOString(),
    },
  },
  'user.created': {
    event: 'user.created',
    timestamp: new Date().toISOString(),
    data: {
      id: 'user_1234567890',
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'contributor',
      created_at: new Date().toISOString(),
    },
  },
};

interface TestResult {
  success: boolean;
  status_code?: number;
  duration_ms?: number;
  response_headers?: Record<string, string>;
  response_body?: any;
  error?: string;
}

export function TestWebhookModal({ webhook, open, onOpenChange }: TestWebhookModalProps) {
  const [selectedEvent, setSelectedEvent] = useState('recording.created');
  const [customPayload, setCustomPayload] = useState<string>('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [activeTab, setActiveTab] = useState('preset');

  const testWebhookMutation = useMutation({
    mutationFn: async () => {
      const payload = activeTab === 'preset'
        ? SAMPLE_PAYLOADS[selectedEvent]
        : JSON.parse(customPayload || '{}');

      const response = await fetch(`/api/organizations/webhooks/${webhook.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: selectedEvent,
          test_payload: payload,
        }),
      });

      if (!response.ok) throw new Error('Failed to test webhook');
      return response.json();
    },
    onSuccess: (data) => {
      setTestResult(data.data);
      if (data.data.success) {
        toast.success('Test webhook sent successfully');
      } else {
        toast.error('Test webhook failed');
      }
    },
    onError: () => {
      toast.error('Failed to send test webhook');
      setTestResult({
        success: false,
        error: 'Failed to send test webhook',
      });
    },
  });

  const handleTest = () => {
    if (activeTab === 'custom' && customPayload) {
      try {
        JSON.parse(customPayload);
      } catch (e) {
        toast.error('Invalid JSON payload');
        return;
      }
    }
    testWebhookMutation.mutate();
  };

  const handleCopyPayload = () => {
    const payload = activeTab === 'preset'
      ? JSON.stringify(SAMPLE_PAYLOADS[selectedEvent], null, 2)
      : customPayload;
    navigator.clipboard.writeText(payload);
    toast.success('Payload copied to clipboard');
  };

  const handleClose = () => {
    setTestResult(null);
    setCustomPayload('');
    setActiveTab('preset');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test Webhook</DialogTitle>
          <DialogDescription>
            Send a test payload to verify your webhook endpoint is working correctly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <Label className="text-xs text-gray-500">Testing URL</Label>
            <p className="font-mono text-sm mt-1">{webhook.url}</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="preset">Preset Payload</TabsTrigger>
              <TabsTrigger value="custom">Custom Payload</TabsTrigger>
            </TabsList>

            <TabsContent value="preset" className="space-y-4">
              <div className="space-y-2">
                <Label>Event Type</Label>
                <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEST_EVENTS.map((event) => (
                      <SelectItem key={event.value} value={event.value}>
                        {event.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Sample Payload</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyPayload}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <ScrollArea className="h-64 rounded-lg border">
                  <SyntaxHighlighter
                    language="json"
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      fontSize: '0.875rem',
                    }}
                  >
                    {JSON.stringify(SAMPLE_PAYLOADS[selectedEvent], null, 2)}
                  </SyntaxHighlighter>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="custom" className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Custom JSON Payload</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyPayload}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <textarea
                  className="w-full h-64 p-3 font-mono text-sm border rounded-lg"
                  placeholder={JSON.stringify(SAMPLE_PAYLOADS['recording.created'], null, 2)}
                  value={customPayload}
                  onChange={(e) => setCustomPayload(e.target.value)}
                />
              </div>
            </TabsContent>
          </Tabs>

          {testResult && (
            <Alert
              className={
                testResult.success
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              }
            >
              {testResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={testResult.success ? 'text-green-800' : 'text-red-800'}>
                <div className="space-y-2">
                  <div className="font-medium">
                    {testResult.success ? 'Test successful' : 'Test failed'}
                  </div>
                  {testResult.status_code && (
                    <div className="flex items-center gap-2">
                      <Badge variant={testResult.success ? 'default' : 'destructive'}>
                        {testResult.status_code}
                      </Badge>
                      {testResult.duration_ms && (
                        <span className="text-sm">{testResult.duration_ms}ms</span>
                      )}
                    </div>
                  )}
                  {testResult.error && (
                    <p className="text-sm">{testResult.error}</p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {testResult && testResult.response_body && (
            <div className="space-y-2">
              <Label>Response Body</Label>
              <ScrollArea className="h-32 rounded-lg border bg-gray-50">
                <pre className="p-3 text-xs">
                  {typeof testResult.response_body === 'string'
                    ? testResult.response_body
                    : JSON.stringify(testResult.response_body, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          <Button
            onClick={handleTest}
            disabled={testWebhookMutation.isLoading}
          >
            {testWebhookMutation.isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Test
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}