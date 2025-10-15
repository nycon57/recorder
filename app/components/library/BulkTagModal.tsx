"use client"

import React, { useState, useEffect } from 'react';
import { Tag, X, Loader2 } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
import { TagInput } from '@/app/components/tags/TagInput';
import { toast } from 'sonner';

interface TagData {
  id: string;
  name: string;
  color: string;
}

interface BulkTagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  selectedIds: string[];
}

/**
 * BulkTagModal Component
 * Modal for assigning tags to multiple items at once
 *
 * Features:
 * - Add multiple tags via TagInput component
 * - Create new tags on the fly
 * - Tag color selection
 * - API integration for tag management
 * - Progress indicator
 *
 * Usage:
 * <BulkTagModal
 *   open={showTagModal}
 *   onOpenChange={setShowTagModal}
 *   selectedCount={3}
 *   selectedIds={['id1', 'id2', 'id3']}
 * />
 */
export function BulkTagModal({
  open,
  onOpenChange,
  selectedCount,
  selectedIds,
}: BulkTagModalProps) {
  const [selectedTags, setSelectedTags] = useState<TagData[]>([]);
  const [availableTags, setAvailableTags] = useState<TagData[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load available tags when modal opens
  useEffect(() => {
    if (open) {
      loadAvailableTags();
    } else {
      // Reset state when modal closes
      setSelectedTags([]);
    }
  }, [open]);

  const loadAvailableTags = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/tags?limit=100');
      if (!response.ok) throw new Error('Failed to load tags');

      const data = await response.json();
      setAvailableTags(data.data.tags || []);
    } catch (error) {
      console.error('Error loading tags:', error);
      toast.error('Failed to load tags');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTag = async (name: string, color: string): Promise<TagData | null> => {
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create tag');
      }

      const data = await response.json();
      const newTag = data.data;

      // Add to available tags
      setAvailableTags(prev => [...prev, newTag]);

      return newTag;
    } catch (error: any) {
      toast.error(error.message || 'Failed to create tag');
      return null;
    }
  };

  const handleAssign = async () => {
    if (selectedTags.length === 0) {
      toast.error('Please select at least one tag');
      return;
    }

    try {
      setIsAssigning(true);

      // Assign tags to each selected item
      const tagIds = selectedTags.map(t => t.id);
      const promises = selectedIds.map(itemId =>
        fetch(`/api/library/${itemId}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagIds }),
        })
      );

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;

      if (successCount > 0) {
        toast.success(
          `Tags assigned to ${successCount} ${successCount === 1 ? 'item' : 'items'}` +
          (failCount > 0 ? `, ${failCount} failed` : '')
        );
      }

      if (failCount > 0 && successCount === 0) {
        toast.error('Failed to assign tags to items');
      }

      // Close modal on success
      if (successCount > 0) {
        onOpenChange(false);
      }
    } catch (err) {
      console.error('Tag assignment failed:', err);
      toast.error('Failed to assign tags');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Add Tags
          </DialogTitle>
          <DialogDescription>
            Assign tags to {selectedCount} {selectedCount === 1 ? 'item' : 'items'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Tag input */}
          <div className="space-y-2">
            <Label>Select or create tags</Label>
            {isLoading ? (
              <div className="flex items-center justify-center h-[42px]">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <TagInput
                value={selectedTags}
                onChange={setSelectedTags}
                availableTags={availableTags}
                placeholder="Search or create tags..."
                allowCreate={true}
                disabled={isAssigning}
                onCreateTag={handleCreateTag}
              />
            )}
          </div>

          {/* Selected tags count */}
          {selectedTags.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isAssigning}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={isAssigning || selectedTags.length === 0}
          >
            {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isAssigning ? 'Assigning...' : `Assign Tags`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
