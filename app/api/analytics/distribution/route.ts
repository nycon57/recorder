/**
 * Storage Distribution API
 *
 * GET /api/analytics/distribution
 * - Returns storage distribution by tier and provider
 * - Includes migration job statistics
 */

import { apiHandler, successResponse } from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/admin';

/**
 * GET /api/analytics/distribution
 *
 * Get storage distribution by tier and provider, plus migration statistics
 *
 * @example
 * GET /api/analytics/distribution
 */
export const GET = apiHandler(async () => {
  const supabase = createClient();

  try {
    // Fetch all non-deleted recordings
    const { data: recordings, error: recordingsError } = await supabase
      .from('recordings')
      .select('storage_tier, storage_provider, file_size')
      .is('deleted_at', null);

    if (recordingsError) {
      console.error('[Analytics Distribution] Error fetching recordings:', recordingsError);
      throw new Error(`Failed to fetch recordings: ${recordingsError.message}`);
    }

    if (!recordings || recordings.length === 0) {
      // Return empty distribution if no recordings
      return successResponse({
        tiers: {
          hot: 0,
          warm: 0,
          cold: 0,
          glacier: 0,
        },
        providers: {
          supabase: 0,
          cloudflare_r2: 0,
        },
        tierPercentages: {
          hot: 0,
          warm: 0,
          cold: 0,
          glacier: 0,
        },
        migration: {
          inProgress: 0,
          pending: 0,
          completed: 0,
          failed: 0,
        },
      });
    }

    // Calculate tier distribution
    const tierMap = {
      hot: 0,
      warm: 0,
      cold: 0,
      glacier: 0,
    };

    recordings.forEach((r) => {
      const tier = (r.storage_tier || 'hot') as 'hot' | 'warm' | 'cold' | 'glacier';
      const size = r.file_size || 0;
      tierMap[tier] += size;
    });

    // Calculate provider distribution
    const providerMap: Record<string, number> = {
      supabase: 0,
      cloudflare_r2: 0,
      unknown: 0,
    };

    recordings.forEach((r) => {
      const provider = r.storage_provider || 'supabase';
      const size = r.file_size || 0;

      if (provider === 'supabase') {
        providerMap.supabase += size;
      } else if (provider === 'r2') {
        providerMap.cloudflare_r2 += size;
      } else {
        providerMap.unknown += size;
        console.warn('[Analytics Distribution] Unknown storage provider:', {
          provider,
          recordingId: (r as any).id,
          size,
        });
      }
    });

    // Calculate total storage for percentage calculations
    const totalStorage = Object.values(tierMap).reduce((sum, val) => sum + val, 0);

    // Calculate tier percentages
    const tierPercentages = {
      hot: totalStorage > 0 ? (tierMap.hot / totalStorage) * 100 : 0,
      warm: totalStorage > 0 ? (tierMap.warm / totalStorage) * 100 : 0,
      cold: totalStorage > 0 ? (tierMap.cold / totalStorage) * 100 : 0,
      glacier: totalStorage > 0 ? (tierMap.glacier / totalStorage) * 100 : 0,
    };

    // Fetch migration job statistics
    const { data: migrationJobs, error: jobsError } = await supabase
      .from('jobs')
      .select('status')
      .eq('type', 'migrate_storage_tier');

    if (jobsError) {
      console.error('[Analytics Distribution] Error fetching migration jobs:', jobsError);
      // Don't fail the request, just log and return zero migration stats
    }

    // Count migration jobs by status
    const migrationStats = {
      inProgress: 0,
      pending: 0,
      completed: 0,
      failed: 0,
    };

    if (migrationJobs) {
      migrationJobs.forEach((job) => {
        if (job.status === 'processing') {
          migrationStats.inProgress++;
        } else if (job.status === 'pending') {
          migrationStats.pending++;
        } else if (job.status === 'completed') {
          migrationStats.completed++;
        } else if (job.status === 'failed') {
          migrationStats.failed++;
        }
      });
    }

    return successResponse({
      tiers: tierMap,
      providers: providerMap,
      tierPercentages,
      migration: migrationStats,
    });
  } catch (error) {
    console.error('[Analytics Distribution] Error:', error);
    throw new Error(
      `Failed to fetch storage distribution: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});
