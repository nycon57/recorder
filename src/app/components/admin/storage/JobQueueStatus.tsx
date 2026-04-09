'use client';

import { useEffect, useState, useRef } from 'react';
import { Clock, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Progress } from '@/app/components/ui/progress';

interface JobStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

interface JobTypeStats {
  type: string;
  total: number;
  success: number;
  failed: number;
  successRate: number;
}

interface JobQueueData {
  stats: JobStats;
  jobTypes: JobTypeStats[];
  totalJobs: number;
  averageProcessingTime: number;
}

export default function JobQueueStatus() {
  const [data, setData] = useState<JobQueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      // Abort previous request if it exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }

      // Create new AbortController for this fetch
      abortControllerRef.current = new AbortController();
      const controller = abortControllerRef.current;

      // Set timeout to abort after 30 seconds
      timeoutIdRef.current = setTimeout(() => {
        controller.abort();
      }, 30000);

      try {
        const response = await fetch('/api/analytics/metrics', {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch job queue data');
        }

        const { data: metricsData } = await response.json();

        setData({
          stats: metricsData.jobs?.stats || { pending: 0, processing: 0, completed: 0, failed: 0 },
          jobTypes: metricsData.jobs?.types || [],
          totalJobs: metricsData.jobs?.total || 0,
          averageProcessingTime: metricsData.jobs?.avgProcessingTime || 0,
        });
        setError(null);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        console.error('Error fetching job queue data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current);
          timeoutIdRef.current = null;
        }
        setLoading(false);
      }
    };

    fetchData();

    // Auto-refresh every 10 seconds for real-time updates
    intervalRef.current = setInterval(fetchData, 10000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const getJobTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      compression: 'Video Compression',
      deduplication: 'File Deduplication',
      similarity: 'Similarity Detection',
      tier_migration: 'Tier Migration',
      transcribe: 'Audio Transcription',
      doc_generate: 'Document Generation',
      generate_embeddings: 'Embeddings Generation',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[200px]" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">Error loading job queue data: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const activeJobs = data.stats.pending + data.stats.processing;
  const completionRate = data.totalJobs > 0
    ? ((data.stats.completed / data.totalJobs) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      {/* Queue Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.pending}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Waiting in queue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.processing}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.completed}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Successfully finished
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.failed}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Requires attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Job Type Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Job Type Performance</CardTitle>
          <CardDescription>
            Success rates by job type
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {data.jobTypes.length > 0 ? (
            data.jobTypes.map((jobType) => (
              <div key={jobType.type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {getJobTypeLabel(jobType.type)}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {jobType.total} total
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {jobType.successRate.toFixed(1)}% success
                    </span>
                    <Badge
                      variant={jobType.successRate >= 95 ? 'default' : jobType.successRate >= 80 ? 'secondary' : 'destructive'}
                      className="text-xs"
                    >
                      {jobType.success}/{jobType.total}
                    </Badge>
                  </div>
                </div>
                <Progress value={jobType.successRate} className="h-2" />
                {jobType.failed > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3 w-3 text-yellow-600" />
                    <span>{jobType.failed} failed jobs</span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-sm">No job data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Processing Performance</CardTitle>
          <CardDescription>
            Queue health and efficiency metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Active Jobs</p>
              <p className="text-2xl font-bold">{activeJobs}</p>
              <p className="text-xs text-muted-foreground">
                {data.stats.pending} pending + {data.stats.processing} processing
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Completion Rate</p>
              <p className="text-2xl font-bold">{completionRate}%</p>
              <p className="text-xs text-muted-foreground">
                {data.stats.completed} of {data.totalJobs} jobs
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Avg. Processing Time</p>
              <p className="text-2xl font-bold">{formatTime(data.averageProcessingTime)}</p>
              <p className="text-xs text-muted-foreground">
                Per job completion
              </p>
            </div>
          </div>

          {activeJobs > 100 && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                    High Queue Load
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                    The job queue is experiencing high load. Consider scaling up workers for better performance.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
