import { Skeleton } from '@/app/components/ui/skeleton';

/**
 * Search Loading State
 * Matches the search results layout with skeletons
 */
export default function SearchLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Skeleton className="h-9 w-56 mb-2" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Search Form */}
      <div className="mb-8">
        <div className="flex gap-4 mb-4">
          <Skeleton className="flex-1 h-12" />
          <Skeleton className="h-12 w-24" />
          <Skeleton className="h-12 w-24" />
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4">
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Search Results */}
      <div className="space-y-4">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="border border-border rounded-lg p-5"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            {/* Result Header */}
            <div className="mb-3">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>

            {/* Result Text */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
