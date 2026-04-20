'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { ConfirmationDialog } from '@/app/components/ui/confirmation-dialog';
import { useFetchWithInterval } from '@/app/hooks/useFetchWithAbort';

interface VendorPage {
  id: string;
  app: string;
  screen: string;
  source_url: string | null;
  content_hash: string | null;
  created_at: string;
  updated_at: string;
  vendor_source_id: string | null;
}

interface PagesResponse {
  pages: VendorPage[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
    nextOffset: number | null;
  };
}

interface PagesTableProps {
  /** Available app slugs for the filter dropdown. Loaded from snapshot. */
  availableApps: string[];
}

const PAGE_SIZE = 50;

/**
 * Full vendor_wiki_pages browser with app filter, screen search, pagination,
 * and per-row delete via ConfirmationDialog (requires typing the `app` name).
 *
 * NOTE: vendor_wiki_pages has no soft-delete column. Deletion is permanent.
 * TRIB-152 will likely add a soft-delete / "retract" affordance — until then
 * deletions here are hard-deletes. This component should NOT add bulk-delete.
 *
 * TRIB-149
 */
export function PagesTable({ availableApps }: PagesTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const appFilter = searchParams.get('app') ?? '';
  const offsetParam = searchParams.get('offset');
  const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

  const [screenSearch, setScreenSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<VendorPage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Build query URL
  const queryUrl = appFilter
    ? `/api/admin/vendor-sources/pages?app=${encodeURIComponent(appFilter)}&offset=${offset}`
    : `/api/admin/vendor-sources/pages?offset=${offset}`;

  const { data, loading, refetch } = useFetchWithInterval<{ data: PagesResponse }>(
    queryUrl,
    0, // no auto-poll — user-driven on this view
  );

  const pagesData = data?.data;
  const allPages = pagesData?.pages ?? [];

  // Client-side screen filter (no extra API call for P0)
  const pages = screenSearch
    ? allPages.filter((p) =>
        p.screen.toLowerCase().includes(screenSearch.toLowerCase()),
      )
    : allPages;

  function setAppFilter(app: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (app && app !== 'all') {
      params.set('app', app);
    } else {
      params.delete('app');
    }
    params.delete('offset');
    router.push(`?${params.toString()}`);
  }

  function goToOffset(newOffset: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (newOffset > 0) {
      params.set('offset', String(newOffset));
    } else {
      params.delete('offset');
    }
    router.push(`?${params.toString()}`);
  }

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/vendor-sources/pages/${deleteTarget.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.error?.message ?? `Delete failed (${res.status})`);
        return;
      }

      toast.success(`Page '${deleteTarget.screen}' deleted`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error('Network error — please try again.');
      console.error('[PagesTable] delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, refetch]);

  const total = pagesData?.pagination.total ?? 0;
  const prevOffset = offset > 0 ? Math.max(0, offset - PAGE_SIZE) : null;
  const nextOffset = pagesData?.pagination.nextOffset ?? null;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={appFilter || 'all'} onValueChange={setAppFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All apps" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All apps</SelectItem>
            {availableApps.map((app) => (
              <SelectItem key={app} value={app}>
                {app}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Search by screen…"
          value={screenSearch}
          onChange={(e) => setScreenSearch(e.target.value)}
          className="w-52"
        />

        <span className="text-sm text-muted-foreground ml-auto">
          {loading ? 'Loading…' : `${total} pages`}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">App</TableHead>
              <TableHead>Screen</TableHead>
              <TableHead className="hidden lg:table-cell">Source URL</TableHead>
              <TableHead className="hidden md:table-cell w-36">Updated</TableHead>
              <TableHead className="hidden xl:table-cell w-32">Hash</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {loading ? 'Loading pages…' : 'No pages found.'}
                </TableCell>
              </TableRow>
            ) : (
              pages.map((page) => (
                <TableRow key={page.id}>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {page.app}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/admin/vendor-sources/pages/${page.id}`}
                      className="hover:underline"
                    >
                      {page.screen}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell max-w-xs">
                    {page.source_url ? (
                      <a
                        href={page.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline truncate"
                      >
                        {page.source_url}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(page.updated_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {page.content_hash ? (
                      <span
                        className="font-mono text-xs text-muted-foreground"
                        title={page.content_hash}
                      >
                        {page.content_hash.slice(0, 10)}…
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild className="h-7 px-2">
                        <Link href={`/admin/vendor-sources/pages/${page.id}`}>View</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(page)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {(prevOffset !== null || nextOffset !== null) && (
        <div className="flex items-center justify-between text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={prevOffset === null}
            onClick={() => prevOffset !== null && goToOffset(prevOffset)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={nextOffset === null}
            onClick={() => nextOffset !== null && goToOffset(nextOffset)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Delete confirmation dialog — requires typing the app name */}
      <ConfirmationDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete vendor page"
        description={
          deleteTarget
            ? `This will permanently remove the canonical page '${deleteTarget.screen}' from the shared vendor corpus. This cannot be undone.`
            : ''
        }
        confirmText={deleteTarget?.app ?? 'confirm'}
        cancelText="Cancel"
        onConfirm={handleDelete}
        isLoading={isDeleting}
        variant="destructive"
        requireTypedConfirmation={deleteTarget?.app ?? true}
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
