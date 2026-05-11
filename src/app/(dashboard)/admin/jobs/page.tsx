'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Loader,
  RefreshCw,
  XCircle,
} from 'lucide-react';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';

interface Job {
  id: string;
  type: string;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  createdAt: string;
  runAfter: string;
  processingStartedAt?: string;
  completedAt?: string;
  error?: string;
}

interface JobsData {
  jobs: Job[];
  metrics: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    totalJobs: number;
  };
}

export default function AdminJobsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [data, setData] = useState<JobsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Job Queue - Admin';
    fetchJobs();

    // Refresh every 5 seconds
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  async function fetchJobs() {
    try {
      const url =
        statusFilter === 'all'
          ? '/api/admin/jobs?limit=100'
          : `/api/admin/jobs?status=${statusFilter}&limit=100`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied. System admin privileges required.');
        }
        throw new Error('Failed to fetch jobs');
      }

      const result = await response.json();
      setData(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  async function retryJob(jobId: string) {
    setRetrying(jobId);
    try {
      const response = await fetch(`/api/admin/jobs/${jobId}/retry`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to retry job');
      }

      // Refresh jobs list
      await fetchJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to retry job');
    } finally {
      setRetrying(null);
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'pending':
        return <Clock className="size-4 text-muted-foreground" />;
      case 'processing':
        return <Loader className="size-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="size-4 text-green-500" />;
      case 'failed':
        return <XCircle className="size-4 text-red-500" />;
      default:
        return null;
    }
  }

  function getStatusBadgeVariant(status: string) {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'processing':
        return 'default';
      case 'completed':
        return 'outline';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  if (!data && !error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full size-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="trbd-page">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="trbd-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="trbd-page-title">Job Queue</h1>
          <p className="text-muted-foreground">
            Monitor and manage background jobs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Jobs</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Badge variant="outline" className="text-sm">
            Auto-refresh: 5s
          </Badge>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Database className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.totalJobs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <Loader className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.processing}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.failed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {data.jobs.length === 0 ? (
            <div className="text-center py-12">
              <Database className="size-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-sm text-muted-foreground">No jobs found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {job.type}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        <Badge variant={getStatusBadgeVariant(job.status)}>
                          {job.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {job.attemptCount} / {job.maxAttempts}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(job.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.completedAt ? formatDate(job.completedAt) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {job.status === 'failed' &&
                        job.attemptCount < job.maxAttempts && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => retryJob(job.id)}
                            disabled={retrying === job.id}
                          >
                            {retrying === job.id ? (
                              <Loader className="size-3 animate-spin mr-1" />
                            ) : (
                              <RefreshCw className="size-3 mr-1" />
                            )}
                            Retry
                          </Button>
                        )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
