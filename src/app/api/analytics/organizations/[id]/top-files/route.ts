/**
 * Organization Deep Dive - Top Files API
 *
 * GET /api/analytics/organizations/[id]/top-files
 * - Returns top files by size for an organization
 * - Supports sorting and filtering
 * - Requires system admin privileges
 */

import { NextRequest } from 'next/server';
import {
  apiHandler,
  requireSystemAdmin,
  successResponse,
  parseSearchParams,
} from '@/lib/utils/api';
import { organizationTopFilesQuerySchema } from '@/lib/validations/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/analytics/organizations/[id]/top-files
 *
 * Get top files by size for an organization
 *
 * Query parameters:
 * - limit: number (default: 10, max: 50) - Number of files to return
 * - sortBy: 'size' | 'created_at' (default: 'size') - Sort field
 *
 * @example
 * GET /api/analytics/organizations/123e4567-e89b-12d3-a456-426614174000/top-files?limit=25&sortBy=size
 */
export const GET = apiHandler(async (request: NextRequest, context: RouteContext) => {
  // Require system admin privileges for organization deep dive
  await requireSystemAdmin();

  const { id: orgId } = await context.params;
  const queryParams = parseSearchParams(request, organizationTopFilesQuerySchema);
  // Type assertion for parsed params
  const { limit, sortBy } = queryParams as { limit: number; sortBy: string };

  // Validate organization exists
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, name')
    .eq('id', orgId)
    .single();

  if (orgError || !org) {
    throw new Error('Organization not found');
  }

  // Get top files with user information
  let query = supabaseAdmin
    .from('content')
    .select(
      `
      id,
      title,
      file_size,
      created_at,
      mime_type,
      compression_stats,
      storage_tier,
      storage_provider,
      users!recordings_created_by_fkey(id, name)
    `
    )
    .eq('org_id', orgId)
    .is('deleted_at', null);

  // Sort by field
  if (sortBy === 'size') {
    query = query.order('file_size', { ascending: false, nullsFirst: false });
  } else if (sortBy === 'created_at') {
    query = query.order('created_at', { ascending: false });
  }

  query = query.limit(limit);

  const { data: topFiles, error: filesError } = await query;

  if (filesError) {
    console.error('[Top Files] Error fetching files:', filesError);
    throw new Error('Failed to fetch top files');
  }

  // Calculate totals and potential savings
  const totalSize = topFiles?.reduce((sum, f) => sum + (f.file_size || 0), 0) || 0;

  // Calculate potential savings (if uncompressed or in hot tier)
  const tierPricing = { hot: 0.021, warm: 0.015, cold: 0.01, glacier: 0.004 };
  const potentialSavings = topFiles?.reduce((sum, f) => {
    let savings = 0;

    // If uncompressed, estimate 30% file size savings
    const compressionStats = f.compression_stats as any;
    if (!compressionStats) {
      const sizeGB = (f.file_size || 0) / 1e9;
      savings += sizeGB * 0.3 * tierPricing.hot; // Assume hot tier
    }

    // If in hot tier and old (90+ days), estimate tier migration savings
    if (f.storage_tier === 'hot') {
      const age = Date.now() - new Date(f.created_at).getTime();
      const daysOld = age / (1000 * 60 * 60 * 24);
      if (daysOld > 90) {
        // Savings from hot to cold: (0.021 - 0.010) per GB per month
        const sizeGB = (f.file_size || 0) / 1e9;
        savings += sizeGB * (tierPricing.hot - tierPricing.cold);
      }
    }

    return sum + savings;
  }, 0) || 0;

  // Format files for response
  const files = topFiles?.map((f) => {
    const compressionStats = f.compression_stats as any;
    const user = Array.isArray(f.users) ? f.users[0] : f.users;

    return {
      id: f.id,
      title: f.title || 'Untitled',
      fileSize: f.file_size || 0,
      fileSizeGB: (f.file_size || 0) / 1e9,
      createdAt: f.created_at,
      mimeType: f.mime_type || 'unknown',
      compressionRate: compressionStats?.compression_ratio || null,
      storageTier: f.storage_tier || 'hot',
      storageProvider: f.storage_provider || 'supabase',
      owner: {
        id: user?.id || 'unknown',
        name: user?.name || 'Unknown User',
      },
    };
  }) || [];

  return successResponse({
    organization: {
      id: org.id,
      name: org.name,
    },
    files,
    summary: {
      totalFiles: files.length,
      totalSize,
      totalSizeGB: totalSize / 1e9,
      potentialSavings,
    },
  });
});
