'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Archive, RefreshCw, Table2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';

interface SourceCardActionsProps {
  sourceId: string;
  app: string;
  /** If a job is already pending/processing, warn the operator before re-queuing. */
  activeJobStatus: 'pending' | 'processing' | null;
  syncBlockReason: string | null;
  lifecycle: 'active' | 'paused' | 'retired';
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
  syncBlockReason,
  lifecycle,
  onResyncSuccess,
}: SourceCardActionsProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRetiring, setIsRetiring] = useState(false);
  const [retireOpen, setRetireOpen] = useState(false);
  const [retirementReason, setRetirementReason] = useState('');

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

  async function handleRetire() {
    const reason = retirementReason.trim();
    if (reason.length < 5) {
      toast.error('Retirement reason is required.');
      return;
    }

    setIsRetiring(true);
    try {
      const res = await fetch(`/api/admin/vendor-sources/${sourceId}/retire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(json?.error?.message ?? json?.message ?? `Retire failed (${res.status})`);
        return;
      }

      toast.success(`Retired ${app}`);
      setRetirementReason('');
      setRetireOpen(false);
      onResyncSuccess?.();
    } catch (err) {
      toast.error('Network error — please try again.');
      console.error('[SourceCardActions] retire error:', err);
    } finally {
      setIsRetiring(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleResync}
        disabled={isSyncing || Boolean(syncBlockReason)}
        className="gap-1.5"
        title={
          syncBlockReason ??
          (activeJobStatus
            ? `A ${activeJobStatus} job already exists — force=true will re-enqueue anyway`
            : 'Queue a manual re-sync for this source')
        }
      >
        <RefreshCw className={`size-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
        {isSyncing ? 'Queueing...' : 'Re-sync now'}
      </Button>

      <Dialog open={retireOpen} onOpenChange={setRetireOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={lifecycle === 'retired'}
            className="gap-1.5"
          >
            <Archive className="size-3.5" />
            Retire
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Retire {app}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor={`retire-${sourceId}`}>Reason</Label>
            <Textarea
              id={`retire-${sourceId}`}
              value={retirementReason}
              onChange={(event) => setRetirementReason(event.target.value)}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRetireOpen(false)}
                disabled={isRetiring}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleRetire}
                disabled={isRetiring}
              >
                {isRetiring ? 'Retiring...' : 'Retire source'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Button variant="ghost" size="sm" asChild className="gap-1.5">
        <Link href={`/admin/vendor-sources/pages?app=${encodeURIComponent(app)}`}>
          <Table2 className="size-3.5" />
          View pages
        </Link>
      </Button>
    </div>
  );
}
