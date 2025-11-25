/**
 * Search Performance Monitoring
 *
 * Tracks and logs search performance metrics for continuous optimization.
 * Provides real-time monitoring and alerting capabilities.
 *
 * Configuration:
 * - SEARCH_METRICS_STORAGE: 'redis' | 'memory' (default: 'memory')
 * - SEARCH_METRICS_BUFFER_SIZE: number (default: 100)
 * - SEARCH_METRICS_TTL: number in seconds (default: 86400 = 24 hours)
 */

import { getRedis } from '@/lib/rate-limit/redis';

export interface SearchPerformanceMetrics {
  queryId: string;
  timestamp: Date;
  orgId: string;
  userId: string;

  // Query characteristics
  query: string;
  queryLength: number;
  queryWordCount: number;

  // Search configuration
  strategy: string;
  threshold: number;
  useHybrid: boolean;
  useAgentic: boolean;

  // Results
  sourcesFound: number;
  avgSimilarity: number;
  minSimilarity: number;
  maxSimilarity: number;

  // Performance
  embeddingTimeMs: number;
  searchTimeMs: number;
  totalTimeMs: number;

  // Retries
  retrievalAttempts: number;
  retriedWithLowerThreshold: boolean;
  retriedWithHybrid: boolean;
  retriedWithKeyword: boolean;

  // Outcome
  success: boolean;
  usedToolFallback: boolean;
  searchFailureAlerted: boolean;
}

export interface AlertCondition {
  name: string;
  condition: (metrics: SearchPerformanceMetrics) => boolean;
  severity: 'info' | 'warning' | 'error';
  message: (metrics: SearchPerformanceMetrics) => string;
}

/**
 * Search Monitor Class
 * Tracks search requests from start to finish
 */
class SearchMonitor {
  private metrics: Map<string, Partial<SearchPerformanceMetrics>> = new Map();
  private alertConditions: AlertCondition[] = [];
  private metricsBuffer: SearchPerformanceMetrics[] = [];

  // Configurable storage settings
  private readonly storageType: 'redis' | 'memory';
  private readonly bufferSize: number;
  private readonly ttlSeconds: number;
  private readonly redisKeyPrefix = 'search_metrics:';

  constructor() {
    // Load configuration from environment
    this.storageType = (process.env.SEARCH_METRICS_STORAGE as 'redis' | 'memory') || 'memory';
    this.bufferSize = parseInt(process.env.SEARCH_METRICS_BUFFER_SIZE || '100', 10);
    this.ttlSeconds = parseInt(process.env.SEARCH_METRICS_TTL || '86400', 10);

    // Register default alert conditions
    this.registerDefaultAlerts();

    // Log storage configuration
    console.log('[Search Monitor] Initialized with config:', {
      storageType: this.storageType,
      bufferSize: this.bufferSize,
      ttlSeconds: this.ttlSeconds,
    });
  }

  /**
   * Start tracking a search request
   */
  startSearch(queryId: string, query: string, orgId: string, userId: string): void {
    this.metrics.set(queryId, {
      queryId,
      timestamp: new Date(),
      orgId,
      userId,
      query,
      queryLength: query.length,
      queryWordCount: query.split(/\s+/).length,
      retrievalAttempts: 0,
    });

    console.log('[Search Monitor] Started tracking:', {
      queryId,
      query: query.substring(0, 50),
      orgId: orgId.substring(0, 8),
    });
  }

  /**
   * Update search configuration
   */
  updateConfig(
    queryId: string,
    config: Partial<SearchPerformanceMetrics>
  ): void {
    const existing = this.metrics.get(queryId) || {};
    this.metrics.set(queryId, { ...existing, ...config });
  }

  /**
   * Record search completion
   */
  endSearch(
    queryId: string,
    results: Partial<SearchPerformanceMetrics>
  ): void {
    const existing = this.metrics.get(queryId) || {};
    const final = { ...existing, ...results } as SearchPerformanceMetrics;

    // Calculate total time if not provided
    if (!final.totalTimeMs && final.timestamp) {
      final.totalTimeMs = Date.now() - final.timestamp.getTime();
    }

    // Determine success
    final.success = final.sourcesFound > 0;

    // Log completed metrics
    console.log('[Search Monitor] Search completed:', {
      queryId,
      query: final.query?.substring(0, 50),
      success: final.success,
      sourcesFound: final.sourcesFound,
      totalTimeMs: final.totalTimeMs,
      retrievalAttempts: final.retrievalAttempts,
      avgSimilarity: final.avgSimilarity?.toFixed(3),
    });

    // Check alert conditions
    this.checkAlerts(final);

    // Store metrics
    this.storeMetrics(final);

    // Clean up
    this.metrics.delete(queryId);
  }

