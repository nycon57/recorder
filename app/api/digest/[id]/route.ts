/**
 * Digest Detail API Route
 *
 * Returns a specific weekly digest by its agent_activity_log ID,
 * along with the preceding digest for comparison stats.
 */

import { NextRequest } from 'next/server';

import { apiHandler, errors, requireOrg, successResponse } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Safely extract the digest object from an agent_activity_log metadata column. */
function extractDigest(metadata: unknown): Record<string, unknown> | null {
  const meta = metadata as Record<string, unknown> | null;
  return (meta?.digest as Record<string, unknown>) ?? null;
}

export const GET = apiHandler(
  async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const { orgId } = await requireOrg();
    const { id } = await context.params;

    const { data: entry, error } = await supabaseAdmin
      .from('agent_activity_log')
      .select('id, metadata, created_at')
      .eq('id', id)
      .eq('org_id', orgId)
      .eq('action_type', 'weekly_digest')
      .eq('outcome', 'success')
      .single();

    if (error || !entry) {
      return errors.notFound('Digest');
    }

    // Fetch previous digest for comparison
    let previous = null;
    const { data: prevData } = await supabaseAdmin
      .from('agent_activity_log')
      .select('id, metadata, created_at')
      .eq('org_id', orgId)
      .eq('action_type', 'weekly_digest')
      .eq('outcome', 'success')
      .lt('created_at', entry.created_at)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (prevData) {
      previous = {
        id: prevData.id,
        createdAt: prevData.created_at,
        digest: extractDigest(prevData.metadata),
      };
    }

    return successResponse({
      id: entry.id,
      createdAt: entry.created_at,
      digest: extractDigest(entry.metadata),
      previous,
    });
  }
);
