'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
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
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
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
import { useFetchWithInterval } from '@/app/hooks/useFetchWithAbort';
import type {
  VendorSourceOpsItem,
  VendorSourceOpsSnapshot,
  VendorSourceOpsStatus,
} from '@/lib/services/vendor-source-ops';
import { AddSourceButton } from '@/app/components/admin/vendor-sources/add-source-button';
import { RecentIngestJobs } from '@/app/components/admin/vendor-sources/recent-ingest-jobs';
import { SourceCardActions } from '@/app/components/admin/vendor-sources/source-card-actions';
import { SourceStatusBadge } from '@/app/components/admin/vendor-sources/source-status-badge';
import { DocLink } from '@/app/components/docs/doc-link';

type SelectFilter = 'all';
type StatusFilter = SelectFilter | VendorSourceOpsStatus;
type FreshnessFilter = 'all' | 'current' | 'due' | 'never' | 'attention';

interface Filters {
  query: string;
  status: StatusFilter;
  terms: SelectFilter | VendorSourceOpsItem['termsReviewStatus'];
  sourceKind: SelectFilter | VendorSourceOpsItem['sourceKind'];
  publisher: SelectFilter | string;
  freshness: FreshnessFilter;
}

const DEFAULT_FILTERS: Filters = {
  query: '',
  status: 'all',
  terms: 'all',
  sourceKind: 'all',
  publisher: 'all',
  freshness: 'all',
};

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Never';

  try {
    return new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatShortHash(value: string | null): string {
  if (!value) return 'Unavailable';
  return value.length > 18 ? `${value.slice(0, 18)}...` : value;
}

function renderBand(values: string[], fallback: string) {
  if (values.length === 0) {
    return <span className="text-muted-foreground">{fallback}</span>;
  }

  return values.join(', ');
}

function getLifecycleBadge(source: VendorSourceOpsItem) {
  if (source.lifecycle === 'retired') {
    return <Badge variant="destructive">Retired</Badge>;
  }

  if (source.lifecycle === 'paused') {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-700">
        Paused
      </Badge>
    );
  }

  return <Badge variant="secondary">Active</Badge>;
}

function getOfficialSourceBadge(source: VendorSourceOpsItem) {
  return source.officialSource ? (
    <Badge variant="outline">Official asserted</Badge>
  ) : (
    <Badge variant="destructive">Official missing</Badge>
  );
}

function isAttentionState(source: VendorSourceOpsItem): boolean {
  return (
    source.status === 'failing' ||
    source.status === 'stale' ||
    source.status === 'blocked' ||
    source.status === 'never_synced'
  );
}

function matchesFreshness(source: VendorSourceOpsItem, filter: FreshnessFilter): boolean {
  switch (filter) {
    case 'current':
      return Boolean(source.lastSuccessfulSyncAt) && !source.isDueForSync && !source.lastError;
    case 'due':
      return source.isDueForSync;
    case 'never':
      return !source.lastSuccessfulSyncAt;
    case 'attention':
      return isAttentionState(source);
    default:
      return true;
  }
}

