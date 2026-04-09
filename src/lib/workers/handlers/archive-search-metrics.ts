/**
 * Archive Search Metrics Job Handler
 *
 * Archives search performance metrics from Redis to Supabase for long-term storage.
 * Runs hourly to persist metrics before they expire from Redis (24h TTL).
 * Also cleans up archived metrics older than 90 days.
 *
 * Benefits:
 * - 90-day retention (vs 24h Redis TTL)
 * - SQL-queryable for trend analysis
 * - Supports A/B testing analysis over weeks/months
 * - Enables day-of-week and seasonal pattern detection
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { getRedis } from '@/lib/rate-limit/redis';
import type { Database } from '@/lib/types/database';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'archive-search-metrics' });

type Job = Database['public']['Tables']['jobs']['Row'];

interface ArchiveSearchMetricsPayload {
  organizationId?: string;
  retentionDays?: number;
}

interface RedisSearchMetric {
  queryId: string;
  timestamp: string;
  orgId: string;
  userId: string;
  query: string;
  queryLength: number;
  queryWordCount: number;
  strategy: string;
  threshold: number;
  useHybrid: boolean;
  useAgentic: boolean;
  sourcesFound: number;
  avgSimilarity: number;
  minSimilarity: number;
  maxSimilarity: number;
  embeddingTimeMs: number;
  searchTimeMs: number;
  totalTimeMs: number;
  retrievalAttempts: number;
  retriedWithLowerThreshold: boolean;
  retriedWithHybrid: boolean;
  retriedWithKeyword: boolean;
  success: boolean;
  usedToolFallback: boolean;
}

export async function handleArchiveSearchMetrics(job: Job): Promise<void> {
  const payload = job.payload as ArchiveSearchMetricsPayload;
  const retentionDays = payload.retentionDays ?? 90;
  const supabase = createAdminClient();
  const redis = getRedis();

  logger.info('Starting search metrics archival', {
    context: { jobId: job.id, organizationId: payload.organizationId, retentionDays },
  });

  if (!redis) {
    logger.warn('Redis not available, skipping archival');
    return;
  }

  try {
    // Step 1: Get organizations to process
    let orgsQuery = supabase.from('organizations').select('id');
    if (payload.organizationId) {
      orgsQuery = orgsQuery.eq('id', payload.organizationId);
    }
    const { data: organizations, error: orgsError } = await orgsQuery;

    if (orgsError) {
      throw new Error(`Failed to fetch organizations: ${orgsError.message}`);
    }

    if (!organizations || organizations.length === 0) {
      logger.warn('No organizations found for metrics archival');
      return;
    }

    let totalArchived = 0;
    let totalCleaned = 0;

    // Step 2: Archive metrics for each organization
    for (const org of organizations) {
      try {
        const archived = await archiveMetricsForOrg(supabase, redis, org.id);
        totalArchived += archived;
      } catch (error) {
        logger.error('Failed to archive metrics for organization', {
          context: { organizationId: org.id },
          error: error as Error,
        });
        // Continue with other organizations
      }
    }

    // Step 3: Clean up old metrics (older than retention period)
    try {
      totalCleaned = await cleanupOldMetrics(supabase, retentionDays);
    } catch (error) {
      logger.error('Failed to cleanup old metrics', { error: error as Error });
    }

    logger.info('Search metrics archival completed', {
      data: { totalArchived, totalCleaned, organizationsProcessed: organizations.length },
    });
  } catch (error) {
    logger.error('Search metrics archival failed', { error: error as Error });
    throw error;
  }
}

/**
 * Archive metrics from Redis for a specific organization
 */
