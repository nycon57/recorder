/**
 * Performance Metrics Service
 *
 * Tracks and reports application performance metrics including:
 * - API response times
 * - Job processing throughput
 * - Cache hit rates
 * - Database query performance
 * - Core Web Vitals
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Metric types
 */
export enum MetricType {
  API_LATENCY = 'api_latency',
  JOB_DURATION = 'job_duration',
  CACHE_HIT = 'cache_hit',
  CACHE_MISS = 'cache_miss',
  DB_QUERY = 'db_query',
  ERROR_RATE = 'error_rate',
  THROUGHPUT = 'throughput',
}

/**
 * Performance thresholds
 */
export const PERFORMANCE_TARGETS = {
  api: {
    p50: 200,  // 200ms median
    p95: 500,  // 500ms 95th percentile
    p99: 1000, // 1s 99th percentile
  },
  job: {
    transcription: 30000,     // 30s
    embedding: 5000,          // 5s
    document_generation: 10000, // 10s
  },
  cache: {
    hitRate: 80, // 80% cache hit rate target
  },
  database: {
    queryTime: 100, // 100ms query time
  },
};

/**
 * Track an API metric
 */
export async function trackApiMetric(
  endpoint: string,
  duration: number,
  status: 'success' | 'error' = 'success'
): Promise<void> {
  try {
    const timestamp = Date.now();
    const hour = Math.floor(timestamp / 3600000) * 3600000;

    // Store in time-series format
    const key = `metrics:api:${endpoint}:${hour}`;

    await redis.zadd(key, {
      score: timestamp,
      member: JSON.stringify({ duration, status }),
    });

    // Expire after 7 days
    await redis.expire(key, 604800);

    // Update aggregates
    await updateApiAggregates(endpoint, duration, status);

    // Track slow APIs
    if (duration > PERFORMANCE_TARGETS.api.p95) {
      await trackSlowApi(endpoint, duration);
    }

  } catch (error) {
    console.error('[Metrics] Error tracking API metric:', error);
  }
}

/**
 * Track a job processing metric
 */
export async function trackJobMetric(
  jobType: string,
  duration: number,
  status: 'success' | 'error' = 'success'
): Promise<void> {
  try {
    const timestamp = Date.now();
    const hour = Math.floor(timestamp / 3600000) * 3600000;

    const key = `metrics:job:${jobType}:${hour}`;

    await redis.zadd(key, {
      score: timestamp,
      member: JSON.stringify({ duration, status }),
    });

    await redis.expire(key, 604800);

    // Update job throughput
    await updateJobThroughput(jobType);

  } catch (error) {
    console.error('[Metrics] Error tracking job metric:', error);
  }
}

/**
 * Track database query performance
 */
export async function trackDbQuery(
  operation: string,
  table: string,
  duration: number
): Promise<void> {
  try {
    const timestamp = Date.now();
    const key = `metrics:db:${table}:${operation}`;

    await redis.zadd(key, {
      score: timestamp,
      member: duration.toString(),
    });

    await redis.expire(key, 86400); // 1 day

    // Track slow queries
    if (duration > PERFORMANCE_TARGETS.database.queryTime) {
      await trackSlowQuery(operation, table, duration);
    }

  } catch (error) {
    console.error('[Metrics] Error tracking DB query:', error);
  }
}

/**
 * Track cache operations
 */
export async function trackCacheOperation(
  hit: boolean,
  latency: number
): Promise<void> {
  try {
    const key = hit ? 'metrics:cache:hits' : 'metrics:cache:misses';
    await redis.incr(key);

    // Track latency
    await redis.zadd('metrics:cache:latency', {
      score: Date.now(),
      member: latency.toString(),
    });

  } catch (error) {
    console.error('[Metrics] Error tracking cache operation:', error);
  }
}

/**
 * Track error rates
 */
export async function trackError(
  context: string,
  error: Error
): Promise<void> {
  try {
    const timestamp = Date.now();
    const hour = Math.floor(timestamp / 3600000) * 3600000;

    const key = `metrics:errors:${context}:${hour}`;

    await redis.zadd(key, {
      score: timestamp,
      member: JSON.stringify({
        message: error.message,
        stack: error.stack?.substring(0, 500),
      }),
    });

    await redis.expire(key, 259200); // 3 days

    // Increment error counter
    await redis.incr(`metrics:errors:count:${context}`);

  } catch (err) {
    console.error('[Metrics] Error tracking error:', err);
  }
}

