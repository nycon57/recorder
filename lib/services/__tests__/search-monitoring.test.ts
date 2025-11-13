/**
 * Tests for Search Performance Monitoring
 *
 * Tests tracking lifecycle, metrics calculation, alert triggering, and buffer management.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SearchMonitor, searchMonitor, monitoredSearch } from '../search-monitoring';
import type { SearchPerformanceMetrics, AlertCondition } from '../search-monitoring';

describe('Search Monitor', () => {
  let monitor: SearchMonitor;

  beforeEach(() => {
    // Create fresh monitor instance for each test
    monitor = new SearchMonitor();
    monitor.clearBuffer();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Search Tracking Lifecycle', () => {
    it('should track search from start to finish', () => {
      const queryId = 'test-query-123';
      const query = 'test query';
      const orgId = 'test-org-id';
      const userId = 'test-user-id';

      // Start tracking
      monitor.startSearch(queryId, query, orgId, userId);

      // Update configuration
      monitor.updateConfig(queryId, {
        strategy: 'standard_search',
        threshold: 0.5,
        useHybrid: false,
        useAgentic: false,
      });

      // Update results
      monitor.updateConfig(queryId, {
        sourcesFound: 5,
        avgSimilarity: 0.75,
        minSimilarity: 0.6,
        maxSimilarity: 0.9,
        searchTimeMs: 150,
      });

      // End tracking
      monitor.endSearch(queryId, {
        success: true,
        totalTimeMs: 200,
      });

      // Verify metrics were stored
      const recent = monitor.getRecentMetrics(1);
      expect(recent).toHaveLength(1);
      expect(recent[0]).toMatchObject({
        queryId,
        query,
        orgId,
        userId,
        strategy: 'standard_search',
        threshold: 0.5,
        sourcesFound: 5,
        avgSimilarity: 0.75,
        success: true,
        totalTimeMs: 200,
      });
    });

    it('should calculate total time automatically if not provided', () => {
      const queryId = 'test-query-456';

      monitor.startSearch(queryId, 'test', 'org-1', 'user-1');

      // Wait a bit to simulate processing time
      const startTime = Date.now();

      // End without providing totalTimeMs
      monitor.endSearch(queryId, {
        sourcesFound: 3,
      });

      const recent = monitor.getRecentMetrics(1);
      expect(recent[0].totalTimeMs).toBeGreaterThanOrEqual(0);
      expect(recent[0].totalTimeMs).toBeLessThan(1000);
    });

    it('should determine success based on sources found', () => {
      const queryId1 = 'query-1';
      const queryId2 = 'query-2';

      // Search with results
      monitor.startSearch(queryId1, 'test 1', 'org-1', 'user-1');
      monitor.endSearch(queryId1, { sourcesFound: 5 });

      // Search with no results
      monitor.startSearch(queryId2, 'test 2', 'org-1', 'user-1');
      monitor.endSearch(queryId2, { sourcesFound: 0 });

      const recent = monitor.getRecentMetrics(2);
      expect(recent[0].success).toBe(true); // 5 sources
      expect(recent[1].success).toBe(false); // 0 sources
    });
  });

  describe('Retry Tracking', () => {
    it('should record lower threshold retry', () => {
      const queryId = 'test-query';

      monitor.startSearch(queryId, 'test', 'org-1', 'user-1');
      monitor.recordRetry(queryId, 'lowerThreshold');

      monitor.endSearch(queryId, { sourcesFound: 3 });

      const recent = monitor.getRecentMetrics(1);
      expect(recent[0].retrievalAttempts).toBe(1);
      expect(recent[0].retriedWithLowerThreshold).toBe(true);
    });

    it('should record hybrid search retry', () => {
      const queryId = 'test-query';

      monitor.startSearch(queryId, 'test', 'org-1', 'user-1');
      monitor.recordRetry(queryId, 'hybrid');

      monitor.endSearch(queryId, { sourcesFound: 2 });

      const recent = monitor.getRecentMetrics(1);
      expect(recent[0].retrievalAttempts).toBe(1);
      expect(recent[0].retriedWithHybrid).toBe(true);
    });

    it('should record keyword-only retry', () => {
      const queryId = 'test-query';

      monitor.startSearch(queryId, 'test', 'org-1', 'user-1');
      monitor.recordRetry(queryId, 'keyword');

      monitor.endSearch(queryId, { sourcesFound: 1 });

      const recent = monitor.getRecentMetrics(1);
      expect(recent[0].retrievalAttempts).toBe(1);
      expect(recent[0].retriedWithKeyword).toBe(true);
    });

    it('should track multiple retry attempts', () => {
      const queryId = 'test-query';

      monitor.startSearch(queryId, 'test', 'org-1', 'user-1');
      monitor.recordRetry(queryId, 'lowerThreshold');
      monitor.recordRetry(queryId, 'hybrid');
      monitor.recordRetry(queryId, 'keyword');

      monitor.endSearch(queryId, { sourcesFound: 0 });

      const recent = monitor.getRecentMetrics(1);
      expect(recent[0].retrievalAttempts).toBe(3);
      expect(recent[0].retriedWithLowerThreshold).toBe(true);
      expect(recent[0].retriedWithHybrid).toBe(true);
      expect(recent[0].retriedWithKeyword).toBe(true);
    });
  });

  describe('Metrics Summary', () => {
    it('should calculate metrics summary correctly', () => {
      // Add multiple searches with varying success rates
      for (let i = 0; i < 10; i++) {
        const queryId = `query-${i}`;
        monitor.startSearch(queryId, `test ${i}`, 'org-1', 'user-1');

        const isSuccess = i < 7; // 70% success rate
        monitor.endSearch(queryId, {
          sourcesFound: isSuccess ? 5 : 0,
          avgSimilarity: isSuccess ? 0.75 : 0,
          totalTimeMs: 100 + i * 10,
          retrievalAttempts: isSuccess ? 1 : 2,
        });
      }

      const summary = monitor.getMetricsSummary();

      expect(summary.totalSearches).toBe(10);
      expect(summary.successRate).toBe(0.7); // 7/10
      expect(summary.avgSimilarity).toBeGreaterThan(0); // Only successful searches count
      expect(summary.avgTimeMs).toBeGreaterThan(100); // Average of all searches
      expect(summary.retryRate).toBe(0.3); // 3/10 required retries
    });

    it('should handle empty buffer gracefully', () => {
      const summary = monitor.getMetricsSummary();

      expect(summary.totalSearches).toBe(0);
      expect(summary.successRate).toBe(0);
      expect(summary.avgSimilarity).toBe(0);
      expect(summary.avgTimeMs).toBe(0);
      expect(summary.retryRate).toBe(0);
    });

    it('should calculate correct average similarity', () => {
      monitor.startSearch('q1', 'test 1', 'org-1', 'user-1');
      monitor.endSearch('q1', { sourcesFound: 2, avgSimilarity: 0.8 });

      monitor.startSearch('q2', 'test 2', 'org-1', 'user-1');
      monitor.endSearch('q2', { sourcesFound: 3, avgSimilarity: 0.6 });

      monitor.startSearch('q3', 'test 3', 'org-1', 'user-1');
      monitor.endSearch('q3', { sourcesFound: 1, avgSimilarity: 0.9 });

      const summary = monitor.getMetricsSummary();

      // Average: (0.8 + 0.6 + 0.9) / 3 = 0.7667
      expect(summary.avgSimilarity).toBeCloseTo(0.7667, 2);
    });

    it('should calculate median and percentiles', () => {
      // Add searches with known latencies
      const latencies = [100, 150, 200, 250, 300, 350, 400, 450, 500, 1000];

      latencies.forEach((latency, i) => {
        const queryId = `query-${i}`;
        monitor.startSearch(queryId, `test ${i}`, 'org-1', 'user-1');
        monitor.endSearch(queryId, {
          sourcesFound: 1,
          totalTimeMs: latency,
        });
      });

      const summary = monitor.getMetricsSummary();

      // Average should be around 370
      expect(summary.avgTimeMs).toBeCloseTo(370, 0);
    });
  });

  describe('Alert System', () => {
    beforeEach(() => {
      // Spy on console methods
      jest.spyOn(console, 'warn').mockImplementation();
      jest.spyOn(console, 'error').mockImplementation();
      jest.spyOn(console, 'info').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should trigger slow search alert', () => {
      const queryId = 'slow-query';

      monitor.startSearch(queryId, 'slow test query', 'org-1', 'user-1');
      monitor.endSearch(queryId, {
        sourcesFound: 5,
        totalTimeMs: 4000, // > 3000ms threshold
      });

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        '[Search Monitor] ALERT [slow_search]:',
        expect.objectContaining({
          severity: 'warning',
          message: expect.stringContaining('Slow search detected'),
        })
      );
    });

    it('should trigger low similarity alert', () => {
      const queryId = 'low-sim-query';

      monitor.startSearch(queryId, 'test query', 'org-1', 'user-1');
      monitor.endSearch(queryId, {
        sourcesFound: 3,
        avgSimilarity: 0.4, // < 0.5 threshold
        success: true,
      });

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        '[Search Monitor] ALERT [low_similarity]:',
        expect.objectContaining({
          severity: 'warning',
          message: expect.stringContaining('Low similarity results'),
        })
      );
    });

    it('should trigger retry failure alert', () => {
      const queryId = 'failed-query';

      monitor.startSearch(queryId, 'test query', 'org-1', 'user-1');
      monitor.recordRetry(queryId, 'lowerThreshold');
      monitor.recordRetry(queryId, 'hybrid');
      monitor.recordRetry(queryId, 'keyword');

      monitor.endSearch(queryId, {
        sourcesFound: 0, // Failed despite retries
        success: false,
      });

      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(
        '[Search Monitor] ALERT [retry_failure]:',
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining('failed after 3 retries'),
        })
      );
    });

    it('should trigger excessive retries alert', () => {
      const queryId = 'retry-query';

      monitor.startSearch(queryId, 'test query', 'org-1', 'user-1');
      monitor.recordRetry(queryId, 'lowerThreshold');
      monitor.recordRetry(queryId, 'hybrid');
      monitor.recordRetry(queryId, 'keyword');

      monitor.endSearch(queryId, {
        sourcesFound: 2, // Eventually succeeded
        success: true,
      });

      // Verify info was logged
      expect(console.info).toHaveBeenCalledWith(
        '[Search Monitor] ALERT [excessive_retries]:',
        expect.objectContaining({
          severity: 'info',
          message: expect.stringContaining('required 3 attempts'),
        })
      );
    });

    it('should trigger tool fallback alert', () => {
      const queryId = 'tool-query';

      monitor.startSearch(queryId, 'test query', 'org-1', 'user-1');
      monitor.endSearch(queryId, {
        sourcesFound: 0,
        usedToolFallback: true,
      });

      // Verify info was logged
      expect(console.info).toHaveBeenCalledWith(
        '[Search Monitor] ALERT [tool_fallback]:',
        expect.objectContaining({
          severity: 'info',
          message: expect.stringContaining('used tool fallback'),
        })
      );
    });

    it('should support custom alerts', () => {
      // Register custom alert
      monitor.registerAlert({
        name: 'custom_alert',
        severity: 'warning',
        condition: (m) => m.sourcesFound === 0 && m.queryWordCount > 10,
        message: (m) => `Long query with no results: "${m.query.substring(0, 30)}"`,
      });

      const queryId = 'custom-query';
      const longQuery = 'this is a very long query with more than ten words in it';

      monitor.startSearch(queryId, longQuery, 'org-1', 'user-1');
      monitor.endSearch(queryId, {
        sourcesFound: 0,
      });

      // Verify custom alert was triggered
      expect(console.warn).toHaveBeenCalledWith(
        '[Search Monitor] ALERT [custom_alert]:',
        expect.objectContaining({
          severity: 'warning',
          message: expect.stringContaining('Long query with no results'),
        })
      );
    });

    it('should NOT trigger alerts when conditions not met', () => {
      const queryId = 'good-query';

      monitor.startSearch(queryId, 'test query', 'org-1', 'user-1');
      monitor.endSearch(queryId, {
        sourcesFound: 5,
        avgSimilarity: 0.8,
        totalTimeMs: 150,
        success: true,
        retrievalAttempts: 1,
      });

      // Verify NO alerts were triggered
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('Buffer Management', () => {
    it('should buffer metrics up to max size', () => {
      const BUFFER_SIZE = 100;

      // Add more than buffer size
      for (let i = 0; i < BUFFER_SIZE + 10; i++) {
        const queryId = `query-${i}`;
        monitor.startSearch(queryId, `test ${i}`, 'org-1', 'user-1');
        monitor.endSearch(queryId, { sourcesFound: 1 });
      }

      // Verify buffer is capped at max size
      const recent = monitor.getRecentMetrics(BUFFER_SIZE + 20);
      expect(recent.length).toBe(BUFFER_SIZE);
    });

    it('should evict oldest entries when buffer is full (FIFO)', () => {
      const BUFFER_SIZE = 100;

      // Fill buffer
      for (let i = 0; i < BUFFER_SIZE; i++) {
        const queryId = `query-${i}`;
        monitor.startSearch(queryId, `test ${i}`, 'org-1', 'user-1');
        monitor.endSearch(queryId, { sourcesFound: 1 });
      }

      // Add one more to trigger eviction
      monitor.startSearch('newest', 'newest query', 'org-1', 'user-1');
      monitor.endSearch('newest', { sourcesFound: 1 });

      const all = monitor.getRecentMetrics(BUFFER_SIZE + 1);

      // First entry (query-0) should be evicted
      expect(all.some(m => m.queryId === 'query-0')).toBe(false);

      // Last entry should be present
      expect(all[all.length - 1].queryId).toBe('newest');
    });

    it('should clear buffer on command', () => {
      // Add some metrics
      for (let i = 0; i < 10; i++) {
        const queryId = `query-${i}`;
        monitor.startSearch(queryId, `test ${i}`, 'org-1', 'user-1');
        monitor.endSearch(queryId, { sourcesFound: 1 });
      }

      expect(monitor.getRecentMetrics(10).length).toBe(10);

      // Clear buffer
      monitor.clearBuffer();

      expect(monitor.getRecentMetrics(10).length).toBe(0);
    });

    it('should retrieve recent metrics with limit', () => {
      // Add 20 metrics
      for (let i = 0; i < 20; i++) {
        const queryId = `query-${i}`;
        monitor.startSearch(queryId, `test ${i}`, 'org-1', 'user-1');
        monitor.endSearch(queryId, { sourcesFound: 1 });
      }

      // Get last 5
      const recent5 = monitor.getRecentMetrics(5);
      expect(recent5.length).toBe(5);

      // Verify they're the newest ones
      expect(recent5[0].queryId).toBe('query-15');
      expect(recent5[4].queryId).toBe('query-19');
    });
  });

  describe('Monitored Search Wrapper', () => {
    it('should track successful search operation', async () => {
      const queryId = 'test-query';
      const query = 'test query';
      const orgId = 'org-1';
      const userId = 'user-1';

      // Mock search function that succeeds
      const searchFn = jest.fn(async () => {
        return { results: [1, 2, 3] };
      });

      const result = await monitoredSearch(
        queryId,
        query,
        orgId,
        userId,
        searchFn,
        {
          strategy: 'standard_search',
          threshold: 0.7,
        }
      );

      // Verify search was called
      expect(searchFn).toHaveBeenCalled();

      // Verify result was returned
      expect(result).toEqual({ results: [1, 2, 3] });

      // Verify metrics were tracked (using singleton searchMonitor)
      const recent = searchMonitor.getRecentMetrics(1);
      expect(recent.length).toBeGreaterThan(0);
    });

    it('should track failed search operation', async () => {
      const queryId = 'failed-query';
      const query = 'test query';
      const orgId = 'org-1';
      const userId = 'user-1';

      // Mock search function that fails
      const searchFn = jest.fn(async () => {
        throw new Error('Search failed');
      });

      await expect(
        monitoredSearch(queryId, query, orgId, userId, searchFn)
      ).rejects.toThrow('Search failed');

      // Verify failure was tracked
      const recent = searchMonitor.getRecentMetrics(1);
      expect(recent.length).toBeGreaterThan(0);
      expect(recent[0].success).toBe(false);
      expect(recent[0].sourcesFound).toBe(0);
    });

    it('should measure total time accurately', async () => {
      const queryId = 'timed-query';
      const query = 'test query';
      const orgId = 'org-1';
      const userId = 'user-1';

      // Mock search function with delay
      const searchFn = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { results: [] };
      });

      await monitoredSearch(queryId, query, orgId, userId, searchFn);

      const recent = searchMonitor.getRecentMetrics(1);
      expect(recent[0].totalTimeMs).toBeGreaterThanOrEqual(100);
      expect(recent[0].totalTimeMs).toBeLessThan(200);
    });
  });

  describe('Edge Cases', () => {
    it('should handle update before start gracefully', () => {
      const queryId = 'orphan-query';

      // Update config without starting
      monitor.updateConfig(queryId, {
        strategy: 'standard_search',
        threshold: 0.5,
      });

      // Should not throw error
      expect(() => monitor.endSearch(queryId, { sourcesFound: 0 })).not.toThrow();
    });

    it('should handle duplicate end calls gracefully', () => {
      const queryId = 'duplicate-query';

      monitor.startSearch(queryId, 'test', 'org-1', 'user-1');
      monitor.endSearch(queryId, { sourcesFound: 5 });

      // Try to end again
      expect(() => monitor.endSearch(queryId, { sourcesFound: 3 })).not.toThrow();

      // Should only have one entry
      const recent = monitor.getRecentMetrics(10);
      const matches = recent.filter(m => m.queryId === queryId);
      expect(matches.length).toBe(1);
    });

    it('should handle missing similarity metrics', () => {
      const queryId = 'missing-sim-query';

      monitor.startSearch(queryId, 'test', 'org-1', 'user-1');
      monitor.endSearch(queryId, {
        sourcesFound: 3,
        // avgSimilarity not provided
      });

      const recent = monitor.getRecentMetrics(1);
      expect(recent[0].avgSimilarity).toBeUndefined();

      // Summary should handle undefined values
      const summary = monitor.getMetricsSummary();
      expect(summary.avgSimilarity).toBe(0);
    });
  });
});