  /**
   * Record a retry attempt
   */
  recordRetry(
    queryId: string,
    retryType: 'lowerThreshold' | 'hybrid' | 'keyword'
  ): void {
    const existing = this.metrics.get(queryId) || {};
    const updated = {
      ...existing,
      retrievalAttempts: (existing.retrievalAttempts || 0) + 1,
    };

    // Mark retry type
    if (retryType === 'lowerThreshold') {
      updated.retriedWithLowerThreshold = true;
    } else if (retryType === 'hybrid') {
      updated.retriedWithHybrid = true;
    } else if (retryType === 'keyword') {
      updated.retriedWithKeyword = true;
    }

    this.metrics.set(queryId, updated);

    console.log('[Search Monitor] Retry recorded:', {
      queryId,
      retryType,
      attempt: updated.retrievalAttempts,
    });
  }

  /**
   * Register a custom alert condition
   */
  registerAlert(alert: AlertCondition): void {
    this.alertConditions.push(alert);
  }

  /**
   * Register default alert conditions
   */
  private registerDefaultAlerts(): void {
    // Alert on slow searches
    this.registerAlert({
      name: 'slow_search',
      severity: 'warning',
      condition: (m) => m.totalTimeMs > 3000,
      message: (m) =>
        `Slow search detected: ${m.totalTimeMs}ms for query "${m.query.substring(0, 50)}"`,
    });

    // Alert on very low similarity
    this.registerAlert({
      name: 'low_similarity',
      severity: 'warning',
      condition: (m) => m.success && m.avgSimilarity < 0.5,
      message: (m) =>
        `Low similarity results: avg ${m.avgSimilarity.toFixed(3)} for query "${m.query.substring(0, 50)}"`,
    });

    // Alert on search failures with retries
    this.registerAlert({
      name: 'retry_failure',
      severity: 'error',
      condition: (m) => !m.success && m.retrievalAttempts > 2,
      message: (m) =>
        `Search failed after ${m.retrievalAttempts} retries: "${m.query.substring(0, 50)}"`,
    });

    // Alert on excessive retries
    this.registerAlert({
      name: 'excessive_retries',
      severity: 'info',
      condition: (m) => m.retrievalAttempts >= 3,
      message: (m) =>
        `Search required ${m.retrievalAttempts} attempts to succeed`,
    });

    // Alert on tool fallback usage (may indicate RAG insufficiency)
    this.registerAlert({
      name: 'tool_fallback',
      severity: 'info',
      condition: (m) => m.usedToolFallback,
      message: (m) =>
        `Search used tool fallback for query: "${m.query.substring(0, 50)}"`,
    });
  }

  /**
   * Check alert conditions and log if triggered
   */
  private checkAlerts(metrics: SearchPerformanceMetrics): void {
    for (const alert of this.alertConditions) {
      if (alert.condition(metrics)) {
        const logLevel =
          alert.severity === 'error'
            ? 'error'
            : alert.severity === 'warning'
            ? 'warn'
            : 'info';

        console[logLevel](`[Search Monitor] ALERT [${alert.name}]:`, {
          severity: alert.severity,
          message: alert.message(metrics),
          queryId: metrics.queryId,
          orgId: metrics.orgId.substring(0, 8),
        });

        // In production, send to alerting service
        // await sendAlert(alert, metrics);
      }
    }
  }

  /**
   * Store metrics for analysis
   */
  private async storeMetrics(metrics: SearchPerformanceMetrics): Promise<void> {
    if (this.storageType === 'redis') {
      await this.storeMetricsInRedis(metrics);
    } else {
      this.storeMetricsInMemory(metrics);
    }
  }