/**
 * Update API aggregates for percentile calculations
 */
async function updateApiAggregates(
  endpoint: string,
  duration: number,
  status: string
): Promise<void> {
  const key = `metrics:api:aggregate:${endpoint}`;

  // Use HyperLogLog for unique request counting
  await redis.pfadd(`metrics:api:requests:${endpoint}`, Date.now().toString());

  // Store duration for percentile calculation
  await redis.zadd(`${key}:durations`, {
    score: duration,
    member: `${Date.now()}-${Math.random()}`,
  });

  // Increment status counter
  await redis.hincrby(`${key}:status`, status, 1);

  // Set expiry
  await redis.expire(`${key}:durations`, 86400);
  await redis.expire(`${key}:status`, 86400);
}

/**
 * Update job throughput metrics
 */
async function updateJobThroughput(jobType: string): Promise<void> {
  const minute = Math.floor(Date.now() / 60000) * 60000;
  const key = `metrics:throughput:${jobType}:${minute}`;

  await redis.incr(key);
  await redis.expire(key, 3600); // 1 hour
}

/**
 * Track slow API endpoints
 */
async function trackSlowApi(
  endpoint: string,
  duration: number
): Promise<void> {
  await redis.zadd('metrics:slow:apis', {
    score: duration,
    member: `${endpoint}:${Date.now()}`,
  });

  // Keep only top 100 slow APIs
  await redis.zremrangebyrank('metrics:slow:apis', 0, -101);
}

/**
 * Track slow database queries
 */
async function trackSlowQuery(
  operation: string,
  table: string,
  duration: number
): Promise<void> {
  await redis.zadd('metrics:slow:queries', {
    score: duration,
    member: `${table}:${operation}:${Date.now()}`,
  });

  await redis.zremrangebyrank('metrics:slow:queries', 0, -101);
}

/**
 * Get performance metrics summary
 */
