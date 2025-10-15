'use client';

import { Card, CardContent, CardHeader } from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Separator } from '@/app/components/ui/separator';

/**
 * RecordingDetailSkeleton Component
 *
 * Skeleton loader for recording detail page
 * Shows progressive loading: header → video player → metadata → transcript → document
 */
export function RecordingDetailSkeleton() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Skeleton className="h-9 w-2/3" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-10 w-10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content area (video + transcript) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video player skeleton */}
          <Card>
            <CardContent className="p-0">
              <div className="aspect-video bg-muted rounded-t-lg flex items-center justify-center">
                <Skeleton className="h-16 w-16 rounded-full" />
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transcript skeleton */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-9 w-36" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-4 w-16 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* AI Document skeleton */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-9 w-28" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  {i % 4 === 0 && <Skeleton className="h-6 w-48 mt-4" />}
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tags card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </CardContent>
          </Card>

          {/* Processing status */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * VideoPlayerSkeleton Component
 *
 * Standalone video player skeleton
 * Used for progressive loading within RecordingDetail
 */
export function VideoPlayerSkeleton() {
  return (
    <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
      <div className="text-center space-y-3">
        <Skeleton className="h-16 w-16 rounded-full mx-auto" />
        <Skeleton className="h-4 w-32 mx-auto" />
      </div>
    </div>
  );
}

/**
 * TranscriptSkeleton Component
 *
 * Standalone transcript skeleton
 * Used for progressive loading or when transcript is generating
 */
export function TranscriptSkeleton({ lines = 10 }: { lines?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex gap-3 animate-in fade-in" style={{ animationDelay: `${i * 50}ms` }}>
          <Skeleton className="h-4 w-16 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            {Math.random() > 0.5 && <Skeleton className="h-4 w-4/5" />}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * DocumentSkeleton Component
 *
 * Standalone AI document skeleton
 * Shows structured content with headings and paragraphs
 */
export function DocumentSkeleton({ paragraphs = 12 }: { paragraphs?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: paragraphs }).map((_, i) => (
        <div key={i} className="space-y-2 animate-in fade-in" style={{ animationDelay: `${i * 75}ms` }}>
          {i % 4 === 0 && <Skeleton className="h-6 w-48 mt-4" />}
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          {Math.random() > 0.6 && <Skeleton className="h-4 w-5/6" />}
        </div>
      ))}
    </div>
  );
}
