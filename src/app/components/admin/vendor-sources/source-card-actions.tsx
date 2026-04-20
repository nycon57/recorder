'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Table2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/app/components/ui/button';

interface SourceCardActionsProps {
  sourceId: string;
  app: string;
  /** If a job is already pending/processing, warn the operator before re-queuing. */
  activeJobStatus: 'pending' | 'processing' | null;
  onResyncSuccess?: () => void;
}

/**
 * Per-source action buttons rendered inside SourceCard on the dashboard.
 * "Re-sync now" POSTs to the existing ingest endpoint with sourceId + force.
 * "View pages" links to the pages browser pre-filtered by app.
 *
 * TRIB-149
 */
export function SourceCardActions({
  sourceId,
  app,
  activeJobStatus,
  onResyncSuccess,
}: SourceCardActionsProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  async function handleResync() {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/admin/vendor-sources/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, force: true }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(json?.error?.message ?? `Re-sync failed (${res.status})`);
        return;
      }

      const status: string = json?.data?.status ?? 'queued';
      const jobId: string = json?.data?.jobId ?? '';

      if (status === 'skipped') {
        toast.info(json?.data?.message ?? 'Sync job skipped — already pending or processing.');
      } else {
        toast.success(`Re-sync queued for ${app}`, {
          description: `Job ${jobId} enqueued`,
          action: jobId
            ? { label: 'View job', onClick: () => window.open(`/admin/jobs?id=${jobId}`, '_blank') }
            : undefined,
        });
        onResyncSuccess?.();
      }
    } catch (err) {
      toast.error('Network error — please try again.');
      console.error('[SourceCardActions] resync error:', err);
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleResync}
        disabled={isSyncing}
        className="gap-1.5"
        title={
          activeJobStatus
            ? `A ${activeJobStatus} job already exists — force=true will re-enqueue anyway`
            : 'Queue a manual re-sync for this source'
        }
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
        {isSyncing ? 'Queueing...' : 'Re-sync now'}
      </Button>

      <Button variant="ghost" size="sm" asChild className="gap-1.5">
        <Link href={`/admin/vendor-sources/pages?app=${encodeURIComponent(app)}`}>
          <Table2 className="h-3.5 w-3.5" />
          View pages
        </Link>
      </Button>
    </div>
  );
}
