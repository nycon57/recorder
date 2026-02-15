/**
 * Digest Detail API Route
 *
 * Returns a specific weekly digest by its agent_activity_log ID,
 * along with the preceding digest for comparison stats.
 */

import { NextRequest } from 'next/server';

import { apiHandler, errors, requireOrg, successResponse } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { toDigestEntry } from '@/lib/utils/digest';

function digestBaseQuery(orgId: string) {
  return supabaseAdmin
    .from('agent_activity_log')
    .select('id, metadata, created_at')
    .eq('org_id', orgId)
    .eq('action_type', 'weekly_digest')
    .eq('outcome', 'success');
}

export const GET = apiHandler(
  async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const { orgId } = await requireOrg();
    const { id } = await context.params;

    const { data: entry, error } = await digestBaseQuery(orgId)
      .eq('id', id)
      .single();

    if (error || !entry) {
      return errors.notFound('Digest');
    }

    // Fetch previous digest for comparison
    const { data: prevData } = await digestBaseQuery(orgId)
      .lt('created_at', entry.created_at)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return successResponse({
      ...toDigestEntry(entry),
      previous: prevData ? toDigestEntry(prevData) : null,
    });
  }
);
