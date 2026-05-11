'use client';

import * as React from 'react';
import { Plus, X } from 'lucide-react';

import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import type { Tag } from '@/lib/types/database';

import TagBadge from './TagBadge';

interface TagInputProps {
  recordingId: string;
  tags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
}

export default function TagInput({
  recordingId,
  tags,
  onTagsChange,
}: TagInputProps) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [newTagName, setNewTagName] = React.useState('');
  const [isTagSavePending, setIsTagSavePending] = React.useState(false);

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;

    setIsTagSavePending(true);
    try {
      const response = await fetch(`/api/recordings/${recordingId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to add tag');
      }

      const { tag } = await response.json();
      onTagsChange([...tags, tag]);
      setNewTagName('');
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding tag:', error);
    } finally {
      setIsTagSavePending(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    setIsTagSavePending(true);
    try {
      const response = await fetch(
        `/api/recordings/${recordingId}/tags/${tagId}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        throw new Error('Failed to remove tag');
      }

      onTagsChange(tags.filter((t) => t.id !== tagId));
    } catch (error) {
      console.error('Error removing tag:', error);
    } finally {
      setIsTagSavePending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewTagName('');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <TagBadge
            key={tag.id}
            name={tag.name}
            color={tag.color}
            onRemove={() => handleRemoveTag(tag.id)}
          />
        ))}

        {isAdding ? (
          <div className="flex items-center gap-1">
            <Input
              type="text"
              placeholder="Tag name..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (!newTagName.trim()) {
                  setIsAdding(false);
                }
              }}
              className="h-7 w-32 text-xs"
              disabled={isTagSavePending}
            />
            <Button
              size="sm"
              variant="ghost"
              className="size-7 p-0"
              onClick={handleAddTag}
              disabled={!newTagName.trim() || isTagSavePending}
            >
              <Plus className="size-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="size-7 p-0"
              onClick={() => {
                setIsAdding(false);
                setNewTagName('');
              }}
              disabled={isTagSavePending}
            >
              <X className="size-3" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => setIsAdding(true)}
            disabled={isTagSavePending}
          >
            <Plus className="size-3 mr-1" />
            Add Tag
          </Button>
        )}
      </div>
    </div>
  );
}
