/**
 * Knowledge Health Dashboard — TRIB-43
 * =====================================
 *
 * Server Component that extends the `/dashboard/knowledge` area with
 * wiki-specific health metrics powered by:
 *
 *   - TRIB-42 daily lint results (`wiki_lint_results`)
 *   - TRIB-41 pending contradictions count (`getPendingContradictionCount`)
 *   - TRIB-44 community-detection clusters (`wiki_clusters`)
 *   - TRIB-40 active / superseded `org_wiki_pages` rows
 *
 * Layout:
 *
 *   1. Page metrics card      — active pages, superseded, avg confidence, clusters
 *   2. Lint health card       — orphan/stale/stale_link/coverage_gap/confidence_decay
 *   3. Pending contradictions — count + link to /admin/wiki-review
 *   4. Coverage map           — "fully covered" vs "vendor-only gaps" (app, screen) pairs
 *   5. Lint detail drilldowns — first-N lists linking to per-page routes / vendor pages
 *
 * Auth: `requireOrg()` — any authenticated user in the caller's org.
 * Unauthenticated / misconfigured users get redirected to `/dashboard`.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileText,
  GitBranch,
  Inbox,
  Layers,
  Link2Off,
  MapPinned,
  Network,
  ShieldAlert,
  TimerOff,
  TrendingDown,
} from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireOrg } from '@/lib/utils/api';
import {
  getLatestLintResult,
  type CoverageGapDetail,
  type LintResult,
  type OrphanDetail,
  type StaleDetail,
  type StaleLinkDetail,
} from '@/lib/services/wiki-lint';
import { getPendingContradictionCount } from '@/lib/services/wiki-review';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Knowledge Health | Dashboard',
  description:
    'Wiki health metrics — lint results, contradictions, coverage, and clusters.',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageMetrics {
  activePages: number;
  supersededPages: number;
  averageConfidence: number | null;
  clusterCount: number;
}

interface CoverageMapData {
  fullyCovered: Array<{ app: string; screen: string }>;
  vendorOnlyGaps: CoverageGapDetail[];
}

// ---------------------------------------------------------------------------
// Data loaders
// ---------------------------------------------------------------------------

/**
 * Aggregate active/superseded page counts, average confidence over active
 * pages, and cluster count. Uses four narrow queries instead of one heavy
 * join — page counts are bounded (low thousands per org) so this is cheap.
 */
async function loadPageMetrics(orgId: string): Promise<PageMetrics> {
  const [activeRes, supersededRes, clusterRes] = await Promise.all([
    supabaseAdmin
      .from('org_wiki_pages')
      .select('confidence', { count: 'exact' })
      .eq('org_id', orgId)
      .is('valid_until', null),
    supabaseAdmin
      .from('org_wiki_pages')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .not('valid_until', 'is', null),
    supabaseAdmin
      .from('wiki_clusters')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId),
  ]);

  const activeRows = (activeRes.data ?? []) as Array<{ confidence: number }>;
  let averageConfidence: number | null = null;
  if (activeRows.length > 0) {
    const total = activeRows.reduce((sum, r) => sum + (r.confidence ?? 0), 0);
    averageConfidence = +(total / activeRows.length).toFixed(2);
  }

  return {
    activePages: activeRes.count ?? activeRows.length,
    supersededPages: supersededRes.count ?? 0,
    averageConfidence,
    clusterCount: clusterRes.count ?? 0,
  };
}

/**
 * Build the coverage map by cross-referencing `vendor_wiki_pages` against
 * the org's active `org_wiki_pages`. The "vendor-only gaps" list is pulled
 * straight from the persisted lint result so it matches what the cron saw
 * at 03:00 UTC. The "fully covered" list is computed live — vendor tuples
 * that DO have a matching active org page.
 */
