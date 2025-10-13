import { SearchTracker } from '@/lib/services/analytics/search-tracker';
import { createClient } from '@/lib/supabase/server';

// Mock Supabase client
jest.mock('@/lib/supabase/server');

describe('SearchTracker', () => {
  let tracker: SearchTracker;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock Supabase client with chainable methods
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockSupabase = {
      from: jest.fn(() => mockChain),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    tracker = new SearchTracker();
  });

  describe('trackSearch()', () => {
    it('should insert search record into search_analytics table', async () => {
      const searchData = {
        org_id: 'org_123',
        user_id: 'user_123',
        query: 'test search query',
        result_count: 5,
        latency_ms: 150,
        cache_hit: false,
        search_type: 'semantic' as const,
      };

      const mockInsert = jest.fn().mockResolvedValue({ data: { id: 'search_1' }, error: null });
      mockSupabase.from().insert = mockInsert;

      const result = await tracker.trackSearch(searchData);

      expect(mockSupabase.from).toHaveBeenCalledWith('search_analytics');
      expect(mockInsert).toHaveBeenCalledWith({
        org_id: searchData.org_id,
        user_id: searchData.user_id,
        query: searchData.query,
        result_count: searchData.result_count,
        latency_ms: searchData.latency_ms,
        cache_hit: searchData.cache_hit,
        search_type: searchData.search_type,
        created_at: expect.any(String),
      });
      expect(result).toBe('search_1');
    });

    it('should not throw if analytics insert fails', async () => {
      const searchData = {
        org_id: 'org_123',
        user_id: 'user_123',
        query: 'test query',
        result_count: 5,
        latency_ms: 150,
        cache_hit: false,
        search_type: 'semantic' as const,
      };

      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });
      mockSupabase.from().insert = mockInsert;

      // Should not throw, just log error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await tracker.trackSearch(searchData);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to track search:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle cache hits correctly', async () => {
      const searchData = {
        org_id: 'org_123',
        user_id: 'user_123',
        query: 'cached query',
        result_count: 3,
        latency_ms: 10, // Fast due to cache
        cache_hit: true,
        search_type: 'semantic' as const,
      };

      const mockInsert = jest.fn().mockResolvedValue({ data: { id: 'search_2' }, error: null });
      mockSupabase.from().insert = mockInsert;

      await tracker.trackSearch(searchData);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ cache_hit: true })
      );
    });

    it('should handle different search types', async () => {
      const searchTypes: Array<'semantic' | 'keyword' | 'hybrid'> = [
        'semantic',
        'keyword',
        'hybrid',
      ];

      const mockInsert = jest.fn().mockResolvedValue({ data: { id: 'search_x' }, error: null });
      mockSupabase.from().insert = mockInsert;

      for (const type of searchTypes) {
        await tracker.trackSearch({
          org_id: 'org_123',
          user_id: 'user_123',
          query: 'test',
          result_count: 1,
          latency_ms: 100,
          cache_hit: false,
          search_type: type,
        });

        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({ search_type: type })
        );
      }
    });
  });

  describe('trackFeedback()', () => {
    it('should insert feedback record into search_feedback table', async () => {
      const feedbackData = {
        search_id: 'search_123',
        result_id: 'chunk_456',
        feedback_type: 'relevant' as const,
        rating: 5,
      };

      const mockInsert = jest.fn().mockResolvedValue({ data: { id: 'feedback_1' }, error: null });
      mockSupabase.from().insert = mockInsert;

      await tracker.trackFeedback(feedbackData);

      expect(mockSupabase.from).toHaveBeenCalledWith('search_feedback');
      expect(mockInsert).toHaveBeenCalledWith({
        search_id: feedbackData.search_id,
        result_id: feedbackData.result_id,
        feedback_type: feedbackData.feedback_type,
        rating: feedbackData.rating,
        created_at: expect.any(String),
      });
    });

    it('should handle different feedback types', async () => {
      const feedbackTypes: Array<'relevant' | 'irrelevant' | 'clicked'> = [
        'relevant',
        'irrelevant',
        'clicked',
      ];

      const mockInsert = jest.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from().insert = mockInsert;

      for (const type of feedbackTypes) {
        await tracker.trackFeedback({
          search_id: 'search_123',
          result_id: 'chunk_456',
          feedback_type: type,
          rating: null,
        });

        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({ feedback_type: type })
        );
      }
    });

    it('should not throw if feedback insert fails', async () => {
      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });
      mockSupabase.from().insert = mockInsert;

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await tracker.trackFeedback({
        search_id: 'search_123',
        result_id: 'chunk_456',
        feedback_type: 'relevant',
        rating: 5,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to track feedback:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getMetrics()', () => {
    it('should calculate P50, P95, P99 latency percentiles', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: {
          p50_latency: 100,
          p95_latency: 500,
          p99_latency: 1000,
          avg_latency: 150,
          total_searches: 1000,
        },
        error: null,
      });
      mockSupabase.rpc = mockRpc;

      const metrics = await tracker.getMetrics('org_123', 7);

      expect(mockRpc).toHaveBeenCalledWith('get_search_metrics', {
        p_org_id: 'org_123',
        p_days: 7,
      });
      expect(metrics.latency.p50).toBe(100);
      expect(metrics.latency.p95).toBe(500);
      expect(metrics.latency.p99).toBe(1000);
      expect(metrics.latency.avg).toBe(150);
    });

    it('should calculate cache hit rate percentage', async () => {
      const mockSelect = jest.fn().mockResolvedValue({
        data: [
          { cache_hit: true },
          { cache_hit: true },
          { cache_hit: true },
          { cache_hit: false },
        ],
        error: null,
      });

      mockSupabase.from().select = mockSelect;

      const metrics = await tracker.getMetrics('org_123', 7);

      expect(metrics.cacheHitRate).toBe(75); // 3/4 = 75%
    });

    it('should aggregate by time range', async () => {
      const timeRanges = [7, 30, 90];

      for (const days of timeRanges) {
        const mockRpc = jest.fn().mockResolvedValue({
          data: { total_searches: days * 10 },
          error: null,
        });
        mockSupabase.rpc = mockRpc;

        await tracker.getMetrics('org_123', days);

        expect(mockRpc).toHaveBeenCalledWith('get_search_metrics', {
          p_org_id: 'org_123',
          p_days: days,
        });
      }
    });

    it('should handle missing data gracefully', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      mockSupabase.rpc = mockRpc;

      const mockSelect = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      mockSupabase.from().select = mockSelect;

      const metrics = await tracker.getMetrics('org_123', 7);

      expect(metrics.latency.p50).toBe(0);
      expect(metrics.latency.avg).toBe(0);
      expect(metrics.cacheHitRate).toBe(0);
      expect(metrics.totalSearches).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });
      mockSupabase.rpc = mockRpc;

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const metrics = await tracker.getMetrics('org_123', 7);

      expect(metrics.latency.p50).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('getPopularQueries()', () => {
    it('should query search_queries_mv materialized view', async () => {
      const mockData = [
        { query: 'how to deploy', search_count: 100, avg_latency: 150 },
        { query: 'authentication setup', search_count: 75, avg_latency: 120 },
        { query: 'database migration', search_count: 50, avg_latency: 200 },
      ];

      const mockSelect = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });
      mockSupabase.from().select = mockSelect;
      mockSupabase.from().eq = jest.fn().mockReturnThis();
      mockSupabase.from().order = jest.fn().mockReturnThis();
      mockSupabase.from().limit = jest.fn().mockReturnValue({ data: mockData, error: null });

      const queries = await tracker.getPopularQueries('org_123', 10);

      expect(mockSupabase.from).toHaveBeenCalledWith('search_queries_mv');
      expect(queries).toEqual(mockData);
    });

    it('should return top queries by search count', async () => {
      const mockData = Array(20)
        .fill(null)
        .map((_, i) => ({
          query: `query ${i}`,
          search_count: 100 - i,
          avg_latency: 100,
        }));

      mockSupabase.from().limit = jest.fn().mockResolvedValue({
        data: mockData.slice(0, 10),
        error: null,
      });

      const queries = await tracker.getPopularQueries('org_123', 10);

      expect(queries).toHaveLength(10);
      expect(queries[0].search_count).toBeGreaterThan(queries[9].search_count);
    });

    it('should handle empty results', async () => {
      mockSupabase.from().limit = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const queries = await tracker.getPopularQueries('org_123', 10);

      expect(queries).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockSupabase.from().limit = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const queries = await tracker.getPopularQueries('org_123', 10);

      expect(queries).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('batch operations', () => {
    it('should batch analytics writes for performance', async () => {
      const searches = Array(100)
        .fill(null)
        .map((_, i) => ({
          org_id: 'org_123',
          user_id: 'user_123',
          query: `query ${i}`,
          result_count: i,
          latency_ms: 100 + i,
          cache_hit: i % 2 === 0,
          search_type: 'semantic' as const,
        }));

      const mockInsert = jest.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from().insert = mockInsert;

      await tracker.trackSearchBatch(searches);

      // Should insert in batches (e.g., 50 at a time)
      expect(mockInsert).toHaveBeenCalledTimes(2);
      expect(mockInsert.mock.calls[0][0]).toHaveLength(50);
      expect(mockInsert.mock.calls[1][0]).toHaveLength(50);
    });

    it('should handle partial batch failures', async () => {
      const searches = Array(10)
        .fill(null)
        .map((_, i) => ({
          org_id: 'org_123',
          user_id: 'user_123',
          query: `query ${i}`,
          result_count: i,
          latency_ms: 100,
          cache_hit: false,
          search_type: 'semantic' as const,
        }));

      const mockInsert = jest
        .fn()
        .mockResolvedValueOnce({ data: {}, error: null }) // First batch succeeds
        .mockResolvedValueOnce({ data: null, error: new Error('Batch failed') }); // Second fails

      mockSupabase.from().insert = mockInsert;

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await tracker.trackSearchBatch(searches);

      // Should log error but not throw
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('async tracking', () => {
    it('should not block search responses if analytics fails', async () => {
      const searchData = {
        org_id: 'org_123',
        user_id: 'user_123',
        query: 'test query',
        result_count: 5,
        latency_ms: 150,
        cache_hit: false,
        search_type: 'semantic' as const,
      };

      // Simulate slow analytics insert
      const mockInsert = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { data: { id: 'search_1' }, error: null };
      });
      mockSupabase.from().insert = mockInsert;

      const startTime = Date.now();

      // Track search asynchronously (don't await)
      tracker.trackSearchAsync(searchData);

      const endTime = Date.now();

      // Should return immediately (< 50ms)
      expect(endTime - startTime).toBeLessThan(50);
    });
  });
});
