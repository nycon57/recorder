'use client';

/**
 * JobDetailDialog
 *
 * Renders full job payload + error in a Dialog. No additional fetch — the
 * failure row already carries all data needed. Used by FailureLogTable.
 *
 * TRIB-152
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';
import { formatStableDateTime } from '@/lib/utils/formatting';

interface JobDetailDialogProps {
  job: {
    id: string;
    status: string;
    payload: Record<string, unknown> | null;
    error: string | null;
    created_at: string;
    processing_started_at: string | null;
    completed_at: string | null;
    attempt_count: number;
    dedupe_key: string | null;
    triggeredByEmail?: string | null;
  };
  trigger: React.ReactNode;
}

export function JobDetailDialog({ job, trigger }: JobDetailDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <span className="font-mono">{job.id.slice(0, 12)}…</span>
            <Badge variant="destructive">failed</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2 text-sm">
          {/* Timestamps */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Queued
              </p>
              <p>{formatStableDateTime(job.created_at)}</p>
            </div>
            {job.processing_started_at && (
              <div className="space-y-0.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Started
                </p>
                <p>{formatStableDateTime(job.processing_started_at)}</p>
              </div>
            )}
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Attempts
              </p>
              <p>{job.attempt_count}</p>
            </div>
          </div>

          {/* Triggered by */}
          {job.triggeredByEmail || job.payload?.triggered_by_user_id ? (
            <div className="space-y-0.5 text-xs">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Triggered by
              </p>
              <p>
                {job.triggeredByEmail ??
                  String(job.payload?.triggered_by_user_id ?? '—')}
              </p>
            </div>
          ) : null}

          {/* Error */}
          {job.error ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-destructive">Error</p>
              <pre className="bg-destructive/5 border border-destructive/20 rounded-md p-3 text-xs font-mono whitespace-pre-wrap break-all overflow-x-auto">
                {job.error}
              </pre>
            </div>
          ) : null}

          {/* Payload */}
          {job.payload ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Payload
              </p>
              <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto">
                {JSON.stringify(job.payload, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