async function loadCoverageMap(
  orgId: string,
  lintResult: LintResult | null
): Promise<CoverageMapData> {
  const [vendorRes, activeRes] = await Promise.all([
    supabaseAdmin.from('vendor_wiki_pages').select('app, screen'),
    supabaseAdmin
      .from('org_wiki_pages')
      .select('app, screen')
      .eq('org_id', orgId)
      .is('valid_until', null),
  ]);

  const vendorRows = (vendorRes.data ?? []) as Array<{
    app: string | null;
    screen: string | null;
  }>;
  const orgRows = (activeRes.data ?? []) as Array<{
    app: string | null;
    screen: string | null;
  }>;

  // Build case-insensitive set of covered (app, screen) keys from org pages.
  const coveredKeys = new Set<string>();
  for (const row of orgRows) {
    if (!row.app || !row.screen) continue;
    coveredKeys.add(`${row.app.toLowerCase()}::${row.screen.toLowerCase()}`);
  }

  // Build unique vendor tuples keyed the same way.
  const vendorTuples = new Map<string, { app: string; screen: string }>();
  for (const row of vendorRows) {
    if (!row.app || !row.screen) continue;
    const key = `${row.app.toLowerCase()}::${row.screen.toLowerCase()}`;
    if (!vendorTuples.has(key)) {
      vendorTuples.set(key, { app: row.app, screen: row.screen });
    }
  }

  const fullyCovered: Array<{ app: string; screen: string }> = [];
  for (const [key, tuple] of vendorTuples.entries()) {
    if (coveredKeys.has(key)) fullyCovered.push(tuple);
  }
  fullyCovered.sort(
    (a, b) =>
      a.app.localeCompare(b.app) || a.screen.localeCompare(b.screen)
  );

  // Vendor-only gaps: prefer the lint result (authoritative snapshot from
  // the last cron run) — fall back to live computation if the org has
  // never been linted.
  let vendorOnlyGaps: CoverageGapDetail[];
  if (lintResult) {
    vendorOnlyGaps = [...lintResult.details.coverage_gaps].sort(
      (a, b) =>
        a.app.localeCompare(b.app) || a.screen.localeCompare(b.screen)
    );
  } else {
    const liveGaps: CoverageGapDetail[] = [];
    const seen = new Set<string>();
    for (const [key, tuple] of vendorTuples.entries()) {
      if (coveredKeys.has(key)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      // Count vendor rows that share this (app, screen) — mirrors the lint
      // service's aggregation so empty-state numbers look the same.
      const vendorPagesCount = vendorRows.filter(
        (r) =>
          r.app &&
          r.screen &&
          `${r.app.toLowerCase()}::${r.screen.toLowerCase()}` === key
      ).length;
      liveGaps.push({
        app: tuple.app,
        screen: tuple.screen,
        vendor_pages_count: vendorPagesCount,
      });
    }
    vendorOnlyGaps = liveGaps.sort(
      (a, b) =>
        a.app.localeCompare(b.app) || a.screen.localeCompare(b.screen)
    );
  }

  return { fullyCovered, vendorOnlyGaps };
}

/**
 * Look up the vendor page id for a given (app, screen) tuple so coverage
 * gap rows can link directly to the source doc. Falls back to `null` when
 * no vendor row exists (shouldn't happen in practice — the tuple came
 * from vendor_wiki_pages in the first place).
 */
async function resolveVendorPageLinks(
  gaps: CoverageGapDetail[]
): Promise<Map<string, string>> {
  if (gaps.length === 0) return new Map();

  const { data, error } = await supabaseAdmin
    .from('vendor_wiki_pages')
    .select('id, app, screen');

  if (error || !data) return new Map();

  const byKey = new Map<string, string>();
  for (const row of data as Array<{
    id: string;
    app: string | null;
    screen: string | null;
  }>) {
    if (!row.app || !row.screen) continue;
    const key = `${row.app.toLowerCase()}::${row.screen.toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, row.id);
  }
  return byKey;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function KnowledgeHealthPage() {
  let orgId: string;
  try {
    const ctx = await requireOrg();
    orgId = ctx.orgId;
  } catch {
    redirect('/dashboard');
  }

  const [pageMetrics, lintResult, pendingContradictions] = await Promise.all([
    loadPageMetrics(orgId),
    getLatestLintResult(orgId),
    getPendingContradictionCount(orgId),
  ]);

  const coverageMap = await loadCoverageMap(orgId, lintResult);
  const vendorPageLinks = await resolveVendorPageLinks(
    coverageMap.vendorOnlyGaps
  );

  const lastRunLabel = lintResult
    ? `${formatDistanceToNow(new Date(lintResult.run_at), {
        addSuffix: true,
      })}`
    : null;

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-normal tracking-tight">
            <Activity className="h-8 w-8 text-primary" />
            Knowledge Health
          </h1>
          <p className="mt-1 text-muted-foreground">
            Wiki health metrics — page counts, lint results, contradictions,
            coverage, and clusters.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/knowledge">
              <Network className="mr-2 h-4 w-4" />
              Knowledge Graph
            </Link>
          </Button>
        </div>
      </header>

      {/* --- Row 1: Page metrics ------------------------------------------ */}
      <PageMetricsCard metrics={pageMetrics} />

      {/* --- Row 2: Lint health + Pending contradictions ----------------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LintHealthCard lintResult={lintResult} lastRunLabel={lastRunLabel} />
        </div>
        <PendingContradictionsCard count={pendingContradictions} />
      </div>

      {/* --- Row 3: Coverage map ----------------------------------------- */}
      <CoverageMapCard data={coverageMap} vendorPageLinks={vendorPageLinks} />

      {/* --- Row 4: Lint detail drilldowns ------------------------------- */}
      {lintResult && (
        <LintDetailLinks
          orphans={lintResult.details.orphans}
          stale={lintResult.details.stale}
          staleLinks={lintResult.details.stale_links}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card: Page metrics
// ---------------------------------------------------------------------------

function PageMetricsCard({ metrics }: { metrics: PageMetrics }) {
  const confidenceLabel =
    metrics.averageConfidence === null
      ? '—'
      : `${Math.round(metrics.averageConfidence * 100)}%`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Page metrics
        </CardTitle>
        <CardDescription>
          Snapshot of the compiled wiki for your organization.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Metric
            label="Active pages"
            value={metrics.activePages.toLocaleString()}
            caption="Currently live"
            icon={<FileText className="h-4 w-4 text-muted-foreground" />}
          />
          <Metric
            label="Superseded"
            value={metrics.supersededPages.toLocaleString()}
            caption="Replaced history"
            icon={<Layers className="h-4 w-4 text-muted-foreground" />}
          />
          <Metric
            label="Avg confidence"
            value={confidenceLabel}
            caption="Across active pages"
            icon={
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            }
          />
          <Metric
            label="Clusters"
            value={metrics.clusterCount.toLocaleString()}
            caption="Louvain communities"
            icon={<GitBranch className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  caption,
  icon,
}: {
  label: string;
  value: string;
  caption: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card/40 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card: Lint health (5 checks)
// ---------------------------------------------------------------------------

function LintHealthCard({
  lintResult,
  lastRunLabel,
}: {
  lintResult: LintResult | null;
  lastRunLabel: string | null;
}) {
  if (!lintResult) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Lint health
          </CardTitle>
          <CardDescription>
            Five automated daily checks across every active wiki page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/20 p-4">
            <Inbox className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                Lint hasn&apos;t run yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                First run scheduled for the next 03:00 UTC cron pass. Once
                it completes you&apos;ll see orphans, stale pages, stale
                links, coverage gaps, and confidence decay counts here.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const checks = [
    {
      label: 'Orphans',
      caption: 'No inbound graph edges',
      value: lintResult.orphan_count,
      icon: <Link2Off className="h-4 w-4 text-muted-foreground" />,
    },
    {
      label: 'Stale',
      caption: 'Not corroborated recently',
      value: lintResult.stale_count,
      icon: <TimerOff className="h-4 w-4 text-muted-foreground" />,
    },
    {
      label: 'Stale links',
      caption: 'Point at superseded pages',
      value: lintResult.stale_link_count,
      icon: <Link2Off className="h-4 w-4 text-muted-foreground" />,
    },
    {
      label: 'Coverage gaps',
      caption: 'Vendor pages missing in org',
      value: lintResult.coverage_gap_count,
      icon: <MapPinned className="h-4 w-4 text-muted-foreground" />,
    },
    {
      label: 'Confidence decay',
      caption: 'Confidence dropped this run',
      value: lintResult.confidence_decay_count,
      icon: <TrendingDown className="h-4 w-4 text-muted-foreground" />,
    },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          Lint health
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          Five automated daily checks across every active wiki page.
          {lastRunLabel && (
            <Badge variant="outline" className="ml-auto text-xs">
              Last run {lastRunLabel}
            </Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {checks.map((check) => (
            <div
              key={check.label}
              className="rounded-lg border bg-card/40 p-3"
            >
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                {check.icon}
                <span>{check.label}</span>
              </div>
              <div className="mt-1.5 text-2xl font-semibold tabular-nums">
                {check.value.toLocaleString()}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {check.caption}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Card: Pending contradictions
// ---------------------------------------------------------------------------

function PendingContradictionsCard({ count }: { count: number }) {
  const hasAny = count > 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Pending review
        </CardTitle>
        <CardDescription>
          Flagged contradictions awaiting admin approval.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={
            hasAny
              ? 'rounded-lg border border-amber-500/30 bg-amber-500/5 p-4'
              : 'rounded-lg border bg-card/40 p-4'
          }
        >
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {hasAny ? 'Needs attention' : 'Status'}
          </div>
          <div className="mt-2 text-3xl font-semibold tabular-nums">
            {hasAny ? count.toLocaleString() : 'All clear'}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasAny
              ? `${count === 1 ? 'entry' : 'entries'} awaiting review`
              : 'No pending contradictions to review'}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href="/admin/wiki-review">
            Open Wiki Review
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Card: Coverage map
// ---------------------------------------------------------------------------

function CoverageMapCard({
  data,
  vendorPageLinks,
}: {
  data: CoverageMapData;
  vendorPageLinks: Map<string, string>;
}) {
  const { fullyCovered, vendorOnlyGaps } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPinned className="h-5 w-5" />
          Coverage map
        </CardTitle>
        <CardDescription>
          Vendor (app, screen) pairs cross-referenced against your active
          wiki pages.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Fully covered */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Fully covered
              </h3>
              <Badge variant="outline" className="text-xs">
                {fullyCovered.length.toLocaleString()}
              </Badge>
            </div>
            {fullyCovered.length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
                No fully covered (app, screen) pairs yet. Add wiki pages for
                apps your team uses to see coverage here.
              </p>
            ) : (
              <ul className="divide-y rounded-md border bg-card/40">
                {fullyCovered.slice(0, 20).map((tuple) => (
                  <li
                    key={`${tuple.app}::${tuple.screen}`}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{tuple.app}</span>
                    <span className="text-xs text-muted-foreground">
                      {tuple.screen}
                    </span>
                  </li>
                ))}
                {fullyCovered.length > 20 && (
                  <li className="px-3 py-2 text-xs text-muted-foreground">
                    + {fullyCovered.length - 20} more
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Vendor-only gaps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Vendor-only gaps
              </h3>
              <Badge variant="outline" className="text-xs">
                {vendorOnlyGaps.length.toLocaleString()}
              </Badge>
            </div>
            {vendorOnlyGaps.length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
                Every vendor (app, screen) has a matching org wiki page.
              </p>
            ) : (
              <ul className="divide-y rounded-md border bg-card/40">
                {vendorOnlyGaps.slice(0, 20).map((gap) => {
                  const key = `${gap.app.toLowerCase()}::${gap.screen.toLowerCase()}`;
                  const vendorId = vendorPageLinks.get(key);
                  return (
                    <li
                      key={`${gap.app}::${gap.screen}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{gap.app}</span>
                        <span className="text-xs text-muted-foreground">
                          {gap.screen}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {gap.vendor_pages_count} vendor
                        </Badge>
                        {vendorId ? (
                          <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                          >
                            <Link
                              href={`/dashboard/knowledge/pages/${vendorId}`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
                {vendorOnlyGaps.length > 20 && (
                  <li className="px-3 py-2 text-xs text-muted-foreground">
                    + {vendorOnlyGaps.length - 20} more
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Card: Lint detail drilldowns
// ---------------------------------------------------------------------------

function LintDetailLinks({
  orphans,
  stale,
  staleLinks,
}: {
  orphans: OrphanDetail[];
  stale: StaleDetail[];
  staleLinks: StaleLinkDetail[];
}) {
  if (
    orphans.length === 0 &&
    stale.length === 0 &&
    staleLinks.length === 0
  ) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Flagged pages
        </CardTitle>
        <CardDescription>
          First 10 of each category from the most recent lint run. Click to
          open the page in the knowledge browser.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-3">
          <DrilldownList
            title="Orphans"
            icon={<Link2Off className="h-4 w-4 text-muted-foreground" />}
            entries={orphans.slice(0, 10).map((o) => ({
              key: o.page_id,
              href: `/dashboard/knowledge/pages/${o.page_id}`,
              primary: o.topic,
              secondary: 'No incoming edges',
            }))}
            total={orphans.length}
          />
          <DrilldownList
            title="Stale"
            icon={<TimerOff className="h-4 w-4 text-muted-foreground" />}
            entries={stale.slice(0, 10).map((s) => ({
              key: s.page_id,
              href: `/dashboard/knowledge/pages/${s.page_id}`,
              primary: s.topic,
              secondary: s.last_contributed_at
                ? `Last source ${formatDistanceToNow(
                    new Date(s.last_contributed_at),
                    { addSuffix: true }
                  )}`
                : 'Never corroborated',
            }))}
            total={stale.length}
          />
          <DrilldownList
            title="Stale links"
            icon={<Link2Off className="h-4 w-4 text-muted-foreground" />}
            entries={staleLinks.slice(0, 10).map((sl, idx) => ({
              key: `${sl.page_id}-${idx}`,
              href: `/dashboard/knowledge/pages/${sl.page_id}`,
              primary: sl.topic,
              secondary: `→ [[${sl.target_topic}]]`,
            }))}
            total={staleLinks.length}
          />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Note: the per-page route
          <code className="mx-1 rounded bg-muted px-1 py-0.5 text-[11px]">
            /dashboard/knowledge/pages/[id]
          </code>
          is a future drilldown target — if it does not yet exist in your
          build, links will 404 until it ships.
        </p>
      </CardContent>
    </Card>
  );
}

function DrilldownList({
  title,
  icon,
  entries,
  total,
}: {
  title: string;
  icon: React.ReactNode;
  entries: Array<{
    key: string;
    href: string;
    primary: string;
    secondary: string;
  }>;
  total: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </h3>
        <Badge variant="outline" className="text-xs">
          {total.toLocaleString()}
        </Badge>
      </div>
      {entries.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
          Nothing flagged.
        </p>
      ) : (
        <ul className="divide-y rounded-md border bg-card/40">
          {entries.map((entry) => (
            <li key={entry.key}>
              <Link
                href={entry.href}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted/40"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{entry.primary}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {entry.secondary}
                  </span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
          {total > entries.length && (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              + {total - entries.length} more
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
