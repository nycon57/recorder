'use client';

import { Card, CardContent } from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';

/**
 * ContentCardSkeleton Component
 *
 * Skeleton loader for content cards in grid and list views
 * Matches the dimensions and structure of actual ContentCard components
 *
 * Features:
 * - Shimmer animation for visual feedback
 * - Responsive design matching content cards
 * - Supports both grid and list layouts
 *
 * @param {Object} props
 * @param {boolean} props.listView - If true, renders in list view layout
 */
interface ContentCardSkeletonProps {
  listView?: boolean;
}

export function ContentCardSkeleton({ listView = false }: ContentCardSkeletonProps) {
  if (listView) {
    return (
      <Card className="overflow-hidden">
        <div className="flex gap-4 p-4">
          {/* Thumbnail skeleton */}
          <Skeleton className="w-32 h-20 flex-shrink-0 rounded-md" />

          {/* Content skeleton */}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>

          {/* Actions skeleton */}
          <Skeleton className="w-8 h-8 rounded-md" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Thumbnail/Video preview skeleton */}
      <Skeleton className="aspect-video w-full" />

      {/* Content skeleton */}
      <CardContent className="p-4 space-y-3">
        {/* Title */}
        <Skeleton className="h-4 w-3/4" />

        {/* Metadata row */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-2" />
          <Skeleton className="h-3 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * ContentGridSkeleton Component
 *
 * Renders a grid of content card skeletons
 * Used while loading library content
 *
 * @param {Object} props
 * @param {number} props.count - Number of skeleton cards to render (default: 8)
 */
interface ContentGridSkeletonProps {
  count?: number;
}

export function ContentGridSkeleton({ count = 8 }: ContentGridSkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ContentCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * ContentListSkeleton Component
 *
 * Renders a list of content card skeletons
 * Used while loading library content in list view
 *
 * @param {Object} props
 * @param {number} props.count - Number of skeleton cards to render (default: 8)
 */
interface ContentListSkeletonProps {
  count?: number;
}

export function ContentListSkeleton({ count = 8 }: ContentListSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <ContentCardSkeleton key={i} listView />
      ))}
    </div>
  );
}
