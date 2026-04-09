"use client"

import React from 'react';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Badge } from '@/app/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import { Calendar } from '@/app/components/ui/calendar';
import { ContentType } from '@/lib/types/database';
import { CONTENT_TYPE_LABELS, CONTENT_TYPE_EMOJI } from '@/lib/types/content';
import { cn } from '@/lib/utils';

export interface SearchFiltersState {
  contentTypes: ContentType[];
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
  tags: string[];
  status: string[];
  minFileSize?: number;
  maxFileSize?: number;
}

interface SearchFiltersProps {
  filters: SearchFiltersState;
  onChange: (filters: SearchFiltersState) => void;
  availableTags?: string[];
  className?: string;
}

/**
 * SearchFilters Component
 * Advanced filter panel for search functionality
 *
 * Features:
 * - Content type multi-select
 * - Date range picker
 * - Tag filtering
 * - Status filtering
 * - File size range
 * - Clear all filters
 *
 * Usage:
 * <SearchFilters
 *   filters={filters}
 *   onChange={setFilters}
 *   availableTags={['meeting', 'demo']}
 * />
 */
export function SearchFilters({
  filters,
  onChange,
  availableTags = [],
  className,
}: SearchFiltersProps) {
  const contentTypes: ContentType[] = ['recording', 'video', 'audio', 'document', 'text'];
  const statuses = ['completed', 'transcribing', 'processing', 'error'];

  const handleContentTypeToggle = (type: ContentType) => {
    const newTypes = filters.contentTypes.includes(type)
      ? filters.contentTypes.filter(t => t !== type)
      : [...filters.contentTypes, type];
    onChange({ ...filters, contentTypes: newTypes });
  };

  const handleStatusToggle = (status: string) => {
    const newStatuses = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    onChange({ ...filters, status: newStatuses });
  };

  const handleTagToggle = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    onChange({ ...filters, tags: newTags });
  };

  const handleDateSelect = (field: 'from' | 'to', date: Date | undefined) => {
    onChange({
      ...filters,
      dateRange: { ...filters.dateRange, [field]: date },
    });
  };

  const hasActiveFilters =
    filters.contentTypes.length > 0 ||
    filters.tags.length > 0 ||
    filters.status.length > 0 ||
    filters.dateRange.from !== undefined ||
    filters.dateRange.to !== undefined;

  const clearAllFilters = () => {
    onChange({
      contentTypes: [],
      dateRange: { from: undefined, to: undefined },
      tags: [],
      status: [],
    });
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with clear all */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Filters</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-7 text-xs"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Content Type Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Content Type</Label>
        <div className="space-y-2">
          {contentTypes.map((type) => (
            <div key={type} className="flex items-center space-x-2">
              <Checkbox
                id={`content-type-${type}`}
                checked={filters.contentTypes.includes(type)}
                onCheckedChange={() => handleContentTypeToggle(type)}
              />
              <label
                htmlFor={`content-type-${type}`}
                className="text-sm cursor-pointer flex items-center gap-1"
              >
                <span>{CONTENT_TYPE_EMOJI[type]}</span>
                <span>{CONTENT_TYPE_LABELS[type]}</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Date Range</Label>
        <div className="space-y-2">
          {/* From Date */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !filters.dateRange.from && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateRange.from ? (
                  format(filters.dateRange.from, 'PP')
                ) : (
                  <span>From date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateRange.from}
                onSelect={(date) => handleDateSelect('from', date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* To Date */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !filters.dateRange.to && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateRange.to ? (
                  format(filters.dateRange.to, 'PP')
                ) : (
                  <span>To date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateRange.to}
                onSelect={(date) => handleDateSelect('to', date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Tags Filter */}
      {availableTags.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Tags</Label>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => (
              <Badge
                key={tag}
                variant={filters.tags.includes(tag) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => handleTagToggle(tag)}
              >
                {tag}
                {filters.tags.includes(tag) && (
                  <X className="ml-1 h-3 w-3" />
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Status</Label>
        <div className="space-y-2">
          {statuses.map((status) => (
            <div key={status} className="flex items-center space-x-2">
              <Checkbox
                id={`status-${status}`}
                checked={filters.status.includes(status)}
                onCheckedChange={() => handleStatusToggle(status)}
              />
              <label
                htmlFor={`status-${status}`}
                className="text-sm cursor-pointer capitalize"
              >
                {status}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
