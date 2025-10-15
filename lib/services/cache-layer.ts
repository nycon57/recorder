/**
 * Cache Layer Service
 *
 * Provides Redis caching for:
 * - Frame descriptions
 * - OCR results
 * - Embeddings
 * - Query results
 *
 * Performance improvements:
 * - Reduces redundant API calls
 * - Speeds up similar frame processing
 * - Batch operations support
 */

import crypto from 'crypto';

import Redis from 'ioredis';

// Redis client configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  enableReadyCheck: true,
  lazyConnect: true,
};

// Create Redis client
let redis: Redis | null = null;

/**
 * Get or create Redis client
 */
function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis(redisConfig);

    redis.on('error', (err) => {
      console.error('[Cache] Redis error:', err);
    });

    redis.on('connect', () => {
      console.log('[Cache] Redis connected');
    });
  }

  return redis;
}

/**
 * Frame Cache for video processing
 */
export class FrameCache {
  private redis: Redis;
  private readonly TTL_DESCRIPTION = 3600; // 1 hour for descriptions
  private readonly TTL_OCR = 3600; // 1 hour for OCR
  private readonly TTL_EMBEDDING = 7200; // 2 hours for embeddings
  private readonly TTL_QUERY = 300; // 5 minutes for query results

  constructor() {
    this.redis = getRedisClient();
  }

