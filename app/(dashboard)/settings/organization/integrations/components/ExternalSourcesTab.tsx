'use client';

import { useState } from 'react';
import { FolderOpen, FileText, CheckCircle2, XCircle, Settings, ExternalLink } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Alert, AlertDescription } from '@/app/components/ui/alert';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: typeof FolderOpen;
  status: 'connected' | 'disconnected';
  enabled: boolean;
  lastSync?: string;
}

const availableIntegrations: Integration[] = [
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Sync files and folders from Google Drive to your knowledge base',
    icon: FolderOpen,
    status: 'disconnected',
    enabled: false,
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Import pages and databases from Notion workspaces',
    icon: FileText,
    status: 'disconnected',
    enabled: false,
  },
];

export function ExternalSourcesTab() {
  const [integrations, setIntegrations] = useState<Integration[]>(availableIntegrations);

  const handleConnect = (id: string) => {
    // TODO: Implement OAuth flow
    console.log('Connect:', id);
  };

  const handleDisconnect = (id: string) => {
    // TODO: Implement disconnect logic
    fetch(`/api/integrations/${id}/disconnect`, { method: 'POST' })
      .then(() => {
        setIntegrations((prev) =>
          prev.map((integration) =>
            integration.id === id
              ? { ...integration, status: 'disconnected', enabled: false }
              : integration
          )
        );
      })
      .catch((error) => {
        console.error('Failed to disconnect:', error);
        // Show error toast
      });
  };

  const handleConfigure = (id: string) => {
    // TODO: Open configuration modal
    console.log('Configure:', id);
  };

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          Connect external data sources to automatically sync content into your knowledge base.
          All imported content is processed with AI for semantic search and chat features.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          const isConnected = integration.status === 'connected';

          return (
            <Card key={integration.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        <Badge variant={isConnected ? 'default' : 'secondary'}>
                          {isConnected ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Connected
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />
                              Not Connected
                            </>
                          )}
                        </Badge>
                      </div>
                      <CardDescription>{integration.description}</CardDescription>
                      {isConnected && integration.lastSync && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Last synced: {new Date(integration.lastSync).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConfigure(integration.id)}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDisconnect(integration.id)}
                        >
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleConnect(integration.id)}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              {isConnected && (
                <CardContent className="pt-0">
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Auto-sync</span>
                      <Badge variant="outline">
                        {integration.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Synced items</span>
                      <span className="font-medium">0 files</span>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
