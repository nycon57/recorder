'use client';

import React from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { ChevronDown, ChevronRight, User, Monitor, MapPin } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { Badge } from '@/app/components/ui/badge';
import { TableCell, TableRow } from '@/app/components/ui/table';
import { Button } from '@/app/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/app/components/ui/collapsible';

import type { AuditLog } from '../types';

interface AuditLogRowProps {
  log: AuditLog;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

// Action badge color mapping
const getActionBadgeVariant = (action: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (action.includes('delete') || action.includes('revoke')) return 'destructive';
  if (action.includes('create')) return 'default';
  if (action.includes('update') || action.includes('change')) return 'secondary';
  return 'outline';
};

// Parse user agent for browser/device info
const parseUserAgent = (userAgent: string | null) => {
  if (!userAgent) return { browser: 'Unknown', device: 'Unknown', os: 'Unknown' };

  let browser = 'Unknown';
  let device = 'Desktop';
  let os = 'Unknown';

  // Browser detection
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';

  // Device detection
  if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
    device = 'Mobile';
  } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    device = 'Tablet';
  }

  // OS detection
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iOS') || userAgent.includes('iPhone')) os = 'iOS';

  return { browser, device, os };
};

export function AuditLogRow({ log, isExpanded, onToggleExpand }: AuditLogRowProps) {
  const { browser, device, os } = parseUserAgent(log.user_agent);

  const renderDiff = (oldValues: any, newValues: any) => {
    if (!oldValues && !newValues) return null;

    try {
      const oldObj = typeof oldValues === 'string' ? JSON.parse(oldValues) : oldValues;
      const newObj = typeof newValues === 'string' ? JSON.parse(newValues) : newValues;

      const changes: Array<{ key: string; old: any; new: any }> = [];

      // Find changed fields
      const allKeys = new Set([
        ...Object.keys(oldObj || {}),
        ...Object.keys(newObj || {}),
      ]);

      allKeys.forEach((key) => {
        const oldVal = oldObj?.[key];
        const newVal = newObj?.[key];

        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          changes.push({ key, old: oldVal, new: newVal });
        }
      });

      if (changes.length === 0) return null;

      return (
        <div className="space-y-2">
          <div className="text-sm font-medium">Changes:</div>
          <div className="space-y-1 text-xs">
            {changes.map((change) => (
              <div key={change.key} className="flex items-start gap-2 font-mono">
                <span className="font-semibold min-w-[120px]">{change.key}:</span>
                <div className="flex-1">
                  {change.old !== undefined && (
                    <div className="text-red-600 line-through">
                      {JSON.stringify(change.old)}
                    </div>
                  )}
                  {change.new !== undefined && (
                    <div className="text-green-600">
                      {JSON.stringify(change.new)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    } catch (error) {
      return (
        <div className="text-xs text-muted-foreground">
          Unable to parse change details
        </div>
      );
    }
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand} asChild>
      <>
        <TableRow className="cursor-pointer hover:bg-muted/50">
          <TableCell>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={log.user?.avatar_url || undefined} />
                <AvatarFallback>
                  {log.user?.name?.[0]?.toUpperCase() || log.user?.email?.[0]?.toUpperCase() || 'S'}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {log.user?.name || 'System'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {log.user?.email || 'system@internal'}
                </span>
              </div>
            </div>
          </TableCell>
          <TableCell>
            <Badge variant={getActionBadgeVariant(log.action)}>
              {log.action}
            </Badge>
          </TableCell>
          <TableCell>
            <div className="flex flex-col">
              <span className="text-sm font-medium capitalize">
                {log.resource_type}
              </span>
              {log.resource_id && (
                <span className="text-xs text-muted-foreground font-mono">
                  {log.resource_id.substring(0, 8)}...
                </span>
              )}
            </div>
          </TableCell>
          <TableCell>
            <span className="text-sm font-mono">
              {log.ip_address || 'N/A'}
            </span>
          </TableCell>
          <TableCell>
            <div className="flex flex-col">
              <span className="text-sm" title={format(new Date(log.created_at), 'PPpp')}>
                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(log.created_at), 'MMM d, h:mm a')}
              </span>
            </div>
          </TableCell>
        </TableRow>

        {/* Expanded Details */}
        <CollapsibleContent asChild>
          <TableRow>
            <TableCell colSpan={6} className="bg-muted/30 border-t">
              <div className="py-4 px-2 space-y-4">
                {/* Request Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      Device Information
                    </div>
                    <div className="text-xs space-y-1 ml-6">
                      <div>
                        <span className="text-muted-foreground">Browser:</span>{' '}
                        <span className="font-medium">{browser}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Device:</span>{' '}
                        <span className="font-medium">{device}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">OS:</span>{' '}
                        <span className="font-medium">{os}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Request Details</div>
                    <div className="text-xs space-y-1">
                      <div>
                        <span className="text-muted-foreground">Request ID:</span>{' '}
                        <span className="font-mono text-[10px]">
                          {log.request_id || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Timestamp:</span>{' '}
                        <span className="font-medium">
                          {format(new Date(log.created_at), 'PPpp')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Value Changes */}
                {(log.old_values || log.new_values) && (
                  <div className="border-t pt-4">
                    {renderDiff(log.old_values, log.new_values)}
                  </div>
                )}

                {/* Metadata */}
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <div className="border-t pt-4">
                    <div className="text-sm font-semibold mb-2">Additional Metadata</div>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Full User Agent */}
                {log.user_agent && (
                  <div className="border-t pt-4">
                    <div className="text-sm font-semibold mb-2">User Agent</div>
                    <div className="text-xs font-mono bg-muted p-2 rounded break-all">
                      {log.user_agent}
                    </div>
                  </div>
                )}
              </div>
            </TableCell>
          </TableRow>
        </CollapsibleContent>
      </>
    </Collapsible>
  );
}
