/**
 * Automatic Storage Tier Migration Scheduler
 *
 * API endpoint to automatically schedule tier migrations based on file age.
 * Can be called by a cron job (Vercel Cron, GitHub Actions, etc.)
 */

import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errors } from '@/lib/utils/api';
import { batchMigrateTier } from '@/lib/workers/handlers/migrate-storage-tier';
import { createClient } from '@/lib/supabase/admin';

/**
 * POST /api/admin/storage/schedule-migrations
 *
 * Automatically schedule tier migrations for files based on age thresholds.
 * Protected by CRON_SECRET environment variable for security.
 *
 * Request body:
 * - batchSize (optional): Number of files to migrate per organization (default: 100)
 * - minAgeDays (optional): Minimum file age in days (default: 30)
 * - orgIds (optional): Specific organization IDs to process (default: all)
 *
 * @example
 * POST /api/admin/storage/schedule-migrations
 * Headers:
 *   x-cron-secret: <CRON_SECRET>
 * Body:
 *   { "batchSize": 100, "minAgeDays": 30 }
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

  // Validate and sanitize minAgeDays
  let minAgeDays = 30; // default
  if (body.minAgeDays !== undefined) {
    const parsedMinAgeDays = parseInt(String(body.minAgeDays), 10);
    if (isNaN(parsedMinAgeDays) || parsedMinAgeDays < 0) {
      throw errors.badRequest('minAgeDays must be a non-negative integer');
    }
    if (parsedMinAgeDays > 3650) {
      throw errors.badRequest('minAgeDays must not exceed 3650 (10 years)');
    }
    minAgeDays = parsedMinAgeDays;
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
    `[schedule-migrations] Starting automatic migration scheduling (batch: ${batchSize}, min age: ${minAgeDays} days)`
  );

  const supabase = createClient();
  const results: Array<{
    orgId: string;
    orgName: string;
    success: boolean;
    migrated: number;
    failed: number;
    errors: string[];
  }> = [];

  try {
    // 1. Get list of organizations to process
    let query = supabase.from('organizations').select('id, name').is('deleted_at', null);

    if (targetOrgIds && Array.isArray(targetOrgIds)) {
      query = query.in('id', targetOrgIds);
    }

    const { data: organizations, error: orgsError } = await query;

    if (orgsError) {
      throw new Error(`Failed to fetch organizations: ${orgsError.message}`);
    }

    if (!organizations || organizations.length === 0) {
      return successResponse({
        message: 'No organizations to process',
        results: [],
        summary: {
          totalOrgs: 0,
          totalMigrated: 0,
          totalFailed: 0,
          totalErrors: 0,
        },
      });
    }

    console.log(`[schedule-migrations] Processing ${organizations.length} organizations`);

    // 2. Process each organization
    for (const org of organizations) {
      console.log(`[schedule-migrations] Processing org: ${org.name} (${org.id})`);

      try {
        const migrationResult = await batchMigrateTier(org.id, batchSize, minAgeDays);

        results.push({
          orgId: org.id,
          orgName: org.name,
          success: migrationResult.success,
          migrated: migrationResult.migrated,
          failed: migrationResult.failed,
          errors: migrationResult.errors,
        });

        console.log(
          `[schedule-migrations] Org ${org.name}: ${migrationResult.migrated} migrations scheduled, ${migrationResult.failed} failed`
        );
      } catch (error) {
        console.error(`[schedule-migrations] Error processing org ${org.name}:`, error);
        results.push({
          orgId: org.id,
          orgName: org.name,
          success: false,
          migrated: 0,
          failed: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        });
      }
    }

    // 3. Calculate summary statistics
    const summary = {
      totalOrgs: organizations.length,
      totalMigrated: results.reduce((sum, r) => sum + r.migrated, 0),
      totalFailed: results.reduce((sum, r) => sum + r.failed, 0),
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      successfulOrgs: results.filter((r) => r.success).length,
      failedOrgs: results.filter((r) => !r.success).length,
    };

    console.log('[schedule-migrations] Migration scheduling complete:', summary);

    return successResponse({
      message: 'Migration scheduling completed',
      results,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[schedule-migrations] Migration scheduling failed:', error);
    throw new Error(
      `Migration scheduling failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});

/**
 * GET /api/admin/storage/schedule-migrations
 *
 * Health check endpoint to verify the scheduler is configured correctly.
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    throw new Error('CRON_SECRET not configured');
  }

  if (cronSecret !== expectedSecret) {
    return errors.unauthorized();
  }

  const supabase = createClient();

  // Get migration statistics across all orgs
  const { data: orgCount } = await supabase
    .from('organizations')
    .select('id', { count: 'exact' })
    .is('deleted_at', null);

  const { data: pendingMigrations } = await supabase
    .from('content')
    .select('id', { count: 'exact' })
    .eq('tier_migration_scheduled', true)
    .is('deleted_at', null);

  const { data: recentMigrations } = await supabase
    .from('storage_migrations')
    .select('id', { count: 'exact' })
    .eq('status', 'completed')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  return successResponse({
    status: 'healthy',
    configuration: {
      cronSecretConfigured: !!expectedSecret,
      r2Configured: !!(
        process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY
      ),
    },
    statistics: {
      totalOrganizations: orgCount?.length || 0,
      pendingMigrations: pendingMigrations?.length || 0,
      recentMigrations24h: recentMigrations?.length || 0,
    },
    timestamp: new Date().toISOString(),
  });
});
