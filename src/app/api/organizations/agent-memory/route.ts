/**
 * GET  /api/organizations/agent-memory
 * POST /api/organizations/agent-memory
 *
 * Admin-only agent memory management.
 *
 * GET  — list agent memory entries with filtering, search, and pagination.
 * POST — prune expired memory entries.
 *
 * Auth: requireOrg() (admin/owner only).
 * Runtime: nodejs.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireOrg, errors, successResponse } from '@/lib/utils/api';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { pruneExpiredMemories } from '@/lib/services/agent-memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);

    const agentType = searchParams.get('agent_type') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1),
      200
    );
    const offset = Math.max(
      parseInt(searchParams.get('offset') ?? '0', 10) || 0,
      0
    );

    // Build the main query (exclude embedding column)
    let query = supabase
      .from('agent_memory')
      .select(
        'id, org_id, agent_type, memory_key, memory_value, importance, access_count, last_accessed_at, expires_at, metadata, created_at, updated_at'
      )
      .eq('org_id', orgId);

    if (agentType) {
      query = query.eq('agent_type', agentType);
    }

    if (search) {
      query = query.or(
        `memory_key.ilike.%${search}%,memory_value.ilike.%${search}%`
      );
    }

    query = query
      .order('importance', { ascending: false })
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: memories, error: queryError } = await query;

    if (queryError) {
      console.error('[agent-memory] query error:', queryError);
      return errors.badRequest('Failed to fetch agent memories');
    }

    // Get total count
    let countQuery = supabase
      .from('agent_memory')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId);

    if (agentType) {
      countQuery = countQuery.eq('agent_type', agentType);
    }
    if (search) {
      countQuery = countQuery.or(
        `memory_key.ilike.%${search}%,memory_value.ilike.%${search}%`
      );
    }

    const { count } = await countQuery;

    // Get distinct agent types
    const { data: typeRows } = await supabase
      .from('agent_memory')
      .select('agent_type')
      .eq('org_id', orgId);

    const agentTypes = [
      ...new Set((typeRows ?? []).map((r: { agent_type: string }) => r.agent_type)),
    ];

    return successResponse({
      memories: memories ?? [],
      agentTypes,
      total: count ?? 0,
    });
  } catch (error) {
    console.error('[agent-memory] unexpected error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to fetch agent memories' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
    const body = await request.json();

    if (body.action !== 'prune_expired') {
      return errors.badRequest('Invalid action. Supported: prune_expired');
    }

    const count = await pruneExpiredMemories(orgId);

    return successResponse({ pruned: count });
  } catch (error) {
    console.error('[agent-memory] unexpected error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to prune agent memories' },
      { status: 500 }
    );
  }
}
