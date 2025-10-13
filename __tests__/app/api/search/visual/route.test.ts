/**
 * Visual Search API Route Unit Tests
 *
 * Tests POST endpoint for visual frame search including:
 * - Query processing and validation
 * - Rate limiting
 * - Organization isolation
 * - Feature flag handling
 * - Authentication and authorization
 * - Error handling
 * - Response formatting
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/search/visual/route';
import { visualSearch, isVisualSearchEnabled } from '@/lib/services/multimodal-search';

// Mock dependencies
jest.mock('@/lib/utils/api', () => ({
  apiHandler: jest.fn((handler) => handler),
  requireOrg: jest.fn(),
  successResponse: jest.fn((data) => ({
    status: 200,
    json: async () => ({ data }),
  })),
  parseBody: jest.fn(),
  errors: {
    badRequest: jest.fn((message) => ({
      status: 400,
      json: async () => ({ error: message }),
    })),
    unauthorized: jest.fn(() => ({
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    })),
  },
}));

jest.mock('@/lib/services/multimodal-search');

jest.mock('@/lib/rate-limit/middleware', () => ({
  withRateLimit: jest.fn((handler) => handler),
}));

describe('Visual Search API Route', () => {
  const mockOrgId = 'test-org-123';
  const mockUserId = 'test-user-456';

  const mockSearchResults = [
    {
      id: 'frame-1',
      recordingId: 'rec-1',
      frameTimeSec: 5.5,
      frameUrl: 'https://storage.supabase.co/signed/frame_0001.jpg',
      visualDescription: 'Code editor showing React component',
      ocrText: 'function MyComponent() { return <div>Hello</div>; }',
      similarity: 0.92,
      metadata: { confidence: 0.95 },
      recording: {
        id: 'rec-1',
        title: 'React Tutorial',
        duration_sec: 120,
        created_at: '2025-01-01T00:00:00Z',
      },
    },
    {
      id: 'frame-2',
      recordingId: 'rec-2',
      frameTimeSec: 12.0,
      frameUrl: 'https://storage.supabase.co/signed/frame_0002.jpg',
      visualDescription: 'Browser displaying React application',
      ocrText: 'Hello World',
      similarity: 0.88,
      metadata: { confidence: 0.90 },
      recording: {
        id: 'rec-2',
        title: 'React Demo',
        duration_sec: 60,
        created_at: '2025-01-02T00:00:00Z',
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    const { requireOrg, parseBody } = require('@/lib/utils/api');
    requireOrg.mockResolvedValue({ orgId: mockOrgId, userId: mockUserId });
    parseBody.mockResolvedValue({
      query: 'React component example',
      limit: 20,
      threshold: 0.7,
      includeOcr: true,
    });

    (isVisualSearchEnabled as jest.Mock).mockReturnValue(true);
    (visualSearch as jest.Mock).mockResolvedValue(mockSearchResults);
  });

  describe('POST /api/search/visual', () => {
    it('should perform visual search successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({
          query: 'React component example',
          limit: 20,
          threshold: 0.7,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(visualSearch).toHaveBeenCalledWith(
        'React component example',
        expect.objectContaining({
          orgId: mockOrgId,
          limit: 20,
          threshold: 0.7,
        })
      );

      expect(data.data.results).toHaveLength(2);
      expect(data.data.count).toBe(2);
      expect(data.data.mode).toBe('visual');
    });

    it('should validate request body', async () => {
      const { parseBody } = require('@/lib/utils/api');
      const { visualSearchSchema } = require('@/lib/validations/api');

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      await POST(request);

      expect(parseBody).toHaveBeenCalledWith(request, visualSearchSchema);
    });

    it('should require authentication', async () => {
      const { requireOrg } = require('@/lib/utils/api');
      requireOrg.mockRejectedValueOnce(new Error('Unauthorized'));

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      await expect(POST(request)).rejects.toThrow('Unauthorized');
    });

    it('should enforce organization isolation', async () => {
      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test query' }),
      });

      await POST(request);

      expect(visualSearch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          orgId: mockOrgId,
        })
      );
    });

    it('should use default parameters when not provided', async () => {
      const { parseBody } = require('@/lib/utils/api');
      parseBody.mockResolvedValueOnce({
        query: 'test',
        limit: 20,
        threshold: 0.7,
        includeOcr: true,
      });

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      await POST(request);

      expect(visualSearch).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          limit: 20,
          threshold: 0.7,
        })
      );
    });

    it('should respect custom limit parameter', async () => {
      const { parseBody } = require('@/lib/utils/api');
      parseBody.mockResolvedValueOnce({
        query: 'test',
        limit: 10,
        threshold: 0.7,
        includeOcr: true,
      });

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test', limit: 10 }),
      });

      await POST(request);

      expect(visualSearch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ limit: 10 })
      );
    });

    it('should respect custom threshold parameter', async () => {
      const { parseBody } = require('@/lib/utils/api');
      parseBody.mockResolvedValueOnce({
        query: 'test',
        limit: 20,
        threshold: 0.8,
        includeOcr: true,
      });

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test', threshold: 0.8 }),
      });

      await POST(request);

      expect(visualSearch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ threshold: 0.8 })
      );
    });

    it('should filter by recording IDs when provided', async () => {
      const recordingIds = ['rec-1', 'rec-2', 'rec-3'];
      const { parseBody } = require('@/lib/utils/api');
      parseBody.mockResolvedValueOnce({
        query: 'test',
        recordingIds,
        limit: 20,
        threshold: 0.7,
        includeOcr: true,
      });

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test', recordingIds }),
      });

      await POST(request);

      expect(visualSearch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ recordingIds })
      );
    });

    it('should filter by date range when provided', async () => {
      const dateFrom = '2025-01-01T00:00:00Z';
      const dateTo = '2025-01-31T23:59:59Z';

      const { parseBody } = require('@/lib/utils/api');
      parseBody.mockResolvedValueOnce({
        query: 'test',
        dateFrom,
        dateTo,
        limit: 20,
        threshold: 0.7,
        includeOcr: true,
      });

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test', dateFrom, dateTo }),
      });

      await POST(request);

      expect(visualSearch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          dateFrom: new Date(dateFrom),
          dateTo: new Date(dateTo),
        })
      );
    });

    it('should include OCR text by default', async () => {
      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      await POST(request);

      expect(visualSearch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ includeOcr: true })
      );
    });

    it('should exclude OCR text when requested', async () => {
      const { parseBody } = require('@/lib/utils/api');
      parseBody.mockResolvedValueOnce({
        query: 'test',
        limit: 20,
        threshold: 0.7,
        includeOcr: false,
      });

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test', includeOcr: false }),
      });

      await POST(request);

      expect(visualSearch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ includeOcr: false })
      );
    });

    it('should return empty results when visual search is disabled', async () => {
      (isVisualSearchEnabled as jest.Mock).mockReturnValueOnce(false);

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.results).toHaveLength(0);
      expect(data.data.message).toContain('disabled');
      expect(visualSearch).not.toHaveBeenCalled();
    });

    it('should include search timing metadata', async () => {
      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.timings).toBeDefined();
      expect(data.data.timings.searchMs).toBeGreaterThanOrEqual(0);
    });

    it('should include request metadata', async () => {
      const { parseBody } = require('@/lib/utils/api');
      parseBody.mockResolvedValueOnce({
        query: 'test',
        limit: 15,
        threshold: 0.75,
        includeOcr: false,
        recordingIds: ['rec-1'],
      });

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({
          query: 'test',
          limit: 15,
          threshold: 0.75,
          recordingIds: ['rec-1'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.metadata).toMatchObject({
        threshold: 0.75,
        includeOcr: false,
        recordingIdsFilter: 1,
      });
    });

    it('should handle empty results', async () => {
      (visualSearch as jest.Mock).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'nonexistent query' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.results).toHaveLength(0);
      expect(data.data.count).toBe(0);
    });

    it('should handle search errors', async () => {
      (visualSearch as jest.Mock).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      await expect(POST(request)).rejects.toThrow('Database connection failed');
    });

    it('should truncate query in logs for long queries', async () => {
      const longQuery = 'a'.repeat(100);
      const { parseBody } = require('@/lib/utils/api');
      parseBody.mockResolvedValueOnce({
        query: longQuery,
        limit: 20,
        threshold: 0.7,
        includeOcr: true,
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: longQuery }),
      });

      await POST(request);

      // Verify query was truncated in logs
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Visual Search API]'),
        expect.objectContaining({
          query: expect.stringWithLength(50),
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('rate limiting', () => {
    it('should apply rate limiting', async () => {
      const { withRateLimit } = require('@/lib/rate-limit/middleware');

      expect(withRateLimit).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          limiter: 'search',
        })
      );
    });

    it('should use user ID for rate limit key', async () => {
      const { withRateLimit } = require('@/lib/rate-limit/middleware');
      const rateLimitConfig = withRateLimit.mock.calls[0][1];

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
      });

      const identifier = await rateLimitConfig.identifier(request);

      expect(identifier).toBe(mockUserId);
    });
  });

  describe('query validation', () => {
    it('should reject empty query', async () => {
      const { parseBody } = require('@/lib/utils/api');
      parseBody.mockRejectedValueOnce(new Error('Query is required'));

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: '' }),
      });

      await expect(POST(request)).rejects.toThrow('Query is required');
    });

    it('should reject query exceeding max length', async () => {
      const { parseBody } = require('@/lib/utils/api');
      parseBody.mockRejectedValueOnce(new Error('Query too long'));

      const longQuery = 'a'.repeat(501);
      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: longQuery }),
      });

      await expect(POST(request)).rejects.toThrow('Query too long');
    });

    it('should validate limit is within bounds', async () => {
      const { parseBody } = require('@/lib/utils/api');
      parseBody.mockRejectedValueOnce(new Error('Limit must be between 1 and 100'));

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test', limit: 101 }),
      });

      await expect(POST(request)).rejects.toThrow();
    });

    it('should validate threshold is between 0 and 1', async () => {
      const { parseBody } = require('@/lib/utils/api');
      parseBody.mockRejectedValueOnce(
        new Error('Threshold must be between 0 and 1')
      );

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test', threshold: 1.5 }),
      });

      await expect(POST(request)).rejects.toThrow();
    });

    it('should validate recording IDs are UUIDs', async () => {
      const { parseBody } = require('@/lib/utils/api');
      parseBody.mockRejectedValueOnce(new Error('Invalid UUID'));

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({
          query: 'test',
          recordingIds: ['not-a-uuid'],
        }),
      });

      await expect(POST(request)).rejects.toThrow('Invalid UUID');
    });

    it('should validate date formats', async () => {
      const { parseBody } = require('@/lib/utils/api');
      parseBody.mockRejectedValueOnce(new Error('Invalid datetime'));

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({
          query: 'test',
          dateFrom: 'not-a-date',
        }),
      });

      await expect(POST(request)).rejects.toThrow('Invalid datetime');
    });
  });

  describe('response formatting', () => {
    it('should include all required fields in response', async () => {
      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data).toMatchObject({
        query: expect.any(String),
        results: expect.any(Array),
        count: expect.any(Number),
        mode: 'visual',
        timings: expect.any(Object),
        metadata: expect.any(Object),
      });
    });

    it('should format frame results correctly', async () => {
      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.results[0]).toMatchObject({
        id: expect.any(String),
        recordingId: expect.any(String),
        frameTimeSec: expect.any(Number),
        frameUrl: expect.any(String),
        visualDescription: expect.any(String),
        similarity: expect.any(Number),
        metadata: expect.any(Object),
        recording: expect.objectContaining({
          id: expect.any(String),
          title: expect.any(String),
        }),
      });
    });
  });

  describe('performance', () => {
    it('should complete search in reasonable time', async () => {
      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      const startTime = Date.now();
      await POST(request);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
    });

    it('should handle large result sets efficiently', async () => {
      const manyResults = Array.from({ length: 100 }, (_, i) => ({
        ...mockSearchResults[0],
        id: `frame-${i}`,
        similarity: 0.9 - i * 0.001,
      }));

      (visualSearch as jest.Mock).mockResolvedValueOnce(manyResults);

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test', limit: 100 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.results).toHaveLength(100);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in query', async () => {
      const specialQuery = 'How to use @decorators & {props} in [React]?';
      const { parseBody } = require('@/lib/utils/api');
      parseBody.mockResolvedValueOnce({
        query: specialQuery,
        limit: 20,
        threshold: 0.7,
        includeOcr: true,
      });

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: specialQuery }),
      });

      await POST(request);

      expect(visualSearch).toHaveBeenCalledWith(specialQuery, expect.any(Object));
    });

    it('should handle Unicode characters in query', async () => {
      const unicodeQuery = 'React コンポーネント 🚀';
      const { parseBody } = require('@/lib/utils/api');
      parseBody.mockResolvedValueOnce({
        query: unicodeQuery,
        limit: 20,
        threshold: 0.7,
        includeOcr: true,
      });

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: unicodeQuery }),
      });

      await POST(request);

      expect(visualSearch).toHaveBeenCalledWith(unicodeQuery, expect.any(Object));
    });

    it('should handle empty recording IDs array', async () => {
      const { parseBody } = require('@/lib/utils/api');
      parseBody.mockResolvedValueOnce({
        query: 'test',
        recordingIds: [],
        limit: 20,
        threshold: 0.7,
        includeOcr: true,
      });

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test', recordingIds: [] }),
      });

      await POST(request);

      expect(visualSearch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ recordingIds: [] })
      );
    });

    it('should handle missing optional fields', async () => {
      const { parseBody } = require('@/lib/utils/api');
      parseBody.mockResolvedValueOnce({
        query: 'test',
        limit: 20,
        threshold: 0.7,
        includeOcr: true,
      });

      const request = new NextRequest('http://localhost:3000/api/search/visual', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });
});
