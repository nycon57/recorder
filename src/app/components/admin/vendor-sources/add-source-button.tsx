'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/components/ui/dialog';

import { NewIngestForm } from './new-ingest-form';

/**
 * Button + Dialog wrapper that mounts NewIngestForm inline on the dashboard.
 * On success the dialog closes and the dashboard re-polls within its 60s cadence.
 * Operators can also navigate to /admin/vendor-sources/new for the full-page form.
 *
 * TRIB-149
 */
export function AddSourceButton() {
  const [open, setOpen] = useState(false);
  const { refresh } = useRouter();

  function handleSuccess() {
    setOpen(false);
    // Refresh to allow dashboard to pick up the new syncing source quickly
    refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="size-4" />
          New source
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add vendor source</DialogTitle>
          <DialogDescription>
            Queue a new vendor documentation ingest. The crawler will start within seconds.
          </DialogDescription>
        </DialogHeader>
        <NewIngestForm onSuccess={() => handleSuccess()} />
      </DialogContent>
    </Dialog>
  );
}
