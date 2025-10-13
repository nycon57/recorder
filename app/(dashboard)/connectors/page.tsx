'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plug,
  FolderOpen,
  FileText,
  Upload,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';

interface ConnectorStatus {
  type: 'google-drive' | 'notion' | 'upload';
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  connected: boolean;
  lastSync?: string;
  documentCount?: number;
  status?: 'active' | 'error' | 'syncing';
  href: string;
}

interface RecentImport {
  id: string;
  title: string;
  source: string;
  importDate: string;
  status: 'completed' | 'processing' | 'failed';
  documentCount?: number;
}

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [recentImports, setRecentImports] = useState<RecentImport[]>([]);
  const [loading, setLoading] = useState(true);

  // Set page title
  useEffect(() => {
    document.title = 'Connectors - Record';
  }, []);

  useEffect(() => {
    const fetchConnectorData = async () => {
      try {
        // TODO: Replace with actual API call
        // Mock data for demonstration
        await new Promise(resolve => setTimeout(resolve, 1000));

        setConnectors([
          {
            type: 'google-drive',
            name: 'Google Drive',
            description: 'Import documents from Google Drive folders',
            icon: FolderOpen,
            connected: false,
            href: '/connectors/google-drive'
          },
          {
            type: 'notion',
            name: 'Notion',
            description: 'Sync pages and databases from Notion',
            icon: FileText,
            connected: false,
            href: '/connectors/notion'
          },
          {
            type: 'upload',
            name: 'File Upload',
            description: 'Upload documents directly from your computer',
            icon: Upload,
            connected: true,
            lastSync: '2 hours ago',
            documentCount: 0,
            status: 'active',
            href: '/connectors/upload'
          }
        ]);

        setRecentImports([]);
      } catch (error) {
        console.error('Error fetching connector data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConnectorData();
  }, []);

  const getStatusBadge = (status?: 'active' | 'error' | 'syncing') => {
    if (!status) return null;

    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-400">Active</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'syncing':
        return <Badge variant="default" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">Syncing</Badge>;
    }
  };

  const getImportStatusIcon = (status: RecentImport['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Plug className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Connectors</h1>
            <p className="text-muted-foreground">Import and sync content from external sources</p>
          </div>
        </div>
      </div>

      {/* Connector Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Available Connectors</h2>
          <Badge variant="secondary" className="text-xs">
            {connectors.filter(c => c.connected).length} / {connectors.length} Connected
          </Badge>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-12 w-12 rounded-lg mb-4" />
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {connectors.map((connector) => {
              const Icon = connector.icon;
              return (
                <Card key={connector.type} className="relative overflow-hidden transition-all hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      {connector.connected && getStatusBadge(connector.status)}
                    </div>
                    <CardTitle className="text-lg">{connector.name}</CardTitle>
                    <CardDescription>{connector.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {connector.connected ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Last sync</span>
                          <span className="font-medium">{connector.lastSync || 'Never'}</span>
                        </div>
                        {connector.documentCount !== undefined && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Documents</span>
                            <span className="font-medium">{connector.documentCount.toLocaleString()}</span>
                          </div>
                        )}
                        <Button asChild className="w-full" variant="outline">
                          <Link href={connector.href}>
                            Configure
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      <Button asChild className="w-full">
                        <Link href={connector.href}>
                          Connect
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Imports Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Recent Imports</h2>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : recentImports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Plug className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No imports yet</h3>
              <p className="text-muted-foreground max-w-sm mb-6">
                Connect a source and start importing documents to see your sync history here.
              </p>
              <div className="flex gap-2">
                <Button asChild>
                  <Link href="/connectors/google-drive">Connect Google Drive</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/connectors/upload">Upload Files</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Import Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Documents</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentImports.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.source}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.importDate}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getImportStatusIcon(item.status)}
                          <span className="capitalize text-sm">{item.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.documentCount?.toLocaleString() || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Info Alert */}
      <Alert>
        <Plug className="h-4 w-4" />
        <AlertTitle>About Connectors</AlertTitle>
        <AlertDescription>
          Connectors automatically import and sync content from external sources into your knowledge base.
          Documents are processed with AI to enable semantic search and chat features.
        </AlertDescription>
      </Alert>
    </div>
  );
}
