/**
 * Generate Recommendations Job Handler
 *
 * Analyzes usage patterns and generates optimization recommendations
 * for storage tier migration, compression, and deduplication.
 * Runs daily at midnight.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'generate-recommendations' });

// Recommendation Thresholds Configuration
// These business rules can be adjusted without code changes
export const RECOMMENDATION_THRESHOLDS = {
  // Time periods
  OLD_RECORDING_DAYS: 90, // Days before recording is considered old for tier migration
  UNUSED_RECORDING_MONTHS: 6, // Months before checking if recording is unused
  TWO_YEARS_IN_MONTHS: 24, // Months in 2 years (for very old recordings)

  // Counts and minimums
  MIN_UNCOMPRESSED_FILES: 5, // Minimum uncompressed files before recommending compression
  MIN_DUPLICATE_FILES: 5, // Minimum duplicate files before recommending deduplication
  MIN_UNUSED_RECORDINGS: 10, // Minimum unused recordings before recommending archival
  MIN_OLD_RECORDINGS: 20, // Minimum old recordings to check for unused

  // Pricing (per GB per month)
  TIER_PRICING: {
    HOT: 0.021, // Supabase Storage hot tier
    WARM: 0.015, // Cloudflare R2 warm tier
    COLD: 0.010, // Cloudflare R2 cold tier
    GLACIER: 0.004, // Glacier tier (not yet implemented)
  },

  // Estimation factors
  COMPRESSION_ESTIMATE_RATIO: 0.3, // Estimated 30% compression savings
  ANNUAL_MONTHS: 12, // Months in a year for annual savings calculation

  // Similarity
  HIGH_SIMILARITY_SCORE: 95, // Minimum similarity score (0-100) to consider files as duplicates
} as const;

type Job = Database['public']['Tables']['jobs']['Row'];

interface GenerateRecommendationsPayload {
  organizationId?: string;
}

export async function handleGenerateRecommendations(job: Job): Promise<void> {
  const payload = job.payload as GenerateRecommendationsPayload;
  const supabase = createAdminClient();

  logger.info('Starting recommendation generation', {
    context: { jobId: job.id, organizationId: payload.organizationId },
  });

  try {
    // Get all organizations
    let orgsQuery = supabase.from('organizations').select('id, name');
    if (payload.organizationId) {
      orgsQuery = orgsQuery.eq('id', payload.organizationId);
    }
    const { data: organizations, error: orgsError } = await orgsQuery;

    if (orgsError) {
      throw new Error(`Failed to fetch organizations: ${orgsError.message}`);
    }

    if (!organizations || organizations.length === 0) {
      logger.warn('No organizations found for recommendation generation');
      return;
    }

    logger.info(`Processing recommendations for ${organizations.length} organization(s)`);

    // Process each organization
    for (const org of organizations) {
      try {
        await generateRecommendationsForOrganization(supabase, org.id, org.name);
      } catch (error) {
        logger.error('Failed to generate recommendations for organization', {
          context: { organizationId: org.id, organizationName: org.name },
          error: error as Error,
        });
        // Continue processing other organizations
      }
    }

    logger.info('Recommendation generation completed successfully');
  } catch (error) {
    logger.error('Recommendation generation failed', { error: error as Error });
    throw error;
  }
}

async function generateRecommendationsForOrganization(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  orgName: string
): Promise<void> {
  logger.debug('Generating recommendations for organization', {
    context: { organizationId: orgId, organizationName: orgName },
  });

  let recommendationsCreated = 0;

  // Recommendation 1: Migrate old recordings to cold storage
  const oldRecordingDaysAgo = new Date();
  oldRecordingDaysAgo.setDate(oldRecordingDaysAgo.getDate() - RECOMMENDATION_THRESHOLDS.OLD_RECORDING_DAYS);

  const { data: oldHotFiles } = await supabase
    .from('recordings')
    .select('file_size')
    .eq('org_id', orgId)
    .eq('storage_tier', 'hot')
    .lt('created_at', oldRecordingDaysAgo.toISOString())
    .is('deleted_at', null);

  if (oldHotFiles && oldHotFiles.length > 0) {
    const totalSize = oldHotFiles.reduce((sum, f) => sum + (f.file_size || 0), 0);
    const sizeGB = totalSize / 1e9;
    const monthlySavings = sizeGB * (RECOMMENDATION_THRESHOLDS.TIER_PRICING.HOT - RECOMMENDATION_THRESHOLDS.TIER_PRICING.COLD);
    const annualSavings = monthlySavings * RECOMMENDATION_THRESHOLDS.ANNUAL_MONTHS;

    const created = await createRecommendation(supabase, {
      organization_id: orgId,
      title: 'Migrate old recordings to cold storage',
      description: `Move ${oldHotFiles.length} recordings older than ${RECOMMENDATION_THRESHOLDS.OLD_RECORDING_DAYS} days from hot to cold storage`,
      implementation:
        '1. Review recordings older than 90 days\n' +
        '2. Verify they are rarely accessed\n' +
        '3. Use the "Migrate" action to move to cold storage\n' +
        '4. Monitor access patterns after migration',
      impact: 'high',
      effort: 'low',
      savings: annualSavings,
      timeframe: 'immediate',
    });

    if (created) {
      recommendationsCreated++;
      logger.info('Created tier migration recommendation', {
        context: { organizationId: orgId },
        data: { fileCount: oldHotFiles.length, annualSavings: annualSavings.toFixed(2) },
      });
    }
  }

  // Recommendation 2: Enable compression for uncompressed files
  const { data: uncompressed } = await supabase
    .from('recordings')
    .select('file_size')
    .eq('org_id', orgId)
    .is('compression_stats', null)
    .is('deleted_at', null);

  if (uncompressed && uncompressed.length > RECOMMENDATION_THRESHOLDS.MIN_UNCOMPRESSED_FILES) {
    const totalSize = uncompressed.reduce((sum, f) => sum + (f.file_size || 0), 0);
    const estimatedSavings = totalSize * RECOMMENDATION_THRESHOLDS.COMPRESSION_ESTIMATE_RATIO;
    const sizeGB = estimatedSavings / 1e9;
    const monthlySavings = sizeGB * RECOMMENDATION_THRESHOLDS.TIER_PRICING.HOT;
    const annualSavings = monthlySavings * RECOMMENDATION_THRESHOLDS.ANNUAL_MONTHS;

    const created = await createRecommendation(supabase, {
      organization_id: orgId,
      title: 'Enable compression for uncompressed files',
      description: `Compress ${uncompressed.length} uncompressed files to save ~${sizeGB.toFixed(2)}GB of storage`,
      implementation:
        '1. Enable automatic compression for new uploads\n' +
        '2. Use the "Compress" action to compress existing files\n' +
        '3. Monitor compression ratios\n' +
        '4. Adjust quality settings if needed',
      impact: 'high',
      effort: 'low',
      savings: annualSavings,
      timeframe: 'immediate',
    });

    if (created) {
      recommendationsCreated++;
      logger.info('Created compression recommendation', {
        context: { organizationId: orgId },
        data: { fileCount: uncompressed.length, annualSavings: annualSavings.toFixed(2) },
      });
    }
  }

  // Recommendation 3: Remove duplicate files
  try {
    const { data: duplicates, error: duplicatesError } = await supabase
      .from('similarity_matches')
      .select('duplicate_file_size')
      .eq('org_id', orgId)
      .gte('similarity_score', RECOMMENDATION_THRESHOLDS.HIGH_SIMILARITY_SCORE);

    if (duplicatesError) {
      logger.debug('similarity_matches table not available, skipping duplicate recommendations', {
        error: duplicatesError.message,
      });
    } else if (duplicates && duplicates.length > RECOMMENDATION_THRESHOLDS.MIN_DUPLICATE_FILES) {
      const totalDuplicateSize = duplicates.reduce(
        (sum, d) => sum + (d.duplicate_file_size || 0),
        0
      );
      const sizeGB = totalDuplicateSize / 1e9;
      const monthlySavings = sizeGB * RECOMMENDATION_THRESHOLDS.TIER_PRICING.HOT;
      const annualSavings = monthlySavings * RECOMMENDATION_THRESHOLDS.ANNUAL_MONTHS;

      const created = await createRecommendation(supabase, {
        organization_id: orgId,
        title: 'Remove duplicate files',
        description: `${duplicates.length} duplicate files detected using ${sizeGB.toFixed(2)}GB of storage`,
        implementation:
          '1. Review duplicate file report\n' +
          '2. Verify which files are true duplicates\n' +
          '3. Keep one copy and delete others\n' +
          '4. Update references to point to kept copy',
        impact: 'medium',
        effort: 'medium',
        savings: annualSavings,
        timeframe: 'short-term',
      });

      if (created) {
        recommendationsCreated++;
        logger.info('Created deduplication recommendation', {
          context: { organizationId: orgId },
          data: { duplicateCount: duplicates.length, annualSavings: annualSavings.toFixed(2) },
        });
      }
    }
  } catch (error) {
    // similarity_matches table doesn't exist yet
    logger.debug('similarity_matches table not found, skipping duplicate recommendations');
  }

  // Recommendation 4: Archive unused recordings
  const unusedMonthsAgo = new Date();
  unusedMonthsAgo.setMonth(unusedMonthsAgo.getMonth() - RECOMMENDATION_THRESHOLDS.UNUSED_RECORDING_MONTHS);

  const { data: oldRecordings } = await supabase
    .from('recordings')
    .select('id, file_size')
    .eq('org_id', orgId)
    .lt('created_at', unusedMonthsAgo.toISOString())
    .is('deleted_at', null);

  if (oldRecordings && oldRecordings.length > RECOMMENDATION_THRESHOLDS.MIN_OLD_RECORDINGS) {
    // Check if they have been accessed recently (via search analytics or shares)
    const recordingIds = oldRecordings.map(r => r.id);

    const { data: recentAccess } = await supabase
      .from('shares')
      .select('target_id')
      .in('target_id', recordingIds)
      .gte('last_accessed_at', unusedMonthsAgo.toISOString());

    const accessedIds = new Set(recentAccess?.map(s => s.target_id) || []);
    const unusedRecordings = oldRecordings.filter(r => !accessedIds.has(r.id));

    if (unusedRecordings.length > RECOMMENDATION_THRESHOLDS.MIN_UNUSED_RECORDINGS) {
      const totalSize = unusedRecordings.reduce((sum, r) => sum + (r.file_size || 0), 0);
      const sizeGB = totalSize / 1e9;
      const monthlySavings = sizeGB * RECOMMENDATION_THRESHOLDS.TIER_PRICING.HOT; // Assume hot tier
      const annualSavings = monthlySavings * RECOMMENDATION_THRESHOLDS.ANNUAL_MONTHS;

      const created = await createRecommendation(supabase, {
        organization_id: orgId,
        title: 'Archive or delete unused recordings',
        description: `${unusedRecordings.length} recordings older than ${RECOMMENDATION_THRESHOLDS.UNUSED_RECORDING_MONTHS} months have not been accessed recently`,
        implementation:
          '1. Review list of unused recordings\n' +
          '2. Identify recordings that are no longer needed\n' +
          '3. Export important recordings for offline storage\n' +
          '4. Delete recordings that are no longer needed',
        impact: 'medium',
        effort: 'medium',
        savings: annualSavings,
        timeframe: 'long-term',
      });

      if (created) {
        recommendationsCreated++;
        logger.info('Created archival recommendation', {
          context: { organizationId: orgId },
          data: { unusedCount: unusedRecordings.length, annualSavings: annualSavings.toFixed(2) },
        });
      }
    }
  }

  logger.info('Recommendations generated', {
    context: { organizationId: orgId, organizationName: orgName },
    data: { recommendationsCreated },
  });
}

interface RecommendationData {
  organization_id: string;
  title: string;
  description: string;
  implementation: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  savings: number;
  timeframe: 'immediate' | 'short-term' | 'long-term';
}

async function createRecommendation(
  supabase: ReturnType<typeof createAdminClient>,
  data: RecommendationData
): Promise<boolean> {
  try {
    // Check if recommendation already exists and is not dismissed/completed
    const { data: existing, error: existingError } = await supabase
      .from('recommendations')
      .select('id')
      .eq('organization_id', data.organization_id)
      .eq('title', data.title)
      .in('status', ['pending', 'in-progress'])
      .maybeSingle();

    if (existingError) {
      if (existingError.code === '42P01') {
        // Table doesn't exist
        throw new Error(
          'recommendations table does not exist. Please run ANALYTICS_TABLES_MIGRATION.sql to create it.'
        );
      }
      throw new Error(`Failed to check existing recommendations: ${existingError.message}`);
    }

    if (existing) {
      // Recommendation already exists, don't create duplicate
      logger.debug('Recommendation already exists, skipping', {
        context: { organizationId: data.organization_id, title: data.title },
      });
      return false;
    }

    // Create new recommendation
    const { error: insertError } = await supabase.from('recommendations').insert({
      organization_id: data.organization_id,
      title: data.title,
      description: data.description,
      implementation: data.implementation,
      impact: data.impact,
      effort: data.effort,
      savings: data.savings,
      timeframe: data.timeframe,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      if (insertError.code === '42P01') {
        // Table doesn't exist
        throw new Error(
          'recommendations table does not exist. Please run ANALYTICS_TABLES_MIGRATION.sql to create it.'
        );
      }
      throw new Error(`Failed to create recommendation: ${insertError.message}`);
    }

    return true;
  } catch (error) {
    logger.error('Failed to create recommendation', {
      context: { organizationId: data.organization_id },
      error: error as Error,
    });
    return false;
  }
}
