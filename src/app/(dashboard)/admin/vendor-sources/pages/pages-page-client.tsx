'use client';

import Link from 'next/link';
import { BookOpen, Plus } from 'lucide-react';
import { Suspense } from 'react';

import { Button } from '@/app/components/ui/button';
import { useFetchWithAbort } from '@/app/hooks/useFetchWithAbort';
import { PagesTable } from '@/app/components/admin/vendor-sources/pages-table';
import type { VendorSourceOpsSnapshot } from '@/lib/services/vendor-source-ops';

/**
 * Client shell for the pages browser — loads available apps from the snapshot
 * endpoint, then renders PagesTable which handles its own pagination data.
 *
 * TRIB-149
 */
export function PagesPageClient() {
  const { data: snapshotData } = useFetchWithAbort<{ data: VendorSourceOpsSnapshot }>(
    '/api/admin/vendor-sources',
  );

  const availableApps =
    snapshotData?.data?.sources?.map((s) => s.app).sort() ?? [];

  return (
    <div className="trbd-page">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/vendor-sources" className="hover:text-foreground transition-colors">
          Vendor Sources
        </Link>
        <span>/</span>
        <span className="text-foreground">Pages</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="trbd-page-title flex items-center gap-2">
            <BookOpen className="size-7" />
            Vendor Pages
          </h1>
          <p className="text-muted-foreground">
            Browse and manage canonical vendor documentation pages. Filter by app or search by screen.
          </p>
        </div>
        <Button size="sm" className="gap-2" asChild>
          <Link href="/admin/vendor-sources/new">
            <Plus className="size-4" />
            New ingest
          </Link>
        </Button>
      </div>

      <Suspense>
        <PagesTable availableApps={availableApps} />
      </Suspense>
    </div>
  );
}
