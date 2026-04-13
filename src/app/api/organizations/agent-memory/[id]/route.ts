/**
 * DELETE /api/organizations/agent-memory/[id]
 *
 * Admin-only — delete a single agent memory entry by ID.
 *
 * Auth: requireOrg() (admin/owner only).
 * Runtime: nodejs.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireOrg, errors, successResponse } from '@/lib/utils/api';
import { createClient as createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  let orgId: string;
  let role: string;
  try {
    const ctx = await requireOrg();
    orgId = ctx.orgId;
    role = ctx.role;
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errors.unauthorized();
    }
    return errors.forbidden();
  }

  if (role !== 'admin' && role !== 'owner') {
    return errors.forbidden();
  }

  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // Delete only if it belongs to this org (prevents cross-org deletion)
    const { data, error: deleteError } = await supabase
      .from('agent_memory')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId)
      .select('id');

    if (deleteError) {
      console.error('[agent-memory] delete error:', deleteError);
      return errors.badRequest('Failed to delete memory entry');
    }

    if (!data || data.length === 0) {
      return errors.notFound('Memory entry');
    }

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('[agent-memory] unexpected error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to delete memory entry' },
      { status: 500 }
    );
  }
}
