'use client';

import { useEffect, useState } from 'react';
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Settings,
  Trash2,
  Database,
  FileIcon
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Switch } from '@/app/components/ui/switch';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/app/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';

interface ConnectedWorkspace {
  name: string;
  workspaceId: string;
  connectedAt: string;
  icon?: string;
}

interface SyncSettings {
  autoSync: boolean;
  syncFrequency: 'hourly' | 'daily' | 'weekly';
  selectedPages: string[];
  selectedDatabases: string[];
}

interface NotionItem {
  id: string;
  title: string;
  type: 'page' | 'database';
  selected: boolean;
  lastEdited: string;
  recordCount?: number;
}

interface ImportHistoryItem {
  id: string;
  title: string;
  type: 'page' | 'database';
  importDate: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  pageCount?: number;
}

export default function NotionPage() {
  const [connected, setConnected] = useState(false);
  const [workspace, setWorkspace] = useState<ConnectedWorkspace | null>(null);
  const [settings, setSettings] = useState<SyncSettings>({
    autoSync: false,
    syncFrequency: 'daily',
    selectedPages: [],
    selectedDatabases: []
  });
  const [pages, setPages] = useState<NotionItem[]>([]);
  const [databases, setDatabases] = useState<NotionItem[]>([]);
  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Set page title
  useEffect(() => {
    document.title = 'Notion - Connectors - Record';
  }, []);

  useEffect(() => {
    const fetchConnectorStatus = async () => {
      try {
        // TODO: Replace with actual API call
        // Mock data for demonstration
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Simulate disconnected state for new setup
        setConnected(false);
        setWorkspace(null);
        setPages([]);
        setDatabases([]);
        setImportHistory([]);
      } catch (error) {
        console.error('Error fetching connector status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConnectorStatus();
  }, []);

  const handleConnect = async () => {
    try {
      setSyncing(true);
      // TODO: Implement OAuth flow
      // window.location.href = '/api/connectors/notion/auth';
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock successful connection
      setConnected(true);
      setWorkspace({
        name: 'My Workspace',
        workspaceId: 'workspace-123',
        connectedAt: new Date().toISOString()
      });
      setPages([
        { id: '1', title: 'Product Roadmap', type: 'page', selected: false, lastEdited: '2025-10-12' },
        { id: '2', title: 'Team Meeting Notes', type: 'page', selected: false, lastEdited: '2025-10-11' },
        { id: '3', title: 'Design Guidelines', type: 'page', selected: false, lastEdited: '2025-10-10' }
      ]);
      setDatabases([
        { id: '4', title: 'Project Tasks', type: 'database', selected: false, lastEdited: '2025-10-12', recordCount: 45 },
        { id: '5', title: 'Knowledge Base', type: 'database', selected: false, lastEdited: '2025-10-11', recordCount: 123 }
      ]);
    } catch (error) {
      console.error('Error connecting to Notion:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setSyncing(true);
      // TODO: Implement disconnect API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      setConnected(false);
      setWorkspace(null);
      setPages([]);
      setDatabases([]);
      setImportHistory([]);
      setSettings({
        autoSync: false,
        syncFrequency: 'daily',
        selectedPages: [],
        selectedDatabases: []
      });
    } catch (error) {
      console.error('Error disconnecting from Notion:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncNow = async () => {
    try {
      setSyncing(true);
      // TODO: Implement sync API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Add mock import history
      const newItem: ImportHistoryItem = {
        id: Date.now().toString(),
        title: 'Product Roadmap',
        type: 'page',
        importDate: new Date().toISOString(),
        status: 'success',
        pageCount: 1
      };
      setImportHistory([newItem, ...importHistory]);
    } catch (error) {
      console.error('Error syncing:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      // TODO: Implement save settings API call
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleItemSelection = (itemId: string, type: 'page' | 'database') => {
    if (type === 'page') {
      setPages(pages.map(p =>
        p.id === itemId ? { ...p, selected: !p.selected } : p
      ));

      const page = pages.find(p => p.id === itemId);
      if (page) {
        setSettings({
          ...settings,
          selectedPages: page.selected
            ? settings.selectedPages.filter(id => id !== itemId)
            : [...settings.selectedPages, itemId]
        });
      }
    } else {
      setDatabases(databases.map(d =>
        d.id === itemId ? { ...d, selected: !d.selected } : d
      ));

      const database = databases.find(d => d.id === itemId);
      if (database) {
        setSettings({
          ...settings,
          selectedDatabases: database.selected
            ? settings.selectedDatabases.filter(id => id !== itemId)
            : [...settings.selectedDatabases, itemId]
        });
      }
    }
  };

  const hasSelectedItems = settings.selectedPages.length > 0 || settings.selectedDatabases.length > 0;

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Notion</h1>
            <p className="text-muted-foreground">Import and sync pages and databases from Notion</p>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      {!connected ? (
        <Card>
          <CardHeader>
            <CardTitle>Connect Notion Workspace</CardTitle>
            <CardDescription>
              Authorize Record to access your Notion workspace
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>What we access</AlertTitle>
              <AlertDescription>
                Record will only access pages and databases you explicitly select. We use read-only
                permissions and never modify your content.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button onClick={handleConnect} disabled={syncing} className="w-full sm:w-auto">
                {syncing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Connect Notion
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Connected Workspace Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Connected Workspace
                    <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-400">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Active
                    </Badge>
                  </CardTitle>
                  <CardDescription>Your Notion workspace is connected</CardDescription>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Notion?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will stop syncing content from Notion. Previously imported documents
                        will remain in your knowledge base.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Workspace</span>
                  <span className="text-sm font-medium">{workspace?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Workspace ID</span>
                  <span className="text-sm font-mono">{workspace?.workspaceId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Connected</span>
                  <span className="text-sm font-medium">
                    {workspace?.connectedAt && new Date(workspace.connectedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Page/Database Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Content</CardTitle>
              <CardDescription>
                Choose which pages and databases to sync from your Notion workspace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="pages" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="pages">
                    <FileIcon className="mr-2 h-4 w-4" />
                    Pages ({pages.length})
                  </TabsTrigger>
                  <TabsTrigger value="databases">
                    <Database className="mr-2 h-4 w-4" />
                    Databases ({databases.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pages" className="space-y-2">
                  {pages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No pages found in your Notion workspace</p>
                    </div>
                  ) : (
                    pages.map((page) => (
                      <div
                        key={page.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <FileIcon className="h-5 w-5 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="font-medium">{page.title}</div>
                            <div className="text-sm text-muted-foreground">
                              Last edited {new Date(page.lastEdited).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <Switch
                          checked={page.selected}
                          onCheckedChange={() => toggleItemSelection(page.id, 'page')}
                        />
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="databases" className="space-y-2">
                  {databases.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No databases found in your Notion workspace</p>
                    </div>
                  ) : (
                    databases.map((database) => (
                      <div
                        key={database.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Database className="h-5 w-5 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="font-medium">{database.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {database.recordCount} records • Last edited {new Date(database.lastEdited).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <Switch
                          checked={database.selected}
                          onCheckedChange={() => toggleItemSelection(database.id, 'database')}
                        />
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Sync Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Sync Settings
              </CardTitle>
              <CardDescription>
                Configure how and when content is synced
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-sync">Automatic Sync</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically sync new and updated content
                  </p>
                </div>
                <Switch
                  id="auto-sync"
                  checked={settings.autoSync}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, autoSync: checked })
                  }
                />
              </div>

              {settings.autoSync && (
                <div className="space-y-2">
                  <Label htmlFor="sync-frequency">Sync Frequency</Label>
                  <Select
                    value={settings.syncFrequency}
                    onValueChange={(value: 'hourly' | 'daily' | 'weekly') =>
                      setSettings({ ...settings, syncFrequency: value })
                    }
                  >
                    <SelectTrigger id="sync-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Every hour</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSaveSettings} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSyncNow}
                  disabled={syncing || !hasSelectedItems}
                >
                  {syncing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync Now
                    </>
                  )}
                </Button>
              </div>

              {!hasSelectedItems && (
                <Alert variant="warning">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please select at least one page or database to enable syncing.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Import History */}
          <Card>
            <CardHeader>
              <CardTitle>Import History</CardTitle>
              <CardDescription>Recent content imports from Notion</CardDescription>
            </CardHeader>
            <CardContent>
              {importHistory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <RefreshCw className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No import history yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start syncing to see your import history
                  </p>
                  <Button
                    onClick={handleSyncNow}
                    disabled={syncing || !hasSelectedItems}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Now
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Import Date</TableHead>
                      <TableHead>Pages</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importHistory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.title}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {item.type === 'page' ? (
                              <><FileIcon className="mr-1 h-3 w-3" /> Page</>
                            ) : (
                              <><Database className="mr-1 h-3 w-3" /> Database</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(item.importDate).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.pageCount || '-'}
                        </TableCell>
                        <TableCell>
                          {item.status === 'success' ? (
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-sm">Success</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                              <XCircle className="h-4 w-4" />
                              <span className="text-sm">Failed</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
