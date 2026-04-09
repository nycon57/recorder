'use client';

import * as React from 'react';
import { Folder, MoreHorizontal, Pencil, Trash2, FolderInput } from 'lucide-react';
import { motion } from 'framer-motion';

import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface CollectionFolder {
  id: string;
  name: string;
  description?: string | null;
  color?: string;
  icon?: string | null;
  item_count?: number;
  subcollection_count?: number;
  depth?: number;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

interface CollectionFolderCardProps {
  collection: CollectionFolder;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMove?: () => void;
  selected?: boolean;
  className?: string;
}

/**
 * CollectionFolderCard Component
 * Visual card representing a collection (folder) in the grid view
 *
 * Features:
 * - Folder icon with collection color
 * - Name and item count display
 * - Click to navigate into collection
 * - Context menu for edit/delete/move
 * - Hover effects and animations
 * - Drop target indicator (for drag-and-drop)
 */
export function CollectionFolderCard({
  collection,
  onClick,
  onEdit,
  onDelete,
  onMove,
  selected = false,
  className,
}: CollectionFolderCardProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  // Default color if none specified
  const folderColor = collection.color || '#3b82f6';

  // Calculate total count (items + subcollections)
  const itemCount = collection.item_count || 0;
  const subCount = collection.subcollection_count || 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'group relative flex flex-col rounded-lg border bg-card p-4 cursor-pointer',
        'transition-colors hover:border-primary/50 hover:bg-accent/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'border-primary bg-accent',
        className
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-label={`Open ${collection.name} folder`}
    >
      {/* Folder Icon */}
      <div className="flex items-start justify-between mb-3">
        <div
          className="flex items-center justify-center w-12 h-12 rounded-lg"
          style={{ backgroundColor: `${folderColor}20` }}
        >
          <Folder
            className="w-6 h-6"
            style={{ color: folderColor }}
            fill={`${folderColor}40`}
          />
        </div>

        {/* Context Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className={cn(
                'h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity',
                'focus-visible:opacity-100'
              )}
              onClick={(e) => e.stopPropagation()}
              aria-label="Folder actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {onEdit && (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {onMove && (
              <DropdownMenuItem onClick={onMove}>
                <FolderInput className="mr-2 h-4 w-4" />
                Move
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Collection Name */}
      <h3 className="font-medium text-sm truncate mb-1" title={collection.name}>
        {collection.name}
      </h3>

      {/* Description (if any) */}
      {collection.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {collection.description}
        </p>
      )}

      {/* Item Count */}
      <div className="flex items-center gap-2 mt-auto pt-2">
        <span className="text-xs text-muted-foreground">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </span>
        {subCount > 0 && (
          <>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              {subCount} {subCount === 1 ? 'folder' : 'folders'}
            </span>
          </>
        )}
      </div>

      {/* Selection indicator */}
      {selected && (
        <div
          className="absolute inset-0 rounded-lg border-2 border-primary pointer-events-none"
          aria-hidden="true"
        />
      )}
    </motion.div>
  );
}

/**
 * CollectionFolderCardSkeleton
 * Loading skeleton for folder cards
 */
export function CollectionFolderCardSkeleton() {
  return (
    <div className="flex flex-col rounded-lg border bg-card p-4 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="w-12 h-12 rounded-lg bg-muted" />
        <div className="w-8 h-8 rounded bg-muted" />
      </div>
      <div className="h-4 w-3/4 bg-muted rounded mb-2" />
      <div className="h-3 w-1/2 bg-muted rounded mt-auto" />
    </div>
  );
}
