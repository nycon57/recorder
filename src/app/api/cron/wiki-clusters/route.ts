/**
 * Wiki clusters cron — TRIB-44.
 *
 * Runs Louvain community detection across every org's wiki_relationships
 * graph and refreshes the `wiki_clusters` table plus the `cluster_id`
 * pointer on every `org_wiki_pages` row.
 *
 * Schedule: weekly, Sunday 04:00 UTC (see vercel.json crons).
 *
 * Vercel cron contract:
 *   - Method: GET (Vercel calls it GET; we also accept POST for manual runs)
 *   - Runtime: nodejs (graphology needs a full Node runtime, not edge)
 *   - Auth: `Authorization: Bearer $CRON_SECRET` header
 *
 * Unlike other crons in this project that enqueue a background job and
 * return immediately, community detection is fast enough (single-digit
 * seconds even for mid-size orgs) that we run it inline and return the
 * full result summary. This avoids adding a new job type + handler just
 * for a weekly task. If an org grows large enough that the cron runs
 * close to the Vercel execution limit, move this to a job handler.
 */

import { NextRequest } from 'next/server';

import { apiHandler, successResponse, errorResponse } from '@/lib/utils/api';
import { runClusterDetectionAllOrgs } from '@/lib/services/wiki-clusters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request: NextRequest) => {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret && process.env.NODE_ENV === 'production') {
    console.error('[Cron wiki-clusters] CRON_SECRET not set in production');
    return errorResponse(
      'Unauthorized - CRON_SECRET not configured',
      'UNAUTHORIZED',
      401
    );
  }

  if (
    cronSecret &&
    request.headers.get('authorization') !== `Bearer ${cronSecret}`
  ) {
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
  }

  const startedAt = Date.now();

  try {
    const summary = await runClusterDetectionAllOrgs();

    const totalDurationMs = Date.now() - startedAt;

    console.log(
      `[Cron wiki-clusters] Processed ${summary.orgsProcessed} orgs ` +
        `(${summary.orgsFailed} failed) in ${totalDurationMs}ms`
    );

    return successResponse({
      message: `Cluster detection complete: ${summary.orgsProcessed} orgs processed, ${summary.orgsFailed} failed`,
      orgsProcessed: summary.orgsProcessed,
      orgsFailed: summary.orgsFailed,
      totalDurationMs,
      results: summary.results,
    });
  } catch (error) {
    console.error('[Cron wiki-clusters] Fatal error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Cluster detection failed',
      'CLUSTER_DETECTION_FAILED',
      500
    );
  }
});

// Allow POST for manual triggers from admin tools.
export const POST = GET;
