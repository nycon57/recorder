/**
 * GET /api/knowledge/clusters — TRIB-44.
 *
 * Returns the Louvain-detected communities for the authenticated org.
 * Populated weekly by /api/cron/wiki-clusters.
 *
 * Response shape:
 *   {
 *     clusters: [
 *       {
 *         id: string,
 *         name: string,
 *         member_count: number,
 *         central_page_id: string | null,
 *         central_page_topic: string | null,
 *         modularity: number | null,
 *         computed_at: string
 *       },
 *       ...
 *     ],
 *     total: number
 *   }
 *
 * Ordered by member_count DESC so the biggest communities surface first
 * in admin UIs. Cluster metadata is denormalised (we join to
 * org_wiki_pages to pull `central_page_topic` for display convenience)
 * so clients can render a card grid without a second round-trip.
 *
 * Auth: requireOrg() — standard org-scoped reader.
 * Runtime: nodejs (matches the rest of /api/knowledge/**).
 */

import { NextRequest } from 'next/server';

import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ClusterRow {
  id: string;
  name: string;
  member_count: number;
  central_page_id: string | null;
  modularity: number | null;
  computed_at: string;
}

interface CentralPageRow {
  id: string;
  topic: string;
}

export const GET = apiHandler(async (_request: NextRequest) => {
  const { orgId } = await requireOrg();
  const supabase = createClient();

  // Fetch clusters for the org — largest first.
  const { data: clustersRaw, error: clustersError } = await supabase
    .from('wiki_clusters')
    .select('id, name, member_count, central_page_id, modularity, computed_at')
    .eq('org_id', orgId)
    .order('member_count', { ascending: false });

  if (clustersError) {
    console.error('[GET /api/knowledge/clusters] fetch failed', clustersError);
    throw new Error(`Failed to fetch clusters: ${clustersError.message}`);
  }

  const clusters = (clustersRaw ?? []) as ClusterRow[];

  if (clusters.length === 0) {
    return successResponse({ clusters: [], total: 0 });
  }

  // Pull central page topics in a single round-trip so clients don't
  // have to join themselves. NULL central_page_id rows (possible when
  // a page gets deleted after detection runs) are handled gracefully.
  const centralIds = Array.from(
    new Set(
      clusters
        .map((c) => c.central_page_id)
        .filter((id): id is string => id !== null)
    )
  );

  const topicById = new Map<string, string>();

  if (centralIds.length > 0) {
    const { data: pagesRaw, error: pagesError } = await supabase
      .from('org_wiki_pages')
      .select('id, topic')
      .in('id', centralIds);

    if (pagesError) {
      console.error(
        '[GET /api/knowledge/clusters] central page fetch failed',
        pagesError
      );
      // Non-fatal — we can still return cluster rows without topics.
    } else {
      for (const p of (pagesRaw ?? []) as CentralPageRow[]) {
        topicById.set(p.id, p.topic);
      }
    }
  }

  const payload = clusters.map((c) => ({
    id: c.id,
    name: c.name,
    member_count: c.member_count,
    central_page_id: c.central_page_id,
    central_page_topic: c.central_page_id
      ? (topicById.get(c.central_page_id) ?? null)
      : null,
    modularity: c.modularity,
    computed_at: c.computed_at,
  }));

  return successResponse({
    clusters: payload,
    total: payload.length,
  });
});
