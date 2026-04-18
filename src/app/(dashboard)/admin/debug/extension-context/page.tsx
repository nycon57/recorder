import { redirect } from 'next/navigation';
import { Bug, Filter, Gauge, Globe, Layers3 } from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import {
  listExtensionContextDebugEvents,
  parseExtensionContextDebugFilters,
  type ExtensionContextDebugKnowledgeMode,
} from '@/lib/services/extension-context-debug';
import type { ExtensionContextPageType } from '@/lib/services/extension-context-telemetry';
import { requireAdmin } from '@/lib/utils/api';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Extension Context Debug | Tribora',
  description: 'Internal debug view for extension context telemetry',
};

type PageProps = {
  searchParams: Promise<{
    app?: string;
    pageType?: string;
    knowledgeMode?: string;
    host?: string;
    q?: string;
    limit?: string;
    since?: string;
  }>;
};

const PAGE_TYPE_OPTIONS: ExtensionContextPageType[] = [
  'dialog',
  'settings',
  'dashboard',
  'record_detail',
  'table',
  'form',
  'document',
  'marketing',
  'unknown',
];

const KNOWLEDGE_MODE_OPTIONS: ExtensionContextDebugKnowledgeMode[] = [
  'dom_only',
  'vendor_backed',
  'org_backed',
  'unknown',
];

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function knowledgeModeVariant(mode: ExtensionContextDebugKnowledgeMode) {
  switch (mode) {
    case 'org_backed':
      return 'aurora';
    case 'vendor_backed':
      return 'secondary';
    case 'dom_only':
      return 'outline';
    case 'unknown':
    default:
      return 'outline';
  }
}

function matchCategoryVariant(category: 'exact' | 'alias' | 'app' | 'domain' | 'unknown') {
  switch (category) {
    case 'exact':
      return 'aurora';
    case 'alias':
      return 'secondary';
    case 'domain':
      return 'outline';
    case 'app':
      return 'outline';
    case 'unknown':
    default:
      return 'outline';
  }
}

