import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  GitBranch,
  History,
  Link2,
  ShieldAlert,
  Sparkles,
  Workflow,
} from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { fetchKnowledgePageDetail } from '@/lib/services/knowledge-page-detail';
import { getKnowledgeStatusMeta } from '@/lib/services/knowledge-status';
import { parseRoutingReviewState } from '@/lib/services/routing-review';
import { requireOrg } from '@/lib/utils/api';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return formatDistanceToNow(date, { addSuffix: true });
}

function SafeTextBlock({ content }: { content: string }) {
  return (
    <pre className="max-h-[560px] overflow-auto rounded-md border bg-muted/20 p-4 text-sm whitespace-pre-wrap break-words">
      {content}
    </pre>
  );
}

export default async function KnowledgePageDetailPage({ params }: RouteParams) {
  let orgId: string;
  try {
    const org = await requireOrg();
    orgId = org.orgId;
  } catch {
    redirect('/dashboard');
  }

  const { id } = await params;
  const detail = await fetchKnowledgePageDetail({
    orgId,
    pageId: id,
  });

  if (!detail) {
    notFound();
  }

  const isOrgPage = detail.kind === 'org';
  const orgRoutingState = isOrgPage
    ? parseRoutingReviewState(detail.page.compilation_log)
    : null;
  const conceptEnrichmentHref = `/knowledge/map?view=list&originPage=${encodeURIComponent(detail.page.id)}`;
  const primaryGraphHref = '/knowledge/map?view=graph';

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/knowledge/health">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to knowledge health
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Detail route</span>
          <code className="rounded bg-muted px-2 py-1">/dashboard/knowledge/pages/{id}</code>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-normal tracking-tight">
                {isOrgPage ? detail.page.topic : `${detail.page.app} · ${detail.page.screen}`}
              </CardTitle>
              <CardDescription>
                {isOrgPage
                  ? 'Compiled organization knowledge page'
                  : 'Vendor baseline knowledge page'}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {isOrgPage ? (
                <>
                  <Badge variant="outline">Confidence {Math.round(detail.page.confidence * 100)}%</Badge>
                  {typeof orgRoutingState?.routeConfidence === 'number' ? (
                    <Badge variant="outline">
                      Route confidence {Math.round(orgRoutingState.routeConfidence * 100)}%
                    </Badge>
                  ) : null}
                  <Badge variant={detail.page.valid_until ? 'secondary' : 'default'}>
                    {detail.page.valid_until ? 'Superseded' : 'Active'}
                  </Badge>
                  {detail.page.app && detail.page.screen ? (
                    <Badge variant="secondary">{detail.page.app} / {detail.page.screen}</Badge>
                  ) : null}
                </>
              ) : (
                <>
                  <Badge variant="outline">Vendor</Badge>
                  {detail.page.app_version ? (
                    <Badge variant="secondary">Version {detail.page.app_version}</Badge>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p>{formatDate(detail.page.created_at)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Updated</p>
            <p>{formatDate(detail.page.updated_at)}</p>
          </div>
          {isOrgPage ? (
            <div>
              <p className="text-xs text-muted-foreground">Version window</p>
              <p>
                {formatDate(detail.page.valid_from)} → {detail.page.valid_until ? formatDate(detail.page.valid_until) : 'present'}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground">Source URL</p>
              {detail.page.source_url ? (
                <Link
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                  href={detail.page.source_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open vendor source
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <p>—</p>
              )}
            </div>
          )}
          {isOrgPage ? (
            <>
              <div>
                <p className="text-xs text-muted-foreground">Detected route</p>
                <p>
                  {orgRoutingState?.proposedRoute.topic ?? detail.page.topic} ·{' '}
                  {orgRoutingState?.proposedRoute.app ?? detail.page.app ?? 'unassigned app'} /{' '}
                  {orgRoutingState?.proposedRoute.screen ?? detail.page.screen ?? 'unassigned screen'}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground">Match basis</p>
                <p>
                  {orgRoutingState?.routeReason?.trim() ||
                    'Compiled route inferred from source transcript and metadata.'}
                </p>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Tabs defaultValue="content" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="content">
            <FileText className="h-4 w-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="vendor-baseline">
            <Workflow className="h-4 w-4" />
            Vendor Baseline
          </TabsTrigger>
          <TabsTrigger value="sources">
            <GitBranch className="h-4 w-4" />
            Sources
          </TabsTrigger>
          <TabsTrigger value="relationships">
            <ArrowRightLeft className="h-4 w-4" />
            Relationships
          </TabsTrigger>
          <TabsTrigger value="concept-enrichment">
            <Sparkles className="h-4 w-4" />
            Concept Enrichment
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="approvals">
            <ShieldAlert className="h-4 w-4" />
            Approvals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="content">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Page content</CardTitle>
              <CardDescription>
                {isOrgPage
                  ? 'Current compiled content for this organization page.'
                  : 'Vendor-authored baseline content for this app/screen pair.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SafeTextBlock content={detail.page.content} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendor-baseline">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Vendor baseline</CardTitle>
              <CardDescription>
                Canonical vendor docs aligned to this knowledge route.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isOrgPage ? (
                detail.vendorBaseline.length > 0 ? (
                  detail.vendorBaseline.map((vendorPage) => (
                    <div key={vendorPage.id} className="space-y-2 rounded-md border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{vendorPage.app}</Badge>
                          <Badge variant="secondary">{vendorPage.screen}</Badge>
                          {vendorPage.app_version ? (
                            <Badge variant="secondary">v{vendorPage.app_version}</Badge>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Updated {formatRelativeTime(vendorPage.updated_at)}
                          </span>
                          <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                            <Link href={`/dashboard/knowledge/pages/${vendorPage.id}`}>
                              Open
                            </Link>
                          </Button>
                          {vendorPage.source_url ? (
                            <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                              <Link href={vendorPage.source_url} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <SafeTextBlock content={vendorPage.content} />
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                    No vendor baseline found for this page&apos;s app/screen.
                  </p>
                )
              ) : (
                <div className="space-y-3 rounded-md border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{detail.page.app}</Badge>
                    <Badge variant="secondary">{detail.page.screen}</Badge>
                    {detail.page.app_version ? (
                      <Badge variant="secondary">v{detail.page.app_version}</Badge>
                    ) : null}
                  </div>
                  <SafeTextBlock content={detail.page.content} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Source provenance</CardTitle>
              <CardDescription>
                Recordings/documents that contributed to this page and available artifacts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isOrgPage ? (
                detail.sources.length > 0 ? (
                  detail.sources.map((source) => (
                    <div key={source.id} className="rounded-md border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {source.content?.title?.trim() || `Source ${source.sourceId.slice(0, 8)}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {source.sourceType} · contributed {formatRelativeTime(source.contributedAt)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {source.sourceType !== 'manual' ? (
                            <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                              <Link href={`/library/${source.sourceId}`}>
                                Open source
                              </Link>
                            </Button>
                          ) : null}
                          {source.content?.status ? (
                            <Badge variant="outline">{source.content.status}</Badge>
                          ) : null}
                        </div>
                      </div>
                      {source.contributionSummary ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {source.contributionSummary}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <Badge variant={source.artifacts.transcript ? 'default' : 'secondary'}>
                          Transcript {source.artifacts.transcript ? 'available' : 'missing'}
                        </Badge>
                        <Badge variant={source.artifacts.document ? 'default' : 'secondary'}>
                          Document {source.artifacts.document ? source.artifacts.document.status : 'missing'}
                        </Badge>
                        <Badge variant={source.artifacts.workflow ? 'default' : 'secondary'}>
                          Workflow {source.artifacts.workflow ? source.artifacts.workflow.status : 'missing'}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                    No source links recorded for this page yet.
                  </p>
                )
              ) : detail.matchingOrgPages.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    This vendor page currently maps to {detail.matchingOrgPages.length} active org page(s).
                  </p>
                  <ul className="divide-y rounded-md border bg-card/40">
                    {detail.matchingOrgPages.map((match) => (
                      <li key={match.id}>
                        <Link
                          href={`/dashboard/knowledge/pages/${match.id}`}
                          className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/30"
                        >
                          <div>
                            <p className="font-medium">{match.topic}</p>
                            <p className="text-xs text-muted-foreground">
                              Confidence {Math.round(match.confidence * 100)}%
                            </p>
                          </div>
                          <Link2 className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                  No active org pages currently mapped to this vendor baseline.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relationships">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Relationship graph</CardTitle>
              <CardDescription>
                Incoming and outgoing typed links for this page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isOrgPage ? (
                detail.relationships.length > 0 ? (
                  <ul className="divide-y rounded-md border bg-card/40">
                    {detail.relationships.map((relationship) => (
                      <li key={relationship.id} className="space-y-2 px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={relationship.direction === 'outgoing' ? 'default' : 'secondary'}>
                              {relationship.direction}
                            </Badge>
                            <Badge variant="outline">{relationship.relationshipType}</Badge>
                            <Badge variant="outline">{relationship.sourceType}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(relationship.confidence * 100)}% confidence
                            </span>
                          </div>
                          {relationship.relatedPage ? (
                            <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                              <Link href={`/dashboard/knowledge/pages/${relationship.relatedPage.id}`}>
                                Open related page
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                        {relationship.relatedPage ? (
                          <p className="text-sm">
                            {relationship.relatedPage.topic}
                            <span className="ml-2 text-xs text-muted-foreground">
                              {relationship.relatedPage.app && relationship.relatedPage.screen
                                ? `${relationship.relatedPage.app} / ${relationship.relatedPage.screen}`
                                : 'Unrouted'}
                            </span>
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Related page metadata is unavailable.
                          </p>
                        )}
                        {relationship.evidence ? (
                          <p className="text-sm text-muted-foreground">{relationship.evidence}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                    No relationships recorded for this page.
                  </p>
                )
              ) : (
                <p className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                  Relationship edges are modeled between org wiki pages. Open a mapped org page to inspect graph links.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="concept-enrichment">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Concept enrichment</CardTitle>
              <CardDescription>
                Extracted concept signals are secondary enrichment data. Canonical navigation stays
                on compiled pages and operational relationships.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Use concept mode when you need exploratory context, then return to page-centric views
                for routing, review, and publication decisions.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={conceptEnrichmentHref}>Open concept enrichment view</Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href={primaryGraphHref}>Open primary operational graph</Link>
                </Button>
              </div>
              {!isOrgPage ? (
                <p className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                  Vendor baselines remain reference material. Use mapped org pages for canonical
                  routing and governance actions.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Version history</CardTitle>
              <CardDescription>
                Temporal chain of page versions and lifecycle state.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isOrgPage ? (
                detail.history.length > 0 ? (
                  <div className="space-y-3">
                    {detail.history.map((version, index) => {
                      const statusMeta = getKnowledgeStatusMeta(version.knowledgeStatus);
                      return (
                        <details key={version.id} className="rounded-md border p-3">
                          <summary className="cursor-pointer list-none">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="space-y-1">
                                <p className="font-medium">
                                  Version {detail.history.length - index}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(version.createdAt)} · {formatRelativeTime(version.createdAt)}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={statusMeta.badgeVariant}>{statusMeta.label}</Badge>
                                <Badge variant="outline">{Math.round(version.confidence * 100)}%</Badge>
                              </div>
                            </div>
                          </summary>
                          <div className="mt-3 space-y-3">
                            <p className="text-sm text-muted-foreground">
                              Valid from {formatDate(version.validFrom)} to {version.validUntil ? formatDate(version.validUntil) : 'present'}
                            </p>
                            <SafeTextBlock content={version.content} />
                          </div>
                        </details>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                    No history chain found for this page.
                  </p>
                )
              ) : (
                <p className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                  Vendor baseline pages do not maintain org version chains.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Approvals and review state</CardTitle>
              <CardDescription>
                Pending contradictions and approval queue entries related to this page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isOrgPage ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={detail.approvals.pendingContradictions.length > 0 ? 'destructive' : 'default'}>
                      {detail.approvals.pendingContradictions.length} pending contradictions
                    </Badge>
                    <Badge variant="outline">
                      {detail.approvals.resolvedContradictions.length} resolved contradictions
                    </Badge>
                    <Badge variant={detail.approvals.pendingApprovals.length > 0 ? 'secondary' : 'outline'}>
                      {detail.approvals.pendingApprovals.length} pending approvals
                    </Badge>
                    <Badge variant="outline">
                      {detail.approvals.reviewedApprovals.length} reviewed approvals
                    </Badge>
                    <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                      <Link href="/admin/wiki-review">Open review queue</Link>
                    </Button>
                  </div>

                  {detail.approvals.pendingContradictions.length > 0 ? (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Pending contradictions</h3>
                      <ul className="divide-y rounded-md border bg-card/40">
                        {detail.approvals.pendingContradictions.map((pending) => (
                          <li key={`${pending.entryIndex}-${pending.entry.detected_at}`} className="px-3 py-2">
                            <p className="text-sm font-medium">
                              Entry #{pending.entryIndex + 1} · {formatRelativeTime(pending.entry.detected_at)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Source {pending.entry.source_recording_id}
                            </p>
                            {pending.entry.diff_summary ? (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {pending.entry.diff_summary}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                      No pending contradictions on this page.
                    </p>
                  )}

                  {detail.approvals.pendingApprovals.length > 0 || detail.approvals.reviewedApprovals.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">Pending approval queue</h3>
                        {detail.approvals.pendingApprovals.length > 0 ? (
                          <ul className="divide-y rounded-md border bg-card/40">
                            {detail.approvals.pendingApprovals.map((approval) => (
                              <li key={approval.id} className="px-3 py-2">
                                <p className="text-sm font-medium">{approval.action_type}</p>
                                <p className="text-xs text-muted-foreground">
                                  {approval.agent_type} · created {formatRelativeTime(approval.created_at)}
                                </p>
                                <p className="text-sm text-muted-foreground">{approval.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  Expires {formatDate(approval.expires_at)}
                                </p>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                            No pending queue entries.
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">Reviewed approvals</h3>
                        {detail.approvals.reviewedApprovals.length > 0 ? (
                          <ul className="divide-y rounded-md border bg-card/40">
                            {detail.approvals.reviewedApprovals.map((approval) => (
                              <li key={approval.id} className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  {approval.status === 'approved' ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                  ) : (
                                    <Clock3 className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <p className="text-sm font-medium capitalize">{approval.status}</p>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {approval.action_type} · reviewed {formatRelativeTime(approval.reviewed_at)}
                                </p>
                                {approval.rejection_reason ? (
                                  <p className="text-sm text-muted-foreground">
                                    {approval.rejection_reason}
                                  </p>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                            No reviewed entries linked to this page&apos;s sources.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                  Approval state is tracked on org knowledge pages and source workflows, not vendor baseline records directly.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
