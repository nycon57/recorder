'use client';

/**
 * FailureLogTable
 *
 * Paginated table of failed ingest_vendor_docs jobs from
 * GET /api/admin/vendor-sources/failures.
 *
 * Columns: When | App | Source URL | Error | Attempts | Triggered by | Actions
 * Pagination is server-side (default 25 rows).
 *
 * TRIB-152
 */

import { useState, useCallback } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';

import { useFetchWithAbort } from '@/app/hooks/useFetchWithAbort';
import { Button } from '@/app/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { formatStableDateTime } from '@/lib/utils/formatting';

import { JobDetailDialog } from './job-detail-dialog';
import { ReSyncButton } from './re-sync-button';

const PAGE_SIZE = 25;

interface FailureRow {
  id: string;
  status: string;
  payload: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  processing_started_at: string | null;
  completed_at: string | null;
  attempt_count: number;
  dedupe_key: string | null;
  triggeredByEmail: string | null;
}

interface FailuresResponse {
  data: {
    failures: FailureRow[];
    totalCount: number;
  };
}

export function FailureLogTable() {
  const [offset, setOffset] = useState(0);

  const url = `/api/admin/vendor-sources/failures?limit=${PAGE_SIZE}&offset=${offset}`;

  const { data, loading, error } = useFetchWithAbort<FailuresResponse>(url);

  const failures = data?.data.failures ?? [];
  const totalCount = data?.data.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const handlePrev = useCallback(
    () => setOffset((o) => Math.max(0, o - PAGE_SIZE)),
    [],
  );
  const handleNext = useCallback(() => setOffset((o) => o + PAGE_SIZE), []);

  if (loading && failures.length === 0) {
    return (
      <div className="flex min-h-[10rem] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && failures.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive py-4">
        <AlertTriangle className="size-4 shrink-0" />
        {error.message.includes('403')
          ? 'Access denied.'
          : 'Failed to load failure log.'}
      </div>
    );
  }

  if (failures.length === 0) {
    return (
      <div className="rounded-md border px-4 py-6 text-center text-sm text-muted-foreground">
        No failed jobs in the log. Everything is running clean.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">When</TableHead>
              <TableHead className="w-28">App</TableHead>
              <TableHead>Error</TableHead>
              <TableHead className="w-20 text-right">Attempts</TableHead>
              <TableHead className="w-40">Triggered by</TableHead>
              <TableHead className="w-24">Job</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {failures.map((row) => {
              const app = String(row.payload?.app ?? '—');
              const sourceId = String(row.payload?.source_id ?? '');

              return (
                <TableRow key={row.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatStableDateTime(row.created_at)}
                  </TableCell>

                  <TableCell className="text-xs font-medium">{app}</TableCell>

                  <TableCell className="max-w-[260px] text-xs text-destructive">
                    <span
                      className="line-clamp-2"
                      title={row.error ?? undefined}
                    >
                      {row.error ?? '—'}
                    </span>
                  </TableCell>

                  <TableCell className="text-right tabular-nums text-xs">
                    {row.attempt_count}
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground">
                    {row.triggeredByEmail ??
                      (row.payload?.triggered_by_user_id
                        ? String(row.payload.triggered_by_user_id).slice(0, 8) +
                          '…'
                        : '—')}
                  </TableCell>

                  <TableCell>
                    <JobDetailDialog
                      job={row}
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs font-mono"
                        >
                          {row.id.slice(0, 8)}…
                        </Button>
                      }
                    />
                  </TableCell>

                  <TableCell>
                    {sourceId ? (
                      <ReSyncButton sourceId={sourceId} app={app} size="sm" />
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled
                        className="h-7 text-xs"
                        title="Re-trigger from the dashboard — no source ID in payload"
                      >
                        Retry
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {currentPage} of {totalPages} ({totalCount} total)
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={offset === 0}
              className="size-7 p-0"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={currentPage >= totalPages}
              className="size-7 p-0"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
