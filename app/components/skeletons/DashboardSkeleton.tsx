'use client';

import { Card, CardContent } from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';

/**
 * DashboardStatsSkeleton Component
 *
 * Skeleton loader for dashboard statistics row
 * Matches StatsRow component layout
 */
export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * DashboardRecentItemsSkeleton Component
 *
 * Skeleton loader for recent items grid in dashboard
 * Matches RecentItems component layout
 *
 * @param {Object} props
 * @param {number} props.count - Number of skeleton cards to render (default: 8)
 */
interface DashboardRecentItemsSkeletonProps {
  count?: number;
}

export function DashboardRecentItemsSkeleton({ count = 8 }: DashboardRecentItemsSkeletonProps) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            {/* Thumbnail skeleton */}
            <Skeleton className="h-32 w-full" />

            {/* Content skeleton */}
            <CardContent className="p-4 space-y-3">
              {/* Title */}
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />

              {/* Metadata */}
              <div className="space-y-2 pt-1">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * DashboardQuickActionsSkeleton Component
 *
 * Skeleton loader for quick actions section
 */
export function DashboardQuickActionsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * FullDashboardSkeleton Component
 *
 * Complete dashboard skeleton with all sections
 * Used on initial page load
 */
export function FullDashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <section className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-80" />
          <Skeleton className="h-5 w-96" />
        </div>
        <DashboardQuickActionsSkeleton />
      </section>

      {/* Stats skeleton */}
      <section>
        <DashboardStatsSkeleton />
      </section>

      {/* Recent items skeleton */}
      <section>
        <DashboardRecentItemsSkeleton />
      </section>
    </div>
  );
}
