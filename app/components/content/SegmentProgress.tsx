'use client';

/**
 * SegmentProgress Component
 *
 * Displays real-time progress for segmented video processing.
 * Shows per-segment status, key findings, and estimated time remaining.
 *
 * Features:
 * - Visual segment-by-segment progress indicators
 * - Live updates via polling
 * - Key moments counter
 * - Searchable chunks indicator
 * - Estimated completion time
 */

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Search,
  Sparkles,
  Clock,
  FileVideo,
} from 'lucide-react';
import { Progress } from '@/app/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';

interface SegmentStatus {
  index: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime: number;
  duration: number;
  keyMomentsCount: number;
  embeddingsGenerated: boolean;
  errorMessage?: string;
}

interface ProgressData {
  contentId: string;
  title: string;
  status: string;
  processingStrategy: 'single' | 'segmented';
  progress: {
    percent: number;
    completedSegments: number;
    totalSegments: number;
    searchableChunks: number;
    totalKeyMoments: number;
  };
  segments: SegmentStatus[];
  timing: {
    startedAt: string | null;
    estimatedCompletionAt: string | null;
    averageSegmentTime: number | null;
  };
  messages: {
    primary: string;
    secondary: string;
  };
}

interface SegmentProgressProps {
  contentId: string;
  /** Poll interval in milliseconds (default: 3000) */
  pollInterval?: number;
  /** Callback when processing completes */
  onComplete?: () => void;
  /** Show compact view */
  compact?: boolean;
  /** Additional class names */
  className?: string;
}

export function SegmentProgress({
  contentId,
  pollInterval = 3000,
  onComplete,
  compact = false,
  className,
}: SegmentProgressProps) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  const fetchProgress = useCallback(async () => {
    try {
      const response = await fetch(`/api/content/${contentId}/progress`);
      if (!response.ok) {
        throw new Error('Failed to fetch progress');
      }

      const data: ProgressData = await response.json();
      setProgress(data);
      setError(null);

      // Stop polling when complete or errored
      if (data.status === 'completed' || data.status === 'error') {
        setIsPolling(false);
        if (data.status === 'completed' && onComplete) {
          onComplete();
        }
      }
    } catch (err) {
      setError('Unable to fetch progress');
    }
  }, [contentId, onComplete]);

  useEffect(() => {
    fetchProgress();

    if (isPolling) {
      const interval = setInterval(fetchProgress, pollInterval);
      return () => clearInterval(interval);
    }
  }, [fetchProgress, isPolling, pollInterval]);

  if (error && !progress) {
    return (
      <Card className={cn('border-destructive/50', className)}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!progress) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading progress...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Single-pass processing - simpler view
  if (progress.processingStrategy === 'single') {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="font-medium">{progress.messages.primary}</p>
                <p className="text-sm text-muted-foreground">
                  {progress.messages.secondary}
                </p>
              </div>
            </div>
            <Progress value={progress.progress.percent} className="h-2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Segmented processing - full progress view
  if (compact) {
    return (
      <CompactSegmentProgress progress={progress} className={className} />
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileVideo className="h-5 w-5" />
            Processing Progress
          </CardTitle>
          <Badge variant="secondary">
            {progress.progress.completedSegments} / {progress.progress.totalSegments} segments
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Primary Message */}
        <div className="space-y-2">
          <p className="font-medium text-lg">{progress.messages.primary}</p>
          <p className="text-muted-foreground">{progress.messages.secondary}</p>
        </div>

        {/* Overall Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span className="font-medium">{progress.progress.percent}%</span>
          </div>
          <Progress value={progress.progress.percent} className="h-3" />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            icon={<Sparkles className="h-4 w-4" />}
            label="Key Moments"
            value={progress.progress.totalKeyMoments}
          />
          <StatCard
            icon={<Search className="h-4 w-4" />}
            label="Searchable"
            value={progress.progress.searchableChunks}
            suffix="chunks"
          />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="Est. Remaining"
            value={calculateRemainingTime(progress)}
          />
        </div>

        {/* Segment Grid */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Segment Status</p>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {progress.segments.map((segment) => (
              <SegmentIndicator key={segment.index} segment={segment} />
            ))}
            {/* Show pending placeholders if segments haven't been created yet */}
            {progress.segments.length < progress.progress.totalSegments &&
              Array.from({
                length: progress.progress.totalSegments - progress.segments.length,
              }).map((_, i) => (
                <SegmentIndicator
                  key={`pending-${i}`}
                  segment={{
                    index: progress.segments.length + i,
                    status: 'pending',
                    startTime: 0,
                    duration: 0,
                    keyMomentsCount: 0,
                    embeddingsGenerated: false,
                  }}
                />
              ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Circle className="h-3 w-3 text-muted-foreground/50" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 text-primary" />
            <span>Processing</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span>Complete</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-destructive" />
            <span>Failed</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact version for embedding in content cards
 */
function CompactSegmentProgress({
  progress,
  className,
}: {
  progress: ProgressData;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {progress.messages.primary}
        </span>
        <span className="font-medium">{progress.progress.percent}%</span>
      </div>
      <Progress value={progress.progress.percent} className="h-2" />
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          {progress.progress.totalKeyMoments} moments
        </span>
        <span className="flex items-center gap-1">
          <Search className="h-3 w-3" />
          {progress.progress.searchableChunks} searchable
        </span>
      </div>
    </div>
  );
}

/**
 * Individual segment status indicator
 */
function SegmentIndicator({ segment }: { segment: SegmentStatus }) {
  const statusIcon = {
    pending: <Circle className="h-4 w-4 text-muted-foreground/50" />,
    processing: <Loader2 className="h-4 w-4 text-primary animate-spin" />,
    completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    failed: <AlertCircle className="h-4 w-4 text-destructive" />,
  };

  return (
    <div
      className={cn(
        'relative flex items-center justify-center p-2 rounded-md border transition-colors',
        segment.status === 'completed' && 'border-green-500/30 bg-green-500/5',
        segment.status === 'processing' && 'border-primary/30 bg-primary/5',
        segment.status === 'failed' && 'border-destructive/30 bg-destructive/5',
        segment.status === 'pending' && 'border-muted'
      )}
      title={`Segment ${segment.index + 1}${
        segment.keyMomentsCount > 0
          ? ` - ${segment.keyMomentsCount} key moments`
          : ''
      }`}
    >
      {statusIcon[segment.status]}
      {segment.keyMomentsCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
          {segment.keyMomentsCount > 9 ? '9+' : segment.keyMomentsCount}
        </span>
      )}
    </div>
  );
}

/**
 * Stats card component
 */
function StatCard({
  icon,
  label,
  value,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="font-semibold">
        {value}
        {suffix && <span className="text-xs font-normal ml-1">{suffix}</span>}
      </p>
    </div>
  );
}

/**
 * Calculate remaining time estimate
 */
function calculateRemainingTime(progress: ProgressData): string {
  const remaining =
    progress.progress.totalSegments - progress.progress.completedSegments;

  if (remaining === 0) {
    return 'Done';
  }

  const avgTime = progress.timing.averageSegmentTime || 180; // 3 min default
  const remainingSeconds = remaining * avgTime;

  if (remainingSeconds < 60) {
    return '<1 min';
  }

  const minutes = Math.ceil(remainingSeconds / 60);
  return `~${minutes} min`;
}

export default SegmentProgress;
