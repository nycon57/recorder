'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ChevronDown, Check, Plus } from 'lucide-react';
import debounce from 'lodash/debounce';

import { cn } from '@/lib/utils';
import { TAG_COLORS, getDefaultTagColor } from '@/lib/validations/tags';
import { useToast } from '@/app/components/ui/use-toast';

import { TagBadge } from './TagBadge';


interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagInputProps {
  value: Tag[];
  onChange: (tags: Tag[]) => void;
  availableTags?: Tag[];
  placeholder?: string;
  maxTags?: number;
  allowCreate?: boolean;
  disabled?: boolean;
  className?: string;
  onCreateTag?: (name: string, color: string) => Promise<Tag | null>;
  onLoadTags?: (search: string) => Promise<Tag[]>;
}

/**
 * TagInput - Multi-select tag input with autocomplete and create functionality
 */
export function TagInput({
  value = [],
  onChange,
  availableTags = [],
  placeholder = 'Add tags...',
  maxTags,
  allowCreate = true,
  disabled = false,
  className,
  onCreateTag,
  onLoadTags,
}: TagInputProps) {
  const { toast } = useToast();
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search function
  const debouncedLoadTags = useCallback(
    debounce(async (search: string) => {
      if (onLoadTags) {
        try {
          const tags = await onLoadTags(search);
          setSuggestions(tags);
        } catch (error) {
          console.error('Error loading tags:', error);
        }
      }
    }, 300),
    [onLoadTags]
  );

  // Filter suggestions based on input
  useEffect(() => {
    // Ensure availableTags is always an array
    const tags = Array.isArray(availableTags) ? availableTags : [];

    if (inputValue.trim()) {
      if (onLoadTags) {
        debouncedLoadTags(inputValue);
      } else {
        const filtered = tags.filter(
          (tag) =>
            tag.name.toLowerCase().includes(inputValue.toLowerCase()) &&
            !value.some((selected) => selected.id === tag.id)
        );
        setSuggestions(filtered);
      }
    } else {
      setSuggestions(
        tags.filter(
          (tag) => !value.some((selected) => selected.id === tag.id)
        )
      );
    }
  }, [inputValue, availableTags, value, onLoadTags, debouncedLoadTags]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTag = (tag: Tag) => {
    if (maxTags && value.length >= maxTags) {
      return;
    }

    if (!value.some((t) => t.id === tag.id)) {
      onChange([...value, tag]);
    }

    setInputValue('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleRemoveTag = (tagId: string) => {
    onChange(value.filter((t) => t.id !== tagId));
  };

  const handleCreateTag = async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || !allowCreate) return;

    // Check if tag already exists in selected tags
    if (value.some((t) => t.name.toLowerCase() === trimmedInput.toLowerCase())) {
      setInputValue('');
      return;
    }

    setIsCreating(true);

    try {
      let newTag: Tag | null = null;

      if (onCreateTag) {
        // Use custom create function
        newTag = await onCreateTag(trimmedInput, getDefaultTagColor());
      } else {
        // Create a temporary tag (for client-side only)
        newTag = {
          id: `temp_${Date.now()}`,
          name: trimmedInput,
          color: getDefaultTagColor(),
        };
      }

      if (newTag) {
        handleAddTag(newTag);
      }
    } catch (error) {
      console.error('Error creating tag:', error);
      toast({
        title: 'Failed to create tag',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        // Select highlighted suggestion
        handleAddTag(suggestions[highlightedIndex]);
      } else if (
        inputValue.trim() &&
        allowCreate &&
        !suggestions.some(
          (s) => s.name.toLowerCase() === inputValue.trim().toLowerCase()
        )
      ) {
        // Create new tag if no exact match
        handleCreateTag();
      } else if (suggestions.length === 1) {
        // Auto-select if only one suggestion
        handleAddTag(suggestions[0]);
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // Remove last tag on backspace when input is empty
      handleRemoveTag(value[value.length - 1].id);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    }
  };

  const showCreateOption =
    allowCreate &&
    inputValue.trim() &&
    !suggestions.some(
      (s) => s.name.toLowerCase() === inputValue.trim().toLowerCase()
    );

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'flex flex-wrap gap-1.5 min-h-[42px] p-2 border rounded-md bg-background',
          disabled && 'bg-muted cursor-not-allowed',
          isOpen && 'ring-2 ring-primary ring-offset-0'
        )}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <TagBadge
            key={tag.id}
            name={tag.name}
            color={tag.color}
            size="sm"
            removable={!disabled}
            onRemove={() => handleRemoveTag(tag.id)}
          />
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => !disabled && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled || (maxTags ? value.length >= maxTags : false)}
          placeholder={value.length === 0 ? placeholder : ''}
          className={cn(
            'flex-1 min-w-[120px] outline-none bg-transparent text-sm',
            disabled && 'cursor-not-allowed'
          )}
        />
        {value.length > 0 && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            className="ml-auto p-1 hover:bg-accent rounded"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (suggestions.length > 0 || showCreateOption) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 max-h-60 overflow-auto bg-popover border rounded-md shadow-lg"
        >
          {showCreateOption && (
            <button
              type="button"
              onClick={handleCreateTag}
              disabled={isCreating}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-accent',
                highlightedIndex === -1 && 'bg-accent'
              )}
            >
              <Plus className="h-4 w-4 text-muted-foreground" />
              <span>
                Create "<strong>{inputValue.trim()}</strong>"
              </span>
              {isCreating && (
                <span className="ml-auto text-xs text-muted-foreground">Creating...</span>
              )}
            </button>
          )}

          {suggestions.map((tag, index) => {
            const isSelected = value.some((t) => t.id === tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => !isSelected && handleAddTag(tag)}
                disabled={isSelected}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2 text-sm text-left',
                  isSelected
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-accent',
                  highlightedIndex === index && 'bg-accent'
                )}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1">{tag.name}</span>
                {isSelected && <Check className="h-4 w-4 text-green-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}