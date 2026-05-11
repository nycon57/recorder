'use client';

/**
 * SourceHealthTable
 *
 * Per-source freshness and health overview. Polls the existing
 * /api/admin/vendor-sources snapshot (same endpoint as the dashboard) and
 * computes drift client-side - no new endpoint needed.
 *
 * Drift uses DriftIndicator: absolute days + % of freshness budget + color.
 * Color is supplementary - text always present.
 *
 * TRIB-152
 */

import Link from 'next/link';
import { differenceInDays } from 'date-fns';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

import { useFetchWithInterval } from '@/app/hooks/useFetchWithAbort';
import type {
  VendorSourceOpsItem,
  VendorSourceOpsSnapshot,
} from '@/lib/services/vendor-source-ops';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { formatStableDate } from '@/lib/utils/formatting';

import { SourceStatusBadge } from './source-status-badge';
import { DriftIndicator } from './drift-indicator';
import { ReSyncButton } from './re-sync-button';

function computeDaysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return differenceInDays(new Date(), new Date(dateStr));
}

// Sort order: failing > stale > never_synced > syncing > healthy
const STATUS_RANK: Record<string, number> = {
  failing: 0,
  stale: 1,
  never_synced: 2,
  syncing: 3,
  healthy: 4,
};

function sortSources(sources: VendorSourceOpsItem[]): VendorSourceOpsItem[] {
  return sources.toSorted((a, b) => {
    const ra = STATUS_RANK[a.status] ?? 99;
    const rb = STATUS_RANK[b.status] ?? 99;
    return ra - rb;
  });
}

export function SourceHealthTable() {
  const { data, error, loading, refetch } = useFetchWithInterval<{
    data: VendorSourceOpsSnapshot;
  }>('/api/admin/vendor-sources', 30_000);

  const snapshot = data?.data ?? null;

  if (loading && !snapshot) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive py-4">
        <AlertTriangle className="size-4 shrink-0" />
        {error.message.includes('403')
          ? 'Access denied. System admin privileges required.'
          : 'Failed to load source health.'}
      </div>
    );
  }

  const sources = sortSources(snapshot?.sources ?? []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {sources.length} source{sources.length === 1 ? '' : 's'} -
          auto-refreshes every 30 s
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={refetch}
          className="gap-1.5 h-7 text-xs"
        >
          <RefreshCw className="size-3" />
          Refresh
        </Button>
      </div>

      {sources.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <CheckCircle2 className="size-4" />
          No vendor sources configured.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">App</TableHead>
                <TableHead>Source URL</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-20 text-right">Pages</TableHead>
                <TableHead className="w-28">Last success</TableHead>
                <TableHead className="w-36">Drift</TableHead>
                <TableHead className="w-48">Last error</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((source) => {
                const daysSince = computeDaysSince(source.lastSuccessfulSyncAt);
                return (
                  <TableRow key={source.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/vendor-sources?source=${source.id}`}
                        className="hover:underline text-primary"
                      >
                        {source.app}
                      </Link>
                    </TableCell>

                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      <a
                        href={source.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="hover:underline"
                        title={source.sourceUrl}
                      >
                        {source.sourceUrl}
                      </a>
                    </TableCell>

                    <TableCell>
                      <SourceStatusBadge status={source.status} />
                    </TableCell>

                    <TableCell className="text-right tabular-nums text-xs">
                      {source.corpusPageCount}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {source.lastSuccessfulSyncAt
                        ? formatStableDate(source.lastSuccessfulSyncAt)
                        : 'Never'}
                    </TableCell>

                    <TableCell>
                      <DriftIndicator
                        daysSinceSuccess={daysSince}
                        freshnessTarget={source.freshnessTarget}
                      />
                    </TableCell>

                    <TableCell className="max-w-[180px] text-xs text-destructive truncate">
                      {source.lastError ? (
                        <span title={source.lastError}>{source.lastError}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <ReSyncButton
                        sourceId={source.id}
                        app={source.app}
                        onSuccess={refetch}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
