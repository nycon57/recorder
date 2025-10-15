'use client';

import * as React from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, MoreHorizontal } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface Collection {
  id: string;
  name: string;
  parent_id: string | null;
  children?: Collection[];
  item_count?: number;
  created_at: string;
  updated_at: string;
}

interface CollectionTreeProps {
  collections: Collection[];
  selectedId?: string | null;
  onSelect?: (collection: Collection) => void;
  onCreateChild?: (parentId: string) => void;
  onEdit?: (collection: Collection) => void;
  onDelete?: (collection: Collection) => void;
  className?: string;
}

/**
 * CollectionTree Component
 * Hierarchical tree view for browsing collections
 *
 * Features:
 * - Nested collection hierarchy
 * - Expand/collapse nodes
 * - Drag-and-drop support (placeholder for now)
 * - Context menu for actions
 * - Item counts per collection
 * - Keyboard navigation
 * - Accessible tree structure
 *
 * Usage:
 * <CollectionTree
 *   collections={collections}
 *   selectedId={currentId}
 *   onSelect={handleSelect}
 *   onCreateChild={handleCreate}
 * />
 */
export function CollectionTree({
  collections,
  selectedId,
  onSelect,
  onCreateChild,
  onEdit,
  onDelete,
  className,
}: CollectionTreeProps) {
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  // Build tree structure
  const buildTree = (items: Collection[]): Collection[] => {
    const map = new Map<string, Collection>();
    const roots: Collection[] = [];

    // First pass: create map of all items
    items.forEach((item) => {
      map.set(item.id, { ...item, children: [] });
    });

    // Second pass: build tree
    items.forEach((item) => {
      const node = map.get(item.id)!;
      if (item.parent_id && map.has(item.parent_id)) {
        map.get(item.parent_id)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const tree = React.useMemo(() => buildTree(collections), [collections]);

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

  return (
    <div className={cn('space-y-1', className)} role="tree">
      {tree.map((collection) => (
        <CollectionNode
          key={collection.id}
          collection={collection}
          level={0}
          selectedId={selectedId}
          expandedIds={expandedIds}
          onToggleExpand={toggleExpanded}
          onSelect={onSelect}
          onCreateChild={onCreateChild}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

interface CollectionNodeProps {
  collection: Collection;
  level: number;
  selectedId?: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect?: (collection: Collection) => void;
  onCreateChild?: (parentId: string) => void;
  onEdit?: (collection: Collection) => void;
  onDelete?: (collection: Collection) => void;
}

function CollectionNode({
  collection,
  level,
  selectedId,
  expandedIds,
  onToggleExpand,
  onSelect,
  onCreateChild,
  onEdit,
  onDelete,
}: CollectionNodeProps) {
  const hasChildren = collection.children && collection.children.length > 0;
  const isExpanded = expandedIds.has(collection.id);
  const isSelected = selectedId === collection.id;

  const paddingLeft = level * 16 + 8; // 16px per level + 8px base

  return (
    <Collapsible open={isExpanded} onOpenChange={() => hasChildren && onToggleExpand(collection.id)}>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md hover:bg-accent transition-colors',
          isSelected && 'bg-accent'
        )}
        style={{ paddingLeft }}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-level={level + 1}
      >
        {hasChildren ? (
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6 shrink-0"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        ) : (
          <div className="size-6 shrink-0" />
        )}

        <button
          onClick={() => onSelect?.(collection)}
          className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5 text-sm rounded-md hover:bg-accent/50"
        >
          {isExpanded ? (
            <FolderOpen className="size-4 shrink-0 text-blue-500" />
          ) : (
            <Folder className="size-4 shrink-0 text-blue-500" />
          )}
          <span className="flex-1 truncate text-left">{collection.name}</span>
          {collection.item_count !== undefined && collection.item_count > 0 && (
            <span className="text-xs text-muted-foreground shrink-0">
              {collection.item_count}
            </span>
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Collection actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onCreateChild && (
              <DropdownMenuItem onClick={() => onCreateChild(collection.id)}>
                <Plus className="size-4 mr-2" />
                New Subcollection
              </DropdownMenuItem>
            )}
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(collection)}>
                Edit
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(collection)}
                  className="text-destructive focus:text-destructive"
                >
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {hasChildren && (
        <CollapsibleContent>
          <div className="space-y-1">
            {collection.children!.map((child) => (
              <CollectionNode
                key={child.id}
                collection={child}
                level={level + 1}
                selectedId={selectedId}
                expandedIds={expandedIds}
                onToggleExpand={onToggleExpand}
                onSelect={onSelect}
                onCreateChild={onCreateChild}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
