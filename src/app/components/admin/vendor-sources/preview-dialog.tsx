'use client';

/**
 * PreviewDialog
 *
 * Opens a shadcn Dialog to render vendor page markdown content inline.
 * Fetches from the existing GET /api/admin/vendor-sources/pages/[id] endpoint
 * which now includes the `content` field (extended in TRIB-152).
 *
 * Props:
 *   pageId  - UUID of the vendor_wiki_pages row
 *   trigger - React node used as the Dialog trigger (e.g. <Button>)
 *
 * TRIB-152
 */

import { useState } from 'react';
import { ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton';
import { formatStableDate } from '@/lib/utils/formatting';

import { PreviewMarkdown } from './preview-markdown';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PagePreviewData {
  id: string;
  app: string;
  screen: string;
  source_url: string | null;
  content: string | null;
  content_hash: string | null;
  created_at: string;
  updated_at: string;
  curated_by: string | null;
  ingest_job_id: string | null;
}

interface PreviewDialogProps {
  pageId: string;
  trigger: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Fetch state
// ---------------------------------------------------------------------------

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; page: PagePreviewData; curatedByEmail: string | null };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PreviewDialog({ pageId, trigger }: PreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FetchState>({ status: 'idle' });

  async function fetchPage() {
    setState({ status: 'loading' });
    try {
      const res = await fetch(`/api/admin/vendor-sources/pages/${pageId}`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setState({
          status: 'error',
          message: json?.error?.message ?? `Request failed (${res.status})`,
        });
        return;
      }
      const json = await res.json();
      setState({
        status: 'ok',
        page: json.data.page,
        curatedByEmail: json.data.curatedByEmail ?? null,
      });
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && state.status === 'idle') {
      fetchPage();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="max-w-4xl w-full">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {state.status === 'ok' ? (
              <span className="font-mono">{state.page.screen}</span>
            ) : (
              'Page preview'
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 mt-2 max-h-[70vh]">
          {/* ── Markdown pane ── */}
          <div className="flex-1 min-w-0 overflow-y-auto pr-2">
            {state.status === 'loading' && <PreviewSkeleton />}

            {state.status === 'error' && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <AlertCircle className="size-8 text-destructive" />
                <p className="text-sm text-muted-foreground">{state.message}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchPage}
                  className="gap-1.5"
                >
                  <RefreshCw className="size-3.5" />
                  Retry
                </Button>
              </div>
            )}

            {state.status === 'ok' &&
              (state.page.content ? (
                <PreviewMarkdown content={state.page.content} />
              ) : (
                <p className="text-sm text-muted-foreground py-4">
                  This page has no markdown content - likely an old crawl.
                </p>
              ))}
          </div>

          {/* ── Metadata rail ── */}
          {state.status === 'ok' && (
            <aside className="w-48 shrink-0 border-l pl-4 overflow-y-auto space-y-4 text-xs">
              <MetaItem label="App">
                <Badge variant="secondary">{state.page.app}</Badge>
              </MetaItem>

              <MetaItem label="Screen">
                <code className="font-mono break-all">{state.page.screen}</code>
              </MetaItem>

              {state.page.source_url ? (
                <MetaItem label="Source">
                  <a
                    href={state.page.source_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1 text-primary hover:underline break-all"
                  >
                    Open
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                </MetaItem>
              ) : null}

              <MetaItem label="Updated">
                {formatStableDate(state.page.updated_at)}
              </MetaItem>

              <MetaItem label="Curated by">
                {state.curatedByEmail ??
                  (state.page.curated_by ? (
                    <code className="font-mono break-all">
                      {state.page.curated_by.slice(0, 8)}…
                    </code>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  ))}
              </MetaItem>

              {state.page.ingest_job_id ? (
                <MetaItem label="Ingest job">
                  <a
                    href={`/admin/jobs?id=${state.page.ingest_job_id}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline font-mono break-all"
                  >
                    {state.page.ingest_job_id.slice(0, 8)}…
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                </MetaItem>
              ) : null}
            </aside>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function MetaItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="pt-2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}
