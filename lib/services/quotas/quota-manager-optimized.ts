import { createClient } from '@/lib/supabase/server';

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

interface CachedQuota {
  quota: OrgQuota;
  expires: number;
}

export class QuotaManagerOptimized {
  // In-memory cache with 60-second TTL
  private static quotaCache = new Map<string, CachedQuota>();
  private static CACHE_TTL = 60000; // 60 seconds

  /**
   * Check if org has available quota (with caching)
   */
  static async checkQuota(
    orgId: string,
    quotaType: QuotaType,
    amount: number = 1
  ): Promise<QuotaCheck> {
    // Check cache first
    const cached = this.quotaCache.get(orgId);
    if (cached && cached.expires > Date.now()) {
      return this.evaluateQuota(cached.quota, quotaType, amount);
    }

    // Fetch from database without locking
    const supabase = await createClient();
    const { data: quota, error } = await supabase
      .from('org_quotas')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (error || !quota) {
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        resetAt: new Date(),
        message: 'Quota not found for organization',
      };
    }

    // Map to OrgQuota type
    const orgQuota = this.mapToOrgQuota(quota);

    // Check if quota needs reset
    const now = new Date();
    if (orgQuota.quotaResetAt < now) {
      // Reset in background, don't block the request
      this.resetQuotaAsync(orgId).catch(console.error);

      // Reset local copy for immediate use
      orgQuota.searchesUsed = 0;
      orgQuota.recordingsUsed = 0;
      orgQuota.aiRequestsUsed = 0;
      orgQuota.quotaResetAt = this.getNextResetDate();
    }

    // Cache the quota
    this.quotaCache.set(orgId, {
      quota: orgQuota,
      expires: Date.now() + this.CACHE_TTL,
    });

