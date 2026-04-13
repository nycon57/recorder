/**
 * Wiki Page Version History — Server Component
 * ==============================================
 *
 * Displays all versions of a wiki page in a timeline with diff comparison
 * and point-in-time date filtering. Uses the Supabase RPC function
 * `get_org_wiki_page_history` directly from the server component.
 *
 * Auth: `requireOrg()` — any authenticated user in the caller's org.
 * Unauthenticated / misconfigured users get redirected to `/dashboard`.
 */

import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { ArrowLeft, GitBranch } from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { requireOrg } from '@/lib/utils/api';

import { VersionTimeline } from './version-timeline';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Version History | Knowledge',
  description: 'View all versions of a wiki page with diff comparison and point-in-time filtering.',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WikiPageVersion {
  id: string;
  app: string | null;
  screen: string | null;
  topic: string;
  content: string;
  confidence: number;
  valid_from: string;
  valid_until: string | null;
  supersedes_id: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compilation_log: any;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function WikiVersionHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let orgId: string;
  try {
    const ctx = await requireOrg();
    orgId = ctx.orgId;
  } catch {
    redirect('/dashboard');
  }

  const { id } = await params;

  if (!UUID_RE.test(id)) {
    notFound();
  }

  const supabase = createAdminClient();
  const { data: versions, error } = await supabase.rpc(
    'get_org_wiki_page_history' as never,
    { p_page_id: id, p_org_id: orgId } as never,
  );

  if (error || !versions || (versions as WikiPageVersion[]).length === 0) {
    notFound();
  }

  const typedVersions = versions as WikiPageVersion[];

  // Head version is the one with no valid_until (current active version)
  const headVersion =
    typedVersions.find((v) => v.valid_until === null) ?? typedVersions[0];

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/knowledge/health"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Knowledge Health
          </Link>
          <h1 className="flex items-center gap-3 text-3xl font-normal tracking-tight">
            <GitBranch className="h-8 w-8 text-primary" />
            {headVersion.topic}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline">
              {typedVersions.length} {typedVersions.length === 1 ? 'version' : 'versions'}
            </Badge>
            {headVersion.app && (
              <Badge variant="secondary">{headVersion.app}</Badge>
            )}
            {headVersion.screen && (
              <Badge variant="secondary">{headVersion.screen}</Badge>
            )}
          </div>
        </div>
      </header>

      <VersionTimeline versions={typedVersions} headId={headVersion.id} />
    </div>
  );
}
