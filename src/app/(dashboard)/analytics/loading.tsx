import { Card, CardContent, CardHeader } from '@/app/components/ui/card';

export default function AnalyticsLoading() {
  return (
    <div className="trbd-page">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-lg bg-muted animate-pulse" />
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-9 w-[180px] bg-muted animate-pulse rounded" />
          <div className="h-9 w-20 bg-muted animate-pulse rounded" />
          <div className="h-9 w-24 bg-muted animate-pulse rounded" />
        </div>
      </div>

      {/* Key Metrics Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          'metric-card-1',
          'metric-card-2',
          'metric-card-3',
          'metric-card-4',
        ].map((skeletonId) => (
          <Card key={skeletonId}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                <div className="size-4 bg-muted animate-pulse rounded" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="space-y-4">
        <div className="h-10 w-64 bg-muted animate-pulse rounded" />

        <Card>
          <CardHeader>
            <div className="h-6 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
          </CardHeader>
          <CardContent>
            <div className="h-[300px] bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {['chart-card-1', 'chart-card-2'].map((skeletonId) => (
            <Card key={skeletonId}>
              <CardHeader>
                <div className="h-6 w-48 bg-muted animate-pulse rounded" />
                <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-[300px] bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
