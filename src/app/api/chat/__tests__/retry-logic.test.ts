/**
 * Integration Tests for Chat API Retry Logic
 *
 * Tests the 3-level retry strategy for RAG retrieval:
 * 1. Lower threshold retry (0.5)
 * 2. Hybrid search retry
 * 3. Keyword-only search fallback
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { searchMonitor } from '@/lib/services/search-monitoring';

import { POST } from '../route';

type SyncMock = (...args: unknown[]) => unknown;
type AsyncMock = (...args: unknown[]) => Promise<unknown>;

const mockRetrieveContext = jest.fn<AsyncMock>();
const mockHybridSearch = jest.fn<AsyncMock>();
const mockSupabaseFrom = jest.fn<SyncMock>();

// Mock dependencies
jest.mock('@/lib/utils/api', () => ({
  requireOrg: jest.fn(async () => ({
    orgId: 'test-org-id',
    userId: 'test-user-id',
  })),
}));

jest.mock('@/lib/services/rag-google', () => ({
  retrieveContext: mockRetrieveContext,
}));

jest.mock('@/lib/services/query-preprocessor', () => ({
  preprocessQuery: jest.fn(async (query: string) => ({
    originalQuery: query,
    processedQuery: query,
    wasTransformed: false,
  })),
}));

jest.mock('@/lib/services/query-router', () => ({
  routeQuery: jest.fn(async () => ({
    strategy: 'standard_search' as const,
    intent: 'search',
    reasoning: 'Standard content search',
    config: {
      useAgentic: false,
      useHierarchical: false,
      useReranking: false,
      maxChunks: 10,
      threshold: 0.7,
    },
  })),
  getRetrievalConfig: jest.fn((route: { config: unknown }) => route.config),
  explainRoute: jest.fn(() => 'Route explanation'),
}));

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: mockSupabaseFrom,
  },
}));

jest.mock('@/lib/services/vector-search-google', () => ({
  hybridSearch: mockHybridSearch,
}));

mockSupabaseFrom.mockReturnValue({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  single: jest.fn<AsyncMock>().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
});

jest.mock('ai', () => ({
  streamText: jest.fn(() => ({
    toUIMessageStreamResponse: jest.fn(() => ({
      headers: {
        set: jest.fn(),
        get: jest.fn(),
      },
      body: 'mock-stream',
    })),
  })),
  tool: jest.fn((config) => config),
  stepCountIs: jest.fn((count) => count),
}));

jest.mock('@ai-sdk/google', () => ({
  google: jest.fn(() => 'mock-google-model'),
}));

jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'test-query-id'),
}));

jest.mock('@/lib/services/search-monitoring', () => ({
  searchMonitor: {
    startSearch: jest.fn(),
    updateConfig: jest.fn(),
    endSearch: jest.fn(),
    recordRetry: jest.fn(),
  },
}));

describe('Chat API - Retry Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set environment variables
    process.env.ENABLE_AGENTIC_RAG = 'true';
    process.env.ENABLE_RERANKING = 'true';
    process.env.ENABLE_CHAT_TOOLS = 'true';
    process.env.ENABLE_SEARCH_MONITORING = 'true';
    process.env.ENABLE_SEARCH_AB_TESTING = 'false';

    // Mock default database responses
    mockSupabaseFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn<AsyncMock>().mockResolvedValue({
        data: { count: 5 },
        error: null,
      }),
    });
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.ENABLE_AGENTIC_RAG;
    delete process.env.ENABLE_RERANKING;
    delete process.env.ENABLE_CHAT_TOOLS;
    delete process.env.ENABLE_SEARCH_MONITORING;
    delete process.env.ENABLE_SEARCH_AB_TESTING;
  });

  describe('Retry Strategy 1: Lower Threshold', () => {
    it('should retry with threshold 0.5 when initial search returns 0 results', async () => {
      const mockRequest = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'What is the accelerate login process?',
            },
          ],
        }),
      });

      // Mock first retrieval returning empty results
      mockRetrieveContext.mockResolvedValueOnce({
        query: 'What is the accelerate login process?',
        context: '',
        sources: [],
        totalChunks: 0,
      });

      // Mock second retrieval with lower threshold returning results
      mockRetrieveContext.mockResolvedValueOnce({
        query: 'What is the accelerate login process?',
        context: '[1] Accelerate Login Guide: The login process involves...',
        sources: [
          {
            recordingId: 'rec-1',
            recordingTitle: 'Accelerate Login Guide',
            chunkId: 'chunk-1',
            chunkText: 'The login process involves...',
            similarity: 0.52,
            url: '/library/rec-1',
          },
        ],
        totalChunks: 1,
      });

      await POST(mockRequest);

      // Verify retrieveContext was called twice
      expect(mockRetrieveContext).toHaveBeenCalledTimes(2);

      // Verify second call used lower threshold (0.5)
      expect(mockRetrieveContext).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        'test-org-id',
        expect.objectContaining({
          threshold: 0.5,
        })
      );

      // Verify retry was logged in monitoring
      expect(searchMonitor.recordRetry).toHaveBeenCalledWith('test-query-id', 'lowerThreshold');
    });

    it('should skip threshold retry if original threshold was already 0.5', async () => {
      const mockRequest = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'short query',
            },
          ],
        }),
      });

      // Mock retrieveContext returning empty (with short query, threshold is already 0.5)
      mockRetrieveContext.mockResolvedValueOnce({
        query: 'short query',
        context: '',
        sources: [],
        totalChunks: 0,
      });

      // Mock hybrid search as fallback
      mockHybridSearch.mockResolvedValueOnce([
        {
          id: 'chunk-1',
          recordingId: 'rec-1',
          recordingTitle: 'Test',
          chunkText: 'Content',
          similarity: 0.6,
          metadata: { source: 'transcript' },
          createdAt: new Date().toISOString(),
        },
      ]);

      await POST(mockRequest);

      // Verify retrieveContext was called only once (no threshold retry)
      expect(mockRetrieveContext).toHaveBeenCalledTimes(1);

      // Verify hybrid search was attempted instead
      expect(mockHybridSearch).toHaveBeenCalled();
    });
  });

  describe('Retry Strategy 2: Hybrid Search', () => {
    it('should try hybrid search if threshold retry returns 0 results', async () => {
      const mockRequest = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'What is the login URL?',
            },
          ],
        }),
      });

      // Mock both retrieveContext calls returning empty
      mockRetrieveContext.mockResolvedValue({
        query: 'What is the login URL?',
        context: '',
        sources: [],
        totalChunks: 0,
      });

      // Mock hybrid search returning results
      mockHybridSearch.mockResolvedValueOnce([
        {
          id: 'chunk-1',
          recordingId: 'rec-1',
          recordingTitle: 'Login Guide',
          chunkText: 'The login URL is https://app.example.com',
          similarity: 0.75,
          metadata: { source: 'transcript', startTime: 120 },
          createdAt: new Date().toISOString(),
        },
      ]);

      await POST(mockRequest);

      // Verify hybrid search was called
      expect(mockHybridSearch).toHaveBeenCalledWith(
        'What is the login URL?',
        expect.objectContaining({
          orgId: 'test-org-id',
          limit: expect.any(Number),
          threshold: 0.5,
        })
      );

      // Verify retry was logged
      expect(searchMonitor.recordRetry).toHaveBeenCalledWith('test-query-id', 'hybrid');
    });

    it('should transform hybrid results to RAG context format', async () => {
      const mockRequest = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'test query',
            },
          ],
        }),
      });

      // Mock empty initial retrieval
      mockRetrieveContext.mockResolvedValue({
        query: 'test query',
        context: '',
        sources: [],
        totalChunks: 0,
      });

      // Mock hybrid search with visual context
      mockHybridSearch.mockResolvedValueOnce([
        {
          id: 'chunk-1',
          recordingId: 'rec-1',
          recordingTitle: 'Video Demo',
          chunkText: 'This shows the dashboard...',
          similarity: 0.8,
          metadata: {
            source: 'transcript',
            startTime: 60,
            hasVisualContext: true,
            visualDescription: 'Screenshot of dashboard',
            contentType: 'video',
          },
          createdAt: new Date().toISOString(),
        },
      ]);

      const response = await POST(mockRequest);

      // Verify response headers include sources
      const { headers } = response;
      expect(headers.set).toHaveBeenCalledWith('X-Sources-Count', '1');
      expect(headers.set).toHaveBeenCalledWith('X-Retrieval-Attempts', '2');
    });
  });

  describe('Retry Strategy 3: Keyword-Only Fallback', () => {
    it('should try keyword search as last resort', async () => {
      const mockRequest = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'authentication process',
            },
          ],
        }),
      });

      // Mock all previous attempts returning empty
      mockRetrieveContext.mockResolvedValue({
        query: 'authentication process',
        context: '',
        sources: [],
        totalChunks: 0,
      });

      // Mock first hybrid search (attempt 2) returning empty
      mockHybridSearch.mockResolvedValueOnce([]);

      // Mock second hybrid search (attempt 3 - keyword fallback) returning results
      mockHybridSearch.mockResolvedValueOnce([
        {
          id: 'chunk-1',
          recordingId: 'rec-1',
          recordingTitle: 'Authentication Guide',
          chunkText: 'The authentication process starts with...',
          similarity: 0.6,
          metadata: { source: 'transcript' },
          createdAt: new Date().toISOString(),
        },
      ]);

      await POST(mockRequest);

      // Verify hybrid search was called twice (once for hybrid, once for keyword)
      expect(mockHybridSearch).toHaveBeenCalledTimes(2);

      // Verify third call used very low threshold (0.3)
      expect(mockHybridSearch).toHaveBeenNthCalledWith(
        2,
        'authentication process',
        expect.objectContaining({
          threshold: 0.3,
        })
      );

      // Verify keyword retry was logged
      expect(searchMonitor.recordRetry).toHaveBeenCalledWith('test-query-id', 'keyword');
    });

    it('should handle all retries failing gracefully', async () => {
      const mockRequest = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'nonexistent topic',
            },
          ],
        }),
      });

      // Mock all attempts returning empty
      mockRetrieveContext.mockResolvedValue({
        query: 'nonexistent topic',
        context: '',
        sources: [],
        totalChunks: 0,
      });

      mockHybridSearch.mockResolvedValue([]);

      const response = await POST(mockRequest);

      // Verify response headers indicate 0 sources and 3 attempts
      const { headers } = response;
      expect(headers.set).toHaveBeenCalledWith('X-Sources-Count', '0');
      expect(headers.set).toHaveBeenCalledWith('X-Retrieval-Attempts', '3');

      // Verify system prompt instructs LLM to use tools
      // (Implementation falls back to tool-based discovery)
    });
  });

  describe('Error Handling', () => {
    it('should handle RAG retrieval errors gracefully', async () => {
      const mockRequest = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'test query',
            },
          ],
        }),
      });

      // Mock retrieval throwing error
      mockRetrieveContext.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await POST(mockRequest);

      // Verify error was caught and response still generated
      expect(response).toBeDefined();

      // Verify monitoring was completed
      expect(searchMonitor.endSearch).toHaveBeenCalledWith(
        'test-query-id',
        expect.objectContaining({
          success: false,
        })
      );
    });

    it('should include error details in logs', async () => {
      const mockRequest = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'test query',
            },
          ],
        }),
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      // Mock retrieval throwing error
      mockRetrieveContext.mockRejectedValue(
        new Error('Embedding service unavailable')
      );

      await POST(mockRequest);

      // Verify error was logged with details
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Chat API] RAG retrieval error:',
        expect.any(Error)
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Chat API] Error details:',
        expect.objectContaining({
          query: 'test query',
          orgId: 'test-org-id',
          errorMessage: 'Embedding service unavailable',
        })
      );

      consoleSpy.mockRestore();
    });

    it('should continue to response generation after retrieval error', async () => {
      const mockRequest = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'test query',
            },
          ],
        }),
      });

      // Mock retrieval error
      mockRetrieveContext.mockRejectedValue(
        new Error('Temporary failure')
      );

      const response = await POST(mockRequest);

      // Verify streamText was still called (falls back to tools)
      expect(response).toBeDefined();
      expect(response.body).toBe('mock-stream');
    });
  });

  describe('Diagnostic Headers', () => {
    it('should include X-Search-Strategy header', async () => {
      const mockRequest = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'test query',
            },
          ],
        }),
      });

      // Mock successful retrieval
      mockRetrieveContext.mockResolvedValueOnce({
        query: 'test query',
        context: '[1] Test: Content',
        sources: [
          {
            recordingId: 'rec-1',
            recordingTitle: 'Test',
            chunkId: 'chunk-1',
            chunkText: 'Content',
            similarity: 0.8,
            url: '/library/rec-1',
          },
        ],
        totalChunks: 1,
      });

      const response = await POST(mockRequest);

      // Verify strategy header
      const { headers } = response;
      expect(headers.set).toHaveBeenCalledWith('X-Search-Strategy', 'standard_search');
    });

    it('should include X-Sources-Count header', async () => {
      const mockRequest = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'test query',
            },
          ],
        }),
      });

      // Mock retrieval with 3 sources
      mockRetrieveContext.mockResolvedValueOnce({
        query: 'test query',
        context: '[1] Test 1\n[2] Test 2\n[3] Test 3',
        sources: [
          { recordingId: 'rec-1', recordingTitle: 'Test 1', chunkId: 'c1', chunkText: 'T1', similarity: 0.9, url: '/library/rec-1' },
          { recordingId: 'rec-2', recordingTitle: 'Test 2', chunkId: 'c2', chunkText: 'T2', similarity: 0.8, url: '/library/rec-2' },
          { recordingId: 'rec-3', recordingTitle: 'Test 3', chunkId: 'c3', chunkText: 'T3', similarity: 0.7, url: '/library/rec-3' },
        ],
        totalChunks: 3,
      });

      const response = await POST(mockRequest);

      const { headers } = response;
      expect(headers.set).toHaveBeenCalledWith('X-Sources-Count', '3');
    });

    it('should include X-Retrieval-Attempts header', async () => {
      const mockRequest = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'test query',
            },
          ],
        }),
      });

      // Mock first attempt empty, second succeeds
      mockRetrieveContext
        .mockResolvedValueOnce({ query: 'test query', context: '', sources: [], totalChunks: 0 })
        .mockResolvedValueOnce({
          query: 'test query',
          context: '[1] Test: Content',
          sources: [{ recordingId: 'rec-1', recordingTitle: 'Test', chunkId: 'c1', chunkText: 'Content', similarity: 0.75, url: '/library/rec-1' }],
          totalChunks: 1,
        });

      const response = await POST(mockRequest);

      const { headers } = response;
      expect(headers.set).toHaveBeenCalledWith('X-Retrieval-Attempts', '2');
    });

    it('should include X-Threshold-Used header', async () => {
      const mockRequest = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'test query',
            },
          ],
        }),
      });

      // Mock successful retrieval
      mockRetrieveContext.mockResolvedValueOnce({
        query: 'test query',
        context: '[1] Test: Content',
        sources: [{ recordingId: 'rec-1', recordingTitle: 'Test', chunkId: 'c1', chunkText: 'Content', similarity: 0.8, url: '/library/rec-1' }],
        totalChunks: 1,
      });

      const response = await POST(mockRequest);

      const { headers } = response;
      expect(headers.set).toHaveBeenCalledWith('X-Threshold-Used', expect.any(String));
    });

    it('should include X-Similarity-Avg header with calculated average', async () => {
      const mockRequest = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'test query',
            },
          ],
        }),
      });

      // Mock retrieval with multiple sources
      mockRetrieveContext.mockResolvedValueOnce({
        query: 'test query',
        context: '[1] Test 1\n[2] Test 2',
        sources: [
          { recordingId: 'rec-1', recordingTitle: 'Test 1', chunkId: 'c1', chunkText: 'T1', similarity: 0.9, url: '/library/rec-1' },
          { recordingId: 'rec-2', recordingTitle: 'Test 2', chunkId: 'c2', chunkText: 'T2', similarity: 0.7, url: '/library/rec-2' },
        ],
        totalChunks: 2,
      });

      const response = await POST(mockRequest);

      const { headers } = response;
      // Average: (0.9 + 0.7) / 2 = 0.8
      expect(headers.set).toHaveBeenCalledWith('X-Similarity-Avg', '0.800');
    });
  });

  describe('Search Failure Alerts', () => {
    it('should alert when search returns 0 results but library has content', async () => {
      const mockRequest = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'test query',
            },
          ],
        }),
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      // Mock recordings count > 0
      mockSupabaseFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn<AsyncMock>().mockResolvedValue({ data: { count: 10 }, error: null }),
      });

      // Mock all retrievals empty
      mockRetrieveContext.mockResolvedValue({
        query: 'test query',
        context: '',
        sources: [],
        totalChunks: 0,
      });

      mockHybridSearch.mockResolvedValue([]);

      await POST(mockRequest);

      // Verify alert was logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Chat API] ⚠️ SEARCH FAILURE ALERT:',
        expect.objectContaining({
          query: 'test query',
          orgId: 'test-org-id',
          recordingsInLibrary: expect.any(Number),
          retrievalAttempts: 3,
          recommendation: expect.any(String),
        })
      );

      consoleWarnSpy.mockRestore();
    });

    it('should NOT alert when library is empty', async () => {
      const mockRequest = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'test query',
            },
          ],
        }),
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      // Mock recordings count = 0
      mockSupabaseFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn<AsyncMock>().mockResolvedValue({ data: { count: 0 }, error: null }),
      });

      // Mock empty retrieval
      mockRetrieveContext.mockResolvedValue({
        query: 'test query',
        context: '',
        sources: [],
        totalChunks: 0,
      });

      await POST(mockRequest);

      // Verify NO alert was logged (library is empty)
      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        '[Chat API] ⚠️ SEARCH FAILURE ALERT:',
        expect.any(Object)
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
