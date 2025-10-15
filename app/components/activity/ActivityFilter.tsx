'use client';

import { useState } from 'react';
import { Check, Filter, X, Calendar, User, Activity } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Badge } from '@/app/components/ui/badge';
import { Calendar as CalendarComponent } from '@/app/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { cn } from '@/lib/utils';
import type { ActivityAction } from '@/lib/types/phase8';

interface ActivityFilterProps {
  onFilterChange: (filters: FilterState) => void;
  initialFilters?: FilterState;
  className?: string;
}

interface FilterState {
  actions?: ActivityAction[];
  users?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

const actionGroups = {
  Recording: [
    'recording.created',
    'recording.updated',
    'recording.deleted',
    'recording.shared',
    'recording.favorited',
    'recording.unfavorited',
  ] as ActivityAction[],
  Collection: [
    'collection.created',
    'collection.updated',
    'collection.deleted',
    'collection.item_added',
    'collection.item_removed',
  ] as ActivityAction[],
  Tags: [
    'tag.created',
    'tag.updated',
    'tag.deleted',
    'tag.applied',
    'tag.removed',
  ] as ActivityAction[],
  Other: [
    'document.generated',
    'document.updated',
    'search.executed',
    'user.login',
  ] as ActivityAction[],
};

const actionLabels: Record<ActivityAction, string> = {
  'recording.created': 'Recording Created',
  'recording.updated': 'Recording Updated',
  'recording.deleted': 'Recording Deleted',
  'recording.shared': 'Recording Shared',
  'recording.favorited': 'Recording Favorited',
  'recording.unfavorited': 'Recording Unfavorited',
  'collection.created': 'Collection Created',
  'collection.updated': 'Collection Updated',
  'collection.deleted': 'Collection Deleted',
  'collection.item_added': 'Item Added to Collection',
  'collection.item_removed': 'Item Removed from Collection',
  'tag.created': 'Tag Created',
  'tag.updated': 'Tag Updated',
  'tag.deleted': 'Tag Deleted',
  'tag.applied': 'Tag Applied',
  'tag.removed': 'Tag Removed',
  'document.generated': 'Document Generated',
  'document.updated': 'Document Updated',
  'search.executed': 'Search Executed',
  'user.login': 'User Login',
};

export function ActivityFilter({
  onFilterChange,
  initialFilters = {},
  className,
}: ActivityFilterProps) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [isOpen, setIsOpen] = useState(false);
  const [dateRangePreset, setDateRangePreset] = useState<string>('all');

  const handleActionToggle = (action: ActivityAction) => {
    const currentActions = filters.actions || [];
    const newActions = currentActions.includes(action)
      ? currentActions.filter(a => a !== action)
      : [...currentActions, action];

    const newFilters = { ...filters, actions: newActions.length > 0 ? newActions : undefined };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleDatePresetChange = (preset: string) => {
    setDateRangePreset(preset);
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined = new Date();

    switch (preset) {
      case 'today':
        dateFrom = new Date();
        dateFrom.setHours(0, 0, 0, 0);
        break;
      case 'week':
        dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 7);
        break;
      case 'month':
        dateFrom = new Date();
        dateFrom.setMonth(dateFrom.getMonth() - 1);
        break;
      case 'all':
      default:
        dateFrom = undefined;
        dateTo = undefined;
    }

    const newFilters = { ...filters, dateFrom, dateTo };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    setFilters({});
    setDateRangePreset('all');
    onFilterChange({});
    setIsOpen(false);
  };

  const activeFilterCount =
    (filters.actions?.length || 0) +
    (filters.users?.length || 0) +
    (filters.dateFrom ? 1 : 0);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={activeFilterCount > 0 ? 'default' : 'outline'}
          size="sm"
          className={cn('gap-2', className)}
        >
          <Filter className="h-4 w-4" />
          Filter
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 px-1 min-w-[20px]">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-4" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Filter Activities</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              disabled={activeFilterCount === 0}
            >
              Clear all
            </Button>
          </div>

          {/* Date Range Filter */}
          <div className="space-y-2">
            <Label className="text-xs font-medium flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Date Range
            </Label>
            <Select value={dateRangePreset} onValueChange={handleDatePresetChange}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Type Filter */}
          <div className="space-y-2">
            <Label className="text-xs font-medium flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Action Types
            </Label>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {Object.entries(actionGroups).map(([groupName, actions]) => (
                <div key={groupName} className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">{groupName}</p>
                  <div className="space-y-1">
                    {actions.map(action => (
                      <label
                        key={action}
                        className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
                      >
                        <Checkbox
                          checked={filters.actions?.includes(action) || false}
                          onCheckedChange={() => handleActionToggle(action)}
                        />
                        <span className="flex-1">{actionLabels[action]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Filters Display */}
          {activeFilterCount > 0 && (
            <div className="pt-2 border-t">
              <div className="flex flex-wrap gap-1">
                {filters.actions?.map(action => (
                  <Badge
                    key={action}
                    variant="secondary"
                    className="text-xs px-2 py-0.5"
                  >
                    {actionLabels[action]}
                    <button
                      onClick={() => handleActionToggle(action)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {filters.dateFrom && (
                  <Badge variant="secondary" className="text-xs px-2 py-0.5">
                    {dateRangePreset !== 'all' && `Last ${dateRangePreset}`}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}