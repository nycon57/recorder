'use client';

import * as React from 'react';
import { Folder, Plus, X } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import type { Collection } from './CollectionTree';

interface CollectionManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection?: Collection | null;
  parentId?: string | null;
  collections: Collection[];
  onSave: (data: { name: string; description: string; parent_id: string | null }) => Promise<void>;
  /** Set to false to prevent Dialog from trapping focus (useful when opening from inside Sheet) */
  modal?: boolean;
}

/**
 * CollectionManager Component
 * Modal for creating and editing collections
 *
 * Features:
 * - Create new collections
 * - Edit existing collections
 * - Set parent collection
 * - Add description
 * - Form validation
 * - Loading states
 *
 * Usage:
 * <CollectionManager
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   collection={editingCollection}
 *   collections={allCollections}
 *   onSave={handleSave}
 * />
 */
export function CollectionManager({
  open,
  onOpenChange,
  collection,
  parentId,
  collections,
  onSave,
  modal = true,
}: CollectionManagerProps) {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [selectedParentId, setSelectedParentId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const isEditing = !!collection;

  React.useEffect(() => {
    if (open) {
      setName(collection?.name || '');
      setDescription(collection?.description || '');
      setSelectedParentId(parentId || collection?.parent_id || null);
    }
  }, [open, collection, parentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        parent_id: selectedParentId,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save collection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get all descendant IDs of a collection to prevent circular references
  const getDescendantIds = (id: string): Set<string> => {
    const descendants = new Set<string>();
    const findDescendants = (parentId: string) => {
      collections.forEach((c) => {
        if (c.parent_id === parentId && !descendants.has(c.id)) {
          descendants.add(c.id);
          findDescendants(c.id);
        }
      });
    };
    findDescendants(id);
    return descendants;
  };

  // Filter out current collection and its descendants to prevent circular references
  const availableParents = collections.filter((c) => {
    if (!isEditing) return true;
    if (c.id === collection.id) return false;
    const descendants = getDescendantIds(collection.id);
    return !descendants.has(c.id);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={modal}>
      <DialogContent hideOverlay={!modal}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <Folder className="size-5" />
                {isEditing ? 'Edit Collection' : 'New Collection'}
              </div>
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the collection details'
                : 'Create a new collection to organize your content'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="collection-name">Name</Label>
              <Input
                id="collection-name"
                placeholder="Collection name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="collection-description">Description (optional)</Label>
              <Textarea
                id="collection-description"
                placeholder="Describe this collection..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent-collection">Parent Collection (optional)</Label>
              <Select
                value={selectedParentId || 'none'}
                onValueChange={(value) => setSelectedParentId(value === 'none' ? null : value)}
                disabled={isLoading}
              >
                <SelectTrigger id="parent-collection">
                  <SelectValue placeholder="No parent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent</SelectItem>
                  {availableParents.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
