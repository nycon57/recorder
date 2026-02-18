/**
 * Curator Knowledge Scheduler
 *
 * Creates daily curate_knowledge jobs for every org that has the curator enabled.
 * Uses a per-org, per-day dedupe_key so only one job runs per org per calendar day,
 * even when the scheduler check fires multiple times.
 *
 * Dedupe key format: `curate_knowledge:${orgId}:${YYYY-MM-DD}`
 *
 * The interval defaults to 24 hours and can be shortened for testing by setting
 * the CURATOR_SCHEDULE_INTERVAL_MS environment variable.
 *
 * Gap Analysis Scheduler
 *
 * Creates weekly analyze_knowledge_gaps jobs for every org with gap_intelligence enabled.
 * Uses a per-org, per-ISO-week dedupe_key to prevent duplicate runs within the same week.
 *
 * Dedupe key format: `analyze_knowledge_gaps:${orgId}:${YYYY-WXX}`
 *
 * The interval defaults to 7 days and can be shortened for testing by setting
 * the GAP_ANALYSIS_SCHEDULE_INTERVAL_MS environment variable.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

/**
 * How often to check for orgs that need a new curate_knowledge job.
 * Defaults to daily; override with CURATOR_SCHEDULE_INTERVAL_MS (ms).
 */
export const CURATOR_SCHEDULE_INTERVAL_MS =
  parseInt(process.env.CURATOR_SCHEDULE_INTERVAL_MS ?? '', 10) || MS_PER_DAY;

/**
 * How often to check for orgs that need a new analyze_knowledge_gaps job.
 * Defaults to weekly; override with GAP_ANALYSIS_SCHEDULE_INTERVAL_MS (ms).
 */
export const GAP_ANALYSIS_SCHEDULE_INTERVAL_MS =
  parseInt(process.env.GAP_ANALYSIS_SCHEDULE_INTERVAL_MS ?? '', 10) || MS_PER_WEEK;

/** UTC calendar date string (YYYY-MM-DD) used in per-day dedupe keys. */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * ISO 8601 week string (YYYY-WXX) for the given date.
 * Week 1 is the week containing the first Thursday of the year.
 */
function isoWeekString(date: Date): string {
  // Work in UTC to avoid timezone drift.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // ISO weeks start on Monday; adjust so Sunday = 7.
  const day = d.getUTCDay() || 7;
  // Move to Thursday of this week (ISO week number is defined by its Thursday).
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Insert curate_knowledge jobs for all orgs with the curator enabled.
 *
 * Skips orgs that already have a pending, processing, or completed job for today.
 * If an org's curator is disabled between scheduled runs, the handler's
 * isAgentEnabled() check skips the job without creating orphan records.
 */
export async function scheduleCurateKnowledgeJobs(): Promise<void> {
  const supabase = createAdminClient();
  const dateString = todayUTC();

  const { data: enabledOrgs, error } = await supabase
    .from('org_agent_settings')
    .select('org_id')
    .eq('curator_enabled', true)
    .eq('global_agent_enabled', true);

  if (error) {
    console.error('[CuratorScheduler] Failed to fetch enabled orgs:', error.message);
    return;
  }

  if (!enabledOrgs?.length) {
    console.log('[CuratorScheduler] No orgs with curator enabled');
    return;
  }

  console.log(
    `[CuratorScheduler] Scheduling curate_knowledge for ${enabledOrgs.length} org(s) on ${dateString}...`
  );

  let created = 0;
  let skipped = 0;

  for (const { org_id: orgId } of enabledOrgs) {
    const dedupeKey = `curate_knowledge:${orgId}:${dateString}`;

    // Skip if a job already exists for this org today (pending, processing, or completed).
    // This prevents double-scheduling when the check fires more than once per day.
    const { data: existing } = await supabase
      .from('jobs')
      .select('id')
      .eq('dedupe_key', dedupeKey)
      .in('status', ['pending', 'processing', 'completed'])
      .limit(1)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const { error: insertError } = await supabase
      .from('jobs')
      .insert({
        type: 'curate_knowledge',
        payload: { orgId },
        dedupe_key: dedupeKey,
        status: 'pending',
        priority: 3, // Low priority — maintenance job
      });

    if (insertError) {
      console.error(
        `[CuratorScheduler] Failed to create job for org ${orgId}:`,
        insertError.message
      );
    } else {
      created++;
      console.log(`[CuratorScheduler] Created curate_knowledge job for org ${orgId}`);
    }
  }

  console.log(`[CuratorScheduler] Done — created: ${created}, skipped: ${skipped}`);
}

/**
 * Insert analyze_knowledge_gaps jobs for all orgs with gap_intelligence enabled.
 *
 * Skips orgs that already have a pending, processing, or completed job for this
 * ISO calendar week.
 */
export async function scheduleAnalyzeKnowledgeGapsJobs(): Promise<void> {
  const supabase = createAdminClient();
  const weekString = isoWeekString(new Date());

  const { data: enabledOrgs, error } = await supabase
    .from('org_agent_settings')
    .select('org_id')
    .eq('gap_intelligence_enabled', true)
    .eq('global_agent_enabled', true);

  if (error) {
    console.error('[GapScheduler] Failed to fetch enabled orgs:', error.message);
    return;
  }

  if (!enabledOrgs?.length) {
    console.log('[GapScheduler] No orgs with gap_intelligence enabled');
    return;
  }

  console.log(
    `[GapScheduler] Scheduling analyze_knowledge_gaps for ${enabledOrgs.length} org(s) on ${weekString}...`
  );

  let created = 0;
  let skipped = 0;

  for (const { org_id: orgId } of enabledOrgs) {
    const dedupeKey = `analyze_knowledge_gaps:${orgId}:${weekString}`;

    // Skip if a job already exists for this org this week (pending, processing, or completed).
    const { data: existing } = await supabase
      .from('jobs')
      .select('id')
      .eq('dedupe_key', dedupeKey)
      .in('status', ['pending', 'processing', 'completed'])
      .limit(1)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const { error: insertError } = await supabase
      .from('jobs')
      .insert({
        type: 'analyze_knowledge_gaps',
        payload: { orgId },
        dedupe_key: dedupeKey,
        status: 'pending',
        priority: 3, // Low priority — maintenance job
      });

    if (insertError) {
      console.error(
        `[GapScheduler] Failed to create job for org ${orgId}:`,
        insertError.message
      );
    } else {
      created++;
      console.log(`[GapScheduler] Created analyze_knowledge_gaps job for org ${orgId}`);
    }
  }

  console.log(`[GapScheduler] Done — created: ${created}, skipped: ${skipped}`);
}
