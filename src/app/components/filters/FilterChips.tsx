'use client';

import * as React from 'react';
import { X } from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';
import type { FilterState } from './AdvancedFilters';

interface FilterChipsProps {
  filters: FilterState;
  onRemoveFilter: (key: keyof FilterState, value?: string) => void;
  onClearAll: () => void;
  className?: string;
}

/**
 * FilterChips Component
 * Display active filters as removable chips
 *
 * Features:
 * - Show all active filters
 * - Remove individual filters
 * - Clear all button
 * - Semantic labels
 *
 * Usage:
 * <FilterChips
 *   filters={activeFilters}
 *   onRemoveFilter={handleRemove}
 *   onClearAll={clearFilters}
 * />
 */
export function FilterChips({
  filters,
  onRemoveFilter,
  onClearAll,
  className,
}: FilterChipsProps) {
  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

  // Content types
  filters.contentTypes.forEach((type) => {
    chips.push({
      key: `type-${type}`,
      label: `Type: ${type}`,
      onRemove: () => onRemoveFilter('contentTypes', type),
    });
  });

  // Favorites
  if (filters.favoritesOnly) {
    chips.push({
      key: 'favorites',
      label: 'Favorites only',
      onRemove: () => onRemoveFilter('favoritesOnly'),
    });
  }

  // Has transcript
  if (filters.hasTranscript !== null) {
    chips.push({
      key: 'transcript',
      label: 'Has transcript',
      onRemove: () => onRemoveFilter('hasTranscript'),
    });
  }

  // Has document
  if (filters.hasDocument !== null) {
    chips.push({
      key: 'document',
      label: 'Has document',
      onRemove: () => onRemoveFilter('hasDocument'),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <span className="text-sm text-muted-foreground">Active filters:</span>
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="gap-1 pl-2 pr-1"
        >
          <span>{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="hover:bg-black/10 rounded-full p-0.5 transition-colors"
            aria-label={`Remove ${chip.label} filter`}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-6 px-2 text-xs"
      >
        Clear all
      </Button>
    </div>
  );
}
