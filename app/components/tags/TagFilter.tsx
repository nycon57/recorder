'use client';

import React, { useState, useEffect } from 'react';
import { Filter, X, Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import { cn } from '@/lib/utils';

interface Tag {
  id: string;
  name: string;
  color: string;
  usage_count?: number;
}

interface TagFilterProps {
  tags: Tag[];
  selectedTags: string[];
  onSelectionChange: (tagIds: string[]) => void;
  filterMode: 'and' | 'or';
  onFilterModeChange: (mode: 'and' | 'or') => void;
  showCounts?: boolean;
  className?: string;
}

/**
 * TagFilter - Multi-select tag filter with AND/OR logic
 */
export function TagFilter({
  tags,
  selectedTags,
  onSelectionChange,
  filterMode,
  onFilterModeChange,
  showCounts = true,
  className,
}: TagFilterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Filter tags based on search
  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTagToggle = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onSelectionChange(selectedTags.filter((id) => id !== tagId));
    } else {
      onSelectionChange([...selectedTags, tagId]);
    }
  };

  const handleClearAll = () => {
    onSelectionChange([]);
    setSearchQuery('');
  };

  const selectedTagsData = tags.filter((tag) => selectedTags.includes(tag.id));

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'justify-start',
              selectedTags.length > 0 && 'border-blue-500'
            )}
          >
            <Filter className="mr-2 h-4 w-4" />
            Tags
            {selectedTags.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedTags.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-2">Filter by Tags</h4>
              <Input
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8"
              />
            </div>

            {selectedTags.length > 1 && (
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">Filter Mode</Label>
                <RadioGroup value={filterMode} onValueChange={onFilterModeChange as any}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="or" id="or" />
                    <Label htmlFor="or" className="text-sm font-normal cursor-pointer">
                      Any tag (OR)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="and" id="and" />
                    <Label htmlFor="and" className="text-sm font-normal cursor-pointer">
                      All tags (AND)
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            <div className="space-y-1 max-h-64 overflow-y-auto">
              {filteredTags.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No tags found
                </p>
              ) : (
                filteredTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleTagToggle(tag.id)}
                      className={cn(
                        'flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-gray-50',
                        isSelected && 'bg-blue-50'
                      )}
                    >
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 text-left truncate">{tag.name}</span>
                      {showCounts && tag.usage_count !== undefined && (
                        <span className="text-xs text-gray-400">
                          {tag.usage_count}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {selectedTags.length > 0 && (
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-xs text-gray-500">
                  {selectedTags.length} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-7 text-xs"
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected tags display */}
      {selectedTags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {selectedTagsData.slice(0, 3).map((tag) => (
            <Badge
              key={tag.id}
              variant="outline"
              className="text-xs"
              style={{
                borderColor: tag.color,
                backgroundColor: `${tag.color}20`,
              }}
            >
              {tag.name}
              <button
                type="button"
                onClick={() => handleTagToggle(tag.id)}
                className="ml-1 hover:bg-black/10 rounded p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {selectedTags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{selectedTags.length - 3} more
            </Badge>
          )}
          {filterMode === 'and' && selectedTags.length > 1 && (
            <span className="text-xs text-gray-500 ml-1">(ALL)</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for mobile or limited space
 */
export function TagFilterCompact({
  tags,
  selectedTags,
  onSelectionChange,
  className,
}: Omit<TagFilterProps, 'filterMode' | 'onFilterModeChange'>) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-8', className)}
        >
          <Filter className="h-4 w-4" />
          {selectedTags.length > 0 && (
            <span className="ml-1">{selectedTags.length}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">Filter by tags</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {tags.map((tag) => {
              const isSelected = selectedTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      onSelectionChange(
                        selectedTags.filter((id) => id !== tag.id)
                      );
                    } else {
                      onSelectionChange([...selectedTags, tag.id]);
                    }
                  }}
                  className={cn(
                    'flex items-center gap-2 w-full px-2 py-1 text-xs rounded hover:bg-gray-50',
                    isSelected && 'bg-blue-50'
                  )}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 text-left">{tag.name}</span>
                  {isSelected && <Check className="h-3 w-3 text-blue-500" />}
                </button>
              );
            })}
          </div>
          {selectedTags.length > 0 && (
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