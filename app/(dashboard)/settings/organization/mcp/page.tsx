'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Copy,
  Trash2,
  Loader2,
  Key,
  AlertTriangle,
  RefreshCw,
  Server,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { useToast } from '@/app/components/ui/use-toast';
import { ConfirmationDialog } from '@/app/components/ui/confirmation-dialog';

interface McpKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  last_used_at: string | null;
  request_count: number;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
}

export default function McpSettingsPage() {
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: keys, isLoading, error, refetch } = useQuery<McpKey[]>({
    queryKey: ['mcp-keys'],
    queryFn: async () => {
      const res = await fetch('/api/organizations/mcp-keys');
      if (!res.ok) throw new Error('Failed to fetch MCP keys');
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/organizations/mcp-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to generate key');
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedKey(data.data.key);
      queryClient.invalidateQueries({ queryKey: ['mcp-keys'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to generate MCP key.',
        variant: 'destructive',
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/organizations/mcp-keys/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to revoke key');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-keys'] });
      toast({ title: 'Key revoked', description: 'The MCP key has been revoked.' });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to revoke MCP key.',
        variant: 'destructive',
      });
    },
  });

  const handleGenerate = () => {
    if (!newKeyName.trim()) return;
    generateMutation.mutate(newKeyName.trim());
  };

  const handleCopy = async () => {
    if (!generatedKey) return;
    try {
      await navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copied', description: 'Key copied to clipboard.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to copy.', variant: 'destructive' });
    }
  };

  const handleCloseGenerate = () => {
    setIsGenerateOpen(false);
    setTimeout(() => {
      setNewKeyName('');
      setGeneratedKey(null);
      setCopied(false);
    }, 200);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="sr-only">Loading MCP keys...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12" role="alert">
        <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Failed to load MCP keys</h3>
        <p className="text-muted-foreground mb-4">
          {error instanceof Error ? error.message : 'An error occurred'}
        </p>
        <Button onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const hasKeys = keys && keys.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-normal">MCP Server</h2>
        <p className="text-muted-foreground mt-1">
          Connect AI agents to your knowledge base via the Model Context Protocol.
        </p>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="text-sm font-medium">Connection Setup</h3>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            Your MCP server URL:{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
              {typeof window !== 'undefined' ? window.location.origin : ''}/api/mcp
            </code>
          </p>
          <p>
            Generate an API key below, then add this to your MCP client configuration:
          </p>
        </div>
        <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto" tabIndex={0} aria-label="MCP client configuration example">
{`{
  "mcpServers": {
    "tribora": {
      "url": "${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/mcp",
      "headers": {
        "Authorization": "Bearer trb_mcp_YOUR_KEY_HERE"
      }
    }
  }
}`}
        </pre>
        <p className="text-xs text-muted-foreground">
          Works with Claude Desktop, Cursor, Windsurf, and any MCP-compatible client.
          For stdio mode, set the <code className="bg-muted px-1 py-0.5 rounded">TRIBORA_API_KEY</code> environment variable.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">API Keys</h3>
          <Button size="sm" onClick={() => setIsGenerateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Generate New Key
          </Button>
        </div>

        {!hasKeys ? (
          <div className="text-center py-10 bg-muted/10 rounded-lg border-2 border-dashed">
            <Key className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-sm font-semibold mb-1">No MCP keys yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Generate a key to connect AI agents to your knowledge base.
            </p>
            <Button size="sm" onClick={() => setIsGenerateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Generate New Key
            </Button>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {k.key_prefix}...
                      </code>
                    </TableCell>
                    <TableCell>{k.request_count.toLocaleString()}</TableCell>
                    <TableCell>
                      {k.last_used_at
                        ? formatDistanceToNow(new Date(k.last_used_at), { addSuffix: true })
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setKeyToRevoke(k.id)}
                        aria-label={`Revoke key ${k.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={isGenerateOpen} onOpenChange={handleCloseGenerate}>
        <DialogContent>
          {!generatedKey ? (
            <>
              <DialogHeader>
                <DialogTitle>Generate MCP Key</DialogTitle>
                <DialogDescription>
                  Create a key to connect an AI agent to your knowledge base.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="key-name">Name</Label>
                <Input
                  id="key-name"
                  autoFocus
                  placeholder="e.g., Cursor Integration"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleGenerate();
                  }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseGenerate}>
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={!newKeyName.trim() || generateMutation.isPending}
                >
                  {generateMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Generate
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-green-600" />
                  <DialogTitle>Key Generated</DialogTitle>
                </div>
              </DialogHeader>
              <div className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This key will only be shown once. Copy it now.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label>Your MCP API Key</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-3 bg-muted rounded-md text-sm break-all select-all">
                      {generatedKey}
                    </code>
                    <Button size="icon" variant="outline" onClick={handleCopy} aria-label="Copy API key to clipboard">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  {copied && (
                    <p className="text-sm text-green-600">Copied to clipboard!</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCloseGenerate}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={!!keyToRevoke}
        onOpenChange={(open) => !open && setKeyToRevoke(null)}
        title="Revoke MCP Key"
        description="Are you sure? Any MCP connections using this key will immediately lose access. This cannot be undone."
        confirmText="Revoke Key"
        variant="destructive"
        isLoading={revokeMutation.isPending}
        onConfirm={() => {
          if (keyToRevoke) {
            revokeMutation.mutate(keyToRevoke);
            setKeyToRevoke(null);
          }
        }}
        useAlertDialog
      />
    </div>
  );
}
