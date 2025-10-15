/**
 * API Performance Tests
 *
 * Tests API endpoints for:
 * - Response time targets
 * - Concurrent request handling
 * - Large dataset handling
 * - Cache effectiveness
 */

import { createMocks } from 'node-mocks-http';
import { performance } from 'perf_hooks';

// Mock environment variables
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

describe('API Performance Tests', () => {
  beforeAll(() => {
    // Mock Clerk authentication
    jest.mock('@clerk/nextjs', () => ({
      auth: jest.fn(() => ({
        userId: 'test-user',
        orgId: 'test-org',
      })),
      currentUser: jest.fn(() => ({
        id: 'test-user',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
      })),
    }));

    // Mock Supabase
    jest.mock('@/lib/supabase/server', () => ({
      createClient: jest.fn(() => ({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              range: jest.fn(() => Promise.resolve({
                data: generateMockRecordings(50),
                error: null,
                count: 1000,
              })),
            })),
          })),
        })),
      })),
    }));
  });

  describe('Library API Performance', () => {
    it('should respond within 500ms for standard queries', async () => {
      const { GET } = await import('@/app/api/library/route.optimized');

      const startTime = performance.now();

      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/library?limit=50',
      });

      await GET(req as any);

      const duration = performance.now() - startTime;

      expect(res._getStatusCode()).toBe(200);
      expect(duration).toBeLessThan(500);
    });

    it('should handle concurrent requests efficiently', async () => {
      const { GET } = await import('@/app/api/library/route.optimized');

      const requests = Array.from({ length: 10 }, async () => {
        const { req, res } = createMocks({
          method: 'GET',
          url: '/api/library?limit=50',
        });

        const startTime = performance.now();
        await GET(req as any);
        const duration = performance.now() - startTime;

        return { status: res._getStatusCode(), duration };
      });

      const results = await Promise.all(requests);

      // All requests should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
      });

      // Average response time should be reasonable
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      expect(avgDuration).toBeLessThan(1000);
    });

    it('should efficiently handle large datasets with pagination', async () => {
      const { GET } = await import('@/app/api/library/route.optimized');

      // Test different page sizes
      const pageSizes = [10, 25, 50, 100];
      const durations: number[] = [];

      for (const limit of pageSizes) {
        const { req, res } = createMocks({
          method: 'GET',
          url: `/api/library?limit=${limit}`,
        });

        const startTime = performance.now();
        await GET(req as any);
        const duration = performance.now() - startTime;

        durations.push(duration);
        expect(res._getStatusCode()).toBe(200);
      }

      // Larger page sizes shouldn't dramatically increase response time
      const ratio = durations[durations.length - 1] / durations[0];
      expect(ratio).toBeLessThan(3); // 100 items shouldn't take 10x longer than 10 items
    });

    it('should benefit from caching on repeated requests', async () => {
      const { GET } = await import('@/app/api/library/route.optimized');

      const url = '/api/library?limit=50&content_type=recording';

      // First request (cache miss)
      const { req: req1, res: res1 } = createMocks({
        method: 'GET',
        url,
      });

      const startTime1 = performance.now();
      await GET(req1 as any);
      const duration1 = performance.now() - startTime1;

      // Second request (should hit cache)
      const { req: req2, res: res2 } = createMocks({
        method: 'GET',
        url,
      });

      const startTime2 = performance.now();
      await GET(req2 as any);
      const duration2 = performance.now() - startTime2;

      expect(res1._getStatusCode()).toBe(200);
      expect(res2._getStatusCode()).toBe(200);

      // Second request should be faster due to caching
      expect(duration2).toBeLessThan(duration1 * 0.5);
    });

    it('should handle search queries efficiently', async () => {
      const { GET } = await import('@/app/api/library/route.optimized');

      const searchTerms = ['test', 'recording', 'document', 'important'];
      const durations: number[] = [];

      for (const search of searchTerms) {
        const { req, res } = createMocks({
          method: 'GET',
          url: `/api/library?search=${search}`,
        });

        const startTime = performance.now();
        await GET(req as any);
        const duration = performance.now() - startTime;

        durations.push(duration);
        expect(res._getStatusCode()).toBe(200);
      }

      // All search queries should be reasonably fast
      const maxDuration = Math.max(...durations);
      expect(maxDuration).toBeLessThan(1000);
    });
  });

  describe('Dashboard Stats API Performance', () => {
    it('should respond within 500ms for dashboard stats', async () => {
      const { GET } = await import('@/app/api/dashboard/stats/route.optimized');

      const startTime = performance.now();

      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/dashboard/stats?period=week',
      });

      await GET(req as any);

      const duration = performance.now() - startTime;

      expect(res._getStatusCode()).toBe(200);
      expect(duration).toBeLessThan(500);
    });

    it('should handle parallel metric calculations efficiently', async () => {
      const { GET } = await import('@/app/api/dashboard/stats/route.optimized');

      const periods = ['week', 'month', 'year', 'all'];
      const requests = periods.map(async period => {
        const { req, res } = createMocks({
          method: 'GET',
          url: `/api/dashboard/stats?period=${period}`,
        });

        const startTime = performance.now();
        await GET(req as any);
        const duration = performance.now() - startTime;

        return { period, duration, status: res._getStatusCode() };
      });

      const results = await Promise.all(requests);

      // All requests should succeed quickly
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.duration).toBeLessThan(1000);
      });
    });

    it('should cache stats effectively', async () => {
      const { GET } = await import('@/app/api/dashboard/stats/route.optimized');

      // First request
      const { req: req1, res: res1 } = createMocks({
        method: 'GET',
        url: '/api/dashboard/stats?period=all&includeBreakdown=true',
      });

      const startTime1 = performance.now();
      await GET(req1 as any);
      const duration1 = performance.now() - startTime1;

      // Second request (cached)
      const { req: req2, res: res2 } = createMocks({
        method: 'GET',
        url: '/api/dashboard/stats?period=all&includeBreakdown=true',
      });

      const startTime2 = performance.now();
      await GET(req2 as any);
      const duration2 = performance.now() - startTime2;

      expect(res1._getStatusCode()).toBe(200);
      expect(res2._getStatusCode()).toBe(200);

      // Cached request should be significantly faster
      expect(duration2).toBeLessThan(duration1 * 0.3);
    });
  });

  describe('Performance Monitoring API', () => {
    it('should collect and report metrics efficiently', async () => {
      const { GET } = await import('@/app/api/monitoring/performance/route');

      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/monitoring/performance',
      });

      const startTime = performance.now();
      await GET(req as any);
      const duration = performance.now() - startTime;

      expect(res._getStatusCode()).toBe(200);
      expect(duration).toBeLessThan(500);

      const data = JSON.parse(res._getData());
      expect(data).toHaveProperty('metrics');
      expect(data).toHaveProperty('health');
      expect(data).toHaveProperty('targets');
    });
  });

  describe('Load Testing', () => {
    it('should handle sustained load of 100 requests per second', async () => {
      const { GET } = await import('@/app/api/library/route.optimized');

      const requestsPerSecond = 100;
      const durationSeconds = 2;
      const totalRequests = requestsPerSecond * durationSeconds;

      const startTime = performance.now();
      const results: any[] = [];

      // Simulate load over time
      for (let second = 0; second < durationSeconds; second++) {
        const batchPromises = Array.from({ length: requestsPerSecond }, async () => {
          const { req, res } = createMocks({
            method: 'GET',
            url: `/api/library?limit=20&offset=${Math.random() * 1000}`,
          });

          const reqStart = performance.now();
          await GET(req as any);
          const reqDuration = performance.now() - reqStart;

          return {
            status: res._getStatusCode(),
            duration: reqDuration,
          };
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Add delay to simulate sustained load
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const totalDuration = performance.now() - startTime;

      // Analyze results
      const successCount = results.filter(r => r.status === 200).length;
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const maxDuration = Math.max(...results.map(r => r.duration));
      const p95Duration = results
        .map(r => r.duration)
        .sort((a, b) => a - b)
        [Math.floor(results.length * 0.95)];

      expect(successCount).toBe(totalRequests); // All requests should succeed
      expect(avgDuration).toBeLessThan(500); // Average under 500ms
      expect(p95Duration).toBeLessThan(1000); // 95th percentile under 1s
      expect(maxDuration).toBeLessThan(2000); // No request over 2s

      console.log('Load test results:', {
        totalRequests,
        successCount,
        avgDuration: Math.round(avgDuration),
        p95Duration: Math.round(p95Duration),
        maxDuration: Math.round(maxDuration),
        totalDuration: Math.round(totalDuration),
      });
    });
  });
});

// Helper function to generate mock data
function generateMockRecordings(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `recording-${i}`,
    title: `Recording ${i}`,
    description: `Description for recording ${i}`,
    content_type: ['recording', 'video', 'audio', 'document', 'text'][i % 5],
    status: 'completed',
    file_size: Math.floor(Math.random() * 10000000),
    duration: Math.floor(Math.random() * 3600),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    org_id: 'test-org',
    user_id: 'test-user',
  }));
}