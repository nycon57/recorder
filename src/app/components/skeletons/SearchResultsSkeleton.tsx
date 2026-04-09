'use client';

import { Card, CardContent } from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';

/**
 * SearchResultSkeleton Component
 *
 * Skeleton loader for individual search result
 */
export function SearchResultSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex gap-4">
          {/* Thumbnail */}
          <Skeleton className="w-32 h-20 flex-shrink-0 rounded-md" />

          {/* Content */}
          <div className="flex-1 space-y-3">
            {/* Header with badge and title */}
            <div className="space-y-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-3/4" />
            </div>

            {/* Snippet */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>

          {/* Score badge */}
          <Skeleton className="h-8 w-16 rounded-full flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * SearchResultsSkeleton Component
 *
 * Grid of search result skeletons
 */
export function SearchResultsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-in fade-in slide-in-from-bottom-2"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <SearchResultSkeleton />
        </div>
      ))}
    </div>
  );
}

/**
 * SearchFiltersSkeleton Component
 *
 * Skeleton for search filters sidebar
 */
export function SearchFiltersSkeleton() {
  return (
    <div className="space-y-6">
      {/* Content Type Filter */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-28" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-8 ml-auto" />
          </div>
        ))}
      </div>

      {/* Date Range Filter */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>

      {/* Tags Filter */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-20" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-18 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * SearchPageSkeleton Component
 *
 * Complete search page skeleton
 */
export function SearchPageSkeleton() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Skeleton className="h-9 w-48" />

        {/* Search bar */}
        <div className="max-w-3xl">
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>

        {/* Quick filters */}
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Content area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters sidebar */}
        <div className="hidden lg:block">
          <SearchFiltersSkeleton />
        </div>

        {/* Results */}
        <div className="lg:col-span-3">
          <SearchResultsSkeleton count={6} />
        </div>
      </div>
    </div>
  );
}
