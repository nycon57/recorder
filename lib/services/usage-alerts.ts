/**
 * Usage Alerts Service
 *
 * Checks whether an org has exceeded its monthly AI credit limit and returns
 * a structured alert at three thresholds: warning (80%), critical (95%), and
 * hard stop (100%). Results are cached in Redis for 60 seconds so that every
 * agent action does not hit the database.
 */

import { getOrgPlanTier, type PlanTier } from '@/lib/services/agent-config';
import { getUsageSummary } from '@/lib/services/agent-metering';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getRedis } from '@/lib/rate-limit/redis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertLevel = 'warning' | 'critical' | 'hard_stop';

export interface UsageAlert {
  level: AlertLevel;
  currentUsage: number;
  limit: number;
  /** Human-readable message shown in the UI banner and log entries. */
  message: string;
}

// ---------------------------------------------------------------------------
// Credit limit config
// ---------------------------------------------------------------------------

/** Defaults match the limits defined in /api/organizations/usage/route.ts */
const DEFAULT_CREDIT_LIMITS: Record<PlanTier, number> = {
  free: 0,
  starter: 1_000,
  professional: 10_000,
  enterprise: 100_000,
};

function getCreditLimit(tier: PlanTier): number {
  const envKey = `PLAN_CREDITS_${tier.toUpperCase()}`;
  const raw = process.env[envKey];
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return DEFAULT_CREDIT_LIMITS[tier];
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

const THRESHOLD_WARNING = 0.8;
const THRESHOLD_CRITICAL = 0.95;
const THRESHOLD_HARD_STOP = 1.0;

function alertForPercent(percent: number): AlertLevel | null {
  if (percent >= THRESHOLD_HARD_STOP) return 'hard_stop';
  if (percent >= THRESHOLD_CRITICAL) return 'critical';
  if (percent >= THRESHOLD_WARNING) return 'warning';
  return null;
}

function buildMessage(level: AlertLevel, percent: number): string {
  const pct = Math.round(percent * 100);
  switch (level) {
    case 'warning':
      return `You have used ${pct}% of your monthly AI credits.`;
    case 'critical':
      return `You have used ${pct}% of your monthly AI credits. Consider upgrading your plan.`;
    case 'hard_stop':
      return 'You have reached your monthly AI credit limit. Agent operations are paused.';
  }
}

// ---------------------------------------------------------------------------
// Redis helpers
// ---------------------------------------------------------------------------

const USAGE_CACHE_KEY = (orgId: string) => `usage:monthly:${orgId}`;
const ALERT_LOGGED_KEY = (orgId: string) => `usage:alert_logged:${orgId}`;
const CACHE_TTL_SECONDS = 60;

/** Fetch cached monthly credit total. Returns null on miss or Redis error. */
async function getCachedUsage(orgId: string): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get<string>(USAGE_CACHE_KEY(orgId));
    if (raw === null || raw === undefined) return null;
    const parsed = parseFloat(String(raw));
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Store monthly credit total in Redis with 60-second TTL. Silently ignores errors. */
async function setCachedUsage(orgId: string, credits: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(USAGE_CACHE_KEY(orgId), String(credits), { ex: CACHE_TTL_SECONDS });
  } catch {
    // Non-fatal: the DB fallback will handle it next time
  }
}

/**
 * Guard against flooding agent_activity_log with alert entries.
 * Returns true when an alert was already logged within the cache window.
 */
async function markAlertLogged(orgId: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    // SET NX (only if not exists) returns 'OK' on first set, null when key exists
    const result = await redis.set(ALERT_LOGGED_KEY(orgId), '1', {
      ex: CACHE_TTL_SECONDS,
      nx: true,
    });
    return result === null; // null means key already existed
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Alert logging
// ---------------------------------------------------------------------------

/**
 * Write a usage_alert entry to agent_activity_log.
 * Called at most once per 60 seconds per org (deduplicated via Redis).
 * Uses supabaseAdmin directly to avoid a circular import with agent-logger.
 */
async function logUsageAlert(
  orgId: string,
  alert: UsageAlert,
): Promise<void> {
  const alreadyLogged = await markAlertLogged(orgId);
  if (alreadyLogged) return;

  const summary =
    `level=${alert.level} usage=${alert.currentUsage} limit=${alert.limit} ` +
    `(${Math.round((alert.currentUsage / alert.limit) * 100)}%)`;

  const { error } = await supabaseAdmin.from('agent_activity_log').insert({
    org_id: orgId,
    agent_type: 'system',
    action_type: 'usage_alert',
    outcome: 'success',
    output_summary: summary,
    metadata: {
      level: alert.level,
      currentUsage: alert.currentUsage,
      limit: alert.limit,
      message: alert.message,
    },
  });

  if (error) {
    console.error('[UsageAlerts] Failed to log usage alert:', error.message);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether `orgId` has exceeded any credit-limit threshold this month.
 *
 * Returns null when usage is below 80% or when the plan has no credit limit
 * (free tier). Results are cached in Redis for 60 seconds; falls back to a
 * direct database query when Redis is unavailable.
 *
 * Never throws — availability of agent operations takes priority over strict
 * rate accuracy. On unexpected errors, returns null.
 */
export async function checkUsageLimits(orgId: string): Promise<UsageAlert | null> {
  try {
    const tier = await getOrgPlanTier(orgId);
    const limit = getCreditLimit(tier);

    // Free tier has no credit limit — nothing to gate
    if (limit <= 0) return null;

    // Fetch monthly usage: Redis cache → DB fallback
    let currentUsage = await getCachedUsage(orgId);

    if (currentUsage === null) {
      const summary = await getUsageSummary(orgId, 'month');
      currentUsage = summary.totalCredits;
      // Best-effort cache write; failures are silently ignored
      await setCachedUsage(orgId, currentUsage);
    }

    const percent = currentUsage / limit;
    const level = alertForPercent(percent);

    if (!level) return null;

    const alert: UsageAlert = {
      level,
      currentUsage,
      limit,
      message: buildMessage(level, percent),
    };

    // Log the alert (deduplicated to at most once per 60s)
    await logUsageAlert(orgId, alert);

    return alert;
  } catch (error) {
    // Never block agent operations on a credit-check failure
    console.error('[UsageAlerts] checkUsageLimits failed:', error);
    return null;
  }
}
