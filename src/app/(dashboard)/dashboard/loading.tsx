import { Skeleton } from '@/app/components/ui/skeleton';

/**
 * Dashboard Loading State
 * Matches the actual dashboard layout with skeletons for grid and table views
 */
export default function DashboardLoading() {
  return (
    <div>
      {/* Header with Search and Filters */}
      <div className="mb-8 space-y-4">
        {/* Top Row: Title and Actions */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <Skeleton className="h-9 w-40 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <Skeleton className="h-12 w-48" />
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search Input */}
          <Skeleton className="flex-1 h-10" />

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-[180px]" />
            <Skeleton className="h-10 w-[180px]" />
            <Skeleton className="h-10 w-[88px]" />
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4">
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Grid View Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(9)].map((_, i) => (
          <div
            key={i}
            className="bg-card rounded-lg border border-border overflow-hidden"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            {/* Thumbnail */}
            <Skeleton className="aspect-video w-full" />

            {/* Content */}
            <div className="p-4 space-y-3">
              {/* Title */}
              <Skeleton className="h-6 w-3/4" />

              {/* Description */}
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>

              {/* Tags */}
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>

              {/* Status and Date */}
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>

              {/* Actions */}
              <div className="flex space-x-2 pt-2">
                <Skeleton className="flex-1 h-10" />
                <Skeleton className="h-10 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
