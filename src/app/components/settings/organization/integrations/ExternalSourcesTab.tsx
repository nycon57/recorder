'use client';

import { useState, useEffect } from 'react';
import {
  FolderOpen,
  FileText,
  CheckCircle2,
  XCircle,
  Settings,
  ExternalLink,
  FileUp,
  Cloud,
  Database,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Switch } from '@/app/components/ui/switch';
import { Label } from '@/app/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible';

type ConnectorType = 'google_drive' | 'sharepoint' | 'onedrive' | 'notion' | 'zoom' | 'microsoft_teams';

interface Integration {
  id: string;
  type: ConnectorType;
  name: string;
  description: string;
  icon: typeof FolderOpen;
  status: 'connected' | 'disconnected' | 'error';
  supportsPublish: boolean;
  supportsImport: boolean;
  lastSync?: string;
  lastPublish?: string;
  externalUserName?: string;
  publishSettings?: {
    autoPublish: boolean;
    defaultFolderId?: string | null;
    defaultFormat?: string;
  };
}

interface ApiIntegration {
  id: string;
  type: ConnectorType;
  name: string;
  description: string;
  status: string;
  supportsPublish: boolean;
  supportsImport: boolean;
  lastSync?: string;
  lastPublish?: string;
  externalUserName?: string;
  publishSettings?: {
    autoPublish: boolean;
    defaultFolderId?: string | null;
    defaultFormat?: string;
  };
}

// Available integration types with their metadata
const INTEGRATION_METADATA: Record<ConnectorType, {
  name: string;
  description: string;
  icon: typeof FolderOpen;
  authUrl?: string;
}> = {
  google_drive: {
    name: 'Google Drive',
    description: 'Import and publish documents to Google Drive',
    icon: FolderOpen,
    authUrl: '/api/integrations/google-drive/auth',
  },
  sharepoint: {
    name: 'SharePoint',
    description: 'Import and publish documents to SharePoint document libraries',
    icon: Database,
    authUrl: '/api/integrations/sharepoint/auth',
  },
  onedrive: {
    name: 'OneDrive',
    description: 'Import and publish documents to OneDrive personal or business',
    icon: Cloud,
    authUrl: '/api/integrations/sharepoint/auth?type=onedrive',
  },
  notion: {
    name: 'Notion',
    description: 'Import pages and databases from Notion workspaces',
    icon: FileText,
    authUrl: '/api/integrations/notion/auth',
  },
  zoom: {
    name: 'Zoom',
    description: 'Import meeting recordings from Zoom',
    icon: FileText,
  },
  microsoft_teams: {
    name: 'Microsoft Teams',
    description: 'Import meeting recordings from Microsoft Teams',
    icon: FileText,
  },
};

