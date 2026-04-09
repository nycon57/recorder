'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  ChevronDown,
  ChevronRight,
  User,
  Globe,
  Shield,
  FileText,
  Settings,
  Activity,
  Clock,
} from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible';

import { UserAvatar } from './UserAvatar';

export interface AuditLogUser {
  name: string | null;
  email: string;
  avatar_url: string | null;
}

export interface AuditLogEntryData {
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
  user?: AuditLogUser;
}

export interface AuditLogEntryProps {
  log: AuditLogEntryData;
  expanded?: boolean;
  onToggle?: () => void;
}

export function AuditLogEntry({ log, expanded = false, onToggle }: AuditLogEntryProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    onToggle?.();
  };

  const getActionIcon = () => {
    const action = log.action.toLowerCase();
    if (action.includes('create') || action.includes('add')) return '+';
    if (action.includes('update') || action.includes('edit')) return '~';
    if (action.includes('delete') || action.includes('remove')) return '-';
    if (action.includes('login') || action.includes('auth')) return <Shield className="h-3 w-3" />;
    if (action.includes('export') || action.includes('download')) return <FileText className="h-3 w-3" />;
    return <Activity className="h-3 w-3" />;
  };

  const getActionColor = () => {
    const action = log.action.toLowerCase();
    if (action.includes('create') || action.includes('add')) return 'text-green-600 bg-green-50';
    if (action.includes('update') || action.includes('edit')) return 'text-blue-600 bg-blue-50';
    if (action.includes('delete') || action.includes('remove')) return 'text-red-600 bg-red-50';
    if (action.includes('login') || action.includes('auth')) return 'text-purple-600 bg-purple-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getResourceIcon = () => {
    const resource = log.resource_type.toLowerCase();
    if (resource.includes('user')) return <User className="h-4 w-4" />;
    if (resource.includes('recording')) return <Activity className="h-4 w-4" />;
    if (resource.includes('document')) return <FileText className="h-4 w-4" />;
    if (resource.includes('settings')) return <Settings className="h-4 w-4" />;
    return <Globe className="h-4 w-4" />;
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const renderDiff = () => {
    if (!log.old_values && !log.new_values) return null;

    const oldKeys = Object.keys(log.old_values || {});
    const newKeys = Object.keys(log.new_values || {});
    const allKeys = [...new Set([...oldKeys, ...newKeys])];

    return (
      <div className="mt-4 space-y-2">
        <div className="text-sm font-medium text-gray-700">Changes:</div>
        <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm font-mono">
          {allKeys.map((key) => {
            const oldValue = log.old_values?.[key];
            const newValue = log.new_values?.[key];
            const hasChanged = oldValue !== newValue;

            if (!hasChanged) return null;

            return (
              <div key={key} className="flex flex-col gap-1">
                <div className="font-semibold text-gray-700">{key}:</div>
                {oldValue !== undefined && (
                  <div className="flex items-start gap-2 text-red-600">
                    <span className="select-none">-</span>
                    <span className="break-all">{formatValue(oldValue)}</span>
                  </div>
                )}
                {newValue !== undefined && (
                  <div className="flex items-start gap-2 text-green-600">
                    <span className="select-none">+</span>
                    <span className="break-all">{formatValue(newValue)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="border-b last:border-b-0">
      <div
        className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer"
        onClick={handleToggle}
      >
        <Button variant="ghost" size="sm" className="p-0 h-auto">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>

        <div className={`rounded-full p-2 ${getActionColor()}`}>
          {getActionIcon()}
        </div>

        <div className="flex items-center gap-2 min-w-[200px]">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-1">
          {log.user ? (
            <>
              <UserAvatar
                name={log.user.name || 'Unknown User'}
                avatarUrl={log.user.avatar_url}
                email={log.user.email}
                size="sm"
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{log.user.name || 'Unknown User'}</span>
                <span className="text-xs text-muted-foreground">{log.user.email}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                <Settings className="h-4 w-4 text-gray-500" />
              </div>
              <span className="text-sm font-medium">System</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{log.action.replace(/_/g, ' ')}</span>
        </div>

        <div className="flex items-center gap-2">
          {getResourceIcon()}
          <Badge variant="outline">
            {log.resource_type.replace(/_/g, ' ')}
          </Badge>
        </div>

        {log.resource_id && (
          <code className="text-xs bg-muted px-2 py-1 rounded">
            {log.resource_id.substring(0, 8)}...
          </code>
        )}
      </div>

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <div className="px-4 pb-4 pl-16 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium text-gray-700 mb-1">IP Address</div>
                <div className="text-muted-foreground">
                  {log.ip_address || 'Not recorded'}
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-700 mb-1">Request ID</div>
                <div className="text-muted-foreground font-mono text-xs">
                  {log.request_id || 'Not recorded'}
                </div>
              </div>
              {log.user_agent && (
                <div className="col-span-2">
                  <div className="font-medium text-gray-700 mb-1">User Agent</div>
                  <div className="text-muted-foreground text-xs break-all">
                    {log.user_agent}
                  </div>
                </div>
              )}
            </div>

            {renderDiff()}

            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Metadata</div>
                <pre className="bg-gray-50 rounded-lg p-3 text-xs overflow-auto">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}