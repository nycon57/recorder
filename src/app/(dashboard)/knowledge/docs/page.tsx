import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { buildKnowledgeDocsList } from '@/lib/services/knowledge-docs';
import {
  KNOWLEDGE_VENDOR_COVERAGE,
  knowledgeDocsQuerySchema,
  type KnowledgeDocsQueryInput,
} from '@/lib/types/knowledge-docs';
import { getKnowledgeStatusMeta } from '@/lib/utils/knowledge-status';
import { requireOrg } from '@/lib/utils/api';
import { formatStableDateTime } from '@/lib/utils/formatting';

export const metadata = {
  title: 'Knowledge Docs | Dashboard',
  description: 'Canonical compiled docs list for operational workflows.',
};

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

function toTitleCase(value: string) {
  return value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function normalizeSearchParams(
  params: Record<string, string | string[] | undefined>,
) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
}

export default async function KnowledgeDocsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ orgId }, rawSearchParams] = await Promise.all([
    requireOrg(),
    searchParams,
  ]);
  const query = knowledgeDocsQuerySchema.parse(
    normalizeSearchParams(rawSearchParams),
  );

  const payload = await buildKnowledgeDocsList({
    orgId,
    query,
  });

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Docs Workspace
        </h1>
        <p className="text-sm text-muted-foreground">
          Canonical compiled knowledge pages with operational filters for
          routing, coverage, and cluster workflows.
        </p>
      </header>

      <section className="rounded-xl border bg-card/40 p-4 sm:p-6 space-y-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" method="get">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Search
            </span>
            <input
              type="text"
              name="search"
              defaultValue={query.search ?? ''}
              placeholder="Topic, app, or screen"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Type
            </span>
            <select
              name="type"
              defaultValue={query.type ?? ''}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">All types</option>
              {payload.facets.types.map((option) => (
                <option key={option.value} value={option.value}>
                  {toTitleCase(option.label)} ({option.count})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status
            </span>
            <select
              name="status"
              defaultValue={query.status ?? ''}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              {payload.facets.statuses.map((option) => (
                <option key={option.value} value={option.value}>
                  {toTitleCase(option.label)} ({option.count})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              App
            </span>
            <select
              name="app"
              defaultValue={query.app ?? ''}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">All apps</option>
              {payload.facets.apps.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Vendor Coverage
            </span>
            <select
              name="vendorCoverage"
              defaultValue={query.vendorCoverage ?? ''}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">All coverage</option>
              {KNOWLEDGE_VENDOR_COVERAGE.map((value) => {
                const count =
                  payload.facets.vendorCoverage.find(
                    (item) => item.value === value,
                  )?.count ?? 0;
                return (
                  <option key={value} value={value}>
                    {toTitleCase(value)} ({count})
                  </option>
                );
              })}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cluster
            </span>
            <select
              name="cluster"
              defaultValue={query.cluster ?? ''}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">All clusters</option>
              {payload.facets.clusters.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Sort
            </span>
            <select
              name="sort"
              defaultValue={query.sort}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="updated_desc">Updated (newest)</option>
              <option value="updated_asc">Updated (oldest)</option>
              <option value="topic_asc">Topic (A → Z)</option>
              <option value="topic_desc">Topic (Z → A)</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Limit
            </span>
            <select
              name="limit"
              defaultValue={String(query.limit)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {[25, 50, 100, 150, 250].map((value) => (
                <option key={value} value={value}>
                  {value} rows
                </option>
              ))}
            </select>
          </label>

          <input type="hidden" name="offset" value="0" />

          <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2">
            <Button type="submit">Apply Filters</Button>
            <Button asChild type="button" variant="outline">
              <Link href="/knowledge/docs">Reset</Link>
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border bg-card/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Topic</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">App / Screen</th>
                <th className="px-4 py-3 font-medium">Vendor Coverage</th>
                <th className="px-4 py-3 font-medium">Cluster</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {payload.items.map((item) => {
                const statusMeta = getKnowledgeStatusMeta(item.status);
                return (
                  <tr key={item.id} className="border-t align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={item.detailHref}
                        className="inline-flex items-start gap-1 font-medium text-primary hover:underline"
                      >
                        <span>{item.topic}</span>
                        <ExternalLink className="mt-0.5 size-3.5" />
                      </Link>
                    </td>
                    <td className="px-4 py-3">{toTitleCase(item.type)}</td>
                    <td className="px-4 py-3">
                      <Badge className={statusMeta.badgeClassName}>
                        {statusMeta.shortLabel}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div>{item.app ?? 'Unassigned'}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.screen ?? 'No screen'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {toTitleCase(item.vendorCoverage)}
                    </td>
                    <td className="px-4 py-3">
                      {item.clusterName ?? 'Unclustered'}
                    </td>
                    <td className="px-4 py-3">
                      {formatConfidence(item.confidence)}
                    </td>
                    <td className="px-4 py-3">
                      {formatStableDateTime(item.updatedAt)}
                    </td>
                  </tr>
                );
              })}
              {payload.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No compiled knowledge pages matched these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
          <span>
            Showing {payload.items.length} of {payload.pagination.total} docs
          </span>
          <PaginationControls query={query} total={payload.pagination.total} />
        </div>
      </section>
    </div>
  );
}

function PaginationControls({
  query,
  total,
}: {
  query: KnowledgeDocsQueryInput;
  total: number;
}) {
  const hasPrevious = query.offset > 0;
  const nextOffset = query.offset + query.limit;
  const hasNext = nextOffset < total;

  const buildHref = (offset: number) => {
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    if (query.type) params.set('type', query.type);
    if (query.status) params.set('status', query.status);
    if (query.app) params.set('app', query.app);
    if (query.vendorCoverage)
      params.set('vendorCoverage', query.vendorCoverage);
    if (query.cluster) params.set('cluster', query.cluster);
    if (query.sort) params.set('sort', query.sort);
    params.set('limit', String(query.limit));
    params.set('offset', String(offset));
    return `/knowledge/docs?${params.toString()}`;
  };

  return (
    <div className="flex items-center gap-2">
      <Button asChild size="sm" variant="outline" disabled={!hasPrevious}>
        <Link
          href={
            hasPrevious
              ? buildHref(Math.max(0, query.offset - query.limit))
              : '#'
          }
        >
          Previous
        </Link>
      </Button>
      <Button asChild size="sm" variant="outline" disabled={!hasNext}>
        <Link href={hasNext ? buildHref(nextOffset) : '#'}>Next</Link>
      </Button>
    </div>
  );
}