    return this.evaluateQuota(orgQuota, quotaType, amount);
  }

  /**
   * Evaluate quota without database call
   */
  private static evaluateQuota(
    quota: OrgQuota,
    quotaType: QuotaType,
    amount: number
  ): QuotaCheck {
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

    const remaining = limit - used;
    const allowed = remaining >= amount;

    return {
      allowed,
      remaining: Math.max(0, remaining),
      limit,
      resetAt: quota.quotaResetAt,
      message: allowed
        ? undefined
        : `Quota exceeded: ${used}/${limit} ${quotaType} used this month`,
    };
  }

  /**
   * Consume quota with optimistic updates
   */
  static async consumeQuota(
    orgId: string,
    quotaType: QuotaType,
    amount: number = 1
  ): Promise<boolean> {
    // Invalidate cache on consumption
    this.quotaCache.delete(orgId);

    const supabase = await createClient();

    try {
      // Use optimized PostgreSQL function with SKIP LOCKED
      const { data, error } = await supabase.rpc('check_quota_optimized', {
        p_org_id: orgId,
        p_quota_type: quotaType,
        p_amount: amount,
      });

      if (error) {
        console.error('[QuotaManager] Failed to consume quota:', error);

        // Fallback to standard check
        const check = await this.checkQuota(orgId, quotaType, amount);
        if (!check.allowed) return false;

        // Try direct update
        return this.directUpdateQuota(orgId, quotaType, amount);
      }

      // Log usage event asynchronously
      this.logUsageEventAsync(orgId, quotaType, amount).catch(console.error);

      return data === true;
    } catch (error) {
      console.error('[QuotaManager] Unexpected error:', error);
      return false;
    }
  }

  /**
   * Batch check multiple quotas at once
   */
  static async checkQuotaBatch(
    orgId: string,
    checks: Array<{ type: QuotaType; amount?: number }>
  ): Promise<Record<QuotaType, QuotaCheck>> {
    // Try to get from cache
    const cached = this.quotaCache.get(orgId);

    let quota: OrgQuota;
    if (cached && cached.expires > Date.now()) {
      quota = cached.quota;
    } else {
      // Fetch once for all checks
      const status = await this.getQuotaStatus(orgId);
      if (!status) {
        return checks.reduce((acc, check) => {
          acc[check.type] = {
            allowed: false,
            remaining: 0,
            limit: 0,
            resetAt: new Date(),
            message: 'Quota not found',
          };
          return acc;
        }, {} as Record<QuotaType, QuotaCheck>);
      }
      quota = status;
    }

    // Evaluate all checks
    return checks.reduce((acc, check) => {
      acc[check.type] = this.evaluateQuota(quota, check.type, check.amount || 1);
      return acc;
    }, {} as Record<QuotaType, QuotaCheck>);
  }

  /**
   * Get current quota status for org
   */
  static async getQuotaStatus(orgId: string): Promise<OrgQuota | null> {
    // Check cache first
    const cached = this.quotaCache.get(orgId);
    if (cached && cached.expires > Date.now()) {
      return cached.quota;
    }

    const supabase = await createClient();

    const { data: quota, error } = await supabase
      .from('org_quotas')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (error || !quota) {
      console.error('[QuotaManager] Failed to fetch quota:', error);
      return null;
    }

    const orgQuota = this.mapToOrgQuota(quota);

    // Cache the result
    this.quotaCache.set(orgId, {
      quota: orgQuota,
      expires: Date.now() + this.CACHE_TTL,
    });

    return orgQuota;
  }

  /**
   * Clear cache for an organization
   */
  static clearCache(orgId?: string): void {
    if (orgId) {
      this.quotaCache.delete(orgId);
    } else {
      this.quotaCache.clear();
    }
  }

  /**
   * Preload quotas for multiple organizations
   */
  static async preloadQuotas(orgIds: string[]): Promise<void> {
    const supabase = await createClient();

    const { data: quotas, error } = await supabase
      .from('org_quotas')
      .select('*')
      .in('org_id', orgIds);

    if (error || !quotas) {
      console.error('[QuotaManager] Failed to preload quotas:', error);
      return;
    }

    const expires = Date.now() + this.CACHE_TTL;
    quotas.forEach(quota => {
      this.quotaCache.set(quota.org_id, {
        quota: this.mapToOrgQuota(quota),
        expires,
      });
    });
  }

  /**
   * Helper: Map database row to OrgQuota type
   */
  private static mapToOrgQuota(quota: any): OrgQuota {
    return {
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
  }

  /**
   * Helper: Get next reset date
   */
  private static getNextResetDate(): Date {
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);
    return nextReset;
  }

  /**
   * Helper: Reset quota asynchronously
   */
  private static async resetQuotaAsync(orgId: string): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from('org_quotas')
      .update({
        searches_used: 0,
        recordings_used: 0,
        ai_requests_used: 0,
        quota_reset_at: this.getNextResetDate().toISOString(),
      })
      .eq('org_id', orgId);

    // Clear cache to force refresh
    this.quotaCache.delete(orgId);
  }

  /**
   * Helper: Log usage event asynchronously
   */
  private static async logUsageEventAsync(
    orgId: string,
    quotaType: QuotaType,
    amount: number
  ): Promise<void> {
    const supabase = await createClient();

    await supabase.from('quota_usage_events').insert({
      org_id: orgId,
      quota_type: quotaType,
      amount,
    });
  }

  /**
   * Helper: Direct quota update fallback
   */
  private static async directUpdateQuota(
    orgId: string,
    quotaType: QuotaType,
    amount: number
  ): Promise<boolean> {
    const supabase = await createClient();

    const field = this.getQuotaField(quotaType);
    if (!field) return false;

    const { error } = await supabase.rpc('increment_quota_usage', {
      p_org_id: orgId,
      p_field: field,
      p_amount: amount,
    });

    return !error;
  }

  /**
   * Helper: Get database field name for quota type
   */
  private static getQuotaField(quotaType: QuotaType): string | null {
    switch (quotaType) {
      case 'search': return 'searches_used';
      case 'recording': return 'recordings_used';
      case 'ai': return 'ai_requests_used';
      case 'connector': return 'connectors_used';
      case 'storage': return 'storage_used_gb';
      default: return null;
    }
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

    await supabase.from('org_quotas').insert({
      org_id: orgId,
      plan_tier: planTier,
      searches_per_month: quotaConfig.searchesPerMonth,
      storage_gb: quotaConfig.storageGb,
      recordings_per_month: quotaConfig.recordingsPerMonth,
      ai_requests_per_month: quotaConfig.aiRequestsPerMonth,
      connectors_allowed: quotaConfig.connectorsAllowed,
      quota_reset_at: this.getNextResetDate().toISOString(),
    });

    console.log(`[QuotaManager] Initialized ${planTier} quota for org ${orgId}`);
  }

  /**
   * Update storage usage (with batching)
   */
  private static storageUpdateQueue = new Map<string, number>();
  private static storageUpdateTimer: NodeJS.Timeout | null = null;

  static async updateStorageUsage(
    orgId: string,
    usedGb: number
  ): Promise<void> {
    // Queue the update
    this.storageUpdateQueue.set(orgId, usedGb);

    // Invalidate cache
    this.quotaCache.delete(orgId);

    // Batch updates every 5 seconds
    if (!this.storageUpdateTimer) {
      this.storageUpdateTimer = setTimeout(async () => {
        const updates = Array.from(this.storageUpdateQueue.entries());
        this.storageUpdateQueue.clear();
        this.storageUpdateTimer = null;

        if (updates.length > 0) {
          const supabase = await createClient();

          // Batch update
          const promises = updates.map(([orgId, usedGb]) =>
            supabase
              .from('org_quotas')
              .update({ storage_used_gb: usedGb })
              .eq('org_id', orgId)
          );

          await Promise.all(promises);
          console.log(`[QuotaManager] Batch updated storage for ${updates.length} orgs`);
        }
      }, 5000);
    }
  }
}

// Export as default for easy migration
export const QuotaManager = QuotaManagerOptimized;