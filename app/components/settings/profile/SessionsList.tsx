'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Monitor, Smartphone, Tablet, Globe, MapPin, Clock, Loader2, Shield } from 'lucide-react';
import { useSession } from '@clerk/nextjs';

import { useFetchWithAbort } from '@/app/hooks/useFetchWithAbort';
import { useToast } from '@/app/components/ui/use-toast';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
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

interface Session {
  id: string;
  device_name: string;
  device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  os: string;
  ip_address: string;
  location: string;
  is_current: boolean;
  last_active_at: string;
  created_at: string;
}

export function SessionsList() {
  const { toast } = useToast();
  const { session: clerkSession } = useSession();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isRevoking, setIsRevoking] = useState<string | null>(null);
  const [sessionToRevoke, setSessionToRevoke] = useState<Session | null>(null);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);

  interface ApiSession {
    id: string;
    browser: string;
    os: string;
    deviceType?: 'desktop' | 'mobile' | 'tablet' | 'unknown';
    ipAddress?: string;
    location?: string;
    lastActiveAt?: string;
    createdAt?: string;
  }

  interface ApiSessionsResponse {
    data: {
      sessions: ApiSession[];
    };
  }

  // ✅ Use abort-safe data fetching hook (prevents race conditions)
  const { loading: isLoading } = useFetchWithAbort<ApiSessionsResponse>(
    '/api/profile/sessions',
    {
      onSuccess: (data) => {
        // Get current Clerk session ID
        const currentSessionId = clerkSession?.id;

        // Transform API response to match component's Session interface
        const formattedSessions: Session[] = (data.data?.sessions || []).map((session) => ({
          id: session.id,
          device_name: `${session.browser} on ${session.os}`,
          device_type: session.deviceType || 'unknown',
          browser: session.browser,
          os: session.os,
          ip_address: session.ipAddress || '',
          location: session.location || 'Unknown',
          is_current: currentSessionId ? session.id === currentSessionId : false,
          last_active_at: session.lastActiveAt || new Date().toISOString(),
          created_at: session.createdAt || new Date().toISOString(),
        }));

        setSessions(formattedSessions);
      },
      onError: (error: Error) => {
        console.error('Error fetching sessions:', error.message);
        toast({
          title: 'Error',
          description: 'Failed to load sessions',
          variant: 'destructive',
        });
      },
    }
  );

  const revokeSession = async (session: Session) => {
    setIsRevoking(session.id);
    try {
      const response = await fetch('/api/profile/sessions', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: session.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to revoke session');
      }

      setSessions((prev) => prev.filter((s) => s.id !== session.id));

      toast({
        title: 'Session revoked',
        description: 'The session has been successfully terminated',
      });
    } catch (error) {
      const err = error as Error;
      console.error('Error revoking session:', err.message);
      toast({
        title: 'Error',
        description: 'Failed to revoke session',
        variant: 'destructive',
      });
    } finally {
      setIsRevoking(null);
      setShowRevokeDialog(false);
      setSessionToRevoke(null);
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'desktop':
        return <Monitor className="h-4 w-4" />;
      case 'mobile':
        return <Smartphone className="h-4 w-4" />;
      case 'tablet':
        return <Tablet className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium">No active sessions</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have any active sessions at the moment
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {getDeviceIcon(session.device_type)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {session.device_name || 'Unknown Device'}
                          </span>
                          {session.is_current && (
                            <Badge variant="secondary" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {session.browser} on {session.os}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3" />
                        {session.location || 'Unknown'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {session.ip_address}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(session.last_active_at), {
                        addSuffix: true
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    {!session.is_current && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSessionToRevoke(session);
                          setShowRevokeDialog(true);
                        }}
                        disabled={isRevoking === session.id}
                      >
                        {isRevoking === session.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Revoke'
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            <strong>Security Tip:</strong> Regularly review your active sessions. If you see any unfamiliar devices or locations, revoke those sessions immediately and change your password.
          </p>
        </div>
      </div>

      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Session?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this session? The device will be logged out immediately.
              {sessionToRevoke && (
                <div className="mt-4 rounded-md bg-muted p-3">
                  <p className="text-sm">
                    <strong>Device:</strong> {sessionToRevoke.device_name || 'Unknown'}
                  </p>
                  <p className="text-sm">
                    <strong>Location:</strong> {sessionToRevoke.location || 'Unknown'}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sessionToRevoke && revokeSession(sessionToRevoke)}
              className="bg-destructive text-destructive-foreground"
            >
              Revoke Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}