'use client';

import * as React from 'react';
import { ArrowLeft, FolderPlus, Settings, ChevronRight, Home } from 'lucide-react';
import { motion } from 'framer-motion';

import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface CollectionHeaderProps {
  /** Collection name */
  name: string;
  /** Collection description */
  description?: string | null;
  /** Item count in this collection */
  itemCount?: number;
  /** Subcollection count */
  subcollectionCount?: number;
  /** Created date */
  createdAt?: string;
  /** Breadcrumb path from root to current */
  breadcrumb: BreadcrumbItem[];
  /** Handler for back/parent navigation */
  onBack?: () => void;
  /** Handler for breadcrumb item click */
  onBreadcrumbClick?: (collectionId: string | null) => void;
  /** Handler for creating a new subcollection */
  onNewSubcollection?: () => void;
  /** Handler for collection settings */
  onSettings?: () => void;
  /** Current depth (for limiting subcollection creation) */
  depth?: number;
  /** Maximum allowed depth */
  maxDepth?: number;
  className?: string;
}

/**
 * CollectionHeader Component
 * Header displayed when inside a collection, showing:
 * - Back button
 * - Breadcrumb navigation
 * - Collection name and metadata
 * - Quick actions (new subcollection, settings)
 */
export function CollectionHeader({
  name,
  description,
  itemCount = 0,
  subcollectionCount = 0,
  createdAt,
  breadcrumb,
  onBack,
  onBreadcrumbClick,
  onNewSubcollection,
  onSettings,
  depth = 0,
  maxDepth = 2,
  className,
}: CollectionHeaderProps) {
  // Can only create subcollections if not at max depth
  const canCreateSubcollection = depth < maxDepth;

  // Format created date
  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
        {/* Back button (mobile-friendly) */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mr-2 -ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only">Back</span>
        </Button>

        {/* Home/Library link */}
        <button
          onClick={() => onBreadcrumbClick?.(null)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Home className="h-4 w-4" />
          <span className="hidden sm:inline">Library</span>
        </button>

        {/* Breadcrumb items - show all on desktop, compact on mobile */}
        {breadcrumb.map((item, index) => {
          const isLast = index === breadcrumb.length - 1;
          const isFirst = index === 0;
          const hasMiddle = breadcrumb.length > 2;
          const isMiddle = !isFirst && !isLast;

          // On mobile (< sm), hide middle items and show ellipsis
          const mobileHidden = isMiddle && hasMiddle;

          return (
            <React.Fragment key={item.id}>
              {/* Show ellipsis for collapsed middle items on mobile */}
              {index === 1 && hasMiddle && (
                <span className="sm:hidden flex items-center">
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                  <span className="text-muted-foreground">...</span>
                </span>
              )}
              <ChevronRight
                className={cn(
                  'h-4 w-4 text-muted-foreground/50 flex-shrink-0',
                  mobileHidden && 'hidden sm:block'
                )}
              />
              {isLast ? (
                <span className="font-medium text-foreground truncate max-w-[150px] sm:max-w-[200px]">
                  {item.name}
                </span>
              ) : (
                <button
                  onClick={() => onBreadcrumbClick?.(item.id)}
                  className={cn(
                    'text-muted-foreground hover:text-foreground transition-colors truncate max-w-[100px] sm:max-w-[150px]',
                    mobileHidden && 'hidden sm:block'
                  )}
                >
                  {item.name}
                </button>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Collection Info */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-semibold tracking-tight"
          >
            {name}
          </motion.h1>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
            {subcollectionCount > 0 && (
              <>
                <span>·</span>
                <span>
                  {subcollectionCount} {subcollectionCount === 1 ? 'folder' : 'folders'}
                </span>
              </>
            )}
            {formattedDate && (
              <>
                <span>·</span>
                <span>Created {formattedDate}</span>
              </>
            )}
          </div>

          {/* Description */}
          {description && (
            <p className="text-sm text-muted-foreground max-w-2xl mt-2">
              {description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {canCreateSubcollection && onNewSubcollection && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNewSubcollection}
              className="gap-1.5"
            >
              <FolderPlus className="h-4 w-4" />
              <span className="hidden sm:inline">New Folder</span>
            </Button>
          )}
          {onSettings && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onSettings}
              aria-label="Collection settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * CollectionHeaderSkeleton
 * Loading skeleton for collection header
 */
export function CollectionHeaderSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-16 bg-muted rounded" />
        <div className="h-4 w-4 bg-muted rounded" />
        <div className="h-4 w-20 bg-muted rounded" />
        <div className="h-4 w-4 bg-muted rounded" />
        <div className="h-4 w-32 bg-muted rounded" />
      </div>

      {/* Title skeleton */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-muted rounded" />
          <div className="h-9 w-9 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}