  /**
   * Generate hash for frame content
   */
  private hashFrame(frameBuffer: Buffer): string {
    return crypto
      .createHash('sha256')
      .update(frameBuffer)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Get cached frame description
   */
  async getCachedDescription(frameBuffer: Buffer): Promise<any | null> {
    try {
      const key = `frame:desc:${this.hashFrame(frameBuffer)}`;
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('[Cache] Error getting description:', error);
      return null;
    }
  }

  /**
   * Set cached frame description
   */
  async setCachedDescription(frameBuffer: Buffer, description: any): Promise<void> {
    try {
      const key = `frame:desc:${this.hashFrame(frameBuffer)}`;
      await this.redis.setex(key, this.TTL_DESCRIPTION, JSON.stringify(description));
    } catch (error) {
      console.error('[Cache] Error setting description:', error);
    }
  }

  /**
   * Get cached OCR result
   */
  async getCachedOCR(frameBuffer: Buffer): Promise<string | null> {
    try {
      const key = `frame:ocr:${this.hashFrame(frameBuffer)}`;
      return await this.redis.get(key);
    } catch (error) {
      console.error('[Cache] Error getting OCR:', error);
      return null;
    }
  }

  /**
   * Set cached OCR result
   */
  async setCachedOCR(frameBuffer: Buffer, text: string): Promise<void> {
    try {
      const key = `frame:ocr:${this.hashFrame(frameBuffer)}`;
      await this.redis.setex(key, this.TTL_OCR, text);
    } catch (error) {
      console.error('[Cache] Error setting OCR:', error);
    }
  }

  /**
   * Get cached embedding
   */
  async getCachedEmbedding(key: string): Promise<number[] | null> {
    try {
      const fullKey = `embedding:${key}`;
      const cached = await this.redis.get(fullKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('[Cache] Error getting embedding:', error);
      return null;
    }
  }

  /**
   * Set cached embedding
   */
  async setCachedEmbedding(key: string, embedding: number[]): Promise<void> {
    try {
      const fullKey = `embedding:${key}`;
      await this.redis.setex(fullKey, this.TTL_EMBEDDING, JSON.stringify(embedding));
    } catch (error) {
      console.error('[Cache] Error setting embedding:', error);
    }
  }

  /**
   * Batch get descriptions
   */
  async batchGetDescriptions(frameBuffers: Buffer[]): Promise<(any | null)[]> {
    try {
      if (frameBuffers.length === 0) return [];

      const keys = frameBuffers.map(b => `frame:desc:${this.hashFrame(b)}`);
      const values = await this.redis.mget(...keys);

      return values.map(v => (v ? JSON.parse(v) : null));
    } catch (error) {
      console.error('[Cache] Error batch getting descriptions:', error);
      return frameBuffers.map(() => null);
    }
  }

  /**
   * Batch set descriptions
   */
  async batchSetDescriptions(
    items: Array<{ buffer: Buffer; description: any }>
  ): Promise<void> {
    try {
      if (items.length === 0) return;

      const pipeline = this.redis.pipeline();

      for (const { buffer, description } of items) {
        const key = `frame:desc:${this.hashFrame(buffer)}`;
        pipeline.setex(key, this.TTL_DESCRIPTION, JSON.stringify(description));
      }

      await pipeline.exec();
    } catch (error) {
      console.error('[Cache] Error batch setting descriptions:', error);
    }
  }

  /**
   * Cache query result
   */
  async cacheQueryResult(query: string, orgId: string, result: any): Promise<void> {
    try {
      const key = `query:${orgId}:${crypto.createHash('md5').update(query).digest('hex')}`;
      await this.redis.setex(key, this.TTL_QUERY, JSON.stringify(result));
    } catch (error) {
      console.error('[Cache] Error caching query result:', error);
    }
  }

  /**
   * Get cached query result
   */
  async getCachedQueryResult(query: string, orgId: string): Promise<any | null> {
    try {
      const key = `query:${orgId}:${crypto.createHash('md5').update(query).digest('hex')}`;
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('[Cache] Error getting cached query:', error);
      return null;
    }
  }

  /**
   * Clear cache for a recording
   */
  async clearRecordingCache(recordingId: string): Promise<void> {
    try {
      const pattern = `*:${recordingId}:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`[Cache] Cleared ${keys.length} keys for recording ${recordingId}`);
      }
    } catch (error) {
      console.error('[Cache] Error clearing recording cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    hitRate: number;
  }> {
    try {
      const info = await this.redis.info('memory');
      const dbSize = await this.redis.dbsize();

      // Parse memory usage
      const memMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memMatch ? memMatch[1].trim() : 'unknown';

      // Get hit rate from stats
      const stats = await this.redis.info('stats');
      const hitsMatch = stats.match(/keyspace_hits:(\d+)/);
      const missesMatch = stats.match(/keyspace_misses:(\d+)/);

      const hits = hitsMatch ? parseInt(hitsMatch[1]) : 0;
      const misses = missesMatch ? parseInt(missesMatch[1]) : 0;
      const total = hits + misses;
      const hitRate = total > 0 ? (hits / total) * 100 : 0;

      return {
        totalKeys: dbSize,
        memoryUsage,
        hitRate: Math.round(hitRate * 100) / 100,
      };
    } catch (error) {
      console.error('[Cache] Error getting stats:', error);
      return {
        totalKeys: 0,
        memoryUsage: 'unknown',
        hitRate: 0,
      };
    }
  }

  /**
   * Warm up cache for a recording
   */
  async warmupCache(recordingId: string, frames: any[]): Promise<void> {
    try {
      console.log(`[Cache] Warming up cache for ${frames.length} frames`);

      const pipeline = this.redis.pipeline();

      for (const frame of frames) {
        if (frame.visual_description) {
          const descKey = `frame:desc:${frame.id}`;
          pipeline.setex(
            descKey,
            this.TTL_DESCRIPTION,
            JSON.stringify({
              description: frame.visual_description,
              sceneType: frame.scene_type,
              detectedElements: frame.detected_elements,
              confidence: frame.metadata?.confidence || 0.7,
            })
          );
        }

        if (frame.ocr_text) {
          const ocrKey = `frame:ocr:${frame.id}`;
          pipeline.setex(
            ocrKey,
            this.TTL_OCR,
            JSON.stringify({
              text: frame.ocr_text,
              confidence: frame.ocr_confidence,
              blocks: frame.ocr_blocks || [],
            })
          );
        }
      }

      await pipeline.exec();
      console.log(`[Cache] Warmup complete for recording ${recordingId}`);
    } catch (error) {
      console.error('[Cache] Error warming up cache:', error);
    }
  }

  /**
   * Check if Redis is connected
   */
  async isConnected(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

// Export singleton instance
export const frameCache = new FrameCache();

/**
 * Performance Cache for metrics
 */
export class PerformanceCache {
  private redis: Redis;
  private readonly TTL = 3600; // 1 hour

  constructor() {
    this.redis = getRedisClient();
  }

  /**
   * Track processing time
   */
  async trackProcessingTime(
    operation: string,
    recordingId: string,
    timeMs: number
  ): Promise<void> {
    try {
      const key = `perf:${operation}:${recordingId}`;
      await this.redis.zadd(key, Date.now(), timeMs);
      await this.redis.expire(key, this.TTL);
    } catch (error) {
      console.error('[PerfCache] Error tracking time:', error);
    }
  }

  /**
   * Get average processing time
   */
  async getAverageTime(operation: string, recordingId?: string): Promise<number> {
    try {
      const key = recordingId
        ? `perf:${operation}:${recordingId}`
        : `perf:${operation}:*`;

      if (recordingId) {
        const times = await this.redis.zrange(key, 0, -1);
        if (times.length === 0) return 0;

        const sum = times.reduce((acc, t) => acc + parseFloat(t), 0);
        return Math.round(sum / times.length);
      } else {
        // Get average across all recordings
        const keys = await this.redis.keys(key);
        if (keys.length === 0) return 0;

        let totalSum = 0;
        let totalCount = 0;

        for (const k of keys) {
          const times = await this.redis.zrange(k, 0, -1);
          const sum = times.reduce((acc, t) => acc + parseFloat(t), 0);
          totalSum += sum;
          totalCount += times.length;
        }

        return totalCount > 0 ? Math.round(totalSum / totalCount) : 0;
      }
    } catch (error) {
      console.error('[PerfCache] Error getting average:', error);
      return 0;
    }
  }

  /**
   * Get performance report
   */
  async getPerformanceReport(): Promise<{
    frameExtraction: number;
    visualIndexing: number;
    ocrProcessing: number;
    total: number;
  }> {
    const frameExtraction = await this.getAverageTime('frame_extraction');
    const visualIndexing = await this.getAverageTime('visual_indexing');
    const ocrProcessing = await this.getAverageTime('ocr_processing');

    return {
      frameExtraction,
      visualIndexing,
      ocrProcessing,
      total: frameExtraction + visualIndexing + ocrProcessing,
    };
  }
}

export const performanceCache = new PerformanceCache();

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    if (redis) {
      console.log('[Cache] Closing Redis connection...');
      await redis.quit();
    }
  });
}