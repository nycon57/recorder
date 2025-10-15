/**
 * Admin Metrics API
 *
 * System-wide metrics dashboard for admins:
 * - Search performance (latency, throughput)
 * - Cache statistics (hit rate, layer distribution)
 * - Job queue status (pending, processing, failed)
 * - Quota usage across organizations
 * - Active alerts and incidents
 */

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireSystemAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/admin/metrics
 * Retrieve system-wide metrics
 */
export const GET = apiHandler(async (request: NextRequest) => {
  // SECURITY: Require system admin privileges for system-wide metrics
  await requireSystemAdmin();

  const { searchParams } = new URL(request.url);
  const timeRange = searchParams.get('timeRange') || '24h';

  // Calculate time window
  const timeWindows: Record<string, number> = {
    '1h': 1,
    '24h': 24,
    '7d': 24 * 7,
    '30d': 24 * 30,
  };

  const hoursAgo = timeWindows[timeRange] || 24;
  const since = new Date();
  since.setHours(since.getHours() - hoursAgo);

  // Fetch search analytics metrics
  const { data: searchAnalytics, error: searchError } = await supabaseAdmin
    .from('search_analytics')
    .select('latency_ms, cache_hit, cache_layer, mode, results_count')
    .gte('created_at', since.toISOString());

  if (searchError) {
    console.error('[AdminMetrics] Search analytics error:', searchError);
  }

  // Calculate search metrics
  const totalSearches = searchAnalytics?.length || 0;
  const avgLatency =
    totalSearches > 0
      ? searchAnalytics!.reduce((sum, s) => sum + (s.latency_ms || 0), 0) /
        totalSearches
      : 0;

  // P95 and P99 latency
  const sortedLatencies = (searchAnalytics || [])
    .map((s) => s.latency_ms || 0)
    .sort((a, b) => a - b);
  const p95Latency =
    sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
  const p99Latency =
    sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0;

  // Cache statistics
  const cacheHits = (searchAnalytics || []).filter((s) => s.cache_hit).length;
  const cacheHitRate = totalSearches > 0 ? cacheHits / totalSearches : 0;

  // Cache layer distribution
  const cacheLayerDistribution: Record<string, number> = {};
  (searchAnalytics || []).forEach((s) => {
    const layer = s.cache_layer || 'none';
    cacheLayerDistribution[layer] = (cacheLayerDistribution[layer] || 0) + 1;
  });

  // Search mode distribution
  const searchModeDistribution: Record<string, number> = {};
  (searchAnalytics || []).forEach((s) => {
    const mode = s.mode || 'unknown';
    searchModeDistribution[mode] = (searchModeDistribution[mode] || 0) + 1;
  });

  // Fetch job metrics
  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from('jobs')
    .select('status, type, created_at');

  if (jobsError) {
    console.error('[AdminMetrics] Jobs error:', jobsError);
  }

  const jobMetrics = {
    total: jobs?.length || 0,
    pending: jobs?.filter((j) => j.status === 'pending').length || 0,
    processing: jobs?.filter((j) => j.status === 'processing').length || 0,
    completed: jobs?.filter((j) => j.status === 'completed').length || 0,
    failed: jobs?.filter((j) => j.status === 'failed').length || 0,
    byType: {} as Record<string, number>,
  };

  // Job type distribution
  (jobs || []).forEach((j) => {
    jobMetrics.byType[j.type] = (jobMetrics.byType[j.type] || 0) + 1;
  });

  // Fetch quota metrics (all organizations)
  const { data: quotas, error: quotasError } = await supabaseAdmin
    .from('org_quotas')
    .select('*');

  if (quotasError) {
    console.error('[AdminMetrics] Quotas error:', quotasError);
  }

  const quotaMetrics = {
    totalOrgs: quotas?.length || 0,
    orgsNearSearchLimit:
      quotas?.filter((q) => {
        const usage = q.searches_used / q.searches_per_month;
        return usage > 0.9;
      }).length || 0,
    orgsNearStorageLimit:
      quotas?.filter((q) => {
        const usage = q.storage_used_gb / q.storage_gb;
        return usage > 0.9;
      }).length || 0,
    totalStorageUsedGb:
      quotas?.reduce((sum, q) => sum + Number(q.storage_used_gb || 0), 0) || 0,
    totalStorageLimitGb:
      quotas?.reduce((sum, q) => sum + Number(q.storage_gb || 0), 0) || 0,
    planDistribution: {} as Record<string, number>,
  };

  // Plan tier distribution
  (quotas || []).forEach((q) => {
    quotaMetrics.planDistribution[q.plan_tier] =
      (quotaMetrics.planDistribution[q.plan_tier] || 0) + 1;
  });

  // Fetch alert incidents
  const { data: incidents, error: incidentsError } = await supabaseAdmin
    .from('alert_incidents')
    .select(
      `
      id,
      status,
      triggered_at,
      metric_value,
      alert_rule_id,
      alert_rules (
        name,
        severity,
        metric_name
      )
    `
    )
    .eq('status', 'open')
    .order('triggered_at', { ascending: false })
    .limit(10);

  if (incidentsError) {
    console.error('[AdminMetrics] Incidents error:', incidentsError);
  }

  const alertMetrics = {
    totalOpen: incidents?.length || 0,
    critical:
      incidents?.filter(
        (i: any) => i.alert_rules?.severity === 'critical'
      ).length || 0,
    warning:
      incidents?.filter(
        (i: any) => i.alert_rules?.severity === 'warning'
      ).length || 0,
    info:
      incidents?.filter((i: any) => i.alert_rules?.severity === 'info')
        .length || 0,
    recentIncidents: incidents?.map((i: any) => ({
      id: i.id,
      ruleName: i.alert_rules?.name,
      severity: i.alert_rules?.severity,
      metricName: i.alert_rules?.metric_name,
      metricValue: i.metric_value,
      triggeredAt: i.triggered_at,
    })),
  };

  return successResponse({
    timeRange,
    generatedAt: new Date().toISOString(),
    summary: {
      totalSearches,
      p95Latency: Math.round(p95Latency),
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      activeJobs: jobMetrics.pending + jobMetrics.processing,
      criticalAlerts: alertMetrics.critical,
    },
    search: {
      totalSearches,
      avgLatencyMs: Math.round(avgLatency),
      p95LatencyMs: Math.round(p95Latency),
      p99LatencyMs: Math.round(p99Latency),
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      cacheLayerDistribution,
      modeDistribution: searchModeDistribution,
    },
    cache: {
      hitRate: Math.round(cacheHitRate * 100) / 100,
      hits: cacheHits,
      misses: totalSearches - cacheHits,
      layerDistribution: cacheLayerDistribution,
    },
    jobs: jobMetrics,
    quotas: quotaMetrics,
    alerts: alertMetrics,
  });
});
