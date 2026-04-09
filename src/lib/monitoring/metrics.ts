/**
 * Performance metrics tracking
 *
 * Tracks key application metrics for monitoring and alerting.
 * Can be extended to integrate with DataDog, New Relic, etc.
 */

import { logger } from './logger';

export interface Metric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  tags?: Record<string, string>;
}

export interface TimerResult {
  duration: number;
  end: () => void;
}

class Metrics {
  private metrics: Metric[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Flush metrics every 60 seconds
    if (typeof window === 'undefined') {
      // Only in Node.js environment
      this.flushInterval = setInterval(() => this.flush(), 60000);
    }
  }

  /**
   * Record a counter metric
   */
  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    this.record(name, value, 'count', tags);
  }

  /**
   * Record a gauge metric (point-in-time value)
   */
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.record(name, value, 'gauge', tags);
  }

  /**
   * Record a histogram metric (distribution)
   */
  histogram(name: string, value: number, tags?: Record<string, string>): void {
    this.record(name, value, 'histogram', tags);
  }

  /**
   * Start a timer for measuring duration
   */
  timer(name: string, tags?: Record<string, string>): TimerResult {
    const start = Date.now();
    let ended = false;

    return {
      duration: 0,
      end: () => {
        if (ended) return;
        ended = true;
        const duration = Date.now() - start;
        this.histogram(name, duration, { ...tags, unit: 'ms' });
        return duration;
      },
    };
  }

  /**
   * Record a metric
   */
  private record(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    const metric: Metric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      tags,
    };

    this.metrics.push(metric);

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Metric: ${name}`, { value, unit, tags });
    }
  }

  /**
   * Flush metrics to external service
   */
  private flush(): void {
    if (this.metrics.length === 0) return;

    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to DataDog/New Relic/etc
      // datadog.gauge('app.metrics', this.metrics);
    }

    logger.debug('Flushing metrics', { count: this.metrics.length });
    this.metrics = [];
  }

  /**
   * Stop the flush interval
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
}

// Export singleton instance
export const metrics = new Metrics();

/**
 * Pre-configured metric helpers for common operations
 */
export const trackMetrics = {
  /**
   * API request metrics
   */
  apiRequest: (method: string, path: string, statusCode: number, duration: number) => {
    metrics.increment('api.request.count', 1, { method, path, status: statusCode.toString() });
    metrics.histogram('api.request.duration', duration, { method, path });

    if (statusCode >= 500) {
      metrics.increment('api.request.errors', 1, { method, path, status: statusCode.toString() });
    }
  },

  /**
   * Background job metrics
   */
  job: (type: string, status: 'success' | 'failed', duration: number) => {
    metrics.increment('job.count', 1, { type, status });
    metrics.histogram('job.duration', duration, { type });

    if (status === 'failed') {
      metrics.increment('job.failures', 1, { type });
    }
  },

  /**
   * Database query metrics
   */
  dbQuery: (operation: string, table: string, duration: number) => {
    metrics.increment('db.query.count', 1, { operation, table });
    metrics.histogram('db.query.duration', duration, { operation, table });
  },

  /**
   * External API call metrics
   */
  externalApi: (service: string, operation: string, statusCode: number, duration: number) => {
    metrics.increment('external.api.count', 1, { service, operation, status: statusCode.toString() });
    metrics.histogram('external.api.duration', duration, { service, operation });

    if (statusCode >= 400) {
      metrics.increment('external.api.errors', 1, { service, operation, status: statusCode.toString() });
    }
  },

  /**
   * AI/LLM metrics
   */
  llm: (model: string, operation: 'transcribe' | 'generate' | 'embed' | 'chat', tokens: number, duration: number) => {
    metrics.increment('llm.request.count', 1, { model, operation });
    metrics.histogram('llm.request.duration', duration, { model, operation });
    metrics.histogram('llm.tokens.used', tokens, { model, operation });
  },

  /**
   * Storage metrics
   */
  storage: (operation: 'upload' | 'download' | 'delete', size: number, duration: number) => {
    metrics.increment('storage.operation.count', 1, { operation });
    metrics.histogram('storage.operation.duration', duration, { operation });
    metrics.histogram('storage.bytes.transferred', size, { operation });
  },
};