  /**
   * Store metrics in Redis (shared, persistent)
   */
  private async storeMetricsInRedis(metrics: SearchPerformanceMetrics): Promise<void> {
    const redis = getRedis();
    if (!redis) {
      console.warn('[Search Monitor] Redis not available, falling back to memory');
      this.storeMetricsInMemory(metrics);
      return;
    }

    try {
      const key = `${this.redisKeyPrefix}${metrics.orgId}:${metrics.queryId}`;

      // Serialize metrics (convert Date to ISO string for JSON)
      const serialized = JSON.stringify({
        ...metrics,
        timestamp: metrics.timestamp.toISOString(),
      });

      // Store with TTL
      await redis.setex(key, this.ttlSeconds, serialized);

      // Add to sorted set for chronological access (score = timestamp)
      const listKey = `${this.redisKeyPrefix}list:${metrics.orgId}`;
      await redis.zadd(listKey, { score: metrics.timestamp.getTime(), member: key });

      // Trim sorted set to buffer size
      const count = await redis.zcard(listKey);
      if (count > this.bufferSize) {
        const removeCount = count - this.bufferSize;
        await redis.zpopmin(listKey, removeCount);
      }

      // Set TTL on list key as well
      await redis.expire(listKey, this.ttlSeconds);

      console.log('[Search Monitor] Metrics stored in Redis:', {
        queryId: metrics.queryId,
        orgId: metrics.orgId.substring(0, 8),
        storage: 'redis',
      });
    } catch (error) {
      console.error('[Search Monitor] Redis storage error, falling back to memory:', error);
      this.storeMetricsInMemory(metrics);
    }
  }

  /**
   * Store metrics in memory (in-process, volatile)
   */
  private storeMetricsInMemory(metrics: SearchPerformanceMetrics): void {
    // Add to buffer
    this.metricsBuffer.push(metrics);

    // Keep buffer size limited
    if (this.metricsBuffer.length > this.bufferSize) {
      this.metricsBuffer.shift();
    }

    console.log('[Search Monitor] Metrics stored in memory:', {
      bufferSize: this.metricsBuffer.length,
      queryId: metrics.queryId,
      storage: 'memory',
    });
  }

  /**
   * Get recent metrics (for debugging)
   */
  async getRecentMetrics(
    orgId?: string,
    limit: number = 10
  ): Promise<SearchPerformanceMetrics[]> {
    if (this.storageType === 'redis' && orgId) {
      return this.getRecentMetricsFromRedis(orgId, limit);
    } else {
      return this.getRecentMetricsFromMemory(limit);
    }
  }

  /**
   * Get recent metrics from Redis
   */
  private async getRecentMetricsFromRedis(
    orgId: string,
    limit: number
  ): Promise<SearchPerformanceMetrics[]> {
    const redis = getRedis();
    if (!redis) {
      console.warn('[Search Monitor] Redis not available, falling back to memory');
      return this.getRecentMetricsFromMemory(limit);
    }

    try {
      const listKey = `${this.redisKeyPrefix}list:${orgId}`;

      // Get most recent keys from sorted set (descending order)
      const keys = await redis.zrange(listKey, 0, limit - 1, { rev: true });

      if (!keys || keys.length === 0) {
        return [];
      }

      // Fetch metrics for each key
      const metricsData = await Promise.all(
        (keys as string[]).map((key: string) => redis.get(key))
      );

      // Parse and deserialize
      const metrics: SearchPerformanceMetrics[] = [];
      for (const data of metricsData) {
        if (typeof data === 'string') {
          try {
            const parsed = JSON.parse(data);
            // Convert timestamp back to Date object
            parsed.timestamp = new Date(parsed.timestamp);
            metrics.push(parsed as SearchPerformanceMetrics);
          } catch (error) {
            console.warn('[Search Monitor] Failed to parse metrics:', error);
          }
        }
      }

      return metrics;
    } catch (error) {
      console.error('[Search Monitor] Redis fetch error, falling back to memory:', error);
      return this.getRecentMetricsFromMemory(limit);
    }
  }

  /**
   * Get recent metrics from memory
   */
  private getRecentMetricsFromMemory(limit: number): SearchPerformanceMetrics[] {
    return this.metricsBuffer.slice(-limit);
  }

  /**
   * Get metrics summary
   */
  async getMetricsSummary(orgId?: string): Promise<{
    totalSearches: number;
    successRate: number;
    avgSimilarity: number;
    avgTimeMs: number;
    retryRate: number;
  }> {
    const metrics =
      this.storageType === 'redis' && orgId
        ? await this.getRecentMetricsFromRedis(orgId, this.bufferSize)
        : this.getRecentMetricsFromMemory(this.bufferSize);

    if (metrics.length === 0) {
      return {
        totalSearches: 0,
        successRate: 0,
        avgSimilarity: 0,
        avgTimeMs: 0,
        retryRate: 0,
      };
    }

    const successful = metrics.filter((m) => m.success);
    const withRetries = metrics.filter((m) => m.retrievalAttempts > 1);

    const avgSimilarity =
      successful.reduce((sum, m) => sum + m.avgSimilarity, 0) /
      (successful.length || 1);

    const avgTimeMs =
      metrics.reduce((sum, m) => sum + m.totalTimeMs, 0) / metrics.length;

    return {
      totalSearches: metrics.length,
      successRate: successful.length / metrics.length,
      avgSimilarity,
      avgTimeMs,
      retryRate: withRetries.length / metrics.length,
    };
  }

