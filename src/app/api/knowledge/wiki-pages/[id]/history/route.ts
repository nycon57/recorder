/**
 * GET /api/knowledge/wiki-pages/[id]/history
 *
 * TRIB-40: Return the full version chain for an org wiki page, newest first.
 *
 * Auth: Better Auth session via `requireOrg()`. The page id must belong to
 * the caller's org — cross-org lookups return 404 rather than 403 so we
 * don't leak page existence across tenants.
 *
 * The endpoint accepts ANY id in the supersede chain (head, middle, or
 * tail) and walks the graph to find the head, then emits every version
 * backwards via `supersedes_id`.
 *
 * Response shape:
 *   {
 *     data: {
 *       id: string;                        // the id that was requested
 *       headId: string;                    // the newest (head) version id
 *       versionCount: number;              // number of versions in the chain
 *       versions: Array<{
 *         id: string;
 *         org_id: string;
 *         app: string | null;
 *         screen: string | null;
 *         topic: string;
 *         content: string;
 *         confidence: number;
 *         valid_from: string;
 *         valid_until: string | null;
 *         supersedes_id: string | null;
 *         compilation_log: unknown;
 *         created_at: string;
 *         updated_at: string;
 *       }>;
 *     };
 *   }
 *
 * Runtime: nodejs (not edge) — Supabase admin client uses a service-role
 * key which is not available in the Edge runtime.
 */

import type { NextRequest } from 'next/server';

import { requireOrg, errors, successResponse } from '@/lib/utils/api';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const logger = createLogger({ service: 'knowledge-wiki-page-history' });

/**
 * Row shape returned by `public.get_org_wiki_page_history` (TRIB-40
 * migration). Kept narrow and local to this file so we don't regenerate
 * `src/lib/types/database.ts` (hand-maintained).
 */
interface WikiPageHistoryRow {
  id: string;
  org_id: string;
  app: string | null;
  screen: string | null;
  topic: string;
  content: string;
  confidence: number;
  valid_from: string;
  valid_until: string | null;
  supersedes_id: string | null;
  compilation_log: unknown;
  created_at: string;
  updated_at: string;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Basic UUID validation so a garbage id returns 400 instead of an empty
// RPC result that would look indistinguishable from "not found".
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: NextRequest, { params }: RouteParams) {
  // ---- Auth -------------------------------------------------------------
  let orgId: string;
  try {
    const ctx = await requireOrg();
    orgId = ctx.orgId;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    if (message === 'Unauthorized') {
      return errors.unauthorized();
    }
    return errors.forbidden();
  }

  // ---- Validate id ------------------------------------------------------
  const { id } = await params;
  if (!id || !UUID_REGEX.test(id)) {
    return errors.badRequest('Invalid page id: expected a UUID');
  }

  // ---- Fetch the chain via the TRIB-40 RPC ------------------------------
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc(
    'get_org_wiki_page_history' as never,
    {
      p_page_id: id,
      p_org_id: orgId,
    } as never
  );

  if (error) {
    logger.error('get_org_wiki_page_history RPC failed', {
      context: { orgId, pageId: id },
      error,
    });
    return errors.internalError();
  }

  const rows = (data ?? []) as WikiPageHistoryRow[];

  if (rows.length === 0) {
    // Either the id doesn't exist OR it belongs to another org. We treat
    // both as 404 to avoid leaking cross-tenant existence.
    return errors.notFound('Wiki page');
  }

  // The RPC returns newest-first by construction (head at index 0). The
  // head's id is the latest version's id — surface it explicitly so
  // clients can link to the current page without rewalking the chain.
  const headId = rows[0].id;

  return successResponse({
    id,
    headId,
    versionCount: rows.length,
    versions: rows,
  });
}
