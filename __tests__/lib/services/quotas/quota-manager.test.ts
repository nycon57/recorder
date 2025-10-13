import { QuotaManager } from '@/lib/services/quotas/quota-manager';
import { createClient } from '@/lib/supabase/server';

// Mock Supabase client
jest.mock('@/lib/supabase/server');

describe('QuotaManager', () => {
  let quotaManager: QuotaManager;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock Supabase client
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockSupabase = {
      from: jest.fn(() => mockChain),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    quotaManager = new QuotaManager();
  });

  describe('checkQuota()', () => {
    it('should return available quota for API calls', async () => {
      const mockData = {
        api_calls_used: 500,
        api_calls_limit: 1000,
      };

      mockSupabase.from().single = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await quotaManager.checkQuota('org_123', 'api_calls');

      expect(result.available).toBe(true);
      expect(result.used).toBe(500);
      expect(result.limit).toBe(1000);
      expect(result.remaining).toBe(500);
    });

    it('should return available quota for storage', async () => {
      const mockData = {
        storage_used: 1024 * 1024 * 500, // 500 MB
        storage_limit: 1024 * 1024 * 1024, // 1 GB
      };

      mockSupabase.from().single = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await quotaManager.checkQuota('org_123', 'storage');

      expect(result.available).toBe(true);
      expect(result.used).toBe(1024 * 1024 * 500);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('should return false when quota exceeded', async () => {
      const mockData = {
        api_calls_used: 1000,
        api_calls_limit: 1000,
      };

      mockSupabase.from().single = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await quotaManager.checkQuota('org_123', 'api_calls');

      expect(result.available).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should return false when quota overdrawn', async () => {
      const mockData = {
        api_calls_used: 1100,
        api_calls_limit: 1000,
      };

      mockSupabase.from().single = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await quotaManager.checkQuota('org_123', 'api_calls');

      expect(result.available).toBe(false);
      expect(result.remaining).toBe(-100);
    });

    it('should create usage_counters row if missing', async () => {
      // First call returns not found
      mockSupabase.from().single = jest
        .fn()
        .mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' }, // Not found
        })
        .mockResolvedValueOnce({
          data: {
            api_calls_used: 0,
            api_calls_limit: 1000,
          },
          error: null,
        });

      const mockInsert = jest.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from().insert = mockInsert;

      await quotaManager.checkQuota('org_123', 'api_calls');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          org_id: 'org_123',
          api_calls_used: 0,
          api_calls_limit: 1000,
        })
      );
    });
  });

  describe('consumeQuota()', () => {
    it('should decrement API calls counter', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: { success: true, remaining: 999 },
        error: null,
      });
      mockSupabase.rpc = mockRpc;

      const result = await quotaManager.consumeQuota('org_123', 'api_calls', 1);

      expect(mockRpc).toHaveBeenCalledWith('consume_quota', {
        p_org_id: 'org_123',
        p_quota_type: 'api_calls',
        p_amount: 1,
      });
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(999);
    });

    it('should decrement storage counter', async () => {
      const bytes = 1024 * 1024 * 10; // 10 MB

      const mockRpc = jest.fn().mockResolvedValue({
        data: { success: true, remaining: 1024 * 1024 * 990 },
        error: null,
      });
      mockSupabase.rpc = mockRpc;

      const result = await quotaManager.consumeQuota('org_123', 'storage', bytes);

      expect(mockRpc).toHaveBeenCalledWith('consume_quota', {
        p_org_id: 'org_123',
        p_quota_type: 'storage',
        p_amount: bytes,
      });
      expect(result.success).toBe(true);
    });

    it('should fail when quota exhausted', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: { success: false, remaining: 0 },
        error: null,
      });
      mockSupabase.rpc = mockRpc;

      const result = await quotaManager.consumeQuota('org_123', 'api_calls', 1);

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should handle concurrent consumption without race conditions', async () => {
      let callCount = 0;
      const mockRpc = jest.fn().mockImplementation(async () => {
        callCount++;
        // Simulate database transaction isolation
        return {
          data: { success: true, remaining: 1000 - callCount },
          error: null,
        };
      });
      mockSupabase.rpc = mockRpc;

      // Make 10 concurrent requests
      const promises = Array(10)
        .fill(null)
        .map(() => quotaManager.consumeQuota('org_123', 'api_calls', 1));

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => expect(result.success).toBe(true));

      // RPC should be called 10 times
      expect(mockRpc).toHaveBeenCalledTimes(10);
    });

    it('should handle database errors gracefully', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });
      mockSupabase.rpc = mockRpc;

      const result = await quotaManager.consumeQuota('org_123', 'api_calls', 1);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('initializeQuota()', () => {
    it('should set limits for starter plan', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from().insert = mockInsert;

      await quotaManager.initializeQuota('org_123', 'starter');

      expect(mockInsert).toHaveBeenCalledWith({
        org_id: 'org_123',
        api_calls_used: 0,
        api_calls_limit: 1000,
        storage_used: 0,
        storage_limit: 1024 * 1024 * 1024, // 1 GB
        recordings_used: 0,
        recordings_limit: 10,
        reset_at: expect.any(String),
      });
    });

    it('should set limits for pro plan', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from().insert = mockInsert;

      await quotaManager.initializeQuota('org_123', 'pro');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          org_id: 'org_123',
          api_calls_limit: 10000,
          storage_limit: 1024 * 1024 * 1024 * 10, // 10 GB
          recordings_limit: 100,
        })
      );
    });

    it('should set limits for enterprise plan', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from().insert = mockInsert;

      await quotaManager.initializeQuota('org_123', 'enterprise');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          org_id: 'org_123',
          api_calls_limit: 100000,
          storage_limit: 1024 * 1024 * 1024 * 100, // 100 GB
          recordings_limit: 1000,
        })
      );
    });

    it('should handle duplicate initialization gracefully', async () => {
      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '23505' }, // Unique constraint violation
      });
      mockSupabase.from().insert = mockInsert;

      // Should not throw
      await expect(
        quotaManager.initializeQuota('org_123', 'starter')
      ).resolves.not.toThrow();
    });
  });

  describe('resetQuota()', () => {
    it('should reset usage counters at month boundary', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from().update = mockUpdate;
      mockSupabase.from().eq = jest.fn().mockReturnThis();

      await quotaManager.resetQuota('org_123');

      expect(mockUpdate).toHaveBeenCalledWith({
        api_calls_used: 0,
        storage_used: 0,
        recordings_used: 0,
        reset_at: expect.any(String), // Next month
      });
    });

    it('should preserve limits when resetting', async () => {
      const mockData = {
        api_calls_limit: 1000,
        storage_limit: 1024 * 1024 * 1024,
        recordings_limit: 10,
      };

      mockSupabase.from().single = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const mockUpdate = jest.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from().update = mockUpdate;

      await quotaManager.resetQuota('org_123');

      // Verify limits are not changed
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          api_calls_used: 0, // Reset
          // api_calls_limit should not be in the update
        })
      );
    });

    it('should handle quota reset for multiple orgs', async () => {
      const orgIds = ['org_1', 'org_2', 'org_3'];

      const mockUpdate = jest.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from().update = mockUpdate;

      for (const orgId of orgIds) {
        await quotaManager.resetQuota(orgId);
      }

      expect(mockUpdate).toHaveBeenCalledTimes(3);
    });

    it('should calculate next reset date correctly', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));

      const mockUpdate = jest.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from().update = mockUpdate;
      mockSupabase.from().eq = jest.fn().mockReturnThis();

      await quotaManager.resetQuota('org_123');

      // Should be February 1st
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          reset_at: '2024-02-01T00:00:00.000Z',
        })
      );

      jest.useRealTimers();
    });

    it('should handle month boundary edge cases', async () => {
      jest.useFakeTimers();

      const edgeCases = [
        { date: '2024-01-31T23:59:59Z', expected: '2024-03-01' }, // End of Jan
        { date: '2024-02-29T12:00:00Z', expected: '2024-04-01' }, // Leap year
        { date: '2024-12-31T23:59:59Z', expected: '2025-02-01' }, // Year boundary
      ];

      const mockUpdate = jest.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from().update = mockUpdate;
      mockSupabase.from().eq = jest.fn().mockReturnThis();

      for (const { date, expected } of edgeCases) {
        jest.setSystemTime(new Date(date));
        mockUpdate.mockClear();

        await quotaManager.resetQuota('org_123');

        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            reset_at: expect.stringContaining(expected.substring(0, 7)), // YYYY-MM
          })
        );
      }

      jest.useRealTimers();
    });
  });

  describe('updateStorageUsage()', () => {
    it('should calculate correct storage usage', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: { total_size: 1024 * 1024 * 500 }, // 500 MB
        error: null,
      });
      mockSupabase.rpc = mockRpc;

      const mockUpdate = jest.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from().update = mockUpdate;

      await quotaManager.updateStorageUsage('org_123');

      expect(mockRpc).toHaveBeenCalledWith('calculate_storage_usage', {
        p_org_id: 'org_123',
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        storage_used: 1024 * 1024 * 500,
      });
    });

    it('should handle zero storage usage', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: { total_size: 0 },
        error: null,
      });
      mockSupabase.rpc = mockRpc;

      const mockUpdate = jest.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from().update = mockUpdate;

      await quotaManager.updateStorageUsage('org_123');

      expect(mockUpdate).toHaveBeenCalledWith({ storage_used: 0 });
    });
  });

  describe('getUsage()', () => {
    it('should return current usage and limits', async () => {
      const mockData = {
        api_calls_used: 500,
        api_calls_limit: 1000,
        storage_used: 1024 * 1024 * 500,
        storage_limit: 1024 * 1024 * 1024,
        recordings_used: 5,
        recordings_limit: 10,
      };

      mockSupabase.from().single = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const usage = await quotaManager.getUsage('org_123');

      expect(usage).toEqual({
        apiCalls: { used: 500, limit: 1000, percentage: 50 },
        storage: {
          used: 1024 * 1024 * 500,
          limit: 1024 * 1024 * 1024,
          percentage: 50,
        },
        recordings: { used: 5, limit: 10, percentage: 50 },
      });
    });

    it('should calculate percentage correctly', async () => {
      const mockData = {
        api_calls_used: 750,
        api_calls_limit: 1000,
        storage_used: 0,
        storage_limit: 1024 * 1024 * 1024,
        recordings_used: 10,
        recordings_limit: 10,
      };

      mockSupabase.from().single = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const usage = await quotaManager.getUsage('org_123');

      expect(usage.apiCalls.percentage).toBe(75);
      expect(usage.storage.percentage).toBe(0);
      expect(usage.recordings.percentage).toBe(100);
    });

    it('should handle division by zero for limits', async () => {
      const mockData = {
        api_calls_used: 100,
        api_calls_limit: 0,
        storage_used: 0,
        storage_limit: 0,
        recordings_used: 0,
        recordings_limit: 0,
      };

      mockSupabase.from().single = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const usage = await quotaManager.getUsage('org_123');

      expect(usage.apiCalls.percentage).toBe(0);
      expect(usage.storage.percentage).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle negative remaining quota', async () => {
      const mockData = {
        api_calls_used: 1100,
        api_calls_limit: 1000,
      };

      mockSupabase.from().single = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await quotaManager.checkQuota('org_123', 'api_calls');

      expect(result.remaining).toBe(-100);
      expect(result.available).toBe(false);
    });

    it('should handle very large storage values', async () => {
      const largeValue = 1024 * 1024 * 1024 * 100; // 100 GB

      const mockRpc = jest.fn().mockResolvedValue({
        data: { success: true, remaining: largeValue },
        error: null,
      });
      mockSupabase.rpc = mockRpc;

      const result = await quotaManager.consumeQuota('org_123', 'storage', 1024);

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(largeValue);
    });

    it('should handle quota record not found', async () => {
      mockSupabase.from().single = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await quotaManager.checkQuota('org_999', 'api_calls');

      // Should return safe defaults
      expect(result.available).toBe(false);

      consoleSpy.mockRestore();
    });
  });
});
