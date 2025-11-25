'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Shield,
  Activity,
  Download,
  Search,
  RefreshCw,
  Users,
  Monitor,
  Globe,
  Smartphone,
  X,
  AlertTriangle,
  Lock,
  Key,
  Clock,
} from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { useToast } from '@/app/components/ui/use-toast';
import { SessionsTable } from '@/app/components/shared/SessionsTable';
import { AuditLogEntry } from '@/app/components/shared/AuditLogEntry';
import { ColumnDef } from '@tanstack/react-table';
import { DateRangePicker } from '@/app/components/shared/DateRangePicker';
import { UserAvatar } from '@/app/components/shared/UserAvatar';

// Types
type AuditLog = {
  id: string;
  org_id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_values: any | null;
  new_values: any | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  metadata: any;
  created_at: string;
  user?: {
    name: string | null;
    email: string;
    avatar_url: string | null;
  };
};

type UserSession = {
  id: string;
  user_id: string;
  org_id: string;
  session_token: string;
  clerk_session_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  location: any | null;
  created_at: string;
  last_active_at: string;
  expires_at: string;
  revoked_at: string | null;
  user?: {
    name: string | null;
    email: string;
    avatar_url: string | null;
  };
  isActive?: boolean;
};

export default function SecurityPage() {
  const [activeTab, setActiveTab] = useState('audit-logs');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Audit log filters
  const [auditSearch, setAuditSearch] = useState('');
  const [auditDateFrom, setAuditDateFrom] = useState<Date | undefined>();
  const [auditDateTo, setAuditDateTo] = useState<Date | undefined>();
  const [auditUserFilter, setAuditUserFilter] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditResourceFilter, setAuditResourceFilter] = useState('');
  const [auditPage, setAuditPage] = useState(1);

  // Session filters
  const [sessionUserFilter, setSessionUserFilter] = useState('');
  const [sessionDeviceFilter, setSessionDeviceFilter] = useState('');
  const [sessionActiveFilter, setSessionActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sessionPage, setSessionPage] = useState(1);

  // Revoke session dialog
  const [sessionToRevoke, setSessionToRevoke] = useState<UserSession | null>(null);

  // Fetch audit logs
  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ['audit-logs', auditPage, auditSearch, auditDateFrom, auditDateTo, auditUserFilter, auditActionFilter, auditResourceFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: auditPage.toString(),
        limit: '20',
      });

      if (auditSearch) params.append('search', auditSearch);
      if (auditDateFrom) params.append('from', auditDateFrom.toISOString());
      if (auditDateTo) params.append('to', auditDateTo.toISOString());
      if (auditUserFilter) params.append('userId', auditUserFilter);
      if (auditActionFilter) params.append('action', auditActionFilter);
      if (auditResourceFilter) params.append('resourceType', auditResourceFilter);

      const response = await fetch(`/api/organizations/audit-logs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      return response.json();
    },
  });

  // Fetch sessions
  const { data: sessionData, isLoading: sessionLoading, refetch: refetchSessions } = useQuery({
    queryKey: ['sessions', sessionPage, sessionUserFilter, sessionDeviceFilter, sessionActiveFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: sessionPage.toString(),
        limit: '20',
      });

      if (sessionUserFilter) params.append('userId', sessionUserFilter);
      if (sessionDeviceFilter) params.append('deviceType', sessionDeviceFilter);
      if (sessionActiveFilter !== 'all') {
        params.append('active', sessionActiveFilter === 'active' ? 'true' : 'false');
      }

      const response = await fetch(`/api/organizations/sessions?${params}`);
      if (!response.ok) throw new Error('Failed to fetch sessions');
      return response.json();
    },
  });

  // Export audit logs mutation
  const exportAuditMutation = useMutation({
    mutationFn: async () => {
      const body = {
        from: auditDateFrom?.toISOString(),
        to: auditDateTo?.toISOString(),
        userId: auditUserFilter,
        action: auditActionFilter,
        resourceType: auditResourceFilter,
      };

      const response = await fetch('/api/organizations/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Failed to export audit logs');
      return response.json();
    },
    onSuccess: (data) => {
      // Convert to CSV
      const csv = convertToCSV(data.data);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'Audit logs exported successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to export audit logs',
        variant: 'destructive',
      });
    },
  });

  // Revoke session mutation
  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/organizations/sessions?sessionId=${sessionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to revoke session');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Session revoked successfully',
      });
      refetchSessions();
      setSessionToRevoke(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to revoke session',
        variant: 'destructive',
      });
    },
  });

  // Bulk revoke sessions mutation
  const bulkRevokeMutation = useMutation({
    mutationFn: async (params: { userId?: string; all?: boolean }) => {
      const response = await fetch('/api/organizations/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error('Failed to bulk revoke sessions');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: data.message,
      });
      refetchSessions();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to bulk revoke sessions',
        variant: 'destructive',
      });
    },
  });

  // CSV conversion utility
  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');

    const csvRows = data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma
        const escaped = String(value || '').replace(/"/g, '""');
        return escaped.includes(',') ? `"${escaped}"` : escaped;
      }).join(',')
    );

    return [csvHeaders, ...csvRows].join('\n');
  };

  // Session table columns
  const sessionColumns: ColumnDef<UserSession>[] = [
    {
      id: 'user',
      header: 'User',
      cell: ({ row }) => {
        const user = row.original.user || { name: 'Unknown User', email: '', avatar_url: null };
        return (
          <div className="flex items-center gap-2">
            <UserAvatar name={user.name || 'Unknown User'} avatarUrl={user.avatar_url} email={user.email} size="sm" />
            <div>
              <div className="font-medium text-sm">
                {user.name || 'Unknown User'}
              </div>
              <div className="text-xs text-muted-foreground">
                {user.email}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'device',
      header: 'Device',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.device_type === 'mobile' ? (
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Monitor className="h-4 w-4 text-muted-foreground" />
          )}
          <div>
            <div className="text-sm">{row.original.browser || 'Unknown'}</div>
            <div className="text-xs text-muted-foreground">{row.original.os || 'Unknown OS'}</div>
          </div>
        </div>
      ),
    },
    {
      id: 'location',
      header: 'Location',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-sm">{row.original.ip_address || 'Unknown'}</div>
            {row.original.location?.city && (
              <div className="text-xs text-muted-foreground">
                {row.original.location.city}, {row.original.location.country}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'last_active',
      accessorKey: 'last_active_at',
      header: 'Last Active',
      enableSorting: true,
      cell: ({ row }) => (
        <div className="text-sm">
          {formatDistanceToNow(new Date(row.original.last_active_at), { addSuffix: true })}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        row.original.isActive ? (
          <Badge className="bg-green-100 text-green-700">Active</Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
        )
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            setSessionToRevoke(row.original);
          }}
          disabled={!row.original.isActive}
        >
          <X className="h-4 w-4" />
          Revoke
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Security & Audit</h3>
        <p className="text-sm text-muted-foreground">
          Monitor security events and manage active sessions
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="audit-logs" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Active Sessions
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit-logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Audit Logs</CardTitle>
                  <CardDescription>
                    Track all changes and activities within your organization
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refetchAudit()}
                    disabled={auditLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${auditLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => exportAuditMutation.mutate()}
                    disabled={exportAuditMutation.isPending}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search actions..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <DateRangePicker
                  from={auditDateFrom}
                  to={auditDateTo}
                  onDateChange={(from, to) => {
                    setAuditDateFrom(from);
                    setAuditDateTo(to);
                  }}
                />

                <Select value={auditActionFilter || 'all'} onValueChange={(value) => setAuditActionFilter(value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    {auditData?.filters?.actions?.map((action: string) => (
                      <SelectItem key={action} value={action}>
                        {action.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={auditResourceFilter || 'all'} onValueChange={(value) => setAuditResourceFilter(value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All resources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All resources</SelectItem>
                    {auditData?.filters?.resourceTypes?.map((type: string) => (
                      <SelectItem key={type} value={type}>
                        {type.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Audit log entries */}
              <div className="border rounded-lg">
                {auditLoading ? (
                  <div className="p-6 space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : auditData?.logs?.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No audit logs found
                  </div>
                ) : (
                  <div>
                    {auditData?.logs?.map((log: AuditLog) => (
                      <AuditLogEntry key={log.id} log={log} />
                    ))}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {auditData?.pagination && auditData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Page {auditData.pagination.page} of {auditData.pagination.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                      disabled={auditPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAuditPage(p => p + 1)}
                      disabled={auditPage === auditData.pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Active Sessions</CardTitle>
                  <CardDescription>
                    Manage active user sessions across your organization
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    {sessionData?.stats?.activeCount || 0} active sessions
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="destructive">
                        Bulk Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => bulkRevokeMutation.mutate({ all: true })}
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Revoke All Sessions
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex gap-4">
                <Select
                  value={sessionActiveFilter}
                  onValueChange={(value: any) => setSessionActiveFilter(value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sessions</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>

                {sessionData?.filters?.deviceTypes?.length > 0 && (
                  <Select value={sessionDeviceFilter || 'all'} onValueChange={(value) => setSessionDeviceFilter(value === 'all' ? '' : value)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All devices" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All devices</SelectItem>
                      {sessionData.filters.deviceTypes.map((type: string) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Sessions table */}
              <SessionsTable
                columns={sessionColumns}
                data={sessionData?.sessions || []}
                isLoading={sessionLoading}
                emptyMessage="No sessions found"
              />

              {/* Pagination */}
              {sessionData?.pagination && sessionData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Page {sessionData.pagination.page} of {sessionData.pagination.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSessionPage(p => Math.max(1, p - 1))}
                      disabled={sessionPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSessionPage(p => p + 1)}
                      disabled={sessionPage === sessionData.pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Configure security policies for your organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Advanced security settings are coming soon. These will include:
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="border rounded-lg p-4 opacity-50">
                  <div className="flex items-start gap-3">
                    <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-medium">Two-Factor Authentication</div>
                      <div className="text-sm text-muted-foreground">
                        Require 2FA for all users in your organization
                      </div>
                      <Badge variant="outline" className="mt-2">Coming Soon</Badge>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4 opacity-50">
                  <div className="flex items-start gap-3">
                    <Key className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-medium">Password Policy</div>
                      <div className="text-sm text-muted-foreground">
                        Set minimum password requirements and rotation policies
                      </div>
                      <Badge variant="outline" className="mt-2">Coming Soon</Badge>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4 opacity-50">
                  <div className="flex items-start gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-medium">IP Allowlist</div>
                      <div className="text-sm text-muted-foreground">
                        Restrict access to specific IP addresses or ranges
                      </div>
                      <Badge variant="outline" className="mt-2">Coming Soon</Badge>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4 opacity-50">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-medium">Session Timeout</div>
                      <div className="text-sm text-muted-foreground">
                        Automatically log out users after a period of inactivity
                      </div>
                      <Badge variant="outline" className="mt-2">Coming Soon</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Revoke session confirmation dialog */}
      <AlertDialog open={!!sessionToRevoke} onOpenChange={() => setSessionToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this session? The user will be logged out immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sessionToRevoke && revokeSessionMutation.mutate(sessionToRevoke.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}