'use client';

import * as React from 'react';
import { FileX2, FolderPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/app/components/ui/button';
import {
  CollectionFolderCard,
  CollectionFolderCardSkeleton,
  CollectionFolder,
} from '@/app/components/collections/CollectionFolderCard';
import { CollectionHeader, CollectionHeaderSkeleton } from '@/app/components/collections/CollectionHeader';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface CollectionDetails extends CollectionFolder {
  item_count: number;
  subcollection_count: number;
}

interface CollectionFolderViewProps {
  /** Collection details */
  collection: CollectionDetails | null;
  /** Breadcrumb path from root to current */
  breadcrumb: BreadcrumbItem[];
  /** Subcollections */
  subcollections: CollectionFolder[];
  /** Loading state */
  loading?: boolean;
  /** Handler for back/parent navigation */
  onBack: () => void;
  /** Handler for breadcrumb item click */
  onBreadcrumbClick: (collectionId: string | null) => void;
  /** Handler for subcollection navigation */
  onSubcollectionClick: (collectionId: string) => void;
  /** Handler for creating a new subcollection */
  onNewSubcollection: () => void;
  /** Handler for editing a collection */
  onEditCollection?: (collection: CollectionFolder) => void;
  /** Handler for deleting a collection */
  onDeleteCollection?: (collection: CollectionFolder) => void;
  /** Handler for collection settings */
  onSettings?: () => void;
  /** Maximum allowed depth (for disabling subcollection creation) */
  maxDepth?: number;
  /** Custom renderer for content items */
  renderContent: () => React.ReactNode;
  className?: string;
}

/**
 * CollectionFolderView Component
 * View for displaying the contents of a collection:
 * - Collection header with breadcrumb and metadata
 * - Subcollections grid
 * - Content items (via renderContent prop)
 */
export function CollectionFolderView({
  collection,
  breadcrumb,
  subcollections,
  loading = false,
  onBack,
  onBreadcrumbClick,
  onSubcollectionClick,
  onNewSubcollection,
  onEditCollection,
  onDeleteCollection,
  onSettings,
  maxDepth = 2,
  renderContent,
  className,
}: CollectionFolderViewProps) {
  // Animation variants for staggered children
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  if (loading) {
    return <CollectionFolderViewSkeleton />;
  }

  if (!collection) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <FileX2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Collection Not Found</h3>
        <p className="text-sm text-muted-foreground mb-4">
          This collection may have been deleted or you don&apos;t have access to it.
        </p>
        <Button variant="outline" onClick={onBack}>
          Go Back
        </Button>
      </div>
    );
  }

  const canCreateSubcollection = (collection.depth || 0) < maxDepth;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Collection Header */}
      <CollectionHeader
        name={collection.name}
        description={collection.description}
        itemCount={collection.item_count}
        subcollectionCount={collection.subcollection_count}
        createdAt={collection.created_at}
        breadcrumb={breadcrumb}
        onBack={onBack}
        onBreadcrumbClick={onBreadcrumbClick}
        onNewSubcollection={canCreateSubcollection ? onNewSubcollection : undefined}
        onSettings={onSettings}
        depth={collection.depth}
        maxDepth={maxDepth}
      />

      {/* Subcollections Section */}
      <AnimatePresence mode="wait">
        {subcollections.length > 0 && (
          <motion.section
            key="subcollections"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Folders ({subcollections.length})
              </h2>
            </div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              {subcollections.map((subcollection) => (
                <motion.div key={subcollection.id} variants={itemVariants}>
                  <CollectionFolderCard
                    collection={subcollection}
                    onClick={() => onSubcollectionClick(subcollection.id)}
                    onEdit={
                      onEditCollection
                        ? () => onEditCollection(subcollection)
                        : undefined
                    }
                    onDelete={
                      onDeleteCollection
                        ? () => onDeleteCollection(subcollection)
                        : undefined
                    }
                  />
                </motion.div>
              ))}
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Content Section */}
      <section>
        {subcollections.length > 0 && collection.item_count > 0 && (
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Content ({collection.item_count})
            </h2>
          </div>
        )}

        {/* Render content items via prop */}
        {renderContent()}

        {/* Empty state if no content and no subcollections */}
        {collection.item_count === 0 && subcollections.length === 0 && (
          <EmptyCollection
            canCreateSubcollection={canCreateSubcollection}
            onNewSubcollection={onNewSubcollection}
          />
        )}
      </section>
    </div>
  );
}

/**
 * Empty state for collection with no content
 */
function EmptyCollection({
  canCreateSubcollection,
  onNewSubcollection,
}: {
  canCreateSubcollection: boolean;
  onNewSubcollection: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4 border border-dashed rounded-lg bg-muted/30"
    >
      <FileX2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium mb-2">This folder is empty</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
        Move items here or upload new content to this folder.
        {canCreateSubcollection && ' You can also create subfolders.'}
      </p>
      {canCreateSubcollection && (
        <Button variant="outline" onClick={onNewSubcollection} className="gap-1.5">
          <FolderPlus className="h-4 w-4" />
          Create Subfolder
        </Button>
      )}
    </motion.div>
  );
}

/**
 * Loading skeleton for CollectionFolderView
 */
export function CollectionFolderViewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <CollectionHeaderSkeleton />

      {/* Subcollections skeleton */}
      <div className="space-y-3">
        <div className="h-4 w-24 bg-muted rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <CollectionFolderCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div className="space-y-3">
        <div className="h-4 w-20 bg-muted rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-video rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
