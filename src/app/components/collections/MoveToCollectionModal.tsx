'use client';

import * as React from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  FolderInput,
  Home,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Collection {
  id: string;
  name: string;
  parent_id: string | null;
  depth?: number;
  item_count?: number;
  children?: Collection[];
}

interface ContentItem {
  id: string;
  title?: string | null;
  collection_id?: string | null;
}

interface MoveToCollectionModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Handler for closing the modal */
  onOpenChange: (open: boolean) => void;
  /** Items being moved */
  items: ContentItem[];
  /** All available collections */
  collections: Collection[];
  /** Handler for moving items to collection */
  onMove: (collectionId: string | null) => Promise<void>;
  /** Maximum allowed depth (collections at this depth cannot have items moved into them) */
  maxDepth?: number;
  /** Loading state */
  loading?: boolean;
}

/**
 * MoveToCollectionModal Component
 * Modal for moving content items to a different collection.
 *
 * Features:
 * - Tree view of available collections
 * - Shows current location of items
 * - Respects depth limits (disables folders at max depth)
 * - "Uncategorized" option to remove from collections
 * - Loading states during move operation
 * - Accessible dialog with keyboard navigation
 */
export function MoveToCollectionModal({
  open,
  onOpenChange,
  items,
  collections,
  onMove,
  maxDepth = 2,
  loading = false,
}: MoveToCollectionModalProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [isMoving, setIsMoving] = React.useState(false);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  // Get current collection(s) of selected items
  const currentCollectionIds = React.useMemo(() => {
    const ids = new Set<string | null>();
    items.forEach((item) => ids.add(item.collection_id || null));
    return ids;
  }, [items]);

  // Check if all items are in the same collection
  const sameCollection = currentCollectionIds.size === 1;
  const currentCollectionId = sameCollection
    ? Array.from(currentCollectionIds)[0]
    : null;

  // Build tree structure from flat collections
  const tree = React.useMemo(() => {
    const map = new Map<string, Collection>();
    const roots: Collection[] = [];

    // First pass: create map
    collections.forEach((item) => {
      map.set(item.id, { ...item, children: [] });
    });

    // Second pass: build tree
    collections.forEach((item) => {
      const node = map.get(item.id)!;
      if (item.parent_id && map.has(item.parent_id)) {
        map.get(item.parent_id)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [collections]);

  // Auto-expand to show current collection
  React.useEffect(() => {
    if (open && currentCollectionId) {
      // Find path to current collection and expand all ancestors
      const findPath = (
        items: Collection[],
        targetId: string,
        path: string[] = []
      ): string[] | null => {
        for (const item of items) {
          if (item.id === targetId) {
            return path;
          }
          if (item.children && item.children.length > 0) {
            const result = findPath(item.children, targetId, [...path, item.id]);
            if (result) return result;
          }
        }
        return null;
      };

      const path = findPath(tree, currentCollectionId);
      if (path) {
        setExpandedIds(new Set(path));
      }
    }
  }, [open, currentCollectionId, tree]);

  // Reset selection when modal opens
  React.useEffect(() => {
    if (open) {
      setSelectedId(null);
    }
  }, [open]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleMove = async () => {
    try {
      setIsMoving(true);
      await onMove(selectedId);
      onOpenChange(false);
    } catch (error) {
      console.error('Move failed:', error);
    } finally {
      setIsMoving(false);
    }
  };

  const itemCount = items.length;
  const itemLabel = itemCount === 1 ? 'item' : 'items';

  // Check if a selection is valid (different from current location)
  const isValidSelection =
    selectedId !== undefined &&
    (selectedId !== currentCollectionId || !sameCollection);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] sm:max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="h-5 w-5" />
            Move {itemCount} {itemLabel}
          </DialogTitle>
          <DialogDescription>
            Select a destination folder or choose &quot;Uncategorized&quot; to
            remove from collections.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-[200px] max-h-[300px] sm:max-h-[350px] pr-4">
          <div className="space-y-1" role="tree" aria-label="Collections">
            {/* Uncategorized option */}
            <button
              onClick={() => setSelectedId(null)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                'hover:bg-accent',
                selectedId === null && 'bg-accent ring-2 ring-primary',
                currentCollectionId === null &&
                  sameCollection &&
                  'text-muted-foreground'
              )}
              aria-selected={selectedId === null}
            >
              <Home className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left">Uncategorized</span>
              {currentCollectionId === null && sameCollection && (
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  Current
                </span>
              )}
            </button>

            {/* Collections tree */}
            {tree.map((collection) => (
              <CollectionTreeNode
                key={collection.id}
                collection={collection}
                level={0}
                selectedId={selectedId}
                currentId={currentCollectionId}
                sameCollection={sameCollection}
                expandedIds={expandedIds}
                onSelect={setSelectedId}
                onToggleExpand={toggleExpanded}
                maxDepth={maxDepth}
              />
            ))}

            {/* Empty state */}
            {tree.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No collections yet</p>
                <p className="text-xs mt-1">
                  Create a collection to organize your content
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isMoving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleMove}
            disabled={!isValidSelection || isMoving || loading}
          >
            {isMoving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Moving...
              </>
            ) : (
              `Move ${itemCount} ${itemLabel}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CollectionTreeNodeProps {
  collection: Collection;
  level: number;
  selectedId: string | null;
  currentId: string | null;
  sameCollection: boolean;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  maxDepth: number;
}

function CollectionTreeNode({
  collection,
  level,
  selectedId,
  currentId,
  sameCollection,
  expandedIds,
  onSelect,
  onToggleExpand,
  maxDepth,
}: CollectionTreeNodeProps) {
  const hasChildren = collection.children && collection.children.length > 0;
  const isExpanded = expandedIds.has(collection.id);
  const isSelected = selectedId === collection.id;
  const isCurrent = currentId === collection.id && sameCollection;

  // Disable if at max depth (can't move items into folders at depth 2)
  const depth = collection.depth ?? level;
  const isDisabled = depth >= maxDepth;

  const paddingLeft = level * 20 + 8;

  return (
    <div role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined}>
      <div
        className={cn(
          'flex items-center gap-1 rounded-md transition-colors',
          !isDisabled && 'hover:bg-accent',
          isSelected && !isDisabled && 'bg-accent ring-2 ring-primary',
          isDisabled && 'opacity-50 cursor-not-allowed'
        )}
        style={{ paddingLeft }}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(collection.id);
            }}
            className="p-1 rounded hover:bg-accent/50"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <div className="w-6" />
        )}

        {/* Collection button */}
        <button
          onClick={() => !isDisabled && onSelect(collection.id)}
          disabled={isDisabled}
          className={cn(
            'flex-1 flex items-center gap-2 px-2 py-1.5 text-sm rounded-md text-left',
            !isDisabled && 'hover:bg-accent/50',
            isDisabled && 'cursor-not-allowed'
          )}
          title={
            isDisabled
              ? `Cannot move items to this folder (max depth ${maxDepth + 1} reached)`
              : undefined
          }
        >
          {isExpanded ? (
            <FolderOpen className="h-4 w-4 text-blue-500 shrink-0" />
          ) : (
            <Folder className="h-4 w-4 text-blue-500 shrink-0" />
          )}
          <span className="flex-1 truncate">{collection.name}</span>
          {isCurrent && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
              Current
            </span>
          )}
          {isDisabled && (
            <span className="text-xs text-muted-foreground shrink-0">
              Max depth
            </span>
          )}
        </button>
      </div>

      {/* Children */}
      <AnimatePresence>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Collapsible open={true}>
              <CollapsibleContent>
                {collection.children!.map((child) => (
                  <CollectionTreeNode
                    key={child.id}
                    collection={child}
                    level={level + 1}
                    selectedId={selectedId}
                    currentId={currentId}
                    sameCollection={sameCollection}
                    expandedIds={expandedIds}
                    onSelect={onSelect}
                    onToggleExpand={onToggleExpand}
                    maxDepth={maxDepth}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
