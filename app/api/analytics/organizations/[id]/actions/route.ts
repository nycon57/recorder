/**
 * Organization Deep Dive - Actions API
 *
 * POST /api/analytics/organizations/[id]/actions
 * - Execute administrative actions on an organization
 * - Supports: compress, migrate, cleanup, report
 * - Requires system admin privileges
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireSystemAdmin, successResponse, parseBody } from '@/lib/utils/api';
import { organizationActionSchema } from '@/lib/validations/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface Recommendation {
  type: string;
  priority: string;
  description: string;
}

/**
 * POST /api/analytics/organizations/[id]/actions
 *
 * Execute administrative actions on an organization
 *
 * Request body:
 * - action: 'compress' | 'migrate' | 'cleanup' | 'report'
 *
 * Actions:
 * - compress: Queue compression jobs for uncompressed files
 * - migrate: Queue migration jobs for old hot storage files
 * - cleanup: Mark old files for deletion (with 30-day grace period)
 * - report: Generate and return storage report
 *
 * @example
 * POST /api/analytics/organizations/123e4567-e89b-12d3-a456-426614174000/actions
 * Body: { "action": "compress" }
 */
export const POST = apiHandler(async (request: NextRequest, context: RouteContext) => {
  // Require system admin privileges for administrative actions
  const adminUser = await requireSystemAdmin();

  const { id: orgId } = await context.params;
  const body = await parseBody(request, organizationActionSchema);
  // Type assertion for parsed body
  const { action } = body as { action: string };

  // Validate organization exists
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, name')
    .eq('id', orgId)
    .single();

  if (orgError || !org) {
    throw new Error('Organization not found');
  }

  // Log audit entry for administrative action
  await supabaseAdmin.from('audit_logs').insert({
    org_id: orgId,
    user_id: adminUser.userId,
    action: `organization.admin_action.${action}`,
    resource_type: 'organization',
    resource_id: orgId,
    metadata: {
      action,
      admin_email: adminUser.email,
    },
  });

  switch (action) {
    case 'compress': {
      // Find uncompressed files
      const { data: uncompressedFiles } = await supabaseAdmin
        .from('content')
        .select('id')
        .eq('org_id', orgId)
        .is('compression_stats', null)
        .is('deleted_at', null);

      if (!uncompressedFiles || uncompressedFiles.length === 0) {
        return successResponse({
          message: 'No uncompressed files found',
          queuedJobs: 0,
        });
      }

      // Queue compression jobs
      const jobs = uncompressedFiles.map((file) => ({
        type: 'compress_video' as const,
        payload: {
          recordingId: file.id,
          orgId,
        },
        status: 'pending' as const,
      }));

      const { error: insertError } = await supabaseAdmin.from('jobs').insert(jobs);

      if (insertError) {
        console.error('[Organization Actions] Error queuing compression jobs:', insertError);
        throw new Error('Failed to queue compression jobs');
      }

      return successResponse({
        message: `Queued ${jobs.length} files for compression`,
        queuedJobs: jobs.length,
      });
    }

    case 'migrate': {
      // Find old hot storage files (90+ days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: oldFiles } = await supabaseAdmin
        .from('content')
        .select('id')
        .eq('org_id', orgId)
        .eq('storage_tier', 'hot')
        .lt('created_at', ninetyDaysAgo.toISOString())
        .is('deleted_at', null);

      if (!oldFiles || oldFiles.length === 0) {
        return successResponse({
          message: 'No old hot storage files found',
          queuedJobs: 0,
        });
      }

      // Queue migration jobs
      const jobs = oldFiles.map((file) => ({
        type: 'migrate_storage_tier' as const,
        payload: {
          recordingId: file.id,
          orgId,
          targetTier: 'cold',
        },
        status: 'pending' as const,
      }));

      const { error: insertError } = await supabaseAdmin.from('jobs').insert(jobs);

      if (insertError) {
        console.error('[Organization Actions] Error queuing migration jobs:', insertError);
        throw new Error('Failed to queue migration jobs');
      }

      return successResponse({
        message: `Queued ${jobs.length} files for migration to cold storage`,
        queuedJobs: jobs.length,
      });
    }

    case 'cleanup': {
      // Find very old recordings (2+ years)
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      const { data: oldRecordings } = await supabaseAdmin
        .from('content')
        .select('id')
        .eq('org_id', orgId)
        .lt('created_at', twoYearsAgo.toISOString())
        .is('deleted_at', null);

      if (!oldRecordings || oldRecordings.length === 0) {
        return successResponse({
          message: 'No very old recordings found',
          markedFiles: 0,
        });
      }

      // Immediately soft delete recordings (no grace period)
      const { error: updateError } = await supabaseAdmin
        .from('content')
        .update({
          deleted_at: new Date().toISOString(),
        })
        .in(
          'id',
          oldRecordings.map((r) => r.id)
        );

      if (updateError) {
        console.error('[Organization Actions] Error deleting files:', updateError);
        throw new Error('Failed to delete files');
      }

      return successResponse({
        message: `Deleted ${oldRecordings.length} files immediately`,
        deletedFiles: oldRecordings.length,
        deletedAt: new Date().toISOString(),
      });
    }

    case 'report': {
      // Generate comprehensive report data
      const { data: recordings } = await supabaseAdmin
        .from('content')
        .select('file_size, storage_tier, compression_stats, created_at, mime_type')
        .eq('org_id', orgId)
        .is('deleted_at', null);

      const totalStorage = recordings?.reduce((sum, r) => sum + (r.file_size || 0), 0) || 0;
      const compressedFiles = recordings?.filter((r) => r.compression_stats != null) || [];

      // Tier breakdown
      const tierBreakdown = {
        hot: recordings?.filter((r) => r.storage_tier === 'hot').length || 0,
        warm: recordings?.filter((r) => r.storage_tier === 'warm').length || 0,
        cold: recordings?.filter((r) => r.storage_tier === 'cold').length || 0,
      };

      // Calculate costs
      const tierPricing = { hot: 0.021, warm: 0.015, cold: 0.01 };
      const totalCost = recordings?.reduce((sum, r) => {
        const sizeGB = (r.file_size || 0) / 1e9;
        const tier = (r.storage_tier || 'hot') as keyof typeof tierPricing;
        return sum + sizeGB * tierPricing[tier];
      }, 0) || 0;

      const report = {
        organizationId: orgId,
        organizationName: org.name,
        generatedAt: new Date().toISOString(),
        generatedBy: adminUser.email,
        metrics: {
          totalFiles: recordings?.length || 0,
          totalStorage,
          totalStorageGB: totalStorage / 1e9,
          totalCost,
          compressedFiles: compressedFiles.length,
          compressionRate:
            compressedFiles.length > 0
              ? (compressedFiles.length / (recordings?.length || 1)) * 100
              : 0,
        },
        tierBreakdown,
        recommendations: [] as Recommendation[],
      };

      // Add recommendations
      const uncompressed = recordings?.filter((r) => !r.compression_stats) || [];
      if (uncompressed.length > 0) {
        report.recommendations.push({
          type: 'compression',
          priority: 'medium',
          description: `${uncompressed.length} files could be compressed to save storage`,
        });
      }

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const oldHotFiles =
        recordings?.filter(
          (r) => r.storage_tier === 'hot' && new Date(r.created_at) < ninetyDaysAgo
        ) || [];

      if (oldHotFiles.length > 0) {
        report.recommendations.push({
          type: 'tier_migration',
          priority: 'high',
          description: `${oldHotFiles.length} files could be migrated to cold storage to reduce costs`,
        });
      }

      return successResponse({
        message: 'Storage report generated successfully',
        report,
      });
    }

    default:
      throw new Error('Invalid action');
  }
});
