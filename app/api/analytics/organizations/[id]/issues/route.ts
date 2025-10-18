/**
 * Organization Deep Dive - Issues API
 *
 * GET /api/analytics/organizations/[id]/issues
 * - Identifies organization-specific storage issues
 * - Returns optimization opportunities
 * - Requires system admin privileges
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireSystemAdmin, successResponse } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface Issue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  type: 'quota' | 'compression' | 'tier_optimization' | 'processing';
  title: string;
  description: string;
  recommendation: string;
  affectedFiles: number;
  potentialSavings: number;
}

/**
 * GET /api/analytics/organizations/[id]/issues
 *
 * Get storage issues and optimization opportunities for an organization
 *
 * @example
 * GET /api/analytics/organizations/123e4567-e89b-12d3-a456-426614174000/issues
 */
export const GET = apiHandler(async (request: NextRequest, context: RouteContext) => {
  // Require system admin privileges for organization deep dive
  await requireSystemAdmin();

  const { id: orgId } = await context.params;

  // Validate organization exists
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, name, max_storage_gb')
    .eq('id', orgId)
    .single();

  if (orgError || !org) {
    throw new Error('Organization not found');
  }

  const issues: Issue[] = [];

  // Get org metrics
  const { data: recordings } = await supabaseAdmin
    .from('recordings')
    .select('file_size, storage_tier, compression_stats, created_at')
    .eq('org_id', orgId)
    .is('deleted_at', null);

  const totalStorage = recordings?.reduce((sum, r) => sum + (r.file_size || 0), 0) || 0;

  // Issue 1: Check quota (use max_storage_gb from org settings)
  const quotaLimitGB = org.max_storage_gb || 100; // Default to 100GB if not set
  const quotaLimit = quotaLimitGB * 1e9; // Convert to bytes

  if (totalStorage > quotaLimit * 0.9) {
    const percentUsed = (totalStorage / quotaLimit) * 100;
    issues.push({
      id: '1',
      severity: percentUsed >= 100 ? 'critical' : 'warning',
      type: 'quota',
      title: percentUsed >= 100 ? 'Storage quota exceeded' : 'Storage quota warning',
      description: `Using ${(totalStorage / 1e9).toFixed(2)}GB of ${quotaLimitGB.toFixed(0)}GB (${percentUsed.toFixed(1)}%)`,
      recommendation:
        percentUsed >= 100
          ? 'Upgrade plan or delete old recordings immediately'
          : 'Consider upgrading plan or cleaning up old files',
      affectedFiles: recordings?.length || 0,
      potentialSavings: 0,
    });
  }

  // Issue 2: Uncompressed files
  const uncompressed =
    recordings?.filter((r) => {
      const stats = r.compression_stats as any;
      return !stats || stats.compression_ratio === null;
    }) || [];

  if (uncompressed.length > 0) {
    const uncompressedSize = uncompressed.reduce((sum, r) => sum + (r.file_size || 0), 0);
    const estimatedSavings = uncompressedSize * 0.3; // Estimate 30% compression

    issues.push({
      id: '2',
      severity: 'warning',
      type: 'compression',
      title: 'Uncompressed files detected',
      description: `${uncompressed.length} files (${(uncompressedSize / 1e9).toFixed(2)}GB) are not compressed`,
      recommendation: 'Enable automatic compression for these files',
      affectedFiles: uncompressed.length,
      potentialSavings: estimatedSavings,
    });
  }

  // Issue 3: Old files in hot storage
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const oldHotFiles =
    recordings?.filter((r) => {
      if (r.storage_tier !== 'hot') return false;
      const createdAt = new Date(r.created_at);
      return createdAt < ninetyDaysAgo;
    }) || [];

  if (oldHotFiles.length > 0) {
    const oldHotSize = oldHotFiles.reduce((sum, r) => sum + (r.file_size || 0), 0);
    const sizeGB = oldHotSize / 1e9;
    // Savings: (hot - cold) * GB = (0.021 - 0.010) * GB per month
    const monthlySavings = sizeGB * (0.021 - 0.01);

    issues.push({
      id: '3',
      severity: 'info',
      type: 'tier_optimization',
      title: 'Old files in hot storage',
      description: `${oldHotFiles.length} files older than 90 days are still in hot storage`,
      recommendation: 'Migrate these files to cold storage to save costs',
      affectedFiles: oldHotFiles.length,
      potentialSavings: monthlySavings * 12, // Annual savings
    });
  }

  // Issue 4: Failed jobs
  const { count: failedJobs } = await supabaseAdmin
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('payload->>orgId', orgId) // Jobs store orgId in payload
    .eq('status', 'failed');

  if (failedJobs && failedJobs > 0) {
    issues.push({
      id: '4',
      severity: 'warning',
      type: 'processing',
      title: 'Failed processing jobs',
      description: `${failedJobs} jobs have failed and need attention`,
      recommendation: 'Review and retry failed jobs',
      affectedFiles: failedJobs,
      potentialSavings: 0,
    });
  }

  // Calculate summary
  const summary = {
    criticalIssues: issues.filter((i) => i.severity === 'critical').length,
    warningIssues: issues.filter((i) => i.severity === 'warning').length,
    infoIssues: issues.filter((i) => i.severity === 'info').length,
    totalPotentialSavings: issues.reduce((sum, i) => sum + i.potentialSavings, 0),
  };

  return successResponse({
    organization: {
      id: org.id,
      name: org.name,
    },
    issues,
    summary,
  });
});
