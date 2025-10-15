'use client';

import { Card, CardContent } from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';

/**
 * UploadProgressSkeleton Component
 *
 * Skeleton for file upload progress display
 * Shows scanning/uploading state
 */
export function UploadProgressSkeleton({ fileCount = 3 }: { fileCount?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fileCount }).map((_, i) => (
        <Card key={i} className="overflow-hidden animate-in fade-in" style={{ animationDelay: `${i * 100}ms` }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* File icon */}
              <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />

              {/* File info */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-16" />
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary animate-pulse w-2/3 rounded-full" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </div>

              {/* Status icon */}
              <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * ProcessingQueueSkeleton Component
 *
 * Skeleton for processing queue display
 * Shows items being processed in background
 */
export function ProcessingQueueSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-lg border bg-card animate-in fade-in"
          style={{ animationDelay: `${i * 75}ms` }}
        >
          {/* Thumbnail */}
          <Skeleton className="h-10 w-16 rounded flex-shrink-0" />

          {/* Info */}
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-1 w-1 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>

          {/* Spinner */}
          <Skeleton className="h-5 w-5 rounded-full animate-spin flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}
