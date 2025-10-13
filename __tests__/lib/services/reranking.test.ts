import { rerankResults, isCohereConfigured } from '@/lib/services/reranking';
import type { SearchResult } from '@/lib/services/vector-search-google';
import { CohereClient } from 'cohere-ai';

// Mock Cohere
jest.mock('cohere-ai');

describe('Reranking Service', () => {
  let mockCohereClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Cohere client
    mockCohereClient = {
      rerank: jest.fn(),
    };
    (CohereClient as jest.Mock).mockImplementation(() => mockCohereClient);

    // Set environment variable for tests
    process.env.COHERE_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.COHERE_API_KEY;
  });

  // Helper to create mock search results
  const createMockResults = (count: number): SearchResult[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `chunk-${i}`,
      recordingId: `recording-${i % 3}`,
      recordingTitle: `Recording ${i % 3}`,
      chunkText: `This is chunk ${i} with some relevant content about the topic.`,
      similarity: 0.8 - i * 0.05, // Decreasing similarity
      createdAt: new Date().toISOString(),
      metadata: {
        source: 'transcript' as const,
        startTime: i * 10,
        endTime: (i + 1) * 10,
        chunkIndex: i,
      },
    }));
  };

  describe('rerankResults', () => {
    it('should rerank results successfully', async () => {
      const query = 'machine learning algorithms';
      const results = createMockResults(10);

      // Mock Cohere response
      mockCohereClient.rerank.mockResolvedValue({
        results: [
          { index: 3, relevanceScore: 0.95 },
          { index: 1, relevanceScore: 0.92 },
          { index: 0, relevanceScore: 0.88 },
          { index: 5, relevanceScore: 0.85 },
          { index: 2, relevanceScore: 0.82 },
        ],
      });

      // Execute
      const result = await rerankResults(query, results, { topN: 5 });

      // Assertions
      expect(result.results).toHaveLength(5);
      expect(result.results[0].id).toBe('chunk-3'); // Highest relevance
      expect(result.results[0].similarity).toBe(0.95);
      expect(result.originalCount).toBe(10);
      expect(result.rerankedCount).toBe(5);
      expect(result.rerankingTime).toBeGreaterThanOrEqual(0);
      expect(result.costEstimate).toBeGreaterThan(0);

      // Verify Cohere was called correctly
      expect(mockCohereClient.rerank).toHaveBeenCalledWith({
        query,
        documents: expect.arrayContaining([
          expect.stringContaining('chunk'),
        ]),
        topN: 5,
        model: 'rerank-english-v3.0',
      });
    });

    it('should use custom model when specified', async () => {
      const query = 'test query';
      const results = createMockResults(5);

      mockCohereClient.rerank.mockResolvedValue({
        results: [
          { index: 0, relevanceScore: 0.9 },
          { index: 1, relevanceScore: 0.8 },
        ],
      });

      // Execute with custom model
      await rerankResults(query, results, {
        model: 'rerank-multilingual-v2.0',
      });

      // Verify custom model was used
      expect(mockCohereClient.rerank).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'rerank-multilingual-v2.0',
        })
      );
    });

    it('should handle timeout gracefully', async () => {
      const query = 'test query';
      const results = createMockResults(10);

      // Mock slow response that times out
      mockCohereClient.rerank.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              results: [{ index: 0, relevanceScore: 0.9 }],
            });
          }, 1000); // Longer than timeout
        });
      });

      // Execute with short timeout
      const result = await rerankResults(query, results, {
        timeoutMs: 100,
      });

      // Should return original results on timeout
      expect(result.results).toHaveLength(10);
      expect(result.results[0].similarity).toBe(0.8); // Original similarity
    });

    it('should return original results if only 1 result', async () => {
      const query = 'test query';
      const results = createMockResults(1);

      // Execute
      const result = await rerankResults(query, results);

      // Should return immediately without calling Cohere
      expect(result.results).toEqual(results);
      expect(result.rerankingTime).toBe(0);
      expect(mockCohereClient.rerank).not.toHaveBeenCalled();
    });

    it('should return empty array if no results', async () => {
      const query = 'test query';
      const results: SearchResult[] = [];

      // Execute - don't specify topN to avoid validation error
      const result = await rerankResults(query, results);

      // Should return immediately
      expect(result.results).toEqual([]);
      expect(result.originalCount).toBe(0);
      expect(result.rerankedCount).toBe(0);
      expect(result.rerankingTime).toBe(0);
      expect(mockCohereClient.rerank).not.toHaveBeenCalled();
    });

    it('should validate query parameter', async () => {
      const results = createMockResults(5);

      // Test empty query
      await expect(rerankResults('', results)).rejects.toThrow(
        'Query cannot be empty'
      );

      // Test whitespace-only query
      await expect(rerankResults('   ', results)).rejects.toThrow(
        'Query cannot be empty'
      );
    });

    it('should validate topN parameter', async () => {
      const query = 'test query';
      const results = createMockResults(5);

      // Test topN < 1
      await expect(
        rerankResults(query, results, { topN: 0 })
      ).rejects.toThrow('topN must be at least 1');
    });

    it('should validate timeout parameter', async () => {
      const query = 'test query';
      const results = createMockResults(5);

      // Test timeout too short
      await expect(
        rerankResults(query, results, { timeoutMs: 50 })
      ).rejects.toThrow('timeoutMs must be at least 100ms');

      // Test timeout too long
      await expect(
        rerankResults(query, results, { timeoutMs: 6000 })
      ).rejects.toThrow('timeoutMs must be at most 5000ms');
    });

    it('should handle Cohere API errors gracefully', async () => {
      const query = 'test query';
      const results = createMockResults(10);

      // Mock API error
      mockCohereClient.rerank.mockRejectedValue(
        new Error('Cohere API error: Invalid API key')
      );

      // Execute - should not throw
      const result = await rerankResults(query, results, { topN: 5 });

      // Should fallback to original results
      expect(result.results).toHaveLength(5);
      expect(result.results[0].id).toBe('chunk-0'); // Original order
    });

    it('should calculate cost estimate correctly', async () => {
      const query = 'test query';
      const results = createMockResults(20);

      mockCohereClient.rerank.mockResolvedValue({
        results: results.map((_, i) => ({
          index: i,
          relevanceScore: 0.9 - i * 0.01,
        })),
      });

      // Execute
      const result = await rerankResults(query, results);

      // Cost should be based on number of documents
      expect(result.costEstimate).toBe(20 * 0.001); // $0.02
    });

    it('should fallback to original results if COHERE_API_KEY not set', async () => {
      delete process.env.COHERE_API_KEY;

      const query = 'test query';
      const results = createMockResults(5);

      // Service has graceful fallback - should not throw
      const result = await rerankResults(query, results);

      // Should return original results
      expect(result.results).toHaveLength(5);
      expect(result.results).toEqual(results);
    });

    it('should limit topN to result count', async () => {
      const query = 'test query';
      const results = createMockResults(5);

      mockCohereClient.rerank.mockResolvedValue({
        results: results.map((_, i) => ({
          index: i,
          relevanceScore: 0.9 - i * 0.1,
        })),
      });

      // Request more results than available
      await rerankResults(query, results, { topN: 20 });

      // Should only request what's available
      expect(mockCohereClient.rerank).toHaveBeenCalledWith(
        expect.objectContaining({
          topN: 5, // Limited to actual count
        })
      );
    });

    it('should preserve original result structure', async () => {
      const query = 'test query';
      const results = createMockResults(3);

      mockCohereClient.rerank.mockResolvedValue({
        results: [
          { index: 2, relevanceScore: 0.95 },
          { index: 0, relevanceScore: 0.85 },
        ],
      });

      // Execute
      const result = await rerankResults(query, results, { topN: 2 });

      // Verify all original fields are preserved
      expect(result.results[0]).toMatchObject({
        id: 'chunk-2',
        recordingId: 'recording-2',
        recordingTitle: 'Recording 2',
        chunkText: expect.stringContaining('chunk 2'),
        similarity: 0.95, // Updated
        metadata: expect.objectContaining({
          source: 'transcript',
          chunkIndex: 2,
        }),
      });
    });
  });

  describe('isCohereConfigured', () => {
    it('should return true when API key is set', () => {
      process.env.COHERE_API_KEY = 'test-key';
      expect(isCohereConfigured()).toBe(true);
    });

    it('should return false when API key is not set', () => {
      delete process.env.COHERE_API_KEY;
      expect(isCohereConfigured()).toBe(false);
    });

    it('should return false when API key is empty string', () => {
      process.env.COHERE_API_KEY = '';
      expect(isCohereConfigured()).toBe(false);
    });
  });
});
