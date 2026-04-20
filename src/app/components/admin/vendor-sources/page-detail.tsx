'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { ConfirmationDialog } from '@/app/components/ui/confirmation-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';

interface ParentSource {
  app: string;
  source_url: string;
  publisher_hostname: string;
  status: string;
}

interface PageDetailData {
  id: string;
  app: string;
  screen: string;
  source_url: string | null;
  content_hash: string | null;
  created_at: string;
  updated_at: string;
  vendor_source_id: string | null;
  curated_by: string | null; // Not yet populated by worker — display blank (TRIB-149 note)
  ingest_job_id: string | null;
}

interface PageDetailProps {
  page: PageDetailData;
  parentSource: ParentSource | null;
}

/**
 * Single vendor_wiki_pages detail view.
 *
 * Preview button is non-interactive (disabled) — ships with TRIB-149 as a
 * scaffold only. Wired behavior lands in TRIB-152.
 *
 * curated_by is displayed blank when null — the worker does not populate
 * this field yet. A follow-up (flagged as TRIB-152 scope or sibling ticket)
 * will backfill the writer.
 *
 * TRIB-149
 */
export function PageDetail({ page, parentSource }: PageDetailProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/vendor-sources/pages/${page.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.error?.message ?? `Delete failed (${res.status})`);
        return;
      }

      toast.success(`Page '${page.screen}' deleted`);
      router.push('/admin/vendor-sources/pages');
    } catch (err) {
      toast.error('Network error — please try again.');
      console.error('[PageDetail] delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="trbd-page">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/admin/vendor-sources"
          className="hover:text-foreground transition-colors"
        >
          Vendor Sources
        </Link>
        <span>/</span>
        <Link
          href={`/admin/vendor-sources/pages?app=${encodeURIComponent(page.app)}`}
          className="hover:text-foreground transition-colors"
        >
          {page.app}
        </Link>
        <span>/</span>
        <span className="text-foreground font-mono">{page.screen}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-1 -ml-2" asChild>
              <Link href={`/admin/vendor-sources/pages?app=${encodeURIComponent(page.app)}`}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
          </div>
          <h1 className="trbd-page-title font-mono">{page.screen}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{page.app}</Badge>
            {page.source_url ? (
              <a
                href={page.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Open source page
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2">
          {/* Preview — non-interactive stub (TRIB-152 will wire this) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="outline" size="sm" disabled className="gap-1.5 cursor-not-allowed opacity-50">
                  <Eye className="h-4 w-4" />
                  Preview
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Preview available in TRIB-152</p>
            </TooltipContent>
          </Tooltip>

          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete page
          </Button>
        </div>
      </div>

      {/* Metadata grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Page metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <MetaRow label="ID" value={<code className="font-mono text-xs">{page.id}</code>} />
            <MetaRow label="App" value={<Badge variant="secondary">{page.app}</Badge>} />
            <MetaRow label="Screen" value={<code className="font-mono text-xs">{page.screen}</code>} />
            <MetaRow
              label="Content hash"
              value={
                page.content_hash ? (
                  <code
                    className="font-mono text-xs"
                    title={page.content_hash}
                  >
                    {page.content_hash}
                  </code>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )
              }
            />
            <MetaRow
              label="Curated by"
              value={
                page.curated_by ? (
                  page.curated_by
                ) : (
                  <span className="text-muted-foreground">—</span>
                )
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Timestamps &amp; provenance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <MetaRow
              label="Created"
              value={formatDistanceToNow(new Date(page.created_at), { addSuffix: true })}
            />
            <MetaRow
              label="Last updated"
              value={formatDistanceToNow(new Date(page.updated_at), { addSuffix: true })}
            />
            <MetaRow
              label="Ingest job"
              value={
                page.ingest_job_id ? (
                  <a
                    href={`/admin/jobs?id=${page.ingest_job_id}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline font-mono text-xs"
                  >
                    {page.ingest_job_id.slice(0, 12)}…
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )
              }
            />
            {page.vendor_source_id ? (
              <MetaRow
                label="Parent source"
                value={
                  <Link
                    href="/admin/vendor-sources"
                    className="text-primary hover:underline font-mono text-xs"
                  >
                    {page.vendor_source_id.slice(0, 12)}…
                  </Link>
                }
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Parent source context */}
      {parentSource ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Parent vendor source</CardTitle>
            <CardDescription>{parentSource.publisher_hostname}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <MetaRow label="Status" value={<Badge variant="outline">{parentSource.status}</Badge>} />
            <MetaRow
              label="Source URL"
              value={
                <a
                  href={parentSource.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {parentSource.source_url}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Delete confirmation — requires typing the app name */}
      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={(open) => !open && setDeleteOpen(false)}
        title="Delete vendor page"
        description={`This will permanently remove the canonical page '${page.screen}' from the shared vendor corpus. This cannot be undone.`}
        confirmText={page.app}
        cancelText="Cancel"
        onConfirm={handleDelete}
        isLoading={isDeleting}
        variant="destructive"
        requireTypedConfirmation={page.app}
        warnings={[
          {
            message:
              'This is a hard delete. There is no soft-delete or recycle bin. The page will be removed from all knowledge responses immediately.',
            variant: 'destructive',
          },
        ]}
      />
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-28 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground pt-0.5">
        {label}
      </span>
      <div className="min-w-0 break-all">{value}</div>
    </div>
  );
}
