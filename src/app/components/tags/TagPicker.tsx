'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Plus, Search, X } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/app/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/lib/utils';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagPickerProps {
  tags: Tag[];
  selectedTags: string[];
  onSelectionChange: (tagIds: string[]) => void;
  onCreateTag?: (name: string, color: string) => Promise<Tag>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxTags?: number;
}

/**
 * TagPicker Component
 * Multi-select dropdown for picking tags with search and create functionality
 *
 * Features:
 * - Multi-select with checkmarks
 * - Search/filter tags
 * - Create new tags inline
 * - Shows selected count in trigger
 * - Keyboard navigation support
 * - Maximum tag limit
 * - Accessible with proper ARIA labels
 *
 * Usage:
 * <TagPicker
 *   tags={availableTags}
 *   selectedTags={selected}
 *   onSelectionChange={setSelected}
 *   onCreateTag={handleCreate}
 * />
 */
export function TagPicker({
  tags,
  selectedTags,
  onSelectionChange,
  onCreateTag,
  placeholder = 'Select tags...',
  disabled = false,
  className,
  maxTags,
}: TagPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);
  const [newTagName, setNewTagName] = React.useState('');

  const selectedTagsData = tags.filter((tag) => selectedTags.includes(tag.id));

  const handleToggle = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onSelectionChange(selectedTags.filter((id) => id !== tagId));
    } else {
      if (maxTags && selectedTags.length >= maxTags) {
        return; // Don't add if limit reached
      }
      onSelectionChange([...selectedTags, tagId]);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !onCreateTag) return;

    try {
      // Generate a random color for new tag
      const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const newTag = await onCreateTag(newTagName.trim(), randomColor);
      onSelectionChange([...selectedTags, newTag.id]);
      setNewTagName('');
      setIsCreating(false);
      setSearch('');
    } catch (error) {
      console.error('Failed to create tag:', error);
      // Add user-facing error feedback
      // e.g., setError('Failed to create tag. Please try again.');
      // or use a toast notification
    }
  };

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(search.toLowerCase())
  );

  const canAddMore = !maxTags || selectedTags.length < maxTags;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between', className)}
          disabled={disabled}
        >
          <span className="flex items-center gap-2 flex-1 min-w-0">
            {selectedTags.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <span className="truncate">
                  {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
                </span>
                {selectedTagsData.slice(0, 2).map((tag) => (
                  <div
                    key={tag.id}
                    className="size-3 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                ))}
              </div>
            )}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search tags..."
            value={search}
            onValueChange={setSearch}
            className="h-9"
          />
          <CommandList>
            <CommandEmpty>
              {onCreateTag && search && (
                <div className="p-2 text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    No tags found
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNewTagName(search);
                      setIsCreating(true);
                    }}
                    className="gap-2"
                  >
                    <Plus className="size-4" />
                    Create &quot;{search}&quot;
                  </Button>
                </div>
              )}
              {!onCreateTag && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No tags found
                </div>
              )}
            </CommandEmpty>

            {filteredTags.length > 0 && (
              <CommandGroup>
                {filteredTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag.id);
                  const isDisabled = !isSelected && !canAddMore;

                  return (
                    <CommandItem
                      key={tag.id}
                      value={tag.name}
                      onSelect={() => !isDisabled && handleToggle(tag.id)}
                      disabled={isDisabled}
                      className={cn(
                        'cursor-pointer',
                        isDisabled && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <div
                          className="size-4 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1">{tag.name}</span>
                      </div>
                      <Check
                        className={cn(
                          'size-4 ml-auto',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {onCreateTag && !isCreating && search && filteredTags.length === 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setNewTagName(search);
                      setIsCreating(true);
                    }}
                    className="cursor-pointer"
                  >
                    <Plus className="size-4 mr-2" />
                    <span>Create &quot;{search}&quot;</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>

          {selectedTags.length > 0 && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelectionChange([])}
                className="w-full justify-start text-muted-foreground hover:text-foreground"
              >
                <X className="size-4 mr-2" />
                Clear all
              </Button>
            </div>
          )}

          {maxTags && (
            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
              {selectedTags.length} / {maxTags} tags selected
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * TagPickerInline Component
 * Inline tag picker that shows selected tags as badges
 *
 * Usage:
 * <TagPickerInline
 *   tags={tags}
 *   selectedTags={selected}
 *   onSelectionChange={setSelected}
 * />
 */
interface TagPickerInlineProps extends TagPickerProps {
  showBadges?: boolean;
}

export function TagPickerInline({
  tags,
  selectedTags,
  onSelectionChange,
  onCreateTag,
  showBadges = true,
  className,
  ...props
}: TagPickerInlineProps) {
  const selectedTagsData = tags.filter((tag) => selectedTags.includes(tag.id));

  const handleRemove = (tagId: string) => {
    onSelectionChange(selectedTags.filter((id) => id !== tagId));
  };

  return (
    <div className={cn('space-y-2', className)}>
      <TagPicker
        tags={tags}
        selectedTags={selectedTags}
        onSelectionChange={onSelectionChange}
        onCreateTag={onCreateTag}
        {...props}
      />

      {showBadges && selectedTagsData.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTagsData.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="gap-1 pl-2 pr-1"
              style={{
                backgroundColor: `${tag.color}20`,
                borderColor: tag.color,
                color: tag.color,
              }}
            >
              <span>{tag.name}</span>
              <button
                type="button"
                onClick={() => handleRemove(tag.id)}
                className="hover:bg-black/10 rounded-full p-0.5 transition-colors"
                aria-label={`Remove ${tag.name} tag`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
