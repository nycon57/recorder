'use client';

import * as React from 'react';
import { Clock, Heart, FileStack, FolderX, FolderPlus, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

import { Button } from '@/app/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import {
  CollectionFolderCard,
  CollectionFolderCardSkeleton,
  CollectionFolder,
} from '@/app/components/collections/CollectionFolderCard';
import { cn } from '@/lib/utils';

export type QuickAccessTab = 'recent' | 'favorites' | 'all' | 'uncategorized';

interface RecentItem {
  id: string;
  title: string | null;
  content_type: string;
  file_type?: string | null;
  status: string;
  thumbnail_url?: string | null;
  duration_sec?: number | null;
  created_at: string;
  collection_id?: string | null;
}

interface LibraryRootViewProps {
  /** Root collections (depth 0) */
  collections: CollectionFolder[];
  /** Recent items */
  recentItems: RecentItem[];
  /** Counts for quick access tabs */
  counts: {
    uncategorized: number;
    favorites: number;
    total: number;
  };
  /** Currently active quick access tab */
  activeTab: QuickAccessTab;
  /** Loading state */
  loading?: boolean;
  /** Handler for collection navigation */
  onCollectionClick: (collectionId: string) => void;
  /** Handler for quick access tab change */
  onTabChange: (tab: QuickAccessTab) => void;
  /** Handler for creating a new collection */
  onNewCollection: () => void;
  /** Handler for editing a collection */
  onEditCollection?: (collection: CollectionFolder) => void;
  /** Handler for deleting a collection */
  onDeleteCollection?: (collection: CollectionFolder) => void;
  /** Handler for clicking a recent item */
  onRecentItemClick?: (itemId: string) => void;
  /** Handler for "See all" recent items */
  onSeeAllRecent?: () => void;
  /** Custom content component for rendering items (when showing all/favorites/uncategorized) */
  renderContent?: () => React.ReactNode;
  className?: string;
}

/**
 * LibraryRootView Component
 * Root/home view of the library showing:
 * - Quick access tabs (Recent, Favorites, All Content, Uncategorized)
 * - Collections grid
 * - Recent items section
 */
export function LibraryRootView({
  collections,
  recentItems,
  counts,
  activeTab,
  loading = false,
  onCollectionClick,
  onTabChange,
  onNewCollection,
  onEditCollection,
  onDeleteCollection,
  onRecentItemClick,
  onSeeAllRecent,
  renderContent,
  className,
}: LibraryRootViewProps) {
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

  // Show different content based on active tab
  const showCollectionsAndRecent = activeTab === 'recent';

  return (
    <div className={cn('space-y-8', className)}>
      {/* Quick Access Tabs */}
      <section>
        <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as QuickAccessTab)}>
          <TabsList className="h-auto flex-wrap gap-2 bg-transparent p-0">
            <TabsTrigger
              value="recent"
              className="gap-2 data-[state=active]:bg-accent"
            >
              <Clock className="h-4 w-4" />
              Recent
            </TabsTrigger>
            <TabsTrigger
              value="favorites"
              className="gap-2 data-[state=active]:bg-accent"
            >
              <Heart className="h-4 w-4" />
              Favorites
              {counts.favorites > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({counts.favorites})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="all"
              className="gap-2 data-[state=active]:bg-accent"
            >
              <FileStack className="h-4 w-4" />
              All Content
              {counts.total > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({counts.total})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="uncategorized"
              className="gap-2 data-[state=active]:bg-accent"
            >
              <FolderX className="h-4 w-4" />
              Uncategorized
              {counts.uncategorized > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({counts.uncategorized})
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </section>

      {/* Content based on tab */}
      {showCollectionsAndRecent ? (
        <>
          {/* Collections Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Collections</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={onNewCollection}
                className="gap-1.5"
              >
                <FolderPlus className="h-4 w-4" />
                <span className="hidden sm:inline">New Folder</span>
              </Button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <CollectionFolderCardSkeleton key={i} />
                ))}
              </div>
            ) : collections.length > 0 ? (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              >
                {collections.map((collection) => (
                  <motion.div key={collection.id} variants={itemVariants}>
                    <CollectionFolderCard
                      collection={collection}
                      onClick={() => onCollectionClick(collection.id)}
                      onEdit={
                        onEditCollection
                          ? () => onEditCollection(collection)
                          : undefined
                      }
                      onDelete={
                        onDeleteCollection
                          ? () => onDeleteCollection(collection)
                          : undefined
                      }
                    />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <EmptyCollections onCreateCollection={onNewCollection} />
            )}
          </section>

          {/* Recent Items Section */}
          {recentItems.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Recent Items</h2>
                {onSeeAllRecent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSeeAllRecent}
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    See all
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              >
                {recentItems.slice(0, 8).map((item) => (
                  <motion.div key={item.id} variants={itemVariants}>
                    <RecentItemCard
                      item={item}
                      onClick={() => onRecentItemClick?.(item.id)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </section>
          )}
        </>
      ) : (
        // Render custom content for other tabs (favorites, all, uncategorized)
        renderContent?.()
      )}
    </div>
  );
}

/**
 * Empty state for collections section
 */
function EmptyCollections({ onCreateCollection }: { onCreateCollection: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 px-4 border border-dashed rounded-lg bg-muted/30"
    >
      <FolderPlus className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium mb-2">No collections yet</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
        Create folders to organize your recordings, documents, and other content.
      </p>
      <Button onClick={onCreateCollection} className="gap-1.5">
        <FolderPlus className="h-4 w-4" />
        Create Collection
      </Button>
    </motion.div>
  );
}

/**
 * Simple card for recent items (minimal view)
 */
function RecentItemCard({
  item,
  onClick,
}: {
  item: RecentItem;
  onClick?: () => void;
}) {
  const getContentTypeIcon = () => {
    switch (item.content_type) {
      case 'recording':
      case 'video':
        return '🎬';
      case 'audio':
        return '🎵';
      case 'document':
        return '📄';
      case 'text':
        return '📝';
      default:
        return '📁';
    }
  };

  const formattedDate = new Date(item.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border bg-card',
        'hover:border-primary/50 hover:bg-accent/50 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail or icon */}
        {item.thumbnail_url ? (
          <div className="w-12 h-12 rounded bg-muted overflow-hidden flex-shrink-0">
            <img
              src={item.thumbnail_url}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0 text-xl">
            {getContentTypeIcon()}
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-sm truncate">
            {item.title || 'Untitled'}
          </h4>
          <p className="text-xs text-muted-foreground">
            {formattedDate}
          </p>
        </div>
      </div>
    </button>
  );
}

/**
 * LibraryRootViewSkeleton
 * Loading skeleton for the root view
 */
export function LibraryRootViewSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Tabs skeleton */}
      <div className="flex gap-2">
        <div className="h-9 w-24 bg-muted rounded" />
        <div className="h-9 w-28 bg-muted rounded" />
        <div className="h-9 w-28 bg-muted rounded" />
        <div className="h-9 w-32 bg-muted rounded" />
      </div>

      {/* Collections section */}
      <div className="space-y-4">
        <div className="flex justify-between">
          <div className="h-6 w-28 bg-muted rounded" />
          <div className="h-9 w-28 bg-muted rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CollectionFolderCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Recent items section */}
      <div className="space-y-4">
        <div className="flex justify-between">
          <div className="h-6 w-32 bg-muted rounded" />
          <div className="h-6 w-16 bg-muted rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-3 rounded-lg border bg-card">
              <div className="flex gap-3">
                <div className="w-12 h-12 bg-muted rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-muted rounded" />
                  <div className="h-3 w-1/3 bg-muted rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
