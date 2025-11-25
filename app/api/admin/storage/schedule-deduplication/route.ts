/**
 * Automatic File Deduplication Scheduler
 *
 * API endpoint to automatically schedule deduplication jobs for organizations.
 * Can be called by a cron job (Vercel Cron, GitHub Actions, etc.)
 */

import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errors } from '@/lib/utils/api';
import { scheduleDeduplicationForAll } from '@/lib/workers/handlers/deduplicate-file';
import { createClient } from '@/lib/supabase/admin';

/**
 * POST /api/admin/storage/schedule-deduplication
 *
 * Automatically schedule deduplication jobs for all organizations.
 * Protected by CRON_SECRET environment variable for security.
 *
 * Request body:
 * - batchSize (optional): Number of files to process per organization (default: 100)
 * - orgIds (optional): Specific organization IDs to process (default: all)
 *
 * @example
 * POST /api/admin/storage/schedule-deduplication
 * Headers:
 *   x-cron-secret: <CRON_SECRET>
 * Body:
 *   { "batchSize": 100 }
 */
export const POST = apiHandler(async (request: NextRequest) => {
  // Verify cron secret for security
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    throw new Error(
      'CRON_SECRET not configured. Set CRON_SECRET environment variable.'
    );
  }

  if (cronSecret !== expectedSecret) {
    return errors.unauthorized();
  }

  // Parse and validate request body
  const body = await request.json().catch(() => ({}));

  // Validate and sanitize batchSize
  let batchSize = 100; // default
  if (body.batchSize !== undefined) {
    const parsedBatchSize = parseInt(String(body.batchSize), 10);
    if (isNaN(parsedBatchSize) || parsedBatchSize < 1) {
      throw errors.badRequest('batchSize must be a positive integer');
    }
    if (parsedBatchSize > 10000) {
      throw errors.badRequest('batchSize must not exceed 10000');
    }
    batchSize = parsedBatchSize;
  }

  // Validate targetOrgIds
  let targetOrgIds: string[] | null = null;
  if (body.orgIds !== undefined) {
    if (body.orgIds !== null && !Array.isArray(body.orgIds)) {
      throw errors.badRequest('orgIds must be an array or null');
    }
    targetOrgIds = body.orgIds;
  }

  console.log(
    `[schedule-deduplication] Starting automatic deduplication scheduling (batch: ${batchSize})`
  );

  try {
    // If specific org IDs are provided, process them individually
    if (targetOrgIds && Array.isArray(targetOrgIds) && targetOrgIds.length > 0) {
      const supabase = createClient();
      const results: Array<{
        orgId: string;
        orgName: string;
        success: boolean;
        processed: number;
        duplicatesFound: number;
        spaceSaved: number;
        errors: string[];
      }> = [];

      // Get organization names
      const { data: organizations, error: orgsError } = await supabase
        .from('organizations')
        .select('id, name')
        .in('id', targetOrgIds)
        .is('deleted_at', null);

      if (orgsError) {
        throw new Error(`Failed to fetch organizations: ${orgsError.message}`);
      }

      if (!organizations || organizations.length === 0) {
        return successResponse({
          message: 'No organizations to process',
          results: [],
          summary: {
            totalOrgs: 0,
            totalProcessed: 0,
            totalDuplicates: 0,
            totalSpaceSaved: 0,
            totalErrors: 0,
          },
        });
      }

      // Import batch handler directly
      const { handleBatchDeduplicate } = await import(
        '@/lib/workers/handlers/deduplicate-file'
      );

      // Process each organization
      for (const org of organizations) {
        console.log(`[schedule-deduplication] Processing org: ${org.name} (${org.id})`);

        try {
          const deduplicationResult = await handleBatchDeduplicate({
            orgId: org.id,
            batchSize,
          });

          results.push({
            orgId: org.id,
            orgName: org.name,
            success: deduplicationResult.success,
            processed: deduplicationResult.processed,
            duplicatesFound: deduplicationResult.duplicatesFound,
            spaceSaved: deduplicationResult.spaceSaved,
            errors: deduplicationResult.errors,
          });

          console.log(
            `[schedule-deduplication] Org ${org.name}: ${deduplicationResult.processed} files processed, ${deduplicationResult.duplicatesFound} duplicates found, ${(deduplicationResult.spaceSaved / 1024 / 1024).toFixed(2)} MB saved`
          );
        } catch (error) {
          console.error(`[schedule-deduplication] Error processing org ${org.name}:`, error);
          results.push({
            orgId: org.id,
            orgName: org.name,
            success: false,
            processed: 0,
            duplicatesFound: 0,
            spaceSaved: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          });
        }
      }

      // Calculate summary statistics
      const summary = {
        totalOrgs: organizations.length,
        totalProcessed: results.reduce((sum, r) => sum + r.processed, 0),
        totalDuplicates: results.reduce((sum, r) => sum + r.duplicatesFound, 0),
        totalSpaceSaved: results.reduce((sum, r) => sum + r.spaceSaved, 0),
        totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
        successfulOrgs: results.filter((r) => r.success).length,
        failedOrgs: results.filter((r) => !r.success).length,
      };

      console.log('[schedule-deduplication] Deduplication scheduling complete:', summary);

      return successResponse({
        message: 'Deduplication scheduling completed',
        results,
        summary,
        timestamp: new Date().toISOString(),
      });
    }

    // Process all organizations
    const result = await scheduleDeduplicationForAll(batchSize);

    const summary = {
      totalOrgs: result.organizations,
      totalProcessed: result.totalProcessed,
      totalDuplicates: result.totalDuplicates,
      totalSpaceSaved: result.totalSpaceSaved,
      totalSpaceSavedMB: Math.round((result.totalSpaceSaved / 1024 / 1024) * 100) / 100,
      totalErrors: result.errors.length,
    };

    console.log('[schedule-deduplication] Deduplication complete:', summary);

    return successResponse({
      message: 'Deduplication completed successfully',
      summary,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[schedule-deduplication] Deduplication scheduling failed:', error);
    throw new Error(
      `Deduplication scheduling failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});

/**
 * GET /api/admin/storage/schedule-deduplication
 *
 * Health check endpoint to verify the deduplication scheduler is configured correctly.
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    throw new Error('CRON_SECRET not configured');
  }

  if (cronSecret !== expectedSecret) {
    throw errors.unauthorized('Invalid cron secret');
  }

  const supabase = createClient();

  // Get deduplication statistics across all orgs
  const { data: orgCount } = await supabase
    .from('organizations')
    .select('id', { count: 'exact' })
    .is('deleted_at', null);

  const { data: filesWithHash } = await supabase
    .from('content')
    .select('id', { count: 'exact' })
    .not('file_hash', 'is', null)
    .is('deleted_at', null);

  const { data: filesWithoutHash } = await supabase
    .from('content')
    .select('id', { count: 'exact' })
    .is('file_hash', null)
    .is('deleted_at', null);

  const { data: deduplicatedFiles } = await supabase
    .from('content')
    .select('id', { count: 'exact' })
    .eq('is_deduplicated', true)
    .is('deleted_at', null);

  return successResponse({
    status: 'healthy',
    configuration: {
      cronSecretConfigured: !!expectedSecret,
      supabaseConfigured: !!(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ),
    },
    statistics: {
      totalOrganizations: orgCount?.length || 0,
      filesWithHash: filesWithHash?.length || 0,
      filesWithoutHash: filesWithoutHash?.length || 0,
      deduplicatedFiles: deduplicatedFiles?.length || 0,
    },
    timestamp: new Date().toISOString(),
  });
});
