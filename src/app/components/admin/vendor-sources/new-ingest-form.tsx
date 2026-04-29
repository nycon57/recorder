'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/components/ui/form';
import { Input } from '@/app/components/ui/input';
import { vendorIngestInputSchema, type VendorIngestInput } from '@/lib/schemas/vendor-source';

/** Suggested tier-1 apps shown below the app input as quick-fill chips. */
const TIER1_SUGGESTIONS = [
  'hubspot', 'slack', 'stripe', 'intercom', 'salesforce',
  'zendesk', 'notion', 'linear', 'github', 'vercel',
];

interface NewIngestFormProps {
  onSuccess?: (jobId: string) => void;
  defaultApp?: string;
}

/**
 * RHF + Zod form for registering and syncing a new vendor source.
 * Registers through POST /api/admin/vendor-sources, then queues by sourceId.
 * Used by both /admin/vendor-sources/new page and the AddSourceButton dialog.
 *
 * TRIB-149
 */
export function NewIngestForm({ onSuccess, defaultApp }: NewIngestFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<VendorIngestInput>({
    resolver: zodResolver(vendorIngestInputSchema),
    defaultValues: {
      app: defaultApp ?? '',
      url: '',
      maxPages: undefined,
      force: false,
    },
  });

  async function onSubmit(values: VendorIngestInput) {
    setIsSubmitting(true);
    try {
      const registerRes = await fetch('/api/admin/vendor-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const registerJson = await registerRes.json().catch(() => null);

      if (!registerRes.ok) {
        const message =
          registerJson?.message ??
          registerJson?.error?.message ??
          `Source registration failed (${registerRes.status})`;
        toast.error(message);
        return;
      }

      const sourceId = registerJson?.data?.source?.id;
      if (!sourceId) {
        toast.error('Source registration did not return a source ID.');
        return;
      }

      const syncRes = await fetch('/api/admin/vendor-sources/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId,
          force: values.force ?? true,
          ...(values.maxPages ? { maxPages: values.maxPages } : {}),
        }),
      });

      const syncJson = await syncRes.json().catch(() => null);

      if (!syncRes.ok) {
        const message =
          syncJson?.message ??
          syncJson?.error?.message ??
          `Sync queue failed (${syncRes.status})`;
        toast.error(message);
        return;
      }

      const jobId: string = syncJson?.data?.jobId ?? '';
      const status: string = syncJson?.data?.status ?? 'queued';

      if (status === 'skipped') {
        toast.info(syncJson?.data?.message ?? 'Sync job was skipped — a job is already pending or processing.');
      } else {
        toast.success(`Sync queued`, {
          description: `Job ${jobId} enqueued for ${values.app}`,
          action: jobId
            ? { label: 'View job', onClick: () => window.open(`/admin/jobs?id=${jobId}`, '_blank') }
            : undefined,
        });
      }

      onSuccess?.(jobId);
    } catch (err) {
      toast.error('Network error — please try again.');
      console.error('[NewIngestForm] submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* App identifier */}
        <FormField
          control={form.control}
          name="app"
          render={({ field }) => (
            <FormItem>
              <FormLabel>App identifier</FormLabel>
              <FormControl>
                <Input
                  placeholder="hubspot"
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Lowercase alphanumeric slug identifying the vendor app.
              </FormDescription>
              {/* Tier-1 suggestion chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {TIER1_SUGGESTIONS.map((app) => (
                  <button
                    key={app}
                    type="button"
                    onClick={() => form.setValue('app', app, { shouldValidate: true })}
                  >
                    <Badge
                      variant="outline"
                      className="cursor-pointer text-xs hover:bg-muted transition-colors"
                    >
                      {app}
                    </Badge>
                  </button>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Source URL */}
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Source URL</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder="https://knowledge.hubspot.com/contacts"
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Root or section URL to crawl. The crawler follows links from this starting point.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Max pages */}
        <FormField
          control={form.control}
          name="maxPages"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Max pages (optional)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  placeholder="Default from app config"
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    field.onChange(v === '' ? undefined : parseInt(v, 10));
                  }}
                />
              </FormControl>
              <FormDescription>
                1–500. Leave blank to use the per-app default from sync config.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Force re-crawl */}
        <FormField
          control={form.control}
          name="force"
          render={({ field }) => (
            <FormItem className="flex items-start gap-3 space-y-0">
              <FormControl>
                <input
                  type="checkbox"
                  checked={field.value ?? false}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border"
                />
              </FormControl>
              <div className="space-y-0.5">
                <FormLabel className="cursor-pointer font-medium">
                  Force re-crawl
                </FormLabel>
                <FormDescription>
                  Bypass pending/processing guard and re-enqueue even if a job is already active.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? 'Queueing...' : 'Queue ingest'}
        </Button>
      </form>
    </Form>
  );
}
