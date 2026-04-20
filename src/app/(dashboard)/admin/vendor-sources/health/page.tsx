/**
 * /admin/vendor-sources/health — Vendor source freshness & failure log
 *
 * Defense-in-depth: calls requireSystemAdmin itself in addition to the
 * parent admin layout guard.
 *
 * Renders SourceHealthTable (per-source drift) and FailureLogTable
 * (paginated failed jobs) stacked. Both are client-side data-fetching
 * components with their own loading/error states.
 *
 * TRIB-152
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Activity } from 'lucide-react';

import { requireSystemAdmin } from '@/lib/utils/api';
import { SourceHealthTable } from '@/app/components/admin/vendor-sources/source-health-table';
import { FailureLogTable } from '@/app/components/admin/vendor-sources/failure-log-table';

export const dynamic = 'force-dynamic';

export default async function VendorSourcesHealthPage() {
  try {
    await requireSystemAdmin();
  } catch {
    redirect('/dashboard');
  }

  return (
    <div className="trbd-page space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/admin/vendor-sources"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Vendor Sources
        </Link>
        <span>/</span>
        <span className="text-foreground">Health</span>
      </div>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="trbd-page-title flex items-center gap-2">
          <Activity className="h-6 w-6" />
          Source Health
        </h1>
        <p className="text-muted-foreground text-sm">
          Per-source freshness, drift indicators, and paginated failure log.
          Shareable URL: <code className="font-mono text-xs">/admin/vendor-sources/health</code>
        </p>
      </div>

      {/* Freshness table */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Source freshness</h2>
        <SourceHealthTable />
      </section>

      {/* Failure log */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Failure log</h2>
        <p className="text-xs text-muted-foreground">
          Most recent 25 failed <code className="font-mono">ingest_vendor_docs</code> jobs.
          Click a job ID to inspect payload and full error trace.
        </p>
        <FailureLogTable />
      </section>
    </div>
  );
}
