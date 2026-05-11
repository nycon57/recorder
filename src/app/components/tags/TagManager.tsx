'use client';

import React, { useReducer } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Tag as TagIcon,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { cn } from '@/lib/utils';
import { TAG_COLORS } from '@/lib/validations/tags';
import { formatStableDate } from '@/lib/utils/formatting';

interface Tag {
  id: string;
  name: string;
  color: string;
  usage_count?: number;
  created_at: string;
  updated_at: string;
}

interface TagManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * TagManager - Modal for managing organization tags
 */
export function TagManager(
  props: Parameters<typeof useTagManagerImplementation>[0],
) {
  return useTagManagerImplementation(props);
}

function useTagManagerImplementation({ open, onOpenChange }: TagManagerProps) {
  const queryClient = useQueryClient();
  const tagQueryKey = ['tags', 'manager'];
  const { data: tags = [], isLoading } = useQuery<Tag[]>({
    queryKey: tagQueryKey,
    enabled: open,
    queryFn: async () => {
      const response = await fetch(
        '/api/tags?includeUsageCount=true&limit=100',
      );
      if (!response.ok) throw new Error('Failed to fetch tags');

      const data = await response.json();
      return data.data.tags;
    },
  });
  const [state, dispatch] = useReducer(
    (
      current: {
        searchQuery: string;
        editingTag: Tag | null;
        isCreating: boolean;
        newTagName: string;
        selectedColor: string;
        isSaving: boolean;
      },
      patch: Partial<{
        searchQuery: string;
        editingTag: Tag | null;
        isCreating: boolean;
        newTagName: string;
        selectedColor: string;
        isSaving: boolean;
      }>,
    ) => ({ ...current, ...patch }),
    {
      searchQuery: '',
      editingTag: null,
      isCreating: false,
      newTagName: '',
      selectedColor: TAG_COLORS[0],
      isSaving: false,
    },
  );
  const {
    searchQuery,
    editingTag,
    isCreating,
    newTagName,
    selectedColor,
    isSaving,
  } = state;

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Please enter a tag name');
      return;
    }

    dispatch({ isSaving: true });
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTagName.trim(),
          color: selectedColor,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create tag');
      }

      const data = await response.json();
      queryClient.setQueryData<Tag[]>(tagQueryKey, (prev = []) => [
        ...prev,
        { ...data.data, usage_count: 0 },
      ]);
      dispatch({ newTagName: '', isCreating: false });
      toast.success('Tag created successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create tag');
    } finally {
      dispatch({ isSaving: false });
    }
  };

  const handleUpdateTag = async () => {
    if (!editingTag) return;

    dispatch({ isSaving: true });
    try {
      const response = await fetch(`/api/tags/${editingTag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingTag.name,
          color: editingTag.color,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update tag');
      }

      const data = await response.json();
      queryClient.setQueryData<Tag[]>(tagQueryKey, (prev = []) =>
        prev.map((tag) =>
          tag.id === editingTag.id
            ? { ...data.data, usage_count: tag.usage_count }
            : tag,
        ),
      );
      dispatch({ editingTag: null });
      toast.success('Tag updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update tag');
    } finally {
      dispatch({ isSaving: false });
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this tag? This will remove it from all items.',
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/tags/${tagId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete tag');
      }

      queryClient.setQueryData<Tag[]>(tagQueryKey, (prev = []) =>
        prev.filter((tag) => tag.id !== tagId),
      );
      toast.success('Tag deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete tag');
    }
  };

  // Filter tags based on search
  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TagIcon className="size-5" />
            Manage Tags
          </DialogTitle>
          <DialogDescription>
            Create and manage tags to organize your content
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search and Create */}
          <div className="space-y-4 pb-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search tags..."
                  value={searchQuery}
                  onChange={(e) => dispatch({ searchQuery: e.target.value })}
                  className="pl-9"
                />
              </div>
              <Button
                onClick={() => dispatch({ isCreating: true })}
                disabled={isCreating}
              >
                <Plus className="size-4 mr-2" />
                New Tag
              </Button>
            </div>

            {/* Create new tag form */}
            {isCreating && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/50">
                <div className="space-y-2">
                  <Label htmlFor="new-tag-name">Tag Name</Label>
                  <Input
                    id="new-tag-name"
                    placeholder="Enter tag name..."
                    value={newTagName}
                    onChange={(e) => dispatch({ newTagName: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateTag();
                      } else if (e.key === 'Escape') {
                        dispatch({ isCreating: false, newTagName: '' });
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {TAG_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => dispatch({ selectedColor: color })}
                        className={cn(
                          'size-8 rounded-full transition-all',
                          selectedColor === color &&
                            'ring-2 ring-offset-2 ring-accent',
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleCreateTag}
                    disabled={isSaving || !newTagName.trim()}
                  >
                    {isSaving && (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    )}
                    Create
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      dispatch({ isCreating: false, newTagName: '' });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Tags table */}
          <div className="flex-1 overflow-auto border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <TagIcon className="size-12 mb-2 opacity-20" />
                <p>No tags found</p>
                {searchQuery && (
                  <p className="text-sm">Try adjusting your search</p>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Color</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTags.map((tag) => (
                    <TableRow key={tag.id}>
                      <TableCell>
                        <div
                          className="size-6 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                      </TableCell>
                      <TableCell>
                        {editingTag?.id === tag.id ? (
                          <Input
                            value={editingTag.name}
                            onChange={(e) =>
                              dispatch({
                                editingTag: {
                                  ...editingTag,
                                  name: e.target.value,
                                },
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateTag();
                              } else if (e.key === 'Escape') {
                                dispatch({ editingTag: null });
                              }
                            }}
                            className="h-8"
                          />
                        ) : (
                          <span className="font-medium">{tag.name}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {tag.usage_count !== undefined && (
                          <span className="text-sm text-muted-foreground">
                            {tag.usage_count}{' '}
                            {tag.usage_count === 1 ? 'item' : 'items'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatStableDate(tag.created_at)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {editingTag?.id === tag.id ? (
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleUpdateTag}
                              disabled={isSaving}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => dispatch({ editingTag: null })}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => dispatch({ editingTag: tag })}
                            >
                              <Edit2 className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteTag(tag.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
