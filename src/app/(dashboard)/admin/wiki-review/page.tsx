/**
 * Admin Wiki Review page — TRIB-34
 *
 * Server Component that lists every `org_wiki_pages` row in the caller's
 * organization that has at least one pending (`flagged`, `resolved_at IS
 * NULL`) contradiction in its `compilation_log`. Each pending entry is
 * rendered with Approve / Reject / Edit & Approve controls backed by the
 * server actions in `./actions.ts`.
 *
 * Auth: `requireAdmin()` — owner/admin role in the caller's org. Any user
 * without that role is redirected to `/dashboard`.
 */

import { redirect } from 'next/navigation';

import { AlertTriangle, Inbox } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';
import { Badge } from '@/app/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import {
  getKnowledgeStatusMeta,
  KNOWLEDGE_STATUS,
} from '@/lib/services/knowledge-status';
import {
  listReviewQueueItems,
  splitReviewQueueItemsByKind,
} from '@/lib/services/review-queue';
import { requireAdmin } from '@/lib/utils/api';

import { ReviewQueueItemCard } from './review-queue-item-card';
import { WikiReviewCard } from './wiki-review-card';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Review Queue | Admin',
  description: 'Review contradictions, routing gaps, and manual publication work',
};

export default async function WikiReviewPage() {
  const reviewStatusMeta = getKnowledgeStatusMeta(KNOWLEDGE_STATUS.NEEDS_REVIEW);
  let orgId: string;
  try {
    const ctx = await requireAdmin();
    orgId = ctx.orgId;
  } catch {
    redirect('/dashboard');
  }

  const reviewQueueItems = await listReviewQueueItems(orgId);
  const groupedItems = splitReviewQueueItemsByKind(reviewQueueItems);
  const totalEntries = reviewQueueItems.length;

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-normal tracking-tight">Review Queue</h1>
          <p className="mt-1 text-muted-foreground">
            Resolve contradictions, route ambiguous knowledge, and finish manual
            publication work from one operational surface.
          </p>
        </div>
        <Badge
          variant={reviewStatusMeta.badgeVariant}
          className={reviewStatusMeta.badgeClassName}
        >
          {totalEntries} {reviewStatusMeta.shortLabel}
        </Badge>
      </header>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>How this works</AlertTitle>
        <AlertDescription>
          Contradictions can still be approved, rejected, or edited directly here.
          Routing and manual-publication items point you to the owning workflow so
          reviewers can resolve the work without losing context.
        </AlertDescription>
      </Alert>

      {reviewQueueItems.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              No pending reviews
            </CardTitle>
            <CardDescription>
              Review items will appear here when contradictions, routing gaps, or
              manual publication work needs attention.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedItems.contradiction.length > 0 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-medium">Contradictions</h2>
                <p className="text-sm text-muted-foreground">
                  Flagged wiki conflicts that still need a direct approve, reject,
                  or edit decision.
                </p>
              </div>
              {groupedItems.contradiction.map((item) =>
                item.kind === 'contradiction' ? (
                  <WikiReviewCard
                    key={item.id}
                    pageId={item.pageId}
                    logEntryIndex={item.logEntryIndex}
                    topic={item.topic}
                    app={item.app}
                    screen={item.screen}
                    currentContent={item.currentContent}
                    detectedAt={item.detectedAt}
                    sourceRecordingId={item.sourceRecordingId}
                    contradictions={item.contradictions}
                    additions={item.additions}
                    mergedContentPreview={item.mergedContentPreview}
                  />
                ) : null
              )}
            </section>
          ) : null}

          {groupedItems.routing.length > 0 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-medium">Needs Routing</h2>
                <p className="text-sm text-muted-foreground">
                  Knowledge pages missing a stable app or screen assignment.
                </p>
              </div>
              {groupedItems.routing.map((item) =>
                item.kind === 'routing' ? (
                  <ReviewQueueItemCard key={item.id} item={item} />
                ) : null
              )}
            </section>
          ) : null}

          {groupedItems['manual-publication'].length > 0 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-medium">Manual Publication</h2>
                <p className="text-sm text-muted-foreground">
                  Completed documents that are ready for a reviewer to publish
                  through the library flow.
                </p>
              </div>
              {groupedItems['manual-publication'].map((item) =>
                item.kind === 'manual-publication' ? (
                  <ReviewQueueItemCard key={item.id} item={item} />
                ) : null
              )}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
