'use client';

import React, { useState } from 'react';
import { Search, Filter, X, Calendar } from 'lucide-react';

import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';

import type { AuditLogFilter } from '../types';

interface AuditLogFiltersProps {
  filters: AuditLogFilter;
  onFiltersChange: (filters: AuditLogFilter) => void;
}

const ACTION_TYPES = [
  { value: 'user.created', label: 'User Created' },
  { value: 'user.updated', label: 'User Updated' },
  { value: 'user.deleted', label: 'User Deleted' },
  { value: 'role.changed', label: 'Role Changed' },
  { value: 'recording.created', label: 'Recording Created' },
  { value: 'recording.updated', label: 'Recording Updated' },
  { value: 'recording.deleted', label: 'Recording Deleted' },
  { value: 'document.created', label: 'Document Created' },
  { value: 'document.updated', label: 'Document Updated' },
  { value: 'document.deleted', label: 'Document Deleted' },
  { value: 'settings.updated', label: 'Settings Updated' },
  { value: 'session.created', label: 'Session Created' },
  { value: 'session.revoked', label: 'Session Revoked' },
];

const RESOURCE_TYPES = [
  { value: 'user', label: 'User' },
  { value: 'recording', label: 'Recording' },
  { value: 'document', label: 'Document' },
  { value: 'organization', label: 'Organization' },
  { value: 'session', label: 'Session' },
  { value: 'api_key', label: 'API Key' },
  { value: 'webhook', label: 'Webhook' },
];

export function AuditLogFilters({ filters, onFiltersChange }: AuditLogFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    // Debounce search
    const timeoutId = setTimeout(() => {
      onFiltersChange({ ...filters, search: value });
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const toggleAction = (action: string) => {
    const newActions = filters.actions.includes(action)
      ? filters.actions.filter((a) => a !== action)
      : [...filters.actions, action];
    onFiltersChange({ ...filters, actions: newActions });
  };

  const toggleResourceType = (type: string) => {
    const newTypes = filters.resourceTypes.includes(type)
      ? filters.resourceTypes.filter((t) => t !== type)
      : [...filters.resourceTypes, type];
    onFiltersChange({ ...filters, resourceTypes: newTypes });
  };

  const clearFilters = () => {
    setSearchInput('');
    onFiltersChange({
      dateRange: '7d',
      actions: [],
      userIds: [],
      resourceTypes: [],
      search: '',
    });
  };

  const hasActiveFilters =
    filters.actions.length > 0 ||
    filters.userIds.length > 0 ||
    filters.resourceTypes.length > 0 ||
    filters.search !== '';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs by user, action, resource..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Date Range */}
        <Select
          value={filters.dateRange}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              dateRange: value as AuditLogFilter['dateRange'],
            })
          }
        >
          <SelectTrigger className="w-[150px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>

        {/* Action Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Actions
              {filters.actions.length > 0 && (
                <Badge variant="secondary" className="ml-2 px-1.5 py-0">
                  {filters.actions.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-3" align="start">
            <div className="space-y-2">
              <div className="text-sm font-medium mb-2">Filter by Action</div>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {ACTION_TYPES.map((action) => (
                  <label
                    key={action.value}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-accent px-2 py-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={filters.actions.includes(action.value)}
                      onChange={() => toggleAction(action.value)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{action.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Resource Type Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Resources
              {filters.resourceTypes.length > 0 && (
                <Badge variant="secondary" className="ml-2 px-1.5 py-0">
                  {filters.resourceTypes.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-3" align="start">
            <div className="space-y-2">
              <div className="text-sm font-medium mb-2">Filter by Resource</div>
              <div className="space-y-1">
                {RESOURCE_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-accent px-2 py-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={filters.resourceTypes.includes(type.value)}
                      onChange={() => toggleResourceType(type.value)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-2" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Active filters:</span>
          {filters.actions.map((action) => (
            <Badge key={action} variant="secondary" className="gap-1">
              {ACTION_TYPES.find((a) => a.value === action)?.label || action}
              <button
                onClick={() => toggleAction(action)}
                className="ml-1 hover:bg-muted rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.resourceTypes.map((type) => (
            <Badge key={type} variant="secondary" className="gap-1">
              {RESOURCE_TYPES.find((t) => t.value === type)?.label || type}
              <button
                onClick={() => toggleResourceType(type)}
                className="ml-1 hover:bg-muted rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
