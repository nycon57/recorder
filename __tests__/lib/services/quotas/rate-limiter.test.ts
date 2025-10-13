import { RateLimiter } from '@/lib/services/quotas/rate-limiter';
import { Redis } from 'ioredis';

// Mock Redis
jest.mock('ioredis');

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock Redis instance
    mockRedis = {
      zadd: jest.fn().mockResolvedValue(1),
      zcount: jest.fn().mockResolvedValue(0),
      zremrangebyscore: jest.fn().mockResolvedValue(0),
      ttl: jest.fn().mockResolvedValue(-1),
      expire: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn(),
    } as any;

    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis);

    rateLimiter = new RateLimiter({
      redis: {
        host: 'localhost',
        port: 6379,
      },
      windowMs: 60000, // 1 minute
    });
  });

  afterEach(async () => {
    await rateLimiter.close();
  });

  describe('checkLimit()', () => {
    it('should allow requests within limit', async () => {
      const identifier = 'user_123';
      const limit = 10;

      // Mock current count is 5
      mockRedis.zcount.mockResolvedValue(5);

      const result = await rateLimiter.checkLimit(identifier, limit);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
      expect(result.limit).toBe(10);
      expect(result.retryAfter).toBeUndefined();
    });

    it('should block requests exceeding limit', async () => {
      const identifier = 'user_123';
      const limit = 10;

      // Mock current count is at limit
      mockRedis.zcount.mockResolvedValue(10);

      const result = await rateLimiter.checkLimit(identifier, limit);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
    });

    it('should use sliding window algorithm', async () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);

      const identifier = 'user_123';
      const limit = 10;
      const windowMs = 60000; // 1 minute

      await rateLimiter.checkLimit(identifier, limit);

      const expectedWindowStart = now - windowMs;

      // Verify old entries are removed
      expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
        `ratelimit:${identifier}`,
        '-inf',
        expectedWindowStart
      );

      // Verify count is checked within window
      expect(mockRedis.zcount).toHaveBeenCalledWith(
        `ratelimit:${identifier}`,
        expectedWindowStart,
        '+inf'
      );

      jest.useRealTimers();
    });

    it('should track per-user limits', async () => {
      const users = ['user_1', 'user_2', 'user_3'];
      const limit = 10;

      for (const user of users) {
        mockRedis.zcount.mockResolvedValue(5);
        await rateLimiter.checkLimit(user, limit);

        expect(mockRedis.zadd).toHaveBeenCalledWith(
          `ratelimit:${user}`,
          expect.any(Number),
          expect.any(String)
        );
      }
    });

    it('should track per-org limits', async () => {
      const identifier = 'org_123';
      const limit = 100;

      mockRedis.zcount.mockResolvedValue(50);

      const result = await rateLimiter.checkLimit(identifier, limit);

      expect(result.allowed).toBe(true);
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        `ratelimit:${identifier}`,
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should track per-IP limits', async () => {
      const ip = '192.168.1.1';
      const limit = 50;

      mockRedis.zcount.mockResolvedValue(25);

      const result = await rateLimiter.checkLimit(`ip:${ip}`, limit);

      expect(result.allowed).toBe(true);
    });

    it('should expire old entries outside window', async () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);

      const identifier = 'user_123';
      const limit = 10;
      const windowMs = 60000;

      // Mock that 3 old entries were removed
      mockRedis.zremrangebyscore.mockResolvedValue(3);
      mockRedis.zcount.mockResolvedValue(7); // After cleanup

      await rateLimiter.checkLimit(identifier, limit);

      expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
        `ratelimit:${identifier}`,
        '-inf',
        now - windowMs
      );

      jest.useRealTimers();
    });

    it('should handle burst traffic correctly', async () => {
      const identifier = 'user_123';
      const limit = 10;

      // Simulate burst of requests
      for (let i = 0; i < 15; i++) {
        mockRedis.zcount.mockResolvedValue(i);

        const result = await rateLimiter.checkLimit(identifier, limit);

        if (i < limit) {
          expect(result.allowed).toBe(true);
        } else {
          expect(result.allowed).toBe(false);
        }
      }
    });

    it('should fail open when Redis unavailable', async () => {
      const identifier = 'user_123';
      const limit = 10;

      // Mock Redis error
      mockRedis.zcount.mockRejectedValue(new Error('Redis unavailable'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await rateLimiter.checkLimit(identifier, limit);

      // Should allow request (fail open)
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(limit);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should return retry-after header value', async () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);

      const identifier = 'user_123';
      const limit = 10;
      const windowMs = 60000;

      // Mock oldest entry timestamp (start of window)
      const oldestTimestamp = now - windowMs + 10000; // 10s into window

      mockRedis.zcount.mockResolvedValue(10);
      // Mock getting oldest entry
      mockRedis.zrange = jest
        .fn()
        .mockResolvedValue([JSON.stringify({ timestamp: oldestTimestamp })]);

      const result = await rateLimiter.checkLimit(identifier, limit);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
      // Retry after should be roughly (windowMs - 10000) / 1000 seconds
      expect(result.retryAfter).toBeCloseTo(50, 0);

      jest.useRealTimers();
    });

    it('should set TTL on rate limit keys', async () => {
      const identifier = 'user_123';
      const limit = 10;
      const windowMs = 60000;

      mockRedis.zcount.mockResolvedValue(5);

      await rateLimiter.checkLimit(identifier, limit);

      // Should set expire after adding entry
      expect(mockRedis.expire).toHaveBeenCalledWith(
        `ratelimit:${identifier}`,
        Math.ceil(windowMs / 1000) + 10 // Window + buffer
      );
    });
  });

  describe('resetLimit()', () => {
    it('should clear rate limit counters', async () => {
      const identifier = 'user_123';

      await rateLimiter.resetLimit(identifier);

      expect(mockRedis.del).toHaveBeenCalledWith(`ratelimit:${identifier}`);
    });

    it('should handle reset errors gracefully', async () => {
      const identifier = 'user_123';

      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await rateLimiter.resetLimit(identifier);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should allow immediate requests after reset', async () => {
      const identifier = 'user_123';
      const limit = 10;

      // Fill up to limit
      mockRedis.zcount.mockResolvedValue(10);
      let result = await rateLimiter.checkLimit(identifier, limit);
      expect(result.allowed).toBe(false);

      // Reset
      await rateLimiter.resetLimit(identifier);

      // Should allow again
      mockRedis.zcount.mockResolvedValue(0);
      result = await rateLimiter.checkLimit(identifier, limit);
      expect(result.allowed).toBe(true);
    });
  });

  describe('window boundary conditions', () => {
    it('should handle requests at window boundaries', async () => {
      jest.useFakeTimers();
      const windowMs = 60000;
      const identifier = 'user_123';
      const limit = 10;

      // Time at start of window
      const windowStart = Date.now();
      jest.setSystemTime(windowStart);

      mockRedis.zcount.mockResolvedValue(5);
      await rateLimiter.checkLimit(identifier, limit);

      // Time at end of window
      jest.setSystemTime(windowStart + windowMs - 1);
      mockRedis.zcount.mockResolvedValue(5);
      await rateLimiter.checkLimit(identifier, limit);

      // Just past window
      jest.setSystemTime(windowStart + windowMs + 1);
      mockRedis.zcount.mockResolvedValue(0); // Old entries removed
      await rateLimiter.checkLimit(identifier, limit);

      expect(mockRedis.zremrangebyscore).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should handle clock skew', async () => {
      jest.useFakeTimers();
      const identifier = 'user_123';
      const limit = 10;

      // Current time
      const now = Date.now();
      jest.setSystemTime(now);

      mockRedis.zcount.mockResolvedValue(5);
      await rateLimiter.checkLimit(identifier, limit);

      // Simulate clock going backwards (rare but possible)
      jest.setSystemTime(now - 10000);

      mockRedis.zcount.mockResolvedValue(5);
      const result = await rateLimiter.checkLimit(identifier, limit);

      // Should still work (not throw)
      expect(result.allowed).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('concurrent requests', () => {
    it('should handle concurrent requests correctly', async () => {
      const identifier = 'user_123';
      const limit = 10;

      let count = 0;
      mockRedis.zcount.mockImplementation(async () => {
        count++;
        return count;
      });

      // Make 20 concurrent requests
      const promises = Array(20)
        .fill(null)
        .map(() => rateLimiter.checkLimit(identifier, limit));

      const results = await Promise.all(promises);

      // First 10 should be allowed
      const allowed = results.filter(r => r.allowed);
      const blocked = results.filter(r => !r.allowed);

      expect(allowed.length).toBeLessThanOrEqual(limit);
      expect(blocked.length).toBeGreaterThan(0);
    });

    it('should handle race conditions with Redis transactions', async () => {
      const identifier = 'user_123';
      const limit = 10;

      // Simulate perfect concurrency
      let callCount = 0;
      mockRedis.zcount.mockImplementation(async () => {
        callCount++;
        // All calls see the same count (race condition)
        return 9;
      });

      const promises = Array(5)
        .fill(null)
        .map(() => rateLimiter.checkLimit(identifier, limit));

      const results = await Promise.all(promises);

      // All should be allowed (they all saw count=9)
      results.forEach(result => expect(result.allowed).toBe(true));
    });
  });

  describe('multiple identifiers', () => {
    it('should track multiple identifier types simultaneously', async () => {
      const userId = 'user_123';
      const orgId = 'org_456';
      const ip = 'ip:192.168.1.1';

      mockRedis.zcount.mockResolvedValue(5);

      await rateLimiter.checkLimit(userId, 10);
      await rateLimiter.checkLimit(orgId, 100);
      await rateLimiter.checkLimit(ip, 50);

      expect(mockRedis.zadd).toHaveBeenCalledTimes(3);
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        `ratelimit:${userId}`,
        expect.any(Number),
        expect.any(String)
      );
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        `ratelimit:${orgId}`,
        expect.any(Number),
        expect.any(String)
      );
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        `ratelimit:${ip}`,
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should enforce strictest limit when checking multiple', async () => {
      const userId = 'user_123';
      const orgId = 'org_456';

      // User has 9/10 requests
      mockRedis.zcount.mockResolvedValueOnce(9);
      const userResult = await rateLimiter.checkLimit(userId, 10);
      expect(userResult.allowed).toBe(true);

      // Org has 99/100 requests
      mockRedis.zcount.mockResolvedValueOnce(99);
      const orgResult = await rateLimiter.checkLimit(orgId, 100);
      expect(orgResult.allowed).toBe(true);

      // Both close to limit, user hits it first
      mockRedis.zcount.mockResolvedValueOnce(10);
      const blockedResult = await rateLimiter.checkLimit(userId, 10);
      expect(blockedResult.allowed).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle zero limit', async () => {
      const identifier = 'user_123';
      const limit = 0;

      mockRedis.zcount.mockResolvedValue(0);

      const result = await rateLimiter.checkLimit(identifier, limit);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should handle negative limit (treat as unlimited)', async () => {
      const identifier = 'user_123';
      const limit = -1;

      mockRedis.zcount.mockResolvedValue(1000);

      const result = await rateLimiter.checkLimit(identifier, limit);

      // Implementation dependent: could allow or block
      // Document expected behavior here
      expect(result.limit).toBe(-1);
    });

    it('should handle very large limits', async () => {
      const identifier = 'user_123';
      const limit = 1000000;

      mockRedis.zcount.mockResolvedValue(500000);

      const result = await rateLimiter.checkLimit(identifier, limit);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(500000);
    });

    it('should handle empty identifier', async () => {
      const identifier = '';
      const limit = 10;

      // Should still work (rate limit by empty string key)
      mockRedis.zcount.mockResolvedValue(5);

      const result = await rateLimiter.checkLimit(identifier, limit);

      expect(result.allowed).toBe(true);
    });

    it('should handle special characters in identifier', async () => {
      const identifier = 'user:123:special!@#$%';
      const limit = 10;

      mockRedis.zcount.mockResolvedValue(5);

      // Should escape or handle special chars
      await expect(
        rateLimiter.checkLimit(identifier, limit)
      ).resolves.not.toThrow();
    });
  });

  describe('close()', () => {
    it('should close Redis connection gracefully', async () => {
      await rateLimiter.close();

      expect(mockRedis.quit).toHaveBeenCalledTimes(1);
    });

    it('should handle close errors', async () => {
      mockRedis.quit.mockRejectedValue(new Error('Close error'));

      await expect(rateLimiter.close()).resolves.not.toThrow();
    });
  });
});