async function archiveMetricsForOrg(
  supabase: ReturnType<typeof createAdminClient>,
  redis: NonNullable<ReturnType<typeof getRedis>>,
  orgId: string
): Promise<number> {
  const listKey = `search_metrics:list:${orgId}`;

  // Get all metric keys from the sorted set
  const keys = await redis.zrange(listKey, 0, -1);

  if (!keys || keys.length === 0) {
    logger.debug('No metrics to archive for organization', {
      context: { organizationId: orgId },
    });
    return 0;
  }

  logger.debug(`Found ${keys.length} metrics to archive for org ${orgId.substring(0, 8)}`);

  // Fetch all metrics data
  const metricsData = await Promise.all(
    (keys as string[]).map((key: string) => redis.get(key))
  );

  // Parse and transform metrics for database insertion
  const metricsToInsert: Array<{
    query_id: string;
    org_id: string;
    user_id: string | null;
    search_timestamp: string;
    query_text: string;
    query_length: number;
    query_word_count: number;
    strategy: string | null;
    similarity_threshold: number | null;
    use_hybrid: boolean;
    use_agentic: boolean;
    sources_found: number;
    avg_similarity: number | null;
    min_similarity: number | null;
    max_similarity: number | null;
    embedding_time_ms: number | null;
    search_time_ms: number | null;
    total_time_ms: number;
    retrieval_attempts: number;
    retried_with_lower_threshold: boolean;
    retried_with_hybrid: boolean;
    retried_with_keyword: boolean;
    success: boolean;
    used_tool_fallback: boolean;
  }> = [];

  for (const data of metricsData) {
    if (typeof data !== 'string') continue;

    try {
      const metric = JSON.parse(data) as RedisSearchMetric;

      // Check if this metric was already archived (by query_id)
      const { data: existing } = await supabase
        .from('search_metrics_archive')
        .select('id')
        .eq('query_id', metric.queryId)
        .limit(1);

      if (existing && existing.length > 0) {
        // Already archived, skip
        continue;
      }

      metricsToInsert.push({
        query_id: metric.queryId,
        org_id: metric.orgId,
        user_id: metric.userId || null,
        search_timestamp: metric.timestamp,
        query_text: metric.query,
        query_length: metric.queryLength,
        query_word_count: metric.queryWordCount,
        strategy: metric.strategy || null,
        similarity_threshold: metric.threshold || null,
        use_hybrid: metric.useHybrid || false,
        use_agentic: metric.useAgentic || false,
        sources_found: metric.sourcesFound || 0,
        avg_similarity: metric.avgSimilarity || null,
        min_similarity: metric.minSimilarity || null,
        max_similarity: metric.maxSimilarity || null,
        embedding_time_ms: metric.embeddingTimeMs || null,
        search_time_ms: metric.searchTimeMs || null,
        total_time_ms: metric.totalTimeMs || 0,
        retrieval_attempts: metric.retrievalAttempts || 1,
        retried_with_lower_threshold: metric.retriedWithLowerThreshold || false,
        retried_with_hybrid: metric.retriedWithHybrid || false,
        retried_with_keyword: metric.retriedWithKeyword || false,
        success: metric.success || false,
        used_tool_fallback: metric.usedToolFallback || false,
      });
    } catch (error) {
      logger.warn('Failed to parse metric data', { error: error as Error });
    }
  }

  if (metricsToInsert.length === 0) {
    logger.debug('No new metrics to archive (all already archived)', {
      context: { organizationId: orgId },
    });
    return 0;
  }

  // Batch insert metrics
  const { error: insertError } = await supabase
    .from('search_metrics_archive')
    .insert(metricsToInsert);

  if (insertError) {
    if (insertError.code === '42P01') {
      throw new Error(
        'search_metrics_archive table does not exist. Please apply the migration.'
      );
    }
    throw new Error(`Failed to insert metrics: ${insertError.message}`);
  }

  logger.info('Archived metrics for organization', {
    context: { organizationId: orgId },
    data: { metricsArchived: metricsToInsert.length },
  });

  return metricsToInsert.length;
}

/**
 * Clean up metrics older than retention period
 */
async function cleanupOldMetrics(
  supabase: ReturnType<typeof createAdminClient>,
  retentionDays: number
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const { data: deleted, error } = await supabase
    .from('search_metrics_archive')
    .delete()
    .lt('search_timestamp', cutoffDate.toISOString())
    .select('id');

  if (error) {
    throw new Error(`Failed to cleanup old metrics: ${error.message}`);
  }

  const deletedCount = deleted?.length || 0;

  if (deletedCount > 0) {
    logger.info('Cleaned up old metrics', {
      data: { deletedCount, cutoffDate: cutoffDate.toISOString(), retentionDays },
    });
  }

  return deletedCount;
}
