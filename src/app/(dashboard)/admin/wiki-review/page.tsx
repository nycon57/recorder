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
import { listPendingReviewPages } from '@/lib/services/wiki-review';

import { WikiReviewCard } from './wiki-review-card';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Wiki Review | Admin',
  description: 'Review and resolve flagged wiki contradictions',
};

export default async function WikiReviewPage() {
  let orgId: string;
  try {
    const ctx = await requireAdmin();
    orgId = ctx.orgId;
  } catch {
    redirect('/dashboard');
  }

  const pendingPages = await listPendingReviewPages(orgId);
  const totalEntries = pendingPages.reduce((sum, p) => sum + p.pendingEntries.length, 0);

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-normal tracking-tight">Wiki Review</h1>
          <p className="mt-1 text-muted-foreground">
            Approve, reject, or edit flagged contradictions detected by the wiki
            compilation engine.
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
          engine flags it here instead of overwriting the page. Approving applies
          the change (superseding the prior row). Editing lets you write the final
          content yourself. Rejecting leaves the page untouched.
        </AlertDescription>
      </Alert>

      {pendingPages.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              No pending reviews
            </CardTitle>
            <CardDescription>
              Every flagged contradiction has been resolved. New ones will appear here
              automatically.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      ) : (
        <div className="space-y-6">
          {pendingPages.map(({ page, pendingEntries }) =>
            pendingEntries.map(({ entryIndex, entry }) => (
              <WikiReviewCard
                key={`${page.id}-${entryIndex}`}
                pageId={page.id}
                logEntryIndex={entryIndex}
                topic={page.topic}
                app={page.app}
                screen={page.screen}
                currentContent={page.content}
                detectedAt={entry.detected_at}
                sourceRecordingId={entry.source_recording_id}
                contradictions={entry.contradictions ?? []}
                additions={entry.additions}
                mergedContentPreview={entry.merged_content ?? null}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