  /**
   * Clear metrics buffer
   */
  async clearBuffer(orgId?: string): Promise<void> {
    if (this.storageType === 'redis' && orgId) {
      await this.clearBufferInRedis(orgId);
    } else {
      this.clearBufferInMemory();
    }
  }

  /**
   * Clear metrics buffer in Redis
   */
  private async clearBufferInRedis(orgId: string): Promise<void> {
    const redis = getRedis();
    if (!redis) {
      console.warn('[Search Monitor] Redis not available, clearing memory buffer');
      this.clearBufferInMemory();
      return;
    }

    try {
      const listKey = `${this.redisKeyPrefix}list:${orgId}`;

      // Get all keys in the sorted set
      const keys = await redis.zrange(listKey, 0, -1);

      // Delete all metric keys
      if (keys && keys.length > 0) {
        await redis.del(...(keys as string[]));
      }

      // Delete the list key
      await redis.del(listKey);

      console.log('[Search Monitor] Redis metrics buffer cleared:', {
        orgId: orgId.substring(0, 8),
        keysDeleted: keys?.length || 0,
        storage: 'redis',
      });
    } catch (error) {
      console.error('[Search Monitor] Redis clear error:', error);
    }
  }

  /**
   * Clear metrics buffer in memory
   */
  private clearBufferInMemory(): void {
    this.metricsBuffer = [];
    console.log('[Search Monitor] Memory metrics buffer cleared');
  }
}

// Singleton instance
export const searchMonitor = new SearchMonitor();

/**
 * Helper function to track a complete search operation
 * Wraps search logic with monitoring
 */
export async function monitoredSearch<T>(
  queryId: string,
  query: string,
  orgId: string,
  userId: string,
  searchFn: () => Promise<T>,
  config: Partial<SearchPerformanceMetrics> = {}
): Promise<T> {
  const startTime = Date.now();

  // Start tracking
  searchMonitor.startSearch(queryId, query, orgId, userId);
  searchMonitor.updateConfig(queryId, config);

  try {
    const result = await searchFn();

    // End tracking on success
    searchMonitor.endSearch(queryId, {
      totalTimeMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    // End tracking on error
    searchMonitor.endSearch(queryId, {
      totalTimeMs: Date.now() - startTime,
      success: false,
      sourcesFound: 0,
    });

    throw error;
  }
}

/**
 * Export utilities for use in chat API
 */
export {
  SearchMonitor,
  searchMonitor as default,
};

/**
 * Example usage in chat API:
 *
 * ```typescript
 * import { searchMonitor } from '@/lib/services/search-monitoring';
 *
 * // Start tracking
 * const queryId = nanoid();
 * searchMonitor.startSearch(queryId, userQuery, orgId, userId);
 *
 * // Update config
 * searchMonitor.updateConfig(queryId, {
 *   strategy: route.strategy,
 *   threshold: config.threshold,
 *   useAgentic: config.useAgentic,
 * });
 *
 * // Record retry
 * searchMonitor.recordRetry(queryId, 'lowerThreshold');
 *
 * // End tracking
 * searchMonitor.endSearch(queryId, {
 *   sourcesFound: results.length,
 *   avgSimilarity: calculateAvg(results),
 *   embeddingTimeMs: embedTime,
 *   searchTimeMs: searchTime,
 * });
 *
 * // Get summary (async when using Redis)
 * const summary = await searchMonitor.getMetricsSummary(orgId);
 * console.log('Recent performance:', summary);
 *
 * // Get recent metrics (async when using Redis)
 * const recent = await searchMonitor.getRecentMetrics(orgId, 20);
 * console.log('Recent searches:', recent);
 *
 * // Clear buffer (async when using Redis)
 * await searchMonitor.clearBuffer(orgId);
 * ```
 *
 * Environment Configuration:
 * ```bash
 * # Use Redis for shared, persistent metrics (recommended for production)
 * SEARCH_METRICS_STORAGE=redis
 * SEARCH_METRICS_BUFFER_SIZE=500
 * SEARCH_METRICS_TTL=86400  # 24 hours
 *
 * # Use in-memory storage (default, good for development)
 * SEARCH_METRICS_STORAGE=memory
 * SEARCH_METRICS_BUFFER_SIZE=100
 * ```
 */