function filterSources(
  sources: VendorSourceOpsItem[],
  filters: Filters,
): VendorSourceOpsItem[] {
  const query = filters.query.trim().toLowerCase();

  return sources.filter((source) => {
    if (filters.status !== 'all' && source.status !== filters.status) return false;
    if (filters.terms !== 'all' && source.termsReviewStatus !== filters.terms) return false;
    if (filters.sourceKind !== 'all' && source.sourceKind !== filters.sourceKind) return false;
    if (filters.publisher !== 'all' && source.publisherHostname !== filters.publisher) {
      return false;
    }
    if (!matchesFreshness(source, filters.freshness)) return false;

    if (!query) return true;

    const haystack = [
      source.app,
      source.publisherHostname,
      source.normalizedSourceUrl,
      source.sourceKind,
      source.termsReviewStatus,
      source.lifecycle,
      source.contentHash ?? '',
      source.latestSyncJobId ?? '',
      source.legalReviewReferenceUrl ?? '',
      source.legalReviewNotes ?? '',
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function SummaryLedger({ snapshot }: { snapshot: VendorSourceOpsSnapshot }) {
  const metrics = [
    ['Sources', snapshot.summary.totalSources.toString(), `${snapshot.summary.appsCovered} apps`],
    ['Healthy', snapshot.summary.healthySources.toString(), 'fresh'],
    ['Syncing', snapshot.summary.syncingSources.toString(), 'active jobs'],
    [
      'Attention',
      (
        snapshot.summary.staleSources +
        snapshot.summary.failingSources +
        snapshot.summary.blockedSources +
        snapshot.summary.neverSyncedSources
      ).toString(),
      'stale, blocked, failing, never',
    ],
    ['Restricted', snapshot.summary.restrictedSources.toString(), 'terms gated'],
    [
      'Lifecycle holds',
      (snapshot.summary.pausedSources + snapshot.summary.retiredSources).toString(),
      'paused or retired',
    ],
  ];

  return (
    <dl className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2 xl:grid-cols-6">
      {metrics.map(([label, value, helper]) => (
        <div key={label} className="bg-background px-3 py-2">
          <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
          <dd className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-semibold">{value}</span>
            <span className="text-xs text-muted-foreground">{helper}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function FilterBar({
  filters,
  onFiltersChange,
  sources,
}: {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  sources: VendorSourceOpsItem[];
}) {
  const publishers = useMemo(
    () => uniqueSorted(sources.map((source) => source.publisherHostname)),
    [sources],
  );
  const sourceKinds = useMemo(
    () => uniqueSorted(sources.map((source) => source.sourceKind)),
    [sources],
  );
  const termsStatuses = useMemo(
    () => uniqueSorted(sources.map((source) => source.termsReviewStatus)),
    [sources],
  );

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="rounded-md border bg-background p-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="vendor-source-search" className="text-xs">
            Search ledger
          </Label>
          <Input
            id="vendor-source-search"
            value={filters.query}
            onChange={(event) => update('query', event.target.value)}
            placeholder="App, publisher, URL, hash, job, review"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vendor-source-status" className="text-xs">
            Status
          </Label>
          <Select
            value={filters.status}
            onValueChange={(value) => update('status', value as StatusFilter)}
          >
            <SelectTrigger id="vendor-source-status" aria-label="Filter by source status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="failing">Failing</SelectItem>
              <SelectItem value="stale">Stale</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="never_synced">Never synced</SelectItem>
              <SelectItem value="syncing">Syncing</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vendor-source-terms" className="text-xs">
            Terms
          </Label>
          <Select
            value={filters.terms}
            onValueChange={(value) => update('terms', value as Filters['terms'])}
          >
            <SelectTrigger id="vendor-source-terms" aria-label="Filter by terms status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All terms</SelectItem>
              {termsStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vendor-source-kind" className="text-xs">
            Source kind
          </Label>
          <Select
            value={filters.sourceKind}
            onValueChange={(value) => update('sourceKind', value as Filters['sourceKind'])}
          >
            <SelectTrigger id="vendor-source-kind" aria-label="Filter by source kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kinds</SelectItem>
              {sourceKinds.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {kind}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vendor-source-publisher" className="text-xs">
            Publisher
          </Label>
          <Select
            value={filters.publisher}
            onValueChange={(value) => update('publisher', value)}
          >
            <SelectTrigger id="vendor-source-publisher" aria-label="Filter by publisher" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All publishers</SelectItem>
              {publishers.map((publisher) => (
                <SelectItem key={publisher} value={publisher}>
                  {publisher}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vendor-source-freshness" className="text-xs">
            Freshness
          </Label>
          <Select
            value={filters.freshness}
            onValueChange={(value) => update('freshness', value as FreshnessFilter)}
          >
            <SelectTrigger id="vendor-source-freshness" aria-label="Filter by freshness" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All freshness</SelectItem>
              <SelectItem value="attention">Needs attention</SelectItem>
              <SelectItem value="due">Due for sync</SelectItem>
              <SelectItem value="never">Never synced</SelectItem>
              <SelectItem value="current">Current</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function SourceLedgerTable({
  sources,
  selectedSourceId,
  onSelectSource,
}: {
  sources: VendorSourceOpsItem[];
  selectedSourceId: string | null;
  onSelectSource: (sourceId: string) => void;
}) {
  if (sources.length === 0) {
    return (
      <div className="rounded-md border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
        No vendor sources match the current filters.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[220px]">Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Publisher</TableHead>
            <TableHead>Terms</TableHead>
            <TableHead>Freshness</TableHead>
            <TableHead>Corpus</TableHead>
            <TableHead>Hash</TableHead>
            <TableHead>Latest job</TableHead>
            <TableHead className="sr-only">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map((source) => {
            const selected = source.id === selectedSourceId;

            return (
              <TableRow key={source.id} data-state={selected ? 'selected' : undefined}>
                <TableCell className="max-w-[320px] whitespace-normal">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{source.app}</span>
                      {getOfficialSourceBadge(source)}
                      {getLifecycleBadge(source)}
                    </div>
                    <Link
                      href={source.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block break-all text-xs text-primary hover:underline"
                    >
                      {source.normalizedSourceUrl}
                    </Link>
                  </div>
                </TableCell>
                <TableCell>
                  <SourceStatusBadge status={source.status} />
                </TableCell>
                <TableCell className="whitespace-normal break-words">
                  {source.publisherHostname}
                </TableCell>
                <TableCell>
                  <Badge variant={source.termsReviewStatus === 'approved' ? 'default' : 'outline'}>
                    {source.termsReviewStatus}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-normal text-xs">
                  <div className="space-y-1">
                    <div>{source.freshnessTarget}</div>
                    <div className="text-muted-foreground">
                      Success: {formatTimestamp(source.lastSuccessfulSyncAt)}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-xs">
                  <div>{source.corpusPageCount} corpus</div>
                  <div className="text-muted-foreground">{source.legacyPageCount} legacy</div>
                </TableCell>
                <TableCell className="max-w-[180px] whitespace-normal break-all font-mono text-xs">
                  <span title={source.contentHash ?? undefined}>
                    {formatShortHash(source.contentHash)}
                  </span>
                </TableCell>
                <TableCell className="text-xs">
                  {source.latestSyncJobId ? (
                    <Link
                      href={`/admin/jobs?id=${source.latestSyncJobId}`}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {source.latestSyncJobStatus ?? 'job'}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">No job</span>
                  )}
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onSelectSource(source.id)}
                    className="rounded-md border px-2 py-1 text-xs transition-colors hover:bg-muted"
                    aria-pressed={selected}
                  >
                    Details
                  </button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{children}</dd>
    </div>
  );
}

function SourceDetail({
  source,
  onResync,
}: {
  source: VendorSourceOpsItem | null;
  onResync?: () => void;
}) {
  if (!source) {
    return (
      <aside className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
        Select a source to inspect provenance.
      </aside>
    );
  }

  const hasApplicabilityMetadata =
    source.applicability &&
    typeof source.applicability === 'object' &&
    !Array.isArray(source.applicability) &&
    Object.keys(source.applicability).length > 0;

  return (
    <aside className="space-y-4 rounded-md border bg-background p-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">{source.app}</h2>
          <SourceStatusBadge status={source.status} />
          {getLifecycleBadge(source)}
        </div>
        <Link
          href={source.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="block break-all text-xs text-primary hover:underline"
        >
          {source.normalizedSourceUrl}
        </Link>
      </div>

      {source.lifecycle === 'retired' ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Retired {formatTimestamp(source.retiredAt)}:{' '}
            {source.retirementReason ?? 'No reason recorded'}
          </AlertDescription>
        </Alert>
      ) : source.lastError ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{source.lastError}</AlertDescription>
        </Alert>
      ) : source.syncBlockReason ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{source.syncBlockReason}</AlertDescription>
        </Alert>
      ) : null}

      <dl className="grid gap-4 sm:grid-cols-2">
        <DetailField label="Official assertion">
          {source.officialSource ? 'Official source asserted' : 'Official source missing'}
        </DetailField>
        <DetailField label="Publisher">{source.publisherHostname}</DetailField>
        <DetailField label="Source kind">{source.sourceKind}</DetailField>
        <DetailField label="Fetch strategy">{source.fetchStrategy}</DetailField>
        <DetailField label="Terms">{source.termsReviewStatus}</DetailField>
        <DetailField label="Freshness target">{source.freshnessTarget}</DetailField>
        <DetailField label="Last successful sync">
          {formatTimestamp(source.lastSuccessfulSyncAt)}
        </DetailField>
        <DetailField label="Last attempt">{formatTimestamp(source.lastAttemptAt)}</DetailField>
        <DetailField label="Content/corpus hash">
          <span className="break-all font-mono text-xs">{source.contentHash ?? 'Unavailable'}</span>
        </DetailField>
        <DetailField label="Latest sync job">
          {source.latestSyncJobId ? (
            <Link
              href={`/admin/jobs?id=${source.latestSyncJobId}`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {source.latestSyncJobId}
              <ExternalLink className="h-3 w-3" />
            </Link>
          ) : (
            'No sync job recorded'
          )}
        </DetailField>
        <DetailField label="Latest job status">
          {source.latestSyncJobStatus ?? 'Unavailable'}
        </DetailField>
        <DetailField label="Latest job time">
          {formatTimestamp(source.latestSyncJobCompletedAt ?? source.latestSyncJobCreatedAt)}
        </DetailField>
        <DetailField label="Version band">
          {renderBand(source.versionBand, 'All versions')}
        </DetailField>
        <DetailField label="Plan band">{renderBand(source.planBand, 'All plans')}</DetailField>
        <DetailField label="Corpus pages">
          {source.corpusPageCount} canonical / {source.legacyPageCount} legacy
        </DetailField>
        <DetailField label="Legal reviewed">
          {formatTimestamp(source.legalReviewedAt)}
        </DetailField>
        <DetailField label="Reviewed by">{source.legalReviewedBy ?? 'Unassigned'}</DetailField>
        <DetailField label="Review evidence">
          {source.legalReviewReferenceUrl ? (
            <Link
              href={source.legalReviewReferenceUrl}
              target="_blank"
              rel="noreferrer"
              className="break-all text-primary hover:underline"
            >
              {source.legalReviewReferenceUrl}
            </Link>
          ) : (
            'No reference URL'
          )}
        </DetailField>
      </dl>

      {source.legalReviewNotes ? (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase text-muted-foreground">Review notes</p>
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {source.legalReviewNotes}
          </p>
        </div>
      ) : null}

      {hasApplicabilityMetadata ? (
        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Applicability metadata
          </p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">
            {JSON.stringify(source.applicability, null, 2)}
          </pre>
        </div>
      ) : null}

      <SourceCardActions
        sourceId={source.id}
        app={source.app}
        activeJobStatus={source.activeJobStatus}
        syncBlockReason={source.syncBlockReason}
        lifecycle={source.lifecycle}
        onResyncSuccess={onResync}
      />
    </aside>
  );
}

export default function AdminVendorSourcesPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const { data, error, loading, refetch } = useFetchWithInterval<{
    data: VendorSourceOpsSnapshot;
  }>('/api/admin/vendor-sources', 60000);

  const snapshot = data?.data ?? null;
  const inlineErrorMessage = error
    ? error.message.includes('403')
      ? 'Access denied. System admin privileges required.'
      : error.message
    : null;

  const filteredSources = useMemo(
    () => filterSources(snapshot?.sources ?? [], filters),
    [filters, snapshot?.sources],
  );
  const selectedSource =
    filteredSources.find((source) => source.id === selectedSourceId) ??
    filteredSources[0] ??
    null;
  const effectiveSelectedSourceId = selectedSource?.id ?? null;

  if (loading && !snapshot) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Loading vendor source ledger...
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
            Loading vendor source ledger...
          </p>
        </div>
      </div>
    );
  }

  const needsAttention =
    snapshot.summary.failingSources +
      snapshot.summary.staleSources +
      snapshot.summary.blockedSources +
      snapshot.summary.neverSyncedSources >
    0;

  return (
    <div className="trbd-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="trbd-page-title flex items-center gap-2">
            <BookOpen className="h-7 w-7" />
            Vendor Source Ledger
          </h1>
          <p className="text-muted-foreground">
            System-admin ledger for official source provenance, sync freshness,
            legal evidence, and corpus hashes.
          </p>
          <div className="mt-1 flex items-center gap-4">
            <DocLink href="/docs/vendor-sources/sync-lifecycle">
              Sync lifecycle
            </DocLink>
            <DocLink href="/docs/vendor-sources/governance">
              Governance
            </DocLink>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Updated {formatTimestamp(snapshot.generatedAt)}</Badge>
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
            stale, {snapshot.summary.blockedSources} blocked, and{' '}
            {snapshot.summary.neverSyncedSources} never-synced source
            {snapshot.summary.totalSources === 1 ? '' : 's'} need operator
            attention.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            All active shared vendor sources are currently healthy or actively syncing.
          </AlertDescription>
        </Alert>
      )}

      <SummaryLedger snapshot={snapshot} />

      <FilterBar filters={filters} onFiltersChange={setFilters} sources={snapshot.sources} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <SourceLedgerTable
          sources={filteredSources}
          selectedSourceId={effectiveSelectedSourceId}
          onSelectSource={setSelectedSourceId}
        />
        <SourceDetail source={selectedSource} onResync={refetch} />
      </div>

      <RecentIngestJobs />
    </div>
  );
}
