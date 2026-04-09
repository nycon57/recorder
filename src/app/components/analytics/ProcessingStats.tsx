'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Progress } from '@/app/components/ui/progress';
import { Badge } from '@/app/components/ui/badge';
import { Skeleton } from '@/app/components/ui/skeleton';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Timer,
  Activity,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProcessingStats as ProcessingStatsType } from '@/lib/types/phase8';

interface ProcessingStatsProps {
  orgId?: string;
  className?: string;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  transcribe: 'Transcription',
  doc_generate: 'Document Generation',
  generate_embeddings: 'Embeddings',
  generate_summary: 'Summarization',
  extract_frames: 'Frame Extraction',
  extract_audio: 'Audio Extraction',
  extract_text_pdf: 'PDF Text Extraction',
  extract_text_docx: 'DOCX Text Extraction',
  process_text_note: 'Text Note Processing',
  sync_connector: 'Connector Sync',
  process_imported_doc: 'Document Import',
  process_webhook: 'Webhook Processing',
};

export function ProcessingStats({ orgId, className }: ProcessingStatsProps) {
  const [stats, setStats] = useState<ProcessingStatsType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortField, setSortField] = useState<keyof ProcessingStatsType>('total_jobs');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [overallSuccessRate, setOverallSuccessRate] = useState(0);

  useEffect(() => {
    fetchProcessingStats();
  }, [orgId]);

  const fetchProcessingStats = async () => {
    try {
      setIsLoading(true);
      const params = orgId ? `?org_id=${orgId}` : '';
      const response = await fetch(`/api/analytics/processing${params}`);

      if (!response.ok) throw new Error('Failed to fetch processing stats');

      const result = await response.json();
      setStats(result.data.stats || []);
      setOverallSuccessRate(result.data.overall_success_rate || 0);
    } catch (error) {
      console.error('Error fetching processing stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null) return '-';

    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  };

  const handleSort = (field: keyof ProcessingStatsType) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedStats = [...stats].sort((a, b) => {
    const aVal = a[sortField] || 0;
    const bVal = b[sortField] || 0;

    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  const getSuccessRateBadge = (rate: number) => {
    if (rate >= 95) {
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          {rate.toFixed(1)}%
        </Badge>
      );
    } else if (rate >= 80) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Activity className="h-3 w-3" />
          {rate.toFixed(1)}%
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          {rate.toFixed(1)}%
        </Badge>
      );
    }
  };

  const getProcessingTimeBadge = (avgTime: number | null) => {
    if (!avgTime) return null;

    const isSlowJob = avgTime > 30000; // Over 30 seconds
    const isFastJob = avgTime < 5000;  // Under 5 seconds

    if (isSlowJob) {
      return (
        <Badge variant="outline" className="gap-1 text-orange-600 border-orange-600">
          <Timer className="h-3 w-3" />
          Slow
        </Badge>
      );
    } else if (isFastJob) {
      return (
        <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
          <Timer className="h-3 w-3" />
          Fast
        </Badge>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Processing Statistics</CardTitle>
            <CardDescription>
              Job performance and reliability metrics
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Overall Success Rate</p>
            <div className="mt-1">{getSuccessRateBadge(overallSuccessRate)}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No processing statistics available
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('job_type')}
                  >
                    <div className="flex items-center gap-1">
                      Job Type
                      {sortField === 'job_type' && (
                        sortDirection === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort('total_jobs')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Total
                      {sortField === 'total_jobs' && (
                        sortDirection === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="text-center">Success Rate</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort('avg_processing_time_ms')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Avg Time
                      {sortField === 'avg_processing_time_ms' && (
                        sortDirection === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="text-center">Min / Max</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedStats.map((stat) => {
                  const successRate = stat.total_jobs > 0
                    ? (stat.completed_jobs / stat.total_jobs) * 100
                    : 0;

                  return (
                    <TableRow key={stat.job_type}>
                      <TableCell className="font-medium">
                        {JOB_TYPE_LABELS[stat.job_type] || stat.job_type}
                      </TableCell>
                      <TableCell className="text-right">
                        {stat.total_jobs.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-center gap-1">
                          <Progress
                            value={successRate}
                            className="h-2 w-20"
                          />
                          <span className="text-xs text-muted-foreground">
                            {stat.completed_jobs}/{stat.total_jobs}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatDuration(stat.avg_processing_time_ms)}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {formatDuration(stat.min_processing_time_ms)} / {formatDuration(stat.max_processing_time_ms)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          {getSuccessRateBadge(successRate)}
                          {getProcessingTimeBadge(stat.avg_processing_time_ms)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Summary Stats */}
        {stats.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Total Jobs</p>
              <p className="text-xl font-semibold">
                {stats.reduce((sum, s) => sum + s.total_jobs, 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-xl font-semibold text-green-600">
                {stats.reduce((sum, s) => sum + s.completed_jobs, 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Failed</p>
              <p className="text-xl font-semibold text-red-600">
                {stats.reduce((sum, s) => sum + s.failed_jobs, 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Processing</p>
              <p className="text-xl font-semibold">
                {formatDuration(
                  stats.reduce((sum, s) => sum + (s.avg_processing_time_ms || 0), 0) / stats.length
                )}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}