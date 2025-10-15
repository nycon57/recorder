'use client';

import * as React from 'react';
import { Filter, X, Calendar, FileType, Star, Clock } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Label } from '@/app/components/ui/label';
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
import { Switch } from '@/app/components/ui/switch';
import { Separator } from '@/app/components/ui/separator';
import { DateRangePicker } from './DateRangePicker';
import { cn } from '@/lib/utils';
import type { ContentType, RecordingStatus } from '@/lib/types/database';

export interface FilterState {
  contentTypes: ContentType[];
  statuses: RecordingStatus[];
  dateRange: { from: Date | null; to: Date | null };
  favoritesOnly: boolean;
  hasTranscript: boolean | null;
  hasDocument: boolean | null;
}

interface AdvancedFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  className?: string;
}

const CONTENT_TYPES: { value: ContentType; label: string; icon: React.ReactNode }[] = [
  { value: 'recording', label: 'Recordings', icon: <FileType className="size-4" /> },
  { value: 'video', label: 'Videos', icon: <FileType className="size-4" /> },
  { value: 'audio', label: 'Audio', icon: <FileType className="size-4" /> },
  { value: 'document', label: 'Documents', icon: <FileType className="size-4" /> },
  { value: 'text', label: 'Notes', icon: <FileType className="size-4" /> },
];

const STATUSES: { value: RecordingStatus; label: string }[] = [
  { value: 'completed', label: 'Completed' },
  { value: 'transcribing', label: 'Transcribing' },
  { value: 'doc_generating', label: 'Generating' },
  { value: 'uploading', label: 'Uploading' },
  { value: 'error', label: 'Error' },
];

/**
 * AdvancedFilters Component
 * Comprehensive filter panel for content
 *
 * Features:
 * - Content type filter
 * - Status filter
 * - Date range picker
 * - Favorites toggle
 * - Processing status filters
 * - Active filter count
 * - Clear all filters
 *
 * Usage:
 * <AdvancedFilters
 *   filters={currentFilters}
 *   onFiltersChange={setFilters}
 * />
 */
export function AdvancedFilters({
  filters,
  onFiltersChange,
  className,
}: AdvancedFiltersProps) {
  const [open, setOpen] = React.useState(false);

  const toggleContentType = (type: ContentType) => {
    const updated = filters.contentTypes.includes(type)
      ? filters.contentTypes.filter((t) => t !== type)
      : [...filters.contentTypes, type];
    onFiltersChange({ ...filters, contentTypes: updated });
  };

  const toggleStatus = (status: RecordingStatus) => {
    const updated = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ ...filters, statuses: updated });
  };

  const clearAll = () => {
    onFiltersChange({
      contentTypes: [],
      statuses: [],
      dateRange: { from: null, to: null },
      favoritesOnly: false,
      hasTranscript: null,
      hasDocument: null,
    });
  };

  const activeFilterCount =
    filters.contentTypes.length +
    filters.statuses.length +
    (filters.dateRange.from || filters.dateRange.to ? 1 : 0) +
    (filters.favoritesOnly ? 1 : 0) +
    (filters.hasTranscript !== null ? 1 : 0) +
    (filters.hasDocument !== null ? 1 : 0);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'justify-start',
              activeFilterCount > 0 && 'border-primary'
            )}
          >
            <Filter className="mr-2 size-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="space-y-4 p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Filters</h4>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="h-7 text-xs"
                >
                  Clear all
                </Button>
              )}
            </div>

            <Separator />

            {/* Content Type */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Content Type
              </Label>
              <div className="space-y-1">
                {CONTENT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => toggleContentType(type.value)}
                    className={cn(
                      'flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors',
                      filters.contentTypes.includes(type.value) && 'bg-accent'
                    )}
                  >
                    {type.icon}
                    <span className="flex-1 text-left">{type.label}</span>
                    {filters.contentTypes.includes(type.value) && (
                      <div className="size-2 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Status */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Status
              </Label>
              <div className="space-y-1">
                {STATUSES.map((status) => (
                  <button
                    key={status.value}
                    type="button"
                    onClick={() => toggleStatus(status.value)}
                    className={cn(
                      'flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors',
                      filters.statuses.includes(status.value) && 'bg-accent'
                    )}
                  >
                    <span className="flex-1 text-left">{status.label}</span>
                    {filters.statuses.includes(status.value) && (
                      <div className="size-2 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Date Range */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="size-3.5" />
                Date Range
              </Label>
              <DateRangePicker
                from={filters.dateRange.from}
                to={filters.dateRange.to}
                onSelect={(range) =>
                  onFiltersChange({
                    ...filters,
                    dateRange: { from: range?.from || null, to: range?.to || null },
                  })
                }
              />
            </div>

            <Separator />

            {/* Quick Filters */}
            <div className="space-y-3">
              <Label className="text-xs font-medium text-muted-foreground">
                Quick Filters
              </Label>

              <div className="flex items-center justify-between">
                <Label htmlFor="favorites" className="text-sm font-normal cursor-pointer flex items-center gap-2">
                  <Star className="size-4" />
                  Favorites only
                </Label>
                <Switch
                  id="favorites"
                  checked={filters.favoritesOnly}
                  onCheckedChange={(checked) =>
                    onFiltersChange({ ...filters, favoritesOnly: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="transcript" className="text-sm font-normal cursor-pointer">
                  Has transcript
                </Label>
                <Switch
                  id="transcript"
                  checked={filters.hasTranscript === true}
                  onCheckedChange={(checked) =>
                    onFiltersChange({
                      ...filters,
                      hasTranscript: checked ? true : null,
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="document" className="text-sm font-normal cursor-pointer">
                  Has document
                </Label>
                <Switch
                  id="document"
                  checked={filters.hasDocument === true}
                  onCheckedChange={(checked) =>
                    onFiltersChange({
                      ...filters,
                      hasDocument: checked ? true : null,
                    })
                  }
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
