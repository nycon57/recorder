'use client';

import { useEffect, useState } from 'react';
import {
  FolderOpen,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Settings,
  Trash2,
  Folder
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

interface ConnectedAccount {
  email: string;
  name: string;
  connectedAt: string;
}

interface SyncSettings {
  autoSync: boolean;
  syncFrequency: 'hourly' | 'daily' | 'weekly';
  selectedFolders: string[];
}

interface SyncHistoryItem {
  id: string;
  fileName: string;
  fileType: string;
  syncDate: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  fileSize?: string;
}

interface FolderItem {
  id: string;
  name: string;
  selected: boolean;
  fileCount: number;
}

export default function GoogleDrivePage() {
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState<ConnectedAccount | null>(null);
  const [settings, setSettings] = useState<SyncSettings>({
    autoSync: false,
    syncFrequency: 'daily',
    selectedFolders: []
  });
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Set page title
  useEffect(() => {
    document.title = 'Google Drive - Connectors - Record';
  }, []);

  useEffect(() => {
    const fetchConnectorStatus = async () => {
      try {
        // TODO: Replace with actual API call
        // Mock data for demonstration
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Simulate disconnected state for new setup
        setConnected(false);
        setAccount(null);
        setFolders([]);
        setSyncHistory([]);
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
      // window.location.href = '/api/connectors/google-drive/auth';
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock successful connection
      setConnected(true);
      setAccount({
        email: 'user@gmail.com',
        name: 'John Doe',
        connectedAt: new Date().toISOString()
      });
      setFolders([
        { id: '1', name: 'Documents', selected: false, fileCount: 42 },
        { id: '2', name: 'Work', selected: false, fileCount: 18 },
        { id: '3', name: 'Projects', selected: false, fileCount: 25 }
      ]);
    } catch (error) {
      console.error('Error connecting to Google Drive:', error);
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
      setAccount(null);
      setFolders([]);
      setSyncHistory([]);
      setSettings({
        autoSync: false,
        syncFrequency: 'daily',
        selectedFolders: []
      });
    } catch (error) {
      console.error('Error disconnecting from Google Drive:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncNow = async () => {
    try {
      setSyncing(true);
      // TODO: Implement sync API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Add mock sync history
      const newItem: SyncHistoryItem = {
        id: Date.now().toString(),
        fileName: 'Document.pdf',
        fileType: 'PDF',
        syncDate: new Date().toISOString(),
        status: 'success',
        fileSize: '2.4 MB'
      };
      setSyncHistory([newItem, ...syncHistory]);
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

  const toggleFolderSelection = (folderId: string) => {
    setFolders(folders.map(f =>
      f.id === folderId ? { ...f, selected: !f.selected } : f
    ));

    const folder = folders.find(f => f.id === folderId);
    if (folder) {
      setSettings({
        ...settings,
        selectedFolders: folder.selected
          ? settings.selectedFolders.filter(id => id !== folderId)
          : [...settings.selectedFolders, folderId]
      });
    }
  };

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
            <FolderOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Google Drive</h1>
            <p className="text-muted-foreground">Import and sync documents from Google Drive</p>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      {!connected ? (
        <Card>
          <CardHeader>
            <CardTitle>Connect Google Drive</CardTitle>
            <CardDescription>
              Authorize Record to access your Google Drive files and folders
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>What we access</AlertTitle>
              <AlertDescription>
                Record will only access folders you explicitly select. We use read-only permissions
                and never modify your files.
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
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Connect Google Drive
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Connected Account Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Connected Account
                    <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-400">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Active
                    </Badge>
                  </CardTitle>
                  <CardDescription>Your Google Drive account is connected</CardDescription>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Google Drive?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will stop syncing files from Google Drive. Previously imported documents
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
                  <span className="text-sm text-muted-foreground">Account</span>
                  <span className="text-sm font-medium">{account?.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Name</span>
                  <span className="text-sm font-medium">{account?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Connected</span>
                  <span className="text-sm font-medium">
                    {account?.connectedAt && new Date(account.connectedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Folder Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Folder className="h-5 w-5" />
                Select Folders
              </CardTitle>
              <CardDescription>
                Choose which folders to sync from your Google Drive
              </CardDescription>
            </CardHeader>
            <CardContent>
              {folders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No folders found in your Google Drive</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Folder className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium">{folder.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {folder.fileCount} files
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={folder.selected}
                        onCheckedChange={() => toggleFolderSelection(folder.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
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
                Configure how and when documents are synced
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-sync">Automatic Sync</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically sync new and updated files
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
                  disabled={syncing || settings.selectedFolders.length === 0}
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

              {settings.selectedFolders.length === 0 && (
                <Alert variant="warning">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please select at least one folder to enable syncing.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Sync History */}
          <Card>
            <CardHeader>
              <CardTitle>Sync History</CardTitle>
              <CardDescription>Recent file syncs from Google Drive</CardDescription>
            </CardHeader>
            <CardContent>
              {syncHistory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <RefreshCw className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No sync history yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start syncing to see your file import history
                  </p>
                  <Button
                    onClick={handleSyncNow}
                    disabled={syncing || settings.selectedFolders.length === 0}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Now
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Sync Date</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncHistory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.fileName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.fileType}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(item.syncDate).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.fileSize || '-'}
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
