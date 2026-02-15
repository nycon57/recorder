/**
 * Generate Weekly Digest Cron Route
 *
 * Triggered every Monday at midnight UTC. For each org with the digest
 * agent enabled, enqueues a generate_weekly_digest job with a
 * dedupe key scoped to org + ISO week to prevent duplicate runs.
 */

import { NextRequest } from 'next/server';

import { apiHandler, successResponse, errorResponse } from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/admin';

/** Return an ISO week string like "2026-W07" for dedupe keys. */
function getISOWeekString(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number (Mon=1, Sun=7)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export const GET = apiHandler(async (request: NextRequest) => {
  const supabase = createClient();

  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret && process.env.NODE_ENV === 'production') {
    console.error('[Cron] CRON_SECRET not set in production');
    return errorResponse('Unauthorized - CRON_SECRET not configured', 'UNAUTHORIZED', 401);
  }

  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
  }

  // Find orgs with digest agent enabled
  const { data: enabledOrgs, error: orgsError } = await supabase
    .from('org_agent_settings')
    .select('org_id')
    .eq('digest_enabled', true)
    .eq('global_agent_enabled', true);

  if (orgsError) {
    console.error('[Cron] Failed to query enabled orgs:', orgsError);
    throw new Error(`Failed to query enabled orgs: ${orgsError.message}`);
  }

  const orgIds = (enabledOrgs ?? []).map((row) => row.org_id);

  if (orgIds.length === 0) {
    console.log('[Cron] No orgs have the digest agent enabled, skipping');
    return successResponse({
      message: 'No orgs with digest enabled',
      jobsCreated: 0,
    });
  }

  const weekString = getISOWeekString(new Date());
  let jobsCreated = 0;

  for (const orgId of orgIds) {
    const dedupeKey = `weekly_digest:${orgId}:${weekString}`;

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        type: 'generate_weekly_digest',
        payload: { orgId },
        status: 'pending',
        run_at: new Date().toISOString(),
        dedupe_key: dedupeKey,
        priority: 3,
      })
      .select('id')
      .single();

    if (error) {
      // Dedupe conflict is expected if job already exists this week
      if (error.code === '23505') {
        console.log(`[Cron] Digest job already exists for org ${orgId} week ${weekString}`);
      } else {
        console.error(`[Cron] Failed to create digest job for org ${orgId}:`, error);
      }
      continue;
    }

    jobsCreated++;
    console.log(`[Cron] Created weekly digest job ${data.id} for org ${orgId}`);
  }

  return successResponse({
    message: `Queued ${jobsCreated} weekly digest jobs`,
    jobsCreated,
    week: weekString,
  });
});

export const POST = GET;
