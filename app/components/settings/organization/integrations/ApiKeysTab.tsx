'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  MoreHorizontal,
  Copy,
  Eye,
  Trash2,
  Loader2,
  Shield,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';

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

import { GenerateApiKeyModal } from './GenerateApiKeyModal';
import { ApiKeyDetailModal } from './ApiKeyDetailModal';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  full_key?: string; // Only available after creation
  scopes: string[];
  created_at: string;
  last_used: string | null;
  rate_limit: number;
  ip_whitelist: string[];
  expires_at: string | null;
}

export function ApiKeysTab() {
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);
  const [newKeys, setNewKeys] = useState<Record<string, string>>({}); // Store full keys after creation

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch API keys
  const { data: apiKeys, isLoading, error, refetch } = useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const response = await fetch('/api/organizations/api-keys');
      if (!response.ok) throw new Error('Failed to fetch API keys');
      const data = await response.json();
      return data.data || [];
    },
  });

  // Delete API key mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/organizations/api-keys/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete API key');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast({
        title: 'API key revoked',
        description: 'The API key has been successfully revoked.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to revoke API key. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleCopyKey = async (keyId: string) => {
    try {
      const fullKey = newKeys[keyId];
      if (fullKey) {
        await navigator.clipboard.writeText(fullKey);
        toast({
          title: 'Copied',
          description: 'Full API key copied to clipboard',
        });
      } else {
        // Only prefix available after initial creation
        const apiKey = apiKeys?.find(k => k.id === keyId);
        if (apiKey?.prefix) {
          await navigator.clipboard.writeText(apiKey.prefix + '...');
          toast({
            title: 'Copied',
            description: 'API key prefix copied to clipboard',
          });
        }
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleViewDetails = (key: ApiKey) => {
    setSelectedKey(key);
    setIsDetailModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setKeyToDelete(id);
  };

  const confirmDelete = () => {
    if (keyToDelete) {
      deleteMutation.mutate(keyToDelete);
      setKeyToDelete(null);
    }
  };

  const formatScopes = (scopes: string[]) => {
    if (scopes.length === 0) return null;
    if (scopes.length <= 2) {
      return scopes.map(scope => (
        <Badge key={scope} variant="secondary" className="mr-1">
          {scope}
        </Badge>
      ));
    }
    return (
      <>
        <Badge variant="secondary" className="mr-1">
          {scopes[0]}
        </Badge>
        <Badge variant="secondary">
          +{scopes.length - 1} more
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

  if (error) {
    return (
      <div className="text-center py-8">
        <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Failed to load API keys</h3>
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

  const hasApiKeys = apiKeys && apiKeys.length > 0;

  return (
    <>
      <div className="space-y-4">
        {!hasApiKeys ? (
          <div className="text-center py-12 bg-muted/10 rounded-lg border-2 border-dashed">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No API keys yet</h3>
            <p className="text-muted-foreground mb-4">
              Generate your first API key to start integrating
            </p>
            <Button onClick={() => setIsGenerateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Generate API Key
            </Button>
          </div>
        ) : (
          <>
            <div className="flex justify-end">
              <Button onClick={() => setIsGenerateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Generate API Key
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Scopes</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((apiKey) => (
                    <TableRow key={apiKey.id}>
                      <TableCell className="font-medium">{apiKey.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {apiKey.prefix}***
                          </code>
                          {newKeys[apiKey.id] && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCopyKey(apiKey.id)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {formatScopes(apiKey.scopes)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(apiKey.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {apiKey.last_used
                          ? format(new Date(apiKey.last_used), 'MMM d, yyyy')
                          : 'Never'
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" aria-label="API key actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(apiKey)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(apiKey.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Revoke
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
      <GenerateApiKeyModal
        open={isGenerateModalOpen}
        onOpenChange={setIsGenerateModalOpen}
        onKeyGenerated={(keyData) => {
          setNewKeys(prev => ({ ...prev, [keyData.id]: keyData.full_key }));
          queryClient.invalidateQueries({ queryKey: ['api-keys'] });
        }}
      />

      {selectedKey && (
        <ApiKeyDetailModal
          open={isDetailModalOpen}
          onOpenChange={setIsDetailModalOpen}
          apiKey={selectedKey}
        />
      )}

      {/* Delete confirmation dialog */}
      <ConfirmationDialog
        open={!!keyToDelete}
        onOpenChange={(open) => !open && setKeyToDelete(null)}
        title="Revoke API Key"
        description="Are you sure you want to revoke this API key? This action cannot be undone and any applications using this key will immediately lose access."
        confirmText="Revoke Key"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={confirmDelete}
        useAlertDialog
      />
    </>
  );
}