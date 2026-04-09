'use client';

import * as React from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { cn } from '@/lib/utils';
import TagBadge from '@/app/components/TagBadge';
import type { Tag } from '@/lib/types/database';

interface InlineTagsEditorProps {
  /**
   * Current tags
   */
  tags: Tag[];

  /**
   * Callback when tags are updated
   */
  onTagsChange: (tags: Tag[]) => void;

  /**
   * Callback to add a new tag
   */
  onAddTag: (tagName: string) => Promise<Tag>;

  /**
   * Callback to remove a tag
   */
  onRemoveTag: (tagId: string) => Promise<void>;

  /**
   * Available tags for suggestions (optional)
   */
  availableTags?: Tag[];

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Whether the editor is in read-only mode
   */
  readOnly?: boolean;
}

/**
 * InlineTagsEditor - Edit tags directly without modal
 *
 * Features:
 * - Add/remove tags inline
 * - Tag suggestions
 * - Keyboard navigation
 * - Loading states
 * - Validation
 *
 * @example
 * <InlineTagsEditor
 *   tags={tags}
 *   onTagsChange={setTags}
 *   onAddTag={async (name) => {
 *     const response = await fetch('/api/tags', {
 *       method: 'POST',
 *       body: JSON.stringify({ name }),
 *     });
 *     return response.json();
 *   }}
 *   onRemoveTag={async (id) => {
 *     await fetch(`/api/tags/${id}`, { method: 'DELETE' });
 *   }}
 * />
 */
export default function InlineTagsEditor({
  tags,
  onTagsChange,
  onAddTag,
  onRemoveTag,
  availableTags = [],
  className,
  readOnly = false,
}: InlineTagsEditorProps) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [newTagName, setNewTagName] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Filter suggestions based on input and existing tags
  const suggestions = React.useMemo(() => {
    if (!newTagName.trim()) return [];

    const existingTagNames = new Set(tags.map((t) => t.name.toLowerCase()));
    const query = newTagName.toLowerCase();

    return availableTags
      .filter((tag) => {
        const tagName = tag.name.toLowerCase();
        return !existingTagNames.has(tagName) && tagName.includes(query);
      })
      .slice(0, 5);
  }, [newTagName, tags, availableTags]);

  // Focus input when entering add mode
  React.useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  const handleStartAdding = () => {
    setIsAdding(true);
    setError(null);
  };

  const handleCancelAdding = () => {
    setIsAdding(false);
    setNewTagName('');
    setError(null);
    setShowSuggestions(false);
  };

  const handleAddTag = async (tagName: string) => {
    const trimmedName = tagName.trim();

    if (!trimmedName) {
      setError('Tag name cannot be empty');
      return;
    }

    if (trimmedName.length > 50) {
      setError('Tag name is too long (max 50 characters)');
      return;
    }

    if (tags.some((t) => t.name.toLowerCase() === trimmedName.toLowerCase())) {
      setError('Tag already exists');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newTag = await onAddTag(trimmedName);
      onTagsChange([...tags, newTag]);
      setNewTagName('');
      setShowSuggestions(false);
      // Keep input focused for adding more tags
      inputRef.current?.focus();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add tag';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await onRemoveTag(tagId);
      onTagsChange(tags.filter((t) => t.id !== tagId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove tag';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancelAdding();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag(newTagName);
    }
  };

  const handleSelectSuggestion = (tag: Tag) => {
    handleAddTag(tag.name);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Existing Tags */}
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <div key={tag.id} className="relative group">
            <TagBadge name={tag.name} color={tag.color} size="sm" />
            {!readOnly && (
              <button
                onClick={() => handleRemoveTag(tag.id)}
                disabled={isLoading}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                title={`Remove ${tag.name}`}
              >
                <X className="size-2.5" />
              </button>
            )}
          </div>
        ))}

        {/* Add Tag Button or Input */}
        {!readOnly && (
          <>
            {!isAdding ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartAdding}
                disabled={isLoading}
                className="h-6 text-xs"
              >
                <Plus className="size-3 mr-1" />
                Add Tag
              </Button>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-1">
                  <Input
                    ref={inputRef}
                    type="text"
                    value={newTagName}
                    onChange={(e) => {
                      setNewTagName(e.target.value);
                      setShowSuggestions(true);
                      setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={() => {
                      // Delay to allow suggestion clicks
                      setTimeout(() => {
                        if (!newTagName.trim()) {
                          handleCancelAdding();
                        }
                      }, 200);
                    }}
                    placeholder="Type tag name..."
                    disabled={isLoading}
                    maxLength={50}
                    className="h-6 w-32 text-xs"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleAddTag(newTagName)}
                    disabled={isLoading || !newTagName.trim()}
                    className="h-6 w-6"
                    title="Add tag (Enter)"
                  >
                    {isLoading ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Plus className="size-3" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleCancelAdding}
                    disabled={isLoading}
                    className="h-6 w-6"
                    title="Cancel (Esc)"
                  >
                    <X className="size-3" />
                  </Button>
                </div>

                {/* Tag Suggestions */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 bg-popover border rounded-md shadow-md z-10 min-w-[150px]">
                    {suggestions.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => handleSelectSuggestion(tag)}
                        className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent transition-colors flex items-center gap-2"
                      >
                        <TagBadge name={tag.name} color={tag.color} size="sm" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Empty State */}
      {tags.length === 0 && !isAdding && !readOnly && (
        <p className="text-xs text-muted-foreground italic">
          No tags yet. Click &quot;Add Tag&quot; to organize your content.
        </p>
      )}
    </div>
  );
}
