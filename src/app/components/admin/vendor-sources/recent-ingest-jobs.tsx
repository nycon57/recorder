'use client';

import Link from 'next/link';
import { ExternalLink, Inbox } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { useFetchWithInterval } from '@/app/hooks/useFetchWithAbort';

import { JobStatusBadge, formatTimestamp } from './source-status-badge';

interface IngestJob {
  id: string;
  status: string;
  payload: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  processing_started_at: string | null;
  completed_at: string | null;
  attempt_count: number;
  dedupe_key: string | null;
}

/**
 * Compact recent-jobs strip for the vendor-sources dashboard.
 * Polls GET /api/admin/vendor-sources/jobs?limit=10 every 5 s.
 *
 * Poll cadence note: two cold queries per operator per 5 s (the dashboard also
 * polls /api/admin/vendor-sources every 60 s). The jobs table is indexed on
 * type + created_at — this is acceptable for an operator-only admin surface.
 * Do not tighten below 5 s without adding caching.
 *
 * TRIB-149
 */
export function RecentIngestJobs() {
  // 5 s cadence — faster than snapshot (60 s) so new jobs surface quickly
  const { data, loading } = useFetchWithInterval<{ data: { jobs: IngestJob[] } }>(
    '/api/admin/vendor-sources/jobs?limit=10',
    5000,
  );

  const jobs = data?.data?.jobs ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Recent ingest jobs</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading && jobs.length === 0 ? (
          <p className="px-6 pb-4 text-xs text-muted-foreground">Loading…</p>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 pb-6 pt-2 text-center">
            <Inbox className="h-6 w-6 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">No ingest jobs yet.</p>
          </div>
        ) : (
          <div className="divide-y">
            {jobs.map((job) => {
              const app =
                (job.payload?.app as string | undefined) ??
                (job.dedupe_key?.split(':')[2] ?? '—');
              const url = job.payload?.url as string | undefined;
              const triggeredBy = job.payload?.triggered_by_user_id as string | undefined;
              const finishedAt = job.completed_at ?? job.processing_started_at ?? null;

              return (
                <div
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-6 py-2.5 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <JobStatusBadge status={job.status} />
                    <div className="min-w-0">
                      <span className="font-medium">{app}</span>
                      {url ? (
                        <span className="ml-1.5 hidden truncate text-xs text-muted-foreground sm:inline">
                          {url}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                    {triggeredBy ? (
                      <span title={triggeredBy}>
                        {triggeredBy.includes('@') ? triggeredBy.split('@')[0] : triggeredBy.slice(0, 8)}
                      </span>
                    ) : null}
                    <span>{formatTimestamp(finishedAt ?? job.created_at)}</span>
                    {job.error ? (
                      <span
                        className="text-destructive truncate max-w-[140px]"
                        title={job.error}
                      >
                        {job.error}
                      </span>
                    ) : null}
                    <Link
                      href={`/admin/jobs?id=${job.id}`}
                      className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                      title="Open in job queue"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
