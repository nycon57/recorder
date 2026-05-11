'use client';

import { formatDistanceToNow } from 'date-fns';

import { Badge } from '@/app/components/ui/badge';
import type { VendorSourceOpsStatus } from '@/lib/services/vendor-source-ops';

/**
 * Canonical status → Badge variant mapping for vendor source health indicators.
 * Extracted from vendor-sources/page.tsx (TRIB-146) for reuse across
 * dashboard, pages browser, and recent-jobs strip (TRIB-149).
 */
export function SourceStatusBadge({ status }: { status: VendorSourceOpsStatus }) {
  switch (status) {
    case 'healthy':
      return <Badge variant="default">Healthy</Badge>;
    case 'syncing':
      return <Badge variant="secondary">Syncing</Badge>;
    case 'stale':
      return (
        <Badge variant="outline" className="border-amber-500/40 text-amber-700">
          Stale
        </Badge>
      );
    case 'blocked':
      return (
        <Badge variant="outline" className="border-orange-500/40 text-orange-700">
          Blocked
        </Badge>
      );
    case 'failing':
      return <Badge variant="destructive">Failing</Badge>;
    case 'never_synced':
      return (
        <Badge variant="outline" className="border-zinc-500/40 text-zinc-700">
          Never synced
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

/** Job status badge for ingest job rows */
export function JobStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <Badge variant="default">Completed</Badge>;
    case 'processing':
      return <Badge variant="secondary">Processing</Badge>;
    case 'pending':
      return (
        <Badge variant="outline" className="border-zinc-500/40 text-zinc-600">
          Pending
        </Badge>
      );
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

/** Format an ISO timestamp as relative distance, or 'Never' when null. */
export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Never';
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return value;
  }
}