export async function getPerformanceMetrics(): Promise<{
  api: {
    endpoints: Record<string, {
      p50: number;
      p95: number;
      p99: number;
      errorRate: number;
      requestCount: number;
    }>;
    slowest: Array<{ endpoint: string; duration: number }>;
  };
  jobs: {
    throughput: Record<string, number>;
    averageDuration: Record<string, number>;
  };
  cache: {
    hitRate: number;
    avgLatency: number;
  };
  database: {
    avgQueryTime: number;
    slowQueries: Array<{ query: string; duration: number }>;
  };
  errors: {
    rate: number;
    contexts: Record<string, number>;
  };
}> {
  try {
    // Get API metrics
    const apiEndpoints: Record<string, any> = {};

    // Get all tracked endpoints (this is simplified, in production you'd maintain a list)
    const endpoints = ['/api/library', '/api/dashboard/stats', '/api/search', '/api/recordings'];

    for (const endpoint of endpoints) {
      const durations = await redis.zrange(
        `metrics:api:aggregate:${endpoint}:durations`,
        0,
        -1,
        { withScores: true }
      );

      if (durations.length > 0) {
        const durValues = durations
          .filter((_, i) => i % 2 === 1)
          .map(v => Number(v))
          .sort((a, b) => a - b);

        const p50Index = Math.floor(durValues.length * 0.5);
        const p95Index = Math.floor(durValues.length * 0.95);
        const p99Index = Math.floor(durValues.length * 0.99);

        const statusCounts = await redis.hgetall(`metrics:api:aggregate:${endpoint}:status`);
        const totalRequests = Object.values(statusCounts || {})
          .reduce((sum: number, count) => sum + Number(count), 0);

        const errorCount = Number(statusCounts?.error || 0);

        apiEndpoints[endpoint] = {
          p50: durValues[p50Index] || 0,
          p95: durValues[p95Index] || 0,
          p99: durValues[p99Index] || 0,
          errorRate: (totalRequests as number) > 0 ? (errorCount / (totalRequests as number)) * 100 : 0,
          requestCount: totalRequests as number,
        };
      }
    }

    // Get slow APIs
    const slowApis = await redis.zrange('metrics:slow:apis', 0, 9, { rev: true, withScores: true });
    const slowestApis = [];
    for (let i = 0; i < slowApis.length; i += 2) {
      const [endpoint] = (slowApis[i] as string).split(':');
      slowestApis.push({
        endpoint,
        duration: Number(slowApis[i + 1]),
      });
    }

    // Get cache metrics
    const cacheHits = await redis.get('metrics:cache:hits') || 0;
    const cacheMisses = await redis.get('metrics:cache:misses') || 0;
    const totalCacheOps = Number(cacheHits) + Number(cacheMisses);
    const cacheHitRate = totalCacheOps > 0
      ? (Number(cacheHits) / totalCacheOps) * 100
      : 0;

    // Get cache latency
    const cacheLatencies = await redis.zrange('metrics:cache:latency', -100, -1);
    const avgCacheLatency = cacheLatencies.length > 0
      ? cacheLatencies.reduce((sum: number, lat) => sum + Number(lat), 0) / cacheLatencies.length
      : 0;

    // Get job throughput (simplified)
    const jobTypes = ['transcribe', 'generate_embeddings', 'doc_generate'];
    const jobThroughput: Record<string, number> = {};

    for (const jobType of jobTypes) {
      const minute = Math.floor(Date.now() / 60000) * 60000;
      let total = 0;

      // Get last 10 minutes
      for (let i = 0; i < 10; i++) {
        const key = `metrics:throughput:${jobType}:${minute - i * 60000}`;
        const count = await redis.get(key);
        total += Number(count || 0);
      }

      jobThroughput[jobType] = total / 10; // Average per minute
    }

    // Get slow queries
    const slowQueries = await redis.zrange('metrics:slow:queries', 0, 9, { rev: true, withScores: true });
    const slowestQueries = [];
    for (let i = 0; i < slowQueries.length; i += 2) {
      const [table, operation] = (slowQueries[i] as string).split(':');
      slowestQueries.push({
        query: `${operation} on ${table}`,
        duration: Number(slowQueries[i + 1]),
      });
    }

    // Get error metrics
    const errorContexts = ['api', 'job', 'database', 'cache'];
    const errorCounts: Record<string, number> = {};
    let totalErrors = 0;

    for (const context of errorContexts) {
      const count = await redis.get(`metrics:errors:count:${context}`) || 0;
      errorCounts[context] = Number(count);
      totalErrors += Number(count);
    }

    return {
      api: {
        endpoints: apiEndpoints,
        slowest: slowestApis,
      },
      jobs: {
        throughput: jobThroughput,
        averageDuration: {}, // TODO: Calculate from job metrics
      },
      cache: {
        hitRate: Math.round(cacheHitRate * 100) / 100,
        avgLatency: Math.round(avgCacheLatency),
      },
      database: {
        avgQueryTime: 0, // TODO: Calculate from DB metrics
        slowQueries: slowestQueries,
      },
      errors: {
        rate: 0, // TODO: Calculate error rate
        contexts: errorCounts,
      },
    };

  } catch (error) {
    console.error('[Metrics] Error getting performance metrics:', error);
    return {
      api: { endpoints: {}, slowest: [] },
      jobs: { throughput: {}, averageDuration: {} },
      cache: { hitRate: 0, avgLatency: 0 },
      database: { avgQueryTime: 0, slowQueries: [] },
      errors: { rate: 0, contexts: {} },
    };
  }
}

/**
 * Reset performance metrics (useful for testing)
 */
export async function resetMetrics(): Promise<void> {
  const patterns = [
    'metrics:api:*',
    'metrics:job:*',
    'metrics:cache:*',
    'metrics:db:*',
    'metrics:errors:*',
    'metrics:throughput:*',
    'metrics:slow:*',
  ];

  for (const pattern of patterns) {
    const keys = [];
    let cursor = 0;

    do {
      const result = await redis.scan(cursor, {
        match: pattern,
        count: 100,
      });

      cursor = typeof result[0] === 'string' ? parseInt(result[0], 10) : result[0];
      keys.push(...(result[1] || []));
    } while (cursor !== 0);

    if (keys.length > 0) {
      await Promise.all(keys.map(key => redis.del(key)));
    }
  }
}