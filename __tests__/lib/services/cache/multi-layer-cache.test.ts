import { MultiLayerCache } from '@/lib/services/cache/multi-layer-cache';
import { Redis } from 'ioredis';

// Mock Redis
jest.mock('ioredis');

describe('MultiLayerCache', () => {
  let cache: MultiLayerCache;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock Redis instance
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
    } as any;

    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis);

    // Create cache instance
    cache = new MultiLayerCache({
      redis: {
        host: 'localhost',
        port: 6379,
      },
      memoryTTL: 60, // 1 minute
      redisTTL: 300, // 5 minutes
    });
  });

  afterEach(async () => {
    await cache.close();
  });

  describe('get()', () => {
    it('should return cached value from memory on cache hit', async () => {
      const key = 'test:key';
      const value = { data: 'test value' };
      const sourceFn = jest.fn().mockResolvedValue(value);

      // First call - populates cache
      const result1 = await cache.get(key, sourceFn, 60);
      expect(result1).toEqual(value);
      expect(sourceFn).toHaveBeenCalledTimes(1);

      // Second call - should hit memory cache
      const result2 = await cache.get(key, sourceFn, 60);
      expect(result2).toEqual(value);
      expect(sourceFn).toHaveBeenCalledTimes(1); // Not called again
      expect(mockRedis.get).not.toHaveBeenCalled(); // Didn't need Redis
    });

    it('should fallback to Redis when memory cache misses', async () => {
      const key = 'test:key';
      const value = { data: 'test value' };
      const sourceFn = jest.fn().mockResolvedValue(value);

      // Mock Redis to return cached value
      mockRedis.get.mockResolvedValue(JSON.stringify(value));

      // Clear memory cache (simulate TTL expiration)
      cache['memoryCache'].clear();

      const result = await cache.get(key, sourceFn, 60);

      expect(result).toEqual(value);
      expect(mockRedis.get).toHaveBeenCalledWith(key);
      expect(sourceFn).not.toHaveBeenCalled(); // Source not needed
    });

    it('should fallback to source function when all caches miss', async () => {
      const key = 'test:key';
      const value = { data: 'test value' };
      const sourceFn = jest.fn().mockResolvedValue(value);

      // Mock Redis to return null (cache miss)
      mockRedis.get.mockResolvedValue(null);

      const result = await cache.get(key, sourceFn, 60);

      expect(result).toEqual(value);
      expect(mockRedis.get).toHaveBeenCalledWith(key);
      expect(sourceFn).toHaveBeenCalledTimes(1);
    });

    it('should populate memory cache after Redis hit', async () => {
      const key = 'test:key';
      const value = { data: 'test value' };
      const sourceFn = jest.fn().mockResolvedValue(value);

      // Mock Redis to return cached value
      mockRedis.get.mockResolvedValue(JSON.stringify(value));

      // First call - hits Redis, populates memory
      await cache.get(key, sourceFn, 60);
      expect(mockRedis.get).toHaveBeenCalledTimes(1);

      // Second call - should hit memory (no Redis call)
      mockRedis.get.mockClear();
      const result = await cache.get(key, sourceFn, 60);
      expect(result).toEqual(value);
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should populate both caches after source hit', async () => {
      const key = 'test:key';
      const value = { data: 'test value' };
      const sourceFn = jest.fn().mockResolvedValue(value);

      // Mock Redis cache miss
      mockRedis.get.mockResolvedValue(null);

      await cache.get(key, sourceFn, 60);

      // Verify Redis was populated
      expect(mockRedis.setex).toHaveBeenCalledWith(
        key,
        60,
        JSON.stringify(value)
      );

      // Verify memory cache was populated (by checking second call)
      mockRedis.get.mockClear();
      const result = await cache.get(key, sourceFn, 60);
      expect(result).toEqual(value);
      expect(mockRedis.get).not.toHaveBeenCalled(); // Memory hit
    });

    it('should respect TTL expiration in memory cache', async () => {
      jest.useFakeTimers();

      const key = 'test:key';
      const value = { data: 'test value' };
      const sourceFn = jest.fn().mockResolvedValue(value);

      // First call - populates cache with 5 second TTL
      await cache.get(key, sourceFn, 5);

      // Advance time by 6 seconds (past TTL)
      jest.advanceTimersByTime(6000);

      // Mock Redis to return null
      mockRedis.get.mockResolvedValue(null);

      // Second call - memory cache should be expired
      await cache.get(key, sourceFn, 5);
      expect(sourceFn).toHaveBeenCalledTimes(2); // Called again

      jest.useRealTimers();
    });

    it('should handle Redis connection errors gracefully', async () => {
      const key = 'test:key';
      const value = { data: 'test value' };
      const sourceFn = jest.fn().mockResolvedValue(value);

      // Mock Redis error
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await cache.get(key, sourceFn, 60);

      // Should fallback to source without throwing
      expect(result).toEqual(value);
      expect(sourceFn).toHaveBeenCalledTimes(1);
    });

    it('should handle source function errors', async () => {
      const key = 'test:key';
      const error = new Error('Source error');
      const sourceFn = jest.fn().mockRejectedValue(error);

      mockRedis.get.mockResolvedValue(null);

      await expect(cache.get(key, sourceFn, 60)).rejects.toThrow(error);
      expect(sourceFn).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent access without race conditions', async () => {
      const key = 'test:key';
      const value = { data: 'test value' };
      let callCount = 0;

      // Simulate slow source function
      const sourceFn = jest.fn().mockImplementation(async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 100));
        return value;
      });

      mockRedis.get.mockResolvedValue(null);

      // Make 5 concurrent requests
      const promises = Array(5)
        .fill(null)
        .map(() => cache.get(key, sourceFn, 60));

      const results = await Promise.all(promises);

      // All should return the same value
      results.forEach(result => expect(result).toEqual(value));

      // Source should only be called once (deduplication)
      expect(callCount).toBe(1);
    });

    it('should serialize/deserialize complex objects correctly', async () => {
      const key = 'test:key';
      const value = {
        string: 'test',
        number: 123,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        nested: { a: 1, b: 2 },
        date: new Date('2024-01-01').toISOString(),
      };
      const sourceFn = jest.fn().mockResolvedValue(value);

      mockRedis.get.mockResolvedValue(null);

      const result = await cache.get(key, sourceFn, 60);

      expect(result).toEqual(value);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        key,
        60,
        JSON.stringify(value)
      );
    });
  });

  describe('invalidate()', () => {
    it('should invalidate specific cache key', async () => {
      const key = 'test:key';
      const value = { data: 'test value' };
      const sourceFn = jest.fn().mockResolvedValue(value);

      // Populate cache
      await cache.get(key, sourceFn, 60);
      expect(sourceFn).toHaveBeenCalledTimes(1);

      // Invalidate
      await cache.invalidate(key);

      // Mock Redis miss after invalidation
      mockRedis.get.mockResolvedValue(null);

      // Should call source again
      await cache.get(key, sourceFn, 60);
      expect(sourceFn).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache by pattern', async () => {
      const keys = ['user:1', 'user:2', 'post:1'];
      const sourceFn = jest.fn().mockResolvedValue({ data: 'test' });

      // Populate caches
      for (const key of keys) {
        await cache.get(key, sourceFn, 60);
      }

      // Mock Redis keys method
      mockRedis.keys.mockResolvedValue(['user:1', 'user:2']);
      mockRedis.del.mockResolvedValue(2);

      // Invalidate by pattern
      await cache.invalidatePattern('user:*');

      expect(mockRedis.keys).toHaveBeenCalledWith('user:*');
      expect(mockRedis.del).toHaveBeenCalledWith('user:1', 'user:2');

      // Memory cache should also be cleared for matching keys
      // (Verify by checking cache size or subsequent gets)
    });
  });

  describe('getStats()', () => {
    it('should track cache statistics', async () => {
      const key1 = 'test:key1';
      const key2 = 'test:key2';
      const value = { data: 'test' };
      const sourceFn = jest.fn().mockResolvedValue(value);

      // First request - miss (source called)
      mockRedis.get.mockResolvedValue(null);
      await cache.get(key1, sourceFn, 60);

      // Second request - hit (memory)
      await cache.get(key1, sourceFn, 60);

      // Third request - miss (Redis error)
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      await cache.get(key2, sourceFn, 60);

      const stats = cache.getStats();

      expect(stats.memoryHits).toBe(1);
      expect(stats.memoryMisses).toBeGreaterThanOrEqual(2);
      expect(stats.redisErrors).toBe(1);
      expect(stats.sourceHits).toBeGreaterThanOrEqual(2);
    });

    it('should calculate cache hit rate', async () => {
      const key = 'test:key';
      const value = { data: 'test' };
      const sourceFn = jest.fn().mockResolvedValue(value);

      mockRedis.get.mockResolvedValue(null);

      // 1 miss, 3 hits
      await cache.get(key, sourceFn, 60);
      await cache.get(key, sourceFn, 60);
      await cache.get(key, sourceFn, 60);
      await cache.get(key, sourceFn, 60);

      const stats = cache.getStats();
      const hitRate =
        stats.memoryHits / (stats.memoryHits + stats.memoryMisses);

      expect(hitRate).toBeCloseTo(0.75, 2); // 75% hit rate
    });
  });

  describe('edge cases', () => {
    it('should handle invalid JSON in Redis cache', async () => {
      const key = 'test:key';
      const value = { data: 'test value' };
      const sourceFn = jest.fn().mockResolvedValue(value);

      // Mock Redis to return invalid JSON
      mockRedis.get.mockResolvedValue('invalid json{');

      const result = await cache.get(key, sourceFn, 60);

      // Should fallback to source
      expect(result).toEqual(value);
      expect(sourceFn).toHaveBeenCalledTimes(1);
    });

    it('should handle null values correctly', async () => {
      const key = 'test:key';
      const sourceFn = jest.fn().mockResolvedValue(null);

      mockRedis.get.mockResolvedValue(null);

      const result = await cache.get(key, sourceFn, 60);

      expect(result).toBeNull();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        key,
        60,
        JSON.stringify(null)
      );
    });

    it('should handle undefined values correctly', async () => {
      const key = 'test:key';
      const sourceFn = jest.fn().mockResolvedValue(undefined);

      mockRedis.get.mockResolvedValue(null);

      const result = await cache.get(key, sourceFn, 60);

      expect(result).toBeUndefined();
      // Undefined should not be cached (can't serialize reliably)
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should handle very large values', async () => {
      const key = 'test:key';
      const largeArray = Array(10000)
        .fill(null)
        .map((_, i) => ({ id: i, data: 'test'.repeat(100) }));
      const sourceFn = jest.fn().mockResolvedValue(largeArray);

      mockRedis.get.mockResolvedValue(null);

      const result = await cache.get(key, sourceFn, 60);

      expect(result).toEqual(largeArray);
      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  describe('close()', () => {
    it('should close Redis connection gracefully', async () => {
      await cache.close();

      expect(mockRedis.quit).toHaveBeenCalledTimes(1);
    });

    it('should handle close errors', async () => {
      mockRedis.quit.mockRejectedValue(new Error('Close error'));

      // Should not throw
      await expect(cache.close()).resolves.not.toThrow();
    });
  });
});
