/**
 * Collect Metrics Job Handler
 *
 * Collects and aggregates storage metrics hourly for all organizations.
 * Populates the storage_metrics table with usage data, costs, and compression statistics.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'collect-metrics' });

type Job = Database['public']['Tables']['jobs']['Row'];

interface CollectMetricsPayload {
  organizationId?: string;
}

export async function handleCollectMetrics(job: Job): Promise<void> {
  const payload = job.payload as CollectMetricsPayload;
  const supabase = createAdminClient();

  logger.info('Starting metrics collection', {
    context: { jobId: job.id, organizationId: payload.organizationId },
  });

  try {
    // Get all organizations (or specific org if provided)
    let orgsQuery = supabase.from('organizations').select('id, name');
    if (payload.organizationId) {
      orgsQuery = orgsQuery.eq('id', payload.organizationId);
    }
    const { data: organizations, error: orgsError } = await orgsQuery;

    if (orgsError) {
      throw new Error(`Failed to fetch organizations: ${orgsError.message}`);
    }

    if (!organizations || organizations.length === 0) {
      logger.warn('No organizations found for metrics collection');
      return;
    }

    logger.info(`Processing metrics for ${organizations.length} organization(s)`);

    // Process each organization
    for (const org of organizations) {
      try {
        await collectMetricsForOrganization(supabase, org.id, org.name);
      } catch (error) {
        logger.error('Failed to collect metrics for organization', {
          context: { organizationId: org.id, organizationName: org.name },
          error: error as Error,
        });
        // Continue processing other organizations even if one fails
      }
    }

    logger.info('Metrics collection completed successfully');
  } catch (error) {
    logger.error('Metrics collection failed', { error: error as Error });
    throw error;
  }
}

async function collectMetricsForOrganization(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  orgName: string
): Promise<void> {
  logger.debug('Collecting metrics for organization', {
    context: { organizationId: orgId, organizationName: orgName },
  });

  // Fetch all recordings for this organization
  const { data: recordings, error: recordingsError } = await supabase
    .from('content')
    .select('file_size, storage_tier, compression_stats, mime_type, content_type')
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (recordingsError) {
    throw new Error(`Failed to fetch recordings: ${recordingsError.message}`);
  }

  if (!recordings || recordings.length === 0) {
    logger.debug('No recordings found for organization', {
      context: { organizationId: orgId },
    });
    // Still insert a zero-metrics record
    await insertMetrics(supabase, orgId, {
      totalStorage: 0,
      hotStorage: 0,
      warmStorage: 0,
      coldStorage: 0,
      glacierStorage: 0,
      totalFiles: 0,
      totalUsers: 0,
      totalRecordings: 0,
      storageCost: 0,
      processingCost: 0,
      compressionRate: 0,
      deduplicationSavings: 0,
    });
    return;
  }

  // Calculate storage metrics by tier
  const totalStorage = recordings.reduce((sum, r) => sum + (r.file_size || 0), 0);

  const hotStorage = recordings
    .filter(r => r.storage_tier === 'hot')
    .reduce((sum, r) => sum + (r.file_size || 0), 0);

  const warmStorage = recordings
    .filter(r => r.storage_tier === 'warm')
    .reduce((sum, r) => sum + (r.file_size || 0), 0);

  const coldStorage = recordings
    .filter(r => r.storage_tier === 'cold')
    .reduce((sum, r) => sum + (r.file_size || 0), 0);

  // Note: 'glacier' is not in StorageTier type, using 0 for now
  const glacierStorage = 0;

  // Get user count
  const { count: totalUsers, error: usersError } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (usersError) {
    logger.warn('Failed to count users', {
      context: { organizationId: orgId },
      error: new Error(usersError.message),
    });
  }

  // Calculate costs (per GB/month pricing)
  const tierPricing = {
    hot: 0.021,    // Supabase Storage
    warm: 0.015,   // Cloudflare R2 warm tier
    cold: 0.010,   // Cloudflare R2 cold tier
  };

  const storageCost = recordings.reduce((sum, r) => {
    const sizeGB = (r.file_size || 0) / 1e9;
    const tier = (r.storage_tier || 'hot') as 'hot' | 'warm' | 'cold';
    return sum + (sizeGB * (tierPricing[tier] ?? 0));
  }, 0);

  // Get processing costs from completed jobs (last hour)
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const { data: completedJobs } = await supabase
    .from('jobs')
    .select('type, payload')
    .eq('status', 'completed')
    .gte('created_at', oneHourAgo);

  // Estimate processing costs based on job types
  // These are example costs - adjust based on actual provider pricing
  const jobCosts: Record<string, number> = {
    transcribe: 0.006,           // Per minute of audio
    doc_generate: 0.002,         // Per document
    generate_embeddings: 0.0001, // Per chunk
    compress_video: 0.005,       // Per file
    compress_audio: 0.002,       // Per file
  };

  let processingCost = 0;
  if (completedJobs) {
    processingCost = completedJobs.reduce((sum, job) => {
      return sum + (jobCosts[job.type] || 0);
    }, 0);
  }

  // Calculate compression metrics
  const compressedFiles = recordings.filter(
    r => r.compression_stats && typeof r.compression_stats === 'object' && 'compression_ratio' in r.compression_stats
  );

  const compressionRate = compressedFiles.length > 0
    ? compressedFiles.reduce((sum, r) => {
        const stats = r.compression_stats as any;
        return sum + (stats.compression_ratio || 0);
      }, 0) / compressedFiles.length
    : 0;

  // Calculate deduplication savings (from similarity_matches table if it exists)
  // Note: This table is created by ANALYTICS_TABLES_MIGRATION.sql
  // If the migration hasn't been run yet, this query will fail gracefully
  let deduplicationSavings = 0;
  const { data: similarityMatches, error: similarityError } = await supabase
    .from('similarity_matches')
    .select('duplicate_file_size')
    .eq('org_id', orgId);

  if (similarityError) {
    logger.debug('similarity_matches table not available, skipping deduplication metrics', {
      error: new Error(similarityError.message),
    });
  } else if (similarityMatches) {
    deduplicationSavings = similarityMatches.reduce(
      (sum, m) => sum + (m.duplicate_file_size || 0),
      0
    );
  }

  // Insert metrics
  await insertMetrics(supabase, orgId, {
    totalStorage,
    hotStorage,
    warmStorage,
    coldStorage,
    glacierStorage,
    totalFiles: recordings.length,
    totalUsers: totalUsers || 0,
    totalRecordings: recordings.length,
    storageCost,
    processingCost,
    compressionRate,
    deduplicationSavings,
  });

  logger.info('Metrics collected successfully', {
    context: { organizationId: orgId, organizationName: orgName },
    data: {
      totalStorage: (totalStorage / 1e9).toFixed(2) + ' GB',
      totalFiles: recordings.length,
      totalCost: (storageCost + processingCost).toFixed(2),
    },
  });
}

interface MetricsData {
  totalStorage: number;
  hotStorage: number;
  warmStorage: number;
  coldStorage: number;
  glacierStorage: number;
  totalFiles: number;
  totalUsers: number;
  totalRecordings: number;
  storageCost: number;
  processingCost: number;
  compressionRate: number;
  deduplicationSavings: number;
}

async function insertMetrics(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  data: MetricsData
): Promise<void> {
  // Note: storage_metrics table is created by ANALYTICS_TABLES_MIGRATION.sql
  // If the migration hasn't been run yet, this will fail with a clear error
  try {
    const { error } = await supabase.from('storage_metrics').insert({
      organization_id: orgId,
      recorded_at: new Date().toISOString(),
      total_storage: data.totalStorage,
      hot_storage: data.hotStorage,
      warm_storage: data.warmStorage,
      cold_storage: data.coldStorage,
      glacier_storage: data.glacierStorage,
      total_files: data.totalFiles,
      total_users: data.totalUsers,
      total_recordings: data.totalRecordings,
      storage_cost: data.storageCost,
      processing_cost: data.processingCost,
      total_cost: data.storageCost + data.processingCost,
      compression_rate: data.compressionRate,
      deduplication_savings: data.deduplicationSavings,
    });

    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist
        throw new Error(
          'storage_metrics table does not exist. Please run ANALYTICS_TABLES_MIGRATION.sql to create it.'
        );
      }
      throw new Error(`Failed to insert metrics: ${error.message}`);
    }
  } catch (error) {
    logger.error('Failed to insert metrics', {
      context: { organizationId: orgId },
      error: error as Error,
    });
    throw error;
  }
}
