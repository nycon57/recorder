'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';


import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { useFetchWithInterval } from '@/app/hooks/useFetchWithAbort';
import type {
  VendorSourceOpsItem,
  VendorSourceOpsSnapshot,
  VendorSourceOpsStatus,
} from '@/lib/services/vendor-source-ops';
import { AddSourceButton } from '@/app/components/admin/vendor-sources/add-source-button';
import { SourceCardActions } from '@/app/components/admin/vendor-sources/source-card-actions';
import { RecentIngestJobs } from '@/app/components/admin/vendor-sources/recent-ingest-jobs';

function formatTimestamp(value: string | null): string {
  if (!value) return 'Never';
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

function getStatusBadge(status: VendorSourceOpsStatus) {
  switch (status) {
    case 'healthy':
      return <Badge variant="default">Healthy</Badge>;
    case 'syncing':
      return <Badge variant="secondary">Syncing</Badge>;
    case 'stale':
      return (
        <Badge variant="outline" className="border-amber-500/40 text-amber-700">
          Stale
        </Badge>
      );
    case 'failing':
      return <Badge variant="destructive">Failing</Badge>;
    case 'never_synced':
      return (
        <Badge variant="outline" className="border-slate-500/40 text-slate-700">
          Never synced
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function renderBand(values: string[], fallback: string) {
  if (values.length === 0) {
    return <span className="text-muted-foreground">{fallback}</span>;
  }

  return values.join(', ');
}

function SourceCard({ source, onResync }: { source: VendorSourceOpsItem; onResync?: () => void }) {
  const hasApplicabilityMetadata =
    source.applicability &&
    typeof source.applicability === 'object' &&
    !Array.isArray(source.applicability) &&
    Object.keys(source.applicability).length > 0;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{source.app}</CardTitle>
              {getStatusBadge(source.status)}
              {source.officialSource ? (
                <Badge variant="outline">Official</Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{source.sourceKind}</Badge>
              <Badge variant="secondary">{source.fetchStrategy}</Badge>
              <Badge variant="secondary">{source.publisherHostname}</Badge>
              <Badge
                variant={
                  source.termsReviewStatus === 'approved' ? 'default' : 'outline'
                }
              >
                terms:{source.termsReviewStatus}
              </Badge>
            </div>
          </div>

          <Link
            href={source.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Open source
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Freshness
            </p>
            <p className="text-sm">{source.freshnessTarget}</p>
            <p className="text-xs text-muted-foreground">
              Last success: {formatTimestamp(source.lastSuccessfulSyncAt)}
            </p>
            <p className="text-xs text-muted-foreground">
              Last attempt: {formatTimestamp(source.lastAttemptAt)}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Coverage
            </p>
            <p className="text-sm">Corpus pages: {source.corpusPageCount}</p>
            <p className="text-xs text-muted-foreground">
              Legacy pages: {source.legacyPageCount}
            </p>
            {source.activeJobStatus ? (
              <p className="text-xs text-muted-foreground">
                Active job: {source.activeJobStatus}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Applicability
            </p>
            <p className="text-sm">
              Versions: {renderBand(source.versionBand, 'All versions')}
            </p>
            <p className="text-xs text-muted-foreground">
              Plans: {renderBand(source.planBand, 'All plans')}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Failure state
            </p>
            {source.lastError ? (
              <p className="text-sm text-destructive">{source.lastError}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No active error</p>
            )}
            <p className="text-xs text-muted-foreground">
              Hash: {source.contentHash ?? 'Unavailable'}
            </p>
          </div>
        </div>

        {hasApplicabilityMetadata ? (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Applicability metadata
            </p>
            <pre className="overflow-x-auto text-xs text-muted-foreground">
              {JSON.stringify(source.applicability, null, 2)}
            </pre>
          </div>
        ) : null}

        <SourceCardActions
          sourceId={source.id}
          app={source.app}
          activeJobStatus={source.activeJobStatus}
          onResyncSuccess={onResync}
        />
      </CardContent>
    </Card>
  );
}

export default function AdminVendorSourcesPage() {
  const { data, error, loading, refetch } = useFetchWithInterval<{
    data: VendorSourceOpsSnapshot;
  }>('/api/admin/vendor-sources', 60000);

  const snapshot = data?.data ?? null;
  const inlineErrorMessage = error
    ? error.message.includes('403')
      ? 'Access denied. System admin privileges required.'
      : error.message
    : null;

  if (loading && !snapshot) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Loading vendor source health...
          </p>
        </div>
      </div>
    );
  }

  if (inlineErrorMessage && !snapshot) {
    return (
      <div className="trbd-page">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>{inlineErrorMessage}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Loading vendor source health...
          </p>
        </div>
      </div>
    );
  }

  const needsAttention =
    snapshot.summary.failingSources +
      snapshot.summary.staleSources +
      snapshot.summary.neverSyncedSources >
    0;

  return (
    <div className="trbd-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="trbd-page-title flex items-center gap-2">
            <BookOpen className="h-7 w-7" />
            Vendor Sources
          </h1>
          <p className="text-muted-foreground">
            Internal visibility into shared vendor source freshness, failures,
            provenance, and applicability.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            Updated {formatTimestamp(snapshot.generatedAt)}
          </Badge>
          <button
            type="button"
            onClick={refetch}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <Link
            href="/admin/vendor-sources/health"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <Activity className="h-4 w-4" />
            Health
          </Link>
          <AddSourceButton />
        </div>
      </div>

      {inlineErrorMessage ? (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>{inlineErrorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {needsAttention ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {snapshot.summary.failingSources} failing, {snapshot.summary.staleSources}{' '}
            stale, and {snapshot.summary.neverSyncedSources} never-synced vendor
            source{snapshot.summary.totalSources === 1 ? '' : 's'} currently need
            operator attention.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            All shared vendor sources are currently healthy or actively syncing.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{snapshot.summary.totalSources}</div>
            <p className="text-xs text-muted-foreground">
              Across {snapshot.summary.appsCovered} apps
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Healthy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{snapshot.summary.healthySources}</div>
            <p className="text-xs text-muted-foreground">Fresh and error-free</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Syncing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{snapshot.summary.syncingSources}</div>
            <p className="text-xs text-muted-foreground">Pending or processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Stale / Failing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {snapshot.summary.staleSources + snapshot.summary.failingSources}
            </div>
            <p className="text-xs text-muted-foreground">
              Past target or errored
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Restricted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {snapshot.summary.restrictedSources}
            </div>
            <p className="text-xs text-muted-foreground">Terms review restricted</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {snapshot.sources.map((source) => (
          <SourceCard key={source.id} source={source} onResync={refetch} />
        ))}
      </div>

      <RecentIngestJobs />
    </div>
  );
}