export default async function ExtensionContextDebugPage({
  searchParams,
}: PageProps) {
  let orgId: string;
  try {
    const ctx = await requireAdmin();
    orgId = ctx.orgId;
  } catch {
    redirect('/dashboard');
  }

  const filters = parseExtensionContextDebugFilters(await searchParams);
  const { events, summary, availableApps, availableHosts } =
    await listExtensionContextDebugEvents({
      orgId,
      filters,
    });

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-normal tracking-tight">
            <Bug className="h-7 w-7" />
            Extension Context Debug
          </h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            Hidden internal view for inspecting how the extension classified the
            current page, what knowledge it believed was available, and the
            exact semantic telemetry payload stored for each context check.
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {summary.total} checks shown
        </Badge>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Checks</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Gauge className="h-5 w-5" />
              {summary.total}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Distinct Apps</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Layers3 className="h-5 w-5" />
              {summary.distinctApps}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Distinct Hosts</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Globe className="h-5 w-5" />
              {summary.distinctHosts}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Knowledge Modes</CardDescription>
            <CardTitle className="text-base font-normal leading-6">
              <span className="mr-3">
                DOM {summary.byKnowledgeMode.dom_only}
              </span>
              <span className="mr-3">
                Vendor {summary.byKnowledgeMode.vendor_backed}
              </span>
              <span>Org {summary.byKnowledgeMode.org_backed}</span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>
            Narrow the recent context checks by page shape, app, host, and
            knowledge mode.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="GET" className="grid gap-4 md:grid-cols-6">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Search</label>
              <Input
                name="q"
                defaultValue={filters.query ?? ''}
                placeholder="app, screen, summary, path..."
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">App</label>
              <select
                name="app"
                defaultValue={filters.app ?? 'all'}
                className="bg-background border-primary/40 focus-visible:border-accent/50 focus-visible:ring-accent/20 h-9 w-full rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-[3px]"
              >
                <option value="all">All apps</option>
                {availableApps.map((app) => (
                  <option key={app} value={app}>
                    {app}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">
                Page Type
              </label>
              <select
                name="pageType"
                defaultValue={filters.pageType ?? 'all'}
                className="bg-background border-primary/40 focus-visible:border-accent/50 focus-visible:ring-accent/20 h-9 w-full rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-[3px]"
              >
                <option value="all">All types</option>
                {PAGE_TYPE_OPTIONS.map((pageType) => (
                  <option key={pageType} value={pageType}>
                    {pageType}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">
                Knowledge Mode
              </label>
              <select
                name="knowledgeMode"
                defaultValue={filters.knowledgeMode ?? 'all'}
                className="bg-background border-primary/40 focus-visible:border-accent/50 focus-visible:ring-accent/20 h-9 w-full rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-[3px]"
              >
                <option value="all">All modes</option>
                {KNOWLEDGE_MODE_OPTIONS.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Host</label>
              <select
                name="host"
                defaultValue={filters.host ?? 'all'}
                className="bg-background border-primary/40 focus-visible:border-accent/50 focus-visible:ring-accent/20 h-9 w-full rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-[3px]"
              >
                <option value="all">All hosts</option>
                {availableHosts.map((host) => (
                  <option key={host} value={host}>
                    {host}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Since</label>
              <select
                name="since"
                defaultValue={filters.since}
                className="bg-background border-primary/40 focus-visible:border-accent/50 focus-visible:ring-accent/20 h-9 w-full rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-[3px]"
              >
                <option value="1h">Last hour</option>
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="all">All available</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Limit</label>
              <Input
                name="limit"
                type="number"
                min={10}
                max={200}
                defaultValue={String(filters.limit)}
              />
            </div>
            <div className="flex items-end gap-2 md:col-span-2">
              <Button type="submit" variant="outline">
                Apply Filters
              </Button>
              <Button asChild variant="ghost">
                <a href="/admin/debug/extension-context">Clear</a>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Context Checks</CardTitle>
          <CardDescription>
            Each row is one semantic page-state check after extension-side
            deduping. Open a row to inspect the full telemetry payload.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {events.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 px-6 py-10 text-center text-sm text-muted-foreground">
              No extension context checks matched the current filters.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>App / Screen</TableHead>
                    <TableHead>Page Type</TableHead>
                    <TableHead>Knowledge</TableHead>
                    <TableHead>Latency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="align-top">
                        {formatTimestamp(event.createdAt)}
                      </TableCell>
                      <TableCell className="max-w-[300px] align-top">
                        <div className="font-medium">
                          {event.telemetry.urlHost}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {event.telemetry.urlPath}
                        </div>
                        {event.telemetry.selectedEntityTitle ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Entity: {event.telemetry.selectedEntityTitle}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="font-medium">{event.telemetry.app}</div>
                        <div className="text-xs text-muted-foreground">
                          {event.telemetry.screen}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="outline">
                          {event.telemetry.pageType}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant={knowledgeModeVariant(
                              event.telemetry.knowledgeMode,
                            )}
                          >
                            {event.telemetry.knowledgeMode}
                          </Badge>
                          <Badge
                            variant={matchCategoryVariant(
                              event.telemetry.vendorMatchCategory,
                            )}
                          >
                            Vendor:{' '}
                            {event.telemetry.vendorMatchLabel ??
                              event.telemetry.vendorMatchBasis}
                          </Badge>
                          <Badge
                            variant={matchCategoryVariant(
                              event.telemetry.orgMatchCategory,
                            )}
                          >
                            Org:{' '}
                            {event.telemetry.orgMatchLabel ??
                              event.telemetry.orgMatchBasis}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        {event.telemetry.latencyMs}ms
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="space-y-3">
                {events.map((event) => (
                  <details
                    key={`${event.id}-detail`}
                    className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3"
                  >
                    <summary className="cursor-pointer list-none text-sm font-medium">
                      Inspect {event.telemetry.appSignature} on{' '}
                      {event.telemetry.urlHost}
                    </summary>
                    <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                      <div className="space-y-2">
                        <div className="text-sm">
                          <span className="font-medium">Summary:</span>{' '}
                          {event.telemetry.pageSummary ||
                            'No summary available.'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Current nav:{' '}
                          {event.telemetry.currentNavigationLabels.join(', ') ||
                            'None'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Workspace:{' '}
                          {event.telemetry.workspaceValues.join(', ') || 'None'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Confidence: app{' '}
                          {event.telemetry.detectionConfidence.app ?? 'n/a'} /
                          screen{' '}
                          {event.telemetry.detectionConfidence.screen ?? 'n/a'}{' '}
                          / overall{' '}
                          {event.telemetry.detectionConfidence.overall ?? 'n/a'}
                        </div>
                        <div className="grid gap-3 pt-1 md:grid-cols-2">
                          <div className="rounded-md border border-border/60 bg-background p-3">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Vendor baseline
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge
                                variant={matchCategoryVariant(
                                  event.telemetry.vendorMatchCategory,
                                )}
                              >
                                {event.telemetry.vendorMatchLabel ??
                                  event.telemetry.vendorMatchBasis}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {event.telemetry.vendorMatchExplanation ??
                                'No vendor baseline explanation was recorded for this check.'}
                            </p>
                          </div>
                          <div className="rounded-md border border-border/60 bg-background p-3">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Org overlay
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge
                                variant={matchCategoryVariant(
                                  event.telemetry.orgMatchCategory,
                                )}
                              >
                                {event.telemetry.orgMatchLabel ??
                                  event.telemetry.orgMatchBasis}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {event.telemetry.orgMatchExplanation ??
                                'No org overlay explanation was recorded for this check.'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-md bg-background p-3 text-xs text-muted-foreground">
                        <div>
                          Headings: {event.telemetry.surfaceCounts.headings}
                        </div>
                        <div>
                          Navigation: {event.telemetry.surfaceCounts.navigation}
                        </div>
                        <div>
                          Actions:{' '}
                          {event.telemetry.surfaceCounts.primaryActions}
                        </div>
                        <div>Forms: {event.telemetry.surfaceCounts.forms}</div>
                        <div>
                          Tables: {event.telemetry.surfaceCounts.tables}
                        </div>
                        <div>
                          Dialogs: {event.telemetry.surfaceCounts.dialogs}
                        </div>
                        <div>
                          Interactive elements:{' '}
                          {event.telemetry.surfaceCounts.interactiveElements}
                        </div>
                        <div className="mt-2 break-all">
                          Fingerprint: {event.telemetry.fingerprint}
                        </div>
                      </div>
                    </div>
                    <pre className="mt-3 overflow-x-auto rounded-md bg-background p-3 text-xs leading-5 text-muted-foreground">
                      {JSON.stringify(event.telemetry, null, 2)}
                    </pre>
                  </details>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
