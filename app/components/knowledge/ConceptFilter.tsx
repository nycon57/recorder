'use client';

import * as React from 'react';
import { Brain, Check, X } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  CONCEPT_TYPES,
  CONCEPT_TYPE_COLORS,
  type ConceptType,
} from '@/lib/validations/knowledge';


interface ConceptFilterProps {
  selectedTypes: ConceptType[];
  onSelectionChange: (types: ConceptType[]) => void;
  className?: string;
}

/**
 * ConceptFilter - Filter by concept types
 *
 * Similar to TagFilter, allows users to filter search results
 * by concept type (tool, process, technical_term, etc.)
 */
export function ConceptFilter({
  selectedTypes,
  onSelectionChange,
  className,
}: ConceptFilterProps) {
  const [open, setOpen] = React.useState(false);

  const toggleType = (type: ConceptType) => {
    if (selectedTypes.includes(type)) {
      onSelectionChange(selectedTypes.filter((t) => t !== type));
    } else {
      onSelectionChange([...selectedTypes, type]);
    }
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  // Format type for display
  const formatType = (type: string) =>
    type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'justify-start',
              selectedTypes.length > 0 && 'border-purple-500'
            )}
          >
            <Brain className="mr-2 h-4 w-4" />
            Concepts
            {selectedTypes.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedTypes.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Filter by Concept Type</h4>
              {selectedTypes.length > 0 && (
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

            <div className="space-y-1 max-h-64 overflow-y-auto">
              {CONCEPT_TYPES.map((type) => {
                const isSelected = selectedTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                    className={cn(
                      'flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded min-h-[44px]',
                      'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                      isSelected && 'bg-primary/10'
                    )}
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={`Filter by ${formatType(type)} concepts`}
                  >
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CONCEPT_TYPE_COLORS[type] }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 text-left capitalize">
                      {formatType(type)}
                    </span>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>

            {selectedTypes.length > 0 && (
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-xs text-gray-500">
                  {selectedTypes.length} selected
                </span>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected concept types display */}
      {selectedTypes.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {selectedTypes.slice(0, 3).map((type) => (
            <Badge
              key={type}
              variant="outline"
              className="text-xs"
              style={{
                borderColor: CONCEPT_TYPE_COLORS[type],
                backgroundColor: `${CONCEPT_TYPE_COLORS[type]}20`,
              }}
            >
              {formatType(type)}
              <button
                type="button"
                onClick={() => toggleType(type)}
                className="ml-1 hover:bg-black/10 rounded p-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
                aria-label={`Remove ${formatType(type)} filter`}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
          {selectedTypes.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{selectedTypes.length - 3} more
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ConceptTypeBadges - Display selected concept type badges
 *
 * Standalone component for displaying selected types as badges
 */
interface ConceptTypeBadgesProps {
  types: ConceptType[];
  onRemove: (type: ConceptType) => void;
  className?: string;
}

export function ConceptTypeBadges({
  types,
  onRemove,
  className,
}: ConceptTypeBadgesProps) {
  if (types.length === 0) return null;

  // Format type for display
  const formatType = (type: string) =>
    type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {types.map((type) => (
        <Badge
          key={type}
          variant="secondary"
          className="gap-1 pr-1"
          style={{
            backgroundColor: `${CONCEPT_TYPE_COLORS[type]}20`,
            borderColor: CONCEPT_TYPE_COLORS[type],
          }}
        >
          <span className="capitalize">{formatType(type)}</span>
          <button
            type="button"
            onClick={() => onRemove(type)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 transition-colors"
            aria-label={`Remove ${formatType(type)} filter`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}

/**
 * Compact version for mobile or limited space
 */
export function ConceptFilterCompact({
  selectedTypes,
  onSelectionChange,
  className,
}: ConceptFilterProps) {
  // Format type for display
  const formatType = (type: string) =>
    type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={cn('h-8', className)}>
          <Brain className="h-4 w-4" />
          {selectedTypes.length > 0 && (
            <span className="ml-1">{selectedTypes.length}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">
            Filter by concept type
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {CONCEPT_TYPES.map((type) => {
              const isSelected = selectedTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      onSelectionChange(
                        selectedTypes.filter((t) => t !== type)
                      );
                    } else {
                      onSelectionChange([...selectedTypes, type]);
                    }
                  }}
                  className={cn(
                    'flex items-center gap-2 w-full px-2 py-1 text-xs rounded hover:bg-gray-50',
                    isSelected && 'bg-purple-50'
                  )}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: CONCEPT_TYPE_COLORS[type] }}
                  />
                  <span className="flex-1 text-left capitalize">
                    {formatType(type)}
                  </span>
                  {isSelected && <Check className="h-3 w-3 text-purple-500" />}
                </button>
              );
            })}
          </div>
          {selectedTypes.length > 0 && (
            <button
              type="button"
              onClick={() => onSelectionChange([])}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear all
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
