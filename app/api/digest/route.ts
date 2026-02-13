/**
 * Digest API Route
 *
 * Returns the most recent weekly digest and optional historical digests
 * from agent_activity_log entries with action_type: 'weekly_digest'.
 *
 * Query params:
 *  - history=true  Include up to 12 most recent digests
 */

import { NextRequest } from 'next/server';

import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Safely extract the digest object from an agent_activity_log metadata column. */
function extractDigest(metadata: unknown): Record<string, unknown> | null {
  const meta = metadata as Record<string, unknown> | null;
  return (meta?.digest as Record<string, unknown>) ?? null;
}

/** Build a base query for successful weekly digest entries scoped to an org. */
function digestQuery(orgId: string) {
  return supabaseAdmin
    .from('agent_activity_log')
    .select('id, metadata, created_at')
    .eq('org_id', orgId)
    .eq('action_type', 'weekly_digest')
    .eq('outcome', 'success')
    .order('created_at', { ascending: false });
}

export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();

  const includeHistory =
    request.nextUrl.searchParams.get('history') === 'true';

  // Fetch the most recent weekly digest for this org
  const { data: latest, error: latestError } = await digestQuery(orgId)
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw new Error(`Failed to fetch digest: ${latestError.message}`);
  }

  let history = null;
  if (includeHistory) {
    const { data: historyData, error: historyError } = await digestQuery(orgId)
      .limit(12);

    if (historyError) {
      console.error('[Digest API] Failed to fetch history:', historyError);
    } else {
      history = (historyData ?? []).map((entry) => ({
        id: entry.id,
        createdAt: entry.created_at,
        period: extractDigest(entry.metadata)?.period ?? null,
      }));
    }
  }

  // Fetch the previous week's digest for comparison stats
  let previous = null;
  if (latest) {
    const { data: prevData } = await digestQuery(orgId)
      .lt('created_at', latest.created_at)
      .limit(1)
      .maybeSingle();

    if (prevData) {
      previous = {
        id: prevData.id,
        createdAt: prevData.created_at,
        digest: extractDigest(prevData.metadata),
      };
    }
  }

  return successResponse({
    latest: latest
      ? {
          id: latest.id,
          createdAt: latest.created_at,
          digest: extractDigest(latest.metadata),
        }
      : null,
    previous,
    history,
  });
});
