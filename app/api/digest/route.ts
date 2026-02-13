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
import { extractDigest, toDigestEntry } from '@/lib/utils/digest';

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

  const { data: latest, error: latestError } = await digestQuery(orgId)
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw new Error(`Failed to fetch digest: ${latestError.message}`);
  }

  if (!latest) {
    return successResponse({
      latest: null,
      previous: null,
      history: includeHistory ? [] : null,
    });
  }

  // Run history + previous queries in parallel (both depend only on latest)
  const [historyResult, prevResult] = await Promise.all([
    includeHistory
      ? digestQuery(orgId).limit(12)
      : Promise.resolve(null),
    digestQuery(orgId)
      .lt('created_at', latest.created_at)
      .limit(1)
      .maybeSingle(),
  ]);

  let history = null;
  if (includeHistory && historyResult) {
    if (historyResult.error) {
      console.error('[Digest API] Failed to fetch history:', historyResult.error);
    } else {
      history = (historyResult.data ?? []).map((entry) => ({
        id: entry.id,
        createdAt: entry.created_at,
        period: extractDigest(entry.metadata)?.period ?? null,
      }));
    }
  }

  let previous = null;
  if (prevResult.error) {
    console.error('[Digest API] Failed to fetch previous digest:', prevResult.error);
  } else if (prevResult.data) {
    previous = toDigestEntry(prevResult.data);
  }

  return successResponse({
    latest: toDigestEntry(latest),
    previous,
    history,
  });
});
