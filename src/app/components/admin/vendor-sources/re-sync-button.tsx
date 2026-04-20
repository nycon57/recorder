'use client';

/**
 * ReSyncButton
 *
 * Shared re-sync action button. Extracted from SourceCardActions so the
 * health table and failure log can trigger re-syncs without duplicating
 * the fetch logic.
 *
 * TRIB-152
 */

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/app/components/ui/button';

interface ReSyncButtonProps {
  sourceId: string;
  app: string;
  size?: 'sm' | 'default';
  onSuccess?: () => void;
}

export function ReSyncButton({ sourceId, app, size = 'sm', onSuccess }: ReSyncButtonProps) {
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
          description: jobId ? `Job ${jobId} enqueued` : undefined,
          action: jobId
            ? {
                label: 'View job',
                onClick: () => window.open(`/admin/jobs?id=${jobId}`, '_blank'),
              }
            : undefined,
        });
        onSuccess?.();
      }
    } catch (err) {
      toast.error('Network error — please try again.');
      console.error('[ReSyncButton] resync error:', err);
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleResync}
      disabled={isSyncing}
      className="gap-1.5"
      title={`Queue a manual re-sync for ${app}`}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
      {isSyncing ? 'Queueing...' : 'Re-sync'}
    </Button>
  );
}
