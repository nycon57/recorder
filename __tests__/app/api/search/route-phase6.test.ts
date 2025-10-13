/**
 * Phase 6 Enhanced Search API Tests
 * Tests rate limiting, quota consumption, caching, and analytics integration
 */

import { POST } from '@/app/api/search/route';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs';
import { createClient } from '@/lib/supabase/server';
import { RateLimiter } from '@/lib/services/quotas/rate-limiter';
import { QuotaManager } from '@/lib/services/quotas/quota-manager';
import { MultiLayerCache } from '@/lib/services/cache/multi-layer-cache';
import { SearchTracker } from '@/lib/services/analytics/search-tracker';

// Mock all dependencies
jest.mock('@clerk/nextjs');
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/services/quotas/rate-limiter');
jest.mock('@/lib/services/quotas/quota-manager');
jest.mock('@/lib/services/cache/multi-layer-cache');
jest.mock('@/lib/services/analytics/search-tracker');

describe('POST /api/search (Phase 6)', () => {
  let mockAuth: jest.MockedFunction<typeof auth>;
  let mockSupabase: any;
  let mockRateLimiter: jest.Mocked<RateLimiter>;
  let mockQuotaManager: jest.Mocked<QuotaManager>;
  let mockCache: jest.Mocked<MultiLayerCache>;
  let mockTracker: jest.Mocked<SearchTracker>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Clerk auth
    mockAuth = auth as jest.MockedFunction<typeof auth>;
    mockAuth.mockReturnValue({
      userId: 'user_123',
      orgId: 'org_clerk_123',
    } as any);

    // Mock Supabase client
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { org_id: 'org_123', role: 'owner' },
        error: null,
      }),
    };

    mockSupabase = {
      from: jest.fn(() => mockChain),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    // Mock RateLimiter
    mockRateLimiter = {
      checkLimit: jest.fn().mockResolvedValue({
        allowed: true,
        remaining: 100,
        limit: 100,
      }),
    } as any;

    (RateLimiter as jest.MockedClass<typeof RateLimiter>).mockImplementation(
      () => mockRateLimiter
    );

    // Mock QuotaManager
    mockQuotaManager = {
      checkQuota: jest.fn().mockResolvedValue({
        available: true,
        used: 500,
        limit: 1000,
        remaining: 500,
      }),
      consumeQuota: jest.fn().mockResolvedValue({
        success: true,
        remaining: 499,
      }),
    } as any;

    (QuotaManager as jest.MockedClass<typeof QuotaManager>).mockImplementation(
      () => mockQuotaManager
    );

    // Mock MultiLayerCache
    mockCache = {
      get: jest.fn().mockImplementation(async (key, sourceFn) => {
        // Simulate cache miss, call source
        return await sourceFn();
      }),
    } as any;

    (MultiLayerCache as jest.MockedClass<typeof MultiLayerCache>).mockImplementation(
      () => mockCache
    );

    // Mock SearchTracker
    mockTracker = {
      trackSearch: jest.fn().mockResolvedValue('search_123'),
      trackSearchAsync: jest.fn(),
    } as any;

    (SearchTracker as jest.MockedClass<typeof SearchTracker>).mockImplementation(
      () => mockTracker
    );
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting', async () => {
      mockRateLimiter.checkLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        limit: 100,
        retryAfter: 60,
      });

      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test query' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('rate limit');
      expect(response.headers.get('Retry-After')).toBe('60');
    });

    it('should return 429 when rate limited', async () => {
      mockRateLimiter.checkLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        limit: 100,
        retryAfter: 30,
      });

      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(429);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('Retry-After')).toBe('30');
    });

    it('should check rate limit for user and org', async () => {
      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      // Mock successful search
      mockSupabase.from().select = jest.fn().mockReturnValue({
        data: [],
        error: null,
      });

      await POST(request);

      // Should check rate limit for both user and org
      expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith(
        expect.stringContaining('user_123'),
        expect.any(Number)
      );
      expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith(
        expect.stringContaining('org_123'),
        expect.any(Number)
      );
    });

    it('should include rate limit headers in successful responses', async () => {
      mockRateLimiter.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 95,
        limit: 100,
      });

      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      mockSupabase.from().select = jest.fn().mockReturnValue({
        data: [],
        error: null,
      });

      const response = await POST(request);

      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('95');
    });
  });

  describe('Quota Management', () => {
    it('should consume API quota on successful search', async () => {
      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test query' }),
      });

      mockSupabase.from().select = jest.fn().mockReturnValue({
        data: [{ id: '1', content: 'result' }],
        error: null,
      });

      await POST(request);

      expect(mockQuotaManager.consumeQuota).toHaveBeenCalledWith(
        'org_123',
        'api_calls',
        1
      );
    });

    it('should return 402 when quota exceeded', async () => {
      mockQuotaManager.checkQuota.mockResolvedValue({
        available: false,
        used: 1000,
        limit: 1000,
        remaining: 0,
      });

      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(402);
      expect(data.error).toContain('quota exceeded');
    });

    it('should not consume quota if rate limited', async () => {
      mockRateLimiter.checkLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        limit: 100,
      });

      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      await POST(request);

      expect(mockQuotaManager.consumeQuota).not.toHaveBeenCalled();
    });

    it('should not consume quota if quota already exceeded', async () => {
      mockQuotaManager.checkQuota.mockResolvedValue({
        available: false,
        used: 1000,
        limit: 1000,
        remaining: 0,
      });

      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      await POST(request);

      expect(mockQuotaManager.consumeQuota).not.toHaveBeenCalled();
    });
  });

  describe('Caching', () => {
    it('should check cache before searching', async () => {
      const cachedResults = [
        { id: '1', content: 'cached result', similarity: 0.9 },
      ];

      mockCache.get.mockResolvedValue(cachedResults);

      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'cached query' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(mockCache.get).toHaveBeenCalled();
      expect(data.results).toEqual(cachedResults);
      expect(data.cacheHit).toBe(true);
    });

    it('should populate cache after search', async () => {
      const searchResults = [{ id: '1', content: 'new result', similarity: 0.8 }];

      mockCache.get.mockImplementation(async (key, sourceFn) => {
        return await sourceFn(); // Simulate cache miss
      });

      mockSupabase.from().select = jest.fn().mockReturnValue({
        data: searchResults,
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'new query' }),
      });

      await POST(request);

      expect(mockCache.get).toHaveBeenCalled();
      // Cache should be populated by the source function
    });

    it('should reduce latency on cache hit', async () => {
      const cachedResults = [{ id: '1', content: 'cached' }];

      mockCache.get.mockResolvedValue(cachedResults);

      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      const startTime = Date.now();
      const response = await POST(request);
      const endTime = Date.now();
      const data = await response.json();

      expect(data.cacheHit).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Fast response
    });

    it('should handle Redis cache failure gracefully', async () => {
      mockCache.get.mockRejectedValue(new Error('Redis connection failed'));

      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      mockSupabase.from().select = jest.fn().mockReturnValue({
        data: [{ id: '1', content: 'result' }],
        error: null,
      });

      const response = await POST(request);

      // Should fallback to database search
      expect(response.status).toBe(200);
    });

    it('should include cache hit status in response', async () => {
      mockCache.get.mockResolvedValue([{ id: '1', content: 'cached' }]);

      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty('cacheHit');
      expect(data.cacheHit).toBe(true);
    });
  });

  describe('Analytics Tracking', () => {
    it('should track analytics asynchronously', async () => {
      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test query' }),
      });

      mockSupabase.from().select = jest.fn().mockReturnValue({
        data: [{ id: '1' }, { id: '2' }],
        error: null,
      });

      await POST(request);

      expect(mockTracker.trackSearchAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          org_id: 'org_123',
          user_id: 'user_123',
          query: 'test query',
          result_count: 2,
          cache_hit: false,
        })
      );
    });

    it('should not block response if analytics fails', async () => {
      mockTracker.trackSearchAsync.mockImplementation(() => {
        throw new Error('Analytics error');
      });

      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      mockSupabase.from().select = jest.fn().mockReturnValue({
        data: [{ id: '1' }],
        error: null,
      });

      const response = await POST(request);

      // Should still return 200
      expect(response.status).toBe(200);
    });

    it('should track cache hits in analytics', async () => {
      mockCache.get.mockResolvedValue([{ id: '1', content: 'cached' }]);

      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'cached query' }),
      });

      await POST(request);

      expect(mockTracker.trackSearchAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          cache_hit: true,
        })
      );
    });

    it('should track latency in analytics', async () => {
      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      mockSupabase.from().select = jest.fn().mockReturnValue({
        data: [],
        error: null,
      });

      await POST(request);

      expect(mockTracker.trackSearchAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          latency_ms: expect.any(Number),
        })
      );
    });
  });

  describe('Integration', () => {
    it('should handle full request flow', async () => {
      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'full flow test' }),
      });

      mockSupabase.from().select = jest.fn().mockReturnValue({
        data: [{ id: '1', content: 'result' }],
        error: null,
      });

      const response = await POST(request);
      const data = await response.json();

      // Should check rate limit
      expect(mockRateLimiter.checkLimit).toHaveBeenCalled();

      // Should check quota
      expect(mockQuotaManager.checkQuota).toHaveBeenCalled();

      // Should check cache
      expect(mockCache.get).toHaveBeenCalled();

      // Should consume quota
      expect(mockQuotaManager.consumeQuota).toHaveBeenCalled();

      // Should track analytics
      expect(mockTracker.trackSearchAsync).toHaveBeenCalled();

      // Should return results
      expect(response.status).toBe(200);
      expect(data.results).toBeDefined();
    });

    it('should handle errors gracefully without breaking flow', async () => {
      // Analytics fails
      mockTracker.trackSearchAsync.mockImplementation(() => {
        throw new Error('Analytics error');
      });

      // Cache fails
      mockCache.get.mockRejectedValue(new Error('Cache error'));

      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      mockSupabase.from().select = jest.fn().mockReturnValue({
        data: [{ id: '1' }],
        error: null,
      });

      const response = await POST(request);

      // Should still succeed
      expect(response.status).toBe(200);
    });

    it('should include all metadata in response', async () => {
      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      mockSupabase.from().select = jest.fn().mockReturnValue({
        data: [{ id: '1' }],
        error: null,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty('results');
      expect(data).toHaveProperty('cacheHit');
      expect(data).toHaveProperty('latency');
      expect(data).toHaveProperty('quota');
      expect(response.headers.has('X-RateLimit-Limit')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      mockAuth.mockReturnValue({ userId: null, orgId: null } as any);

      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should handle validation errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({}), // Missing query
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should handle database errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      mockSupabase.from().select = jest.fn().mockReturnValue({
        data: null,
        error: new Error('Database error'),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });
});
