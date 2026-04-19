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
import { requireAdmin } from '@/lib/utils/api';

import { RoutingReviewCard } from './routing-review-card';
import { listReviewQueueItems, splitReviewQueueItemsByKind } from './review-queue';
import { WikiReviewCard } from './wiki-review-card';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Wiki Review | Admin',
  description: 'Review and resolve flagged wiki contradictions and routing gaps',
};

export default async function WikiReviewPage() {
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
    <div className="trbd-page">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="trbd-page-title tracking-tight">Wiki Review</h1>
          <p className="mt-1 text-muted-foreground">
            Resolve flagged contradictions and confirm routing gaps before wiki
            updates settle into their final destination.
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {totalEntries} pending
        </Badge>
      </header>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>How this works</AlertTitle>
        <AlertDescription>
          When a new recording contradicts an existing wiki page, the compilation
          engine flags it here instead of overwriting the page. Pages that still
          need human routing review also appear here. Contradictions can be
          approved, rejected, or rewritten directly. Routing decisions now show
          the proposed review surface so backend apply hooks can slot in without
          another UI pass.
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
              Every contradiction and routing gap has been resolved. New review
              work will appear here automatically.
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
                  Flagged wiki conflicts that still need direct approve, reject,
                  or rewrite decisions.
                </p>
              </div>
              {groupedItems.contradiction.map((item) => (
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
              ))}
            </section>
          ) : null}

          {groupedItems.routing.length > 0 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-medium">Needs Routing</h2>
                <p className="text-sm text-muted-foreground">
                  Pages missing stable app or screen placement, ready for reviewer
                  confirmation once routing apply hooks are connected.
                </p>
              </div>
              {groupedItems.routing.map((item) => (
                <RoutingReviewCard key={item.id} item={item} />
              ))}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