export function ExternalSourcesTab() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSettings, setExpandedSettings] = useState<string | null>(null);

  // Fetch integrations on mount
  useEffect(() => {
    fetchIntegrations();
  }, []);

  // Handle URL parameters (success/error messages)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    const message = params.get('message');

    if (success === 'sharepoint_connected') {
      toast.success('SharePoint connected successfully');
      // Refresh integrations list
      fetchIntegrations();
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    } else if (success === 'google_drive_connected') {
      toast.success('Google Drive connected successfully');
      // Refresh integrations list
      fetchIntegrations();
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      toast.error(message || 'Connection failed');
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/integrations');

      if (!response.ok) {
        throw new Error('Failed to fetch integrations');
      }

      const data = await response.json();
      const apiIntegrations: ApiIntegration[] = data.integrations || [];

      // Merge API data with metadata
      const mergedIntegrations: Integration[] = Object.entries(INTEGRATION_METADATA).map(
        ([type, metadata]) => {
          const apiIntegration = apiIntegrations.find((i) => i.type === type);

          if (apiIntegration) {
            // Connected integration
            return {
              id: apiIntegration.id,
              type: type as ConnectorType,
              name: apiIntegration.name || metadata.name,
              description: apiIntegration.description || metadata.description,
              icon: metadata.icon,
              status: (apiIntegration.status === 'error' ? 'error' : 'connected') as 'connected' | 'disconnected' | 'error',
              supportsPublish: apiIntegration.supportsPublish,
              supportsImport: apiIntegration.supportsImport,
              lastSync: apiIntegration.lastSync,
              lastPublish: apiIntegration.lastPublish,
              externalUserName: apiIntegration.externalUserName,
              publishSettings: apiIntegration.publishSettings,
            };
          } else {
            // Not connected integration
            return {
              id: type,
              type: type as ConnectorType,
              name: metadata.name,
              description: metadata.description,
              icon: metadata.icon,
              status: 'disconnected' as const,
              supportsPublish: false,
              supportsImport: true,
            };
          }
        }
      );

      setIntegrations(mergedIntegrations);
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
      toast.error('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = (type: ConnectorType) => {
    const metadata = INTEGRATION_METADATA[type];

    if (!metadata.authUrl) {
      toast.error('This integration is not yet available');
      return;
    }

    // Redirect to OAuth flow
    window.location.href = metadata.authUrl;
  };

  const handleDisconnect = async (id: string) => {
    try {
      const response = await fetch(`/api/integrations/${id}/disconnect`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      toast.success('Integration disconnected');
      fetchIntegrations();
    } catch (error) {
      console.error('Failed to disconnect:', error);
      toast.error('Failed to disconnect integration');
    }
  };

  const handleToggleAutoPublish = async (
    integrationId: string,
    enabled: boolean
  ) => {
    try {
      const response = await fetch(`/api/integrations/${integrationId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publish: {
            autoPublish: enabled,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      toast.success(enabled ? 'Auto-publish enabled' : 'Auto-publish disabled');
      fetchIntegrations();
    } catch (error) {
      console.error('Failed to update settings:', error);
      toast.error('Failed to update settings');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          Connect external data sources to automatically import content and publish enriched documents.
          All imported content is processed with AI for semantic search and chat features.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          const isConnected = integration.status === 'connected';
          const hasError = integration.status === 'error';

          return (
            <Card key={integration.id} className={hasError ? 'border-destructive' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${hasError ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                      <Icon className={`h-6 w-6 ${hasError ? 'text-destructive' : 'text-primary'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        <Badge variant={isConnected ? 'default' : hasError ? 'destructive' : 'secondary'}>
                          {isConnected ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Connected
                            </>
                          ) : hasError ? (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />
                              Error
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />
                              Not Connected
                            </>
                          )}
                        </Badge>
                        {integration.supportsPublish && isConnected && (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <FileUp className="h-3 w-3 mr-1" />
                            Publish Ready
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{integration.description}</CardDescription>
                      {isConnected && integration.externalUserName && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Connected as: {integration.externalUserName}
                        </p>
                      )}
                      {isConnected && integration.lastSync && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last import: {(() => {
                            try {
                              const date = new Date(integration.lastSync);
                              return !isNaN(date.getTime()) ? date.toLocaleString() : 'Never';
                            } catch {
                              return 'Never';
                            }
                          })()}
                        </p>
                      )}
                      {isConnected && integration.lastPublish && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last publish: {(() => {
                            try {
                              const date = new Date(integration.lastPublish);
                              return !isNaN(date.getTime()) ? date.toLocaleString() : 'Never';
                            } catch {
                              return 'Never';
                            }
                          })()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDisconnect(integration.id)}
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleConnect(integration.type)}
                        disabled={!INTEGRATION_METADATA[integration.type].authUrl}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              {/* Publishing Settings (only for connected integrations with publish support) */}
              {isConnected && integration.supportsPublish && (
                <CardContent className="pt-0">
                  <Collapsible
                    open={expandedSettings === integration.id}
                    onOpenChange={(open) =>
                      setExpandedSettings(open ? integration.id : null)
                    }
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:underline">
                      <span>Publishing Settings</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          expandedSettings === integration.id ? 'rotate-180' : ''
                        }`}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 pt-4">
                      {/* Auto-publish toggle */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor={`auto-publish-${integration.id}`}>
                            Auto-publish new documents
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Automatically publish new content to {integration.name}
                          </p>
                        </div>
                        <Switch
                          id={`auto-publish-${integration.id}`}
                          checked={integration.publishSettings?.autoPublish || false}
                          onCheckedChange={(checked) =>
                            handleToggleAutoPublish(integration.id, checked)
                          }
                        />
                      </div>

                      {/* Default folder - placeholder for future implementation */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Default folder</Label>
                          <p className="text-xs text-muted-foreground">
                            {integration.publishSettings?.defaultFolderId
                              ? 'Custom folder selected'
                              : 'Root folder'}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" disabled>
                          Choose Folder
                        </Button>
                      </div>

                      {/* Default format */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Default format</Label>
                          <p className="text-xs text-muted-foreground">
                            {integration.publishSettings?.defaultFormat || 'markdown'}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" disabled>
                          Change Format
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              )}

              {/* Import Settings (for connected integrations without publish support) */}
              {isConnected && !integration.supportsPublish && (
                <CardContent className="pt-0">
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Import capability</span>
                      <Badge variant="outline">
                        {integration.supportsImport ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Publish capability</span>
                      <Badge variant="outline" className="text-amber-600 border-amber-600">
                        Upgrade Required
                      </Badge>
                    </div>
                    <Alert className="mt-2">
                      <AlertDescription className="text-xs">
                        To publish documents to {integration.name}, you need to grant write permissions.
                      </AlertDescription>
                    </Alert>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        const metadata = INTEGRATION_METADATA[integration.type];
                        if (metadata.authUrl) {
                          window.location.href = `${metadata.authUrl}?publish=true`;
                        }
                      }}
                    >
                      <FileUp className="h-4 w-4 mr-2" />
                      Enable Publishing
                    </Button>
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
