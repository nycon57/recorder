import { rateLimit, rateLimiters } from '@/lib/rate-limit/limiter';
import { redis } from '@/lib/rate-limit/redis';

// Mock Redis
jest.mock('@/lib/rate-limit/redis', () => ({
  redis: {
    zremrangebyscore: jest.fn(),
    zcount: jest.fn(),
    zadd: jest.fn(),
    expire: jest.fn(),
    zrange: jest.fn(),
  },
}));

describe('Rate Limiter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rateLimit', () => {
    it('should allow request when under limit', async () => {
      (redis.zcount as jest.Mock).mockResolvedValue(5);

      const result = await rateLimit('test-user', {
        prefix: 'api:test',
        limit: 10,
        window: 60,
      });

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4); // 10 - (5 + 1)
      expect(result.limit).toBe(10);
      expect(redis.zadd).toHaveBeenCalled();
    });

    it('should block request when over limit', async () => {
      const now = Date.now();
      (redis.zcount as jest.Mock).mockResolvedValue(10);
      (redis.zrange as jest.Mock).mockResolvedValue([{ score: now - 30000 }]);

      const result = await rateLimit('test-user', {
        prefix: 'api:test',
        limit: 10,
        window: 60,
      });

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
      expect(redis.zadd).not.toHaveBeenCalled();
    });

    it('should fail open when Redis errors', async () => {
      (redis.zcount as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));

      const result = await rateLimit('test-user', {
        prefix: 'api:test',
        limit: 10,
        window: 60,
      });

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it('should clean up old entries', async () => {
      const now = Date.now();
      const windowStart = now - 60000;

      (redis.zcount as jest.Mock).mockResolvedValue(3);

      await rateLimit('test-user', {
        prefix: 'api:test',
        limit: 10,
        window: 60,
      });

      expect(redis.zremrangebyscore).toHaveBeenCalledWith(
        'ratelimit:api:test:test-user',
        0,
        expect.any(Number)
      );
    });
  });

  describe('rateLimiters presets', () => {
    it('should have api limiter with correct config', async () => {
      (redis.zcount as jest.Mock).mockResolvedValue(0);

      await rateLimiters.api('user-123');

      expect(redis.zremrangebyscore).toHaveBeenCalledWith(
        'ratelimit:api:global:user-123',
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should have search limiter with correct config', async () => {
      (redis.zcount as jest.Mock).mockResolvedValue(0);

      await rateLimiters.search('user-123');

      expect(redis.zremrangebyscore).toHaveBeenCalledWith(
        'ratelimit:api:search:user-123',
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should have upload limiter with org-scoped config', async () => {
      (redis.zcount as jest.Mock).mockResolvedValue(0);

      await rateLimiters.upload('org-456');

      expect(redis.zremrangebyscore).toHaveBeenCalledWith(
        'ratelimit:api:upload:org-456',
        expect.any(Number),
        expect.any(Number)
      );
    });
  });
});
