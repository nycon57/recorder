/**
 * Wiki Lint Cron Route (TRIB-42)
 * ==============================
 *
 * Scheduled handler invoked by Vercel Cron once a day. Runs the 5 Karpathy-
 * style wiki health checks on every org that has active wiki pages and
 * upserts one `wiki_lint_results` row per org per UTC day.
 *
 * Schedule: `0 3 * * *` (03:00 UTC daily) — see `vercel.json`.
 *
 * Auth:
 *   - In production, `Authorization: Bearer <CRON_SECRET>` is required.
 *     This matches the pattern used by the existing cron routes
 *     (see collect-metrics/route.ts) — Vercel Cron automatically sends
 *     that header when `CRON_SECRET` is configured on the project.
 *   - In non-production, the check is relaxed so local dev can POST to
 *     the route without setting a secret.
 *
 * Runtime: Node.js (Fluid Compute default). We need the Supabase admin
 * client and filesystem-style module loading, neither of which are
 * compatible with the Edge runtime.
 *
 * This handler is intentionally thin — all business logic lives in
 * `src/lib/services/wiki-lint.ts` so it stays unit-testable without an
 * HTTP shell.
 */

import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errorResponse } from '@/lib/utils/api';
import { runWikiLintAllOrgs } from '@/lib/services/wiki-lint';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes — matches Fluid Compute default

async function handle(request: NextRequest) {
  // ---- Auth ------------------------------------------------------------
  const authHeader = request.headers.get('authorization');
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  const cronSecret = process.env.CRON_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!cronSecret) {
      console.error('[cron/wiki-lint] CRON_SECRET not set in production');
      return errorResponse('Unauthorized - CRON_SECRET not configured', 'UNAUTHORIZED', 401);
    }
    const bearerOk = authHeader === `Bearer ${cronSecret}`;
    // Vercel Cron populates x-vercel-cron with the cron path for authenticated
    // scheduled invocations. Accept either the bearer header (manual trigger
    // / CI) or the x-vercel-cron header (scheduled run) as defence in depth.
    const cronHeaderOk = Boolean(vercelCronHeader);
    if (!bearerOk && !cronHeaderOk) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }
  } else if (cronSecret && authHeader && authHeader !== `Bearer ${cronSecret}`) {
    // If a dev set CRON_SECRET locally, enforce it — otherwise let the
    // route run for manual testing.
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
  }

  // ---- Run lint --------------------------------------------------------
  const startedAt = Date.now();
  try {
    const results = await runWikiLintAllOrgs();
    const elapsedMs = Date.now() - startedAt;

    console.log(
      `[cron/wiki-lint] Completed ${results.length} org(s) in ${elapsedMs}ms`
    );

    return successResponse({
      success: true,
      orgs_processed: results.length,
      elapsed_ms: elapsedMs,
      summary: results.map((r) => ({
        org_id: r.org_id,
        orphan_count: r.orphan_count,
        stale_count: r.stale_count,
        stale_link_count: r.stale_link_count,
        coverage_gap_count: r.coverage_gap_count,
        confidence_decay_count: r.confidence_decay_count,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cron/wiki-lint] Lint run failed:', message);
    return errorResponse(
      `Wiki lint run failed: ${message}`,
      'LINT_RUN_FAILED',
      500
    );
  }
}

export const POST = apiHandler(handle);
// Allow GET as well so manual / CI triggers can hit the route from a browser
// or curl without having to craft a POST body.
export const GET = apiHandler(handle);
