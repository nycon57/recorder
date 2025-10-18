import { createClient } from '@/lib/supabase/admin';

export type QuotaType = 'search' | 'recording' | 'ai' | 'storage' | 'connector';
export type PlanTier = 'free' | 'starter' | 'professional' | 'enterprise';

export interface QuotaCheck {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  message?: string;
}

export interface OrgQuota {
  planTier: PlanTier;
  searchesPerMonth: number;
  searchesUsed: number;
  storageGb: number;
  storageUsedGb: number;
  recordingsPerMonth: number;
  recordingsUsed: number;
  aiRequestsPerMonth: number;
  aiRequestsUsed: number;
  connectorsAllowed: number;
  connectorsUsed: number;
  quotaResetAt: Date;
}

// In-memory cache for quota checks (60-second TTL)
interface QuotaCacheEntry {
  quota: OrgQuota;
  timestamp: number;
}

const CACHE_TTL = 60000; // 60 seconds
const quotaCache = new Map<string, QuotaCacheEntry>();

export class QuotaManager {
  /**
   * Clear cache for an organization (e.g., after consumption)
   */
  private static clearCache(orgId: string): void {
    quotaCache.delete(orgId);
  }

  /**
   * Get cached quota or fetch from database
   */
  private static async getCachedQuota(orgId: string): Promise<OrgQuota | null> {
    // Performance monitoring: track cache hit rate
    const cacheStart = Date.now();

    // Check if we have a cached entry
    const cached = quotaCache.get(orgId);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < CACHE_TTL) {
        // Performance: Cache hit (~0ms latency)
        console.log(`[QuotaManager] Cache hit for org ${orgId} (age: ${age}ms)`);
        return cached.quota;
      }
    }

    // Performance: Cache miss, fetch from database
    const supabase = await createClient();
    const dbStart = Date.now();

    const { data: quota, error } = await supabase
      .from('org_quotas')
      .select('*')
      .eq('org_id', orgId)
      .single();

    const dbLatency = Date.now() - dbStart;
    console.log(`[QuotaManager] Database fetch for org ${orgId} (latency: ${dbLatency}ms)`);

    if (error || !quota) {
      console.error('[QuotaManager] Failed to fetch quota:', error);
      return null;
    }

    const orgQuota: OrgQuota = {
      planTier: quota.plan_tier as PlanTier,
      searchesPerMonth: quota.searches_per_month,
      searchesUsed: quota.searches_used,
      storageGb: quota.storage_gb,
      storageUsedGb: quota.storage_used_gb,
      recordingsPerMonth: quota.recordings_per_month,
      recordingsUsed: quota.recordings_used,
      aiRequestsPerMonth: quota.ai_requests_per_month,
      aiRequestsUsed: quota.ai_requests_used,
      connectorsAllowed: quota.connectors_allowed,
      connectorsUsed: quota.connectors_used,
      quotaResetAt: new Date(quota.quota_reset_at),
    };

    // Store in cache
    quotaCache.set(orgId, {
      quota: orgQuota,
      timestamp: Date.now(),
    });

    const totalLatency = Date.now() - cacheStart;
    console.log(`[QuotaManager] Total quota check latency: ${totalLatency}ms`);

    return orgQuota;
  }

  /**
   * DEPRECATED: Use checkAndConsumeQuota() instead to avoid race conditions
   * This method is kept for backward compatibility but should not be used
   * @deprecated
   */
  static async checkQuota(
    orgId: string,
    quotaType: QuotaType,
    amount: number = 1
  ): Promise<QuotaCheck> {
    console.warn('[QuotaManager] DEPRECATED: checkQuota() is vulnerable to race conditions. Use checkAndConsumeQuota() instead');

    const startTime = Date.now();

    // Try to get cached quota first
    const quota = await this.getCachedQuota(orgId);

    if (!quota) {
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        resetAt: new Date(),
        message: 'Quota not found for organization',
      };
    }

    // Check if quota needs reset
    const now = new Date();
    if (quota.quotaResetAt < now) {
      // Clear cache and force refetch after reset
      this.clearCache(orgId);
      await this.resetQuota(orgId);

      // Refetch updated quota
      const updatedQuota = await this.getCachedQuota(orgId);
      if (updatedQuota) {
        Object.assign(quota, updatedQuota);
      }
    }

    // Check specific quota type
    let limit = 0;
    let used = 0;

    switch (quotaType) {
      case 'search':
        limit = quota.searchesPerMonth;
        used = quota.searchesUsed;
        break;
      case 'recording':
        limit = quota.recordingsPerMonth;
        used = quota.recordingsUsed;
        break;
      case 'ai':
        limit = quota.aiRequestsPerMonth;
        used = quota.aiRequestsUsed;
        break;
      case 'connector':
        limit = quota.connectorsAllowed;
        used = quota.connectorsUsed;
        break;
      case 'storage':
        limit = quota.storageGb;
        used = Math.ceil(quota.storageUsedGb);
        break;
      default:
        return {
          allowed: false,
          remaining: 0,
          limit: 0,
          resetAt: quota.quotaResetAt,
          message: `Unknown quota type: ${quotaType}`,
        };
    }

    const remaining = limit - used;
    const allowed = remaining >= amount;

    const checkLatency = Date.now() - startTime;
    if (checkLatency > 10) {
      console.warn(`[QuotaManager] Slow quota check: ${checkLatency}ms`);
    }

    return {
      allowed,
      remaining,
      limit,
      resetAt: quota.quotaResetAt,
      message: allowed
        ? undefined
        : `Quota exceeded: ${used}/${limit} ${quotaType} used this month`,
    };
  }

  /**
   * SECURITY: Atomic check and consume quota to prevent race conditions
   * Always use this method instead of separate check/consume calls
   */
  static async checkAndConsumeQuota(
    orgId: string,
    quotaType: QuotaType,
    amount: number = 1
  ): Promise<QuotaCheck> {
    const supabase = await createClient();

    try {
      // SECURITY: Use atomic PostgreSQL function to prevent race conditions
      // This function checks and consumes quota in a single transaction
      const { data, error } = await supabase.rpc('check_quota_optimized', {
        p_org_id: orgId,
        p_quota_type: quotaType,
        p_amount: amount,
      });

      if (error) {
        console.error('[QuotaManager] Failed to check/consume quota:', error);
        return {
          allowed: false,
          remaining: 0,
          limit: 0,
          resetAt: new Date(),
          message: 'Failed to check quota',
        };
      }

      // Clear cache after consumption to ensure fresh data
      this.clearCache(orgId);

      // Get updated quota for response
      const quota = await this.getCachedQuota(orgId);
      if (!quota) {
        return {
          allowed: data === true,
          remaining: 0,
          limit: 0,
          resetAt: new Date(),
          message: data === true ? undefined : 'Quota exceeded',
        };
      }

      // Calculate remaining for the specific quota type
      let limit = 0;
      let used = 0;

      switch (quotaType) {
        case 'search':
          limit = quota.searchesPerMonth;
          used = quota.searchesUsed;
          break;
        case 'recording':
          limit = quota.recordingsPerMonth;
          used = quota.recordingsUsed;
          break;
        case 'ai':
          limit = quota.aiRequestsPerMonth;
          used = quota.aiRequestsUsed;
          break;
        case 'connector':
          limit = quota.connectorsAllowed;
          used = quota.connectorsUsed;
          break;
        case 'storage':
          limit = quota.storageGb;
          used = Math.ceil(quota.storageUsedGb);
          break;
      }

      const remaining = Math.max(0, limit - used);

      // Log usage event (non-blocking)
      if (data === true) {
        supabase
          .from('quota_usage_events')
          .insert({
            org_id: orgId,
            quota_type: quotaType,
            amount,
          })
          .then(() => {
            console.log(`[QuotaManager] Logged usage event for ${orgId}`);
          })
          .catch((err) => {
            console.error('[QuotaManager] Failed to log usage event:', err);
          });
      }

      return {
        allowed: data === true,
        remaining,
        limit,
        resetAt: quota.quotaResetAt,
        message: data === true
          ? undefined
          : `Quota exceeded: ${used}/${limit} ${quotaType} used this month`,
      };
    } catch (error) {
      console.error('[QuotaManager] Unexpected error:', error);
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        resetAt: new Date(),
        message: 'Internal error checking quota',
      };
    }
  }

  /**
   * Consume quota (requires PostgreSQL function check_quota_optimized)
   * Performance: Uses optimized function with SKIP LOCKED
   */
  static async consumeQuota(
    orgId: string,
    quotaType: QuotaType,
    amount: number = 1
  ): Promise<boolean> {
    const supabase = await createClient();

    try {
      // Call optimized PostgreSQL function with SKIP LOCKED
      const { data, error } = await supabase.rpc('check_quota_optimized', {
        p_org_id: orgId,
        p_quota_type: quotaType,
        p_amount: amount,
      });

      if (error) {
        console.error('[QuotaManager] Failed to consume quota:', error);
        return false;
      }

      // Clear cache after consumption to ensure fresh data
      this.clearCache(orgId);

      // Log usage event (non-blocking)
      supabase
        .from('quota_usage_events')
        .insert({
          org_id: orgId,
          quota_type: quotaType,
          amount,
        })
        .then(() => {
          console.log(`[QuotaManager] Logged usage event for ${orgId}`);
        })
        .catch((err) => {
          console.error('[QuotaManager] Failed to log usage event:', err);
        });

      return data === true;
    } catch (error) {
      console.error('[QuotaManager] Unexpected error:', error);
      return false;
    }
  }

  /**
   * Get current quota status for org (uses cache)
   */
  static async getQuotaStatus(orgId: string): Promise<OrgQuota | null> {
    return this.getCachedQuota(orgId);
  }

  /**
   * Reset monthly quotas
   */
  private static async resetQuota(orgId: string): Promise<void> {
    const supabase = await createClient();

    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);

    await supabase
      .from('org_quotas')
      .update({
        searches_used: 0,
        recordings_used: 0,
        ai_requests_used: 0,
        quota_reset_at: nextReset.toISOString(),
      })
      .eq('org_id', orgId);

    // Clear cache after reset
    this.clearCache(orgId);

    console.log(`[QuotaManager] Reset quota for org ${orgId}`);
  }

  /**
   * Update storage usage
   */
  static async updateStorageUsage(
    orgId: string,
    usedGb: number
  ): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from('org_quotas')
      .update({ storage_used_gb: usedGb })
      .eq('org_id', orgId);

    // Clear cache to reflect storage update
    this.clearCache(orgId);
  }

  /**
   * Initialize quota for new organization
   */
  static async initializeQuota(
    orgId: string,
    planTier: PlanTier = 'free'
  ): Promise<void> {
    const supabase = await createClient();

    const quotas: Record<PlanTier, Partial<OrgQuota>> = {
      free: {
        searchesPerMonth: 100,
        storageGb: 1,
        recordingsPerMonth: 10,
        aiRequestsPerMonth: 50,
        connectorsAllowed: 1,
      },
      starter: {
        searchesPerMonth: 1000,
        storageGb: 10,
        recordingsPerMonth: 100,
        aiRequestsPerMonth: 500,
        connectorsAllowed: 3,
      },
      professional: {
        searchesPerMonth: 10000,
        storageGb: 100,
        recordingsPerMonth: 1000,
        aiRequestsPerMonth: 5000,
        connectorsAllowed: 10,
      },
      enterprise: {
        searchesPerMonth: 100000,
        storageGb: 1000,
        recordingsPerMonth: 10000,
        aiRequestsPerMonth: 50000,
        connectorsAllowed: 50,
      },
    };

    const quotaConfig = quotas[planTier];

    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);

    await supabase.from('org_quotas').insert({
      org_id: orgId,
      plan_tier: planTier,
      searches_per_month: quotaConfig.searchesPerMonth,
      storage_gb: quotaConfig.storageGb,
      recordings_per_month: quotaConfig.recordingsPerMonth,
      ai_requests_per_month: quotaConfig.aiRequestsPerMonth,
      connectors_allowed: quotaConfig.connectorsAllowed,
      quota_reset_at: nextReset.toISOString(),
    });

    console.log(`[QuotaManager] Initialized ${planTier} quota for org ${orgId}`);
  }

  /**
   * Clear all cached quotas (for testing or maintenance)
   */
  static clearAllCache(): void {
    quotaCache.clear();
    console.log('[QuotaManager] Cleared all quota cache');
  }
}