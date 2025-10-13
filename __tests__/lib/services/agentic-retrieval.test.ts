/**
 * Tests for Agentic Retrieval Engine
 */

import { agenticSearch } from '@/lib/services/agentic-retrieval';
import { decomposeQuery, planExecutionOrder } from '@/lib/services/query-decomposition';
import { evaluateResults } from '@/lib/services/result-evaluator';
import { vectorSearch } from '@/lib/services/vector-search-google';
import { rerankResults, isCohereConfigured } from '@/lib/services/reranking';
import { createClient } from '@/lib/supabase/server';
import type { SubQuery } from '@/lib/types/agentic-rag';
import type { SearchResult } from '@/lib/services/vector-search-google';

// Mock all dependencies
jest.mock('@/lib/services/query-decomposition');
jest.mock('@/lib/services/result-evaluator');
jest.mock('@/lib/services/vector-search-google');
jest.mock('@/lib/services/reranking');
jest.mock('@/lib/supabase/server');

describe('Agentic Retrieval Engine', () => {
  let mockSupabase: any;

  const createMockSubQuery = (id: string, text: string, dependency: string | null = null): SubQuery => ({
    id,
    text,
    intent: 'single_fact',
    dependency,
    priority: 5,
  });

  const createMockSearchResult = (id: string, text: string, similarity: number = 0.85): SearchResult => ({
    id,
    recordingId: `rec-${id}`,
    recordingTitle: `Recording ${id}`,
    chunkText: text,
    similarity,
    metadata: {
      source: 'transcript',
      chunkIndex: 0,
    },
    createdAt: new Date().toISOString(),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase
    mockSupabase = {
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
      }),
    };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);

    // Default mock implementations
    (isCohereConfigured as jest.Mock).mockReturnValue(false);

    // Clear environment variables
    delete process.env.AGENTIC_MAX_ITERATIONS;
    delete process.env.ENABLE_SELF_REFLECTION;
  });

  describe('agenticSearch', () => {
    it('should execute simple single-query search', async () => {
      const subQuery = createMockSubQuery('q1', 'What is TypeScript?');

      (decomposeQuery as jest.Mock).mockResolvedValue({
        originalQuery: 'What is TypeScript?',
        intent: 'single_fact',
        complexity: 1,
        subQueries: [subQuery],
        reasoning: 'Simple query',
      });

      (planExecutionOrder as jest.Mock).mockReturnValue([[subQuery]]);

      const mockResults = [
        createMockSearchResult('chunk-1', 'TypeScript is a typed superset of JavaScript'),
      ];

      (vectorSearch as jest.Mock).mockResolvedValue(mockResults);

      (evaluateResults as jest.Mock).mockResolvedValue({
        relevant: mockResults,
        irrelevant: [],
        evaluations: [{ chunkId: 'chunk-1', isRelevant: true, confidence: 0.9, reasoning: 'Good' }],
        avgConfidence: 0.9,
        gapsIdentified: [],
        needsRefinement: false,
      });

      const result = await agenticSearch('What is TypeScript?', {
        orgId: 'org-123',
        userId: 'user-123',
        logResults: false,
      });

      expect(result.query).toBe('What is TypeScript?');
      expect(result.intent).toBe('single_fact');
      expect(result.finalResults).toHaveLength(1);
      expect(result.iterations).toHaveLength(1);
      expect(vectorSearch).toHaveBeenCalledTimes(1);
    });

    it('should handle multi-part query with parallel execution', async () => {
      const subQuery1 = createMockSubQuery('q1', 'What is React?');
      const subQuery2 = createMockSubQuery('q2', 'What is Vue?');

      (decomposeQuery as jest.Mock).mockResolvedValue({
        originalQuery: 'Explain React and Vue',
        intent: 'multi_part',
        complexity: 3,
        subQueries: [subQuery1, subQuery2],
        reasoning: 'Multi-part query',
      });

      (planExecutionOrder as jest.Mock).mockReturnValue([[subQuery1, subQuery2]]);

      const mockResults1 = [createMockSearchResult('chunk-1', 'React is a library')];
      const mockResults2 = [createMockSearchResult('chunk-2', 'Vue is a framework')];

      (vectorSearch as jest.Mock)
        .mockResolvedValueOnce(mockResults1)
        .mockResolvedValueOnce(mockResults2);

      (evaluateResults as jest.Mock)
        .mockResolvedValueOnce({
          relevant: mockResults1,
          irrelevant: [],
          evaluations: [{ chunkId: 'chunk-1', isRelevant: true, confidence: 0.9, reasoning: 'Good' }],
          avgConfidence: 0.9,
          gapsIdentified: [],
          needsRefinement: false,
        })
        .mockResolvedValueOnce({
          relevant: mockResults2,
          irrelevant: [],
          evaluations: [{ chunkId: 'chunk-2', isRelevant: true, confidence: 0.85, reasoning: 'Good' }],
          avgConfidence: 0.85,
          gapsIdentified: [],
          needsRefinement: false,
        });

      const result = await agenticSearch('Explain React and Vue', {
        orgId: 'org-123',
        logResults: false,
      });

      expect(result.finalResults).toHaveLength(2);
      expect(result.iterations).toHaveLength(2);
      expect(vectorSearch).toHaveBeenCalledTimes(2); // Parallel execution
    });

    it('should handle sequential execution with dependencies', async () => {
      const subQuery1 = createMockSubQuery('q1', 'What is TypeScript?');
      const subQuery2 = createMockSubQuery('q2', 'What are TypeScript benefits?', 'q1');

      (decomposeQuery as jest.Mock).mockResolvedValue({
        originalQuery: 'Explain TypeScript and its benefits',
        intent: 'multi_part',
        complexity: 3,
        subQueries: [subQuery1, subQuery2],
        reasoning: 'Sequential query',
      });

      (planExecutionOrder as jest.Mock).mockReturnValue([[subQuery1], [subQuery2]]);

      const mockResults1 = [createMockSearchResult('chunk-1', 'TypeScript info')];
      const mockResults2 = [createMockSearchResult('chunk-2', 'TypeScript benefits')];

      (vectorSearch as jest.Mock)
        .mockResolvedValueOnce(mockResults1)
        .mockResolvedValueOnce(mockResults2);

      (evaluateResults as jest.Mock)
        .mockResolvedValueOnce({
          relevant: mockResults1,
          irrelevant: [],
          evaluations: [{ chunkId: 'chunk-1', isRelevant: true, confidence: 0.8, reasoning: 'Good' }],
          avgConfidence: 0.8,
          gapsIdentified: ['Need benefits info'],
          needsRefinement: false,
        })
        .mockResolvedValueOnce({
          relevant: mockResults2,
          irrelevant: [],
          evaluations: [{ chunkId: 'chunk-2', isRelevant: true, confidence: 0.85, reasoning: 'Good' }],
          avgConfidence: 0.85,
          gapsIdentified: [],
          needsRefinement: false,
        });

      const result = await agenticSearch('Explain TypeScript and its benefits', {
        orgId: 'org-123',
        logResults: false,
      });

      expect(result.iterations).toHaveLength(2);
      expect(result.finalResults).toHaveLength(2);
    });

    it('should apply reranking when enabled and configured', async () => {
      (isCohereConfigured as jest.Mock).mockReturnValue(true);

      const subQuery = createMockSubQuery('q1', 'Test query');

      (decomposeQuery as jest.Mock).mockResolvedValue({
        originalQuery: 'Test query',
        intent: 'single_fact',
        complexity: 1,
        subQueries: [subQuery],
        reasoning: 'Simple',
      });

      (planExecutionOrder as jest.Mock).mockReturnValue([[subQuery]]);

      const mockResults = [
        createMockSearchResult('chunk-1', 'Content 1'),
        createMockSearchResult('chunk-2', 'Content 2'),
      ];

      const rerankedResults = [mockResults[1]]; // Reordered

      (vectorSearch as jest.Mock).mockResolvedValue(mockResults);
      (rerankResults as jest.Mock).mockResolvedValue({ results: rerankedResults });

      (evaluateResults as jest.Mock).mockResolvedValue({
        relevant: rerankedResults,
        irrelevant: [],
        evaluations: [{ chunkId: 'chunk-2', isRelevant: true, confidence: 0.9, reasoning: 'Good' }],
        avgConfidence: 0.9,
        gapsIdentified: [],
        needsRefinement: false,
      });

      const result = await agenticSearch('Test query', {
        orgId: 'org-123',
        enableReranking: true,
        logResults: false,
      });

      expect(rerankResults).toHaveBeenCalledTimes(1);
      expect(result.finalResults).toHaveLength(1);
    });

    it('should skip reranking when disabled', async () => {
      const subQuery = createMockSubQuery('q1', 'Test query');

      (decomposeQuery as jest.Mock).mockResolvedValue({
        originalQuery: 'Test query',
        intent: 'single_fact',
        complexity: 1,
        subQueries: [subQuery],
        reasoning: 'Simple',
      });

      (planExecutionOrder as jest.Mock).mockReturnValue([[subQuery]]);

      const mockResults = [createMockSearchResult('chunk-1', 'Content')];

      (vectorSearch as jest.Mock).mockResolvedValue(mockResults);

      (evaluateResults as jest.Mock).mockResolvedValue({
        relevant: mockResults,
        irrelevant: [],
        evaluations: [{ chunkId: 'chunk-1', isRelevant: true, confidence: 0.9, reasoning: 'Good' }],
        avgConfidence: 0.9,
        gapsIdentified: [],
        needsRefinement: false,
      });

      await agenticSearch('Test query', {
        orgId: 'org-123',
        enableReranking: false,
        logResults: false,
      });

      expect(rerankResults).not.toHaveBeenCalled();
    });

    it('should skip self-reflection when disabled', async () => {
      const subQuery = createMockSubQuery('q1', 'Test query');

      (decomposeQuery as jest.Mock).mockResolvedValue({
        originalQuery: 'Test query',
        intent: 'single_fact',
        complexity: 1,
        subQueries: [subQuery],
        reasoning: 'Simple',
      });

      (planExecutionOrder as jest.Mock).mockReturnValue([[subQuery]]);

      const mockResults = [createMockSearchResult('chunk-1', 'Content')];

      (vectorSearch as jest.Mock).mockResolvedValue(mockResults);

      const result = await agenticSearch('Test query', {
        orgId: 'org-123',
        enableSelfReflection: false,
        logResults: false,
      });

      expect(evaluateResults).not.toHaveBeenCalled();
      expect(result.finalResults).toHaveLength(1);
    });

    it('should stop early when confidence is high', async () => {
      const subQuery1 = createMockSubQuery('q1', 'Query 1');
      const subQuery2 = createMockSubQuery('q2', 'Query 2');
      const subQuery3 = createMockSubQuery('q3', 'Query 3');

      (decomposeQuery as jest.Mock).mockResolvedValue({
        originalQuery: 'Complex query',
        intent: 'multi_part',
        complexity: 4,
        subQueries: [subQuery1, subQuery2, subQuery3],
        reasoning: 'Complex',
      });

      (planExecutionOrder as jest.Mock).mockReturnValue([[subQuery1], [subQuery2], [subQuery3]]);

      const mockResults = [createMockSearchResult('chunk-1', 'Perfect content')];

      (vectorSearch as jest.Mock).mockResolvedValue(mockResults);

      (evaluateResults as jest.Mock).mockResolvedValue({
        relevant: mockResults,
        irrelevant: [],
        evaluations: [{ chunkId: 'chunk-1', isRelevant: true, confidence: 0.95, reasoning: 'Excellent' }],
        avgConfidence: 0.95, // High confidence
        gapsIdentified: [], // No gaps
        needsRefinement: false,
      });

      const result = await agenticSearch('Complex query', {
        orgId: 'org-123',
        logResults: false,
      });

      // Should stop after first iteration due to high confidence
      expect(result.iterations).toHaveLength(1);
      expect(vectorSearch).toHaveBeenCalledTimes(1);
    });

    it('should respect maxIterations limit', async () => {
      process.env.AGENTIC_MAX_ITERATIONS = '2';

      const subQueries = Array.from({ length: 5 }, (_, i) =>
        createMockSubQuery(`q${i + 1}`, `Query ${i + 1}`)
      );

      (decomposeQuery as jest.Mock).mockResolvedValue({
        originalQuery: 'Complex query',
        intent: 'exploration',
        complexity: 5,
        subQueries,
        reasoning: 'Complex exploration',
      });

      (planExecutionOrder as jest.Mock).mockReturnValue(
        subQueries.map((sq) => [sq])
      );

      const mockResults = [createMockSearchResult('chunk-1', 'Content')];

      (vectorSearch as jest.Mock).mockResolvedValue(mockResults);

      (evaluateResults as jest.Mock).mockResolvedValue({
        relevant: mockResults,
        irrelevant: [],
        evaluations: [{ chunkId: 'chunk-1', isRelevant: true, confidence: 0.7, reasoning: 'OK' }],
        avgConfidence: 0.7,
        gapsIdentified: ['Need more'],
        needsRefinement: true,
      });

      const result = await agenticSearch('Complex query', {
        orgId: 'org-123',
        maxIterations: 2,
        logResults: false,
      });

      // Should stop at 2 iterations despite having 5 sub-queries
      expect(result.iterations.length).toBeLessThanOrEqual(2);
    });

    it('should deduplicate chunks across iterations', async () => {
      const subQuery1 = createMockSubQuery('q1', 'Query 1');
      const subQuery2 = createMockSubQuery('q2', 'Query 2');

      (decomposeQuery as jest.Mock).mockResolvedValue({
        originalQuery: 'Test',
        intent: 'multi_part',
        complexity: 3,
        subQueries: [subQuery1, subQuery2],
        reasoning: 'Multi-part',
      });

      (planExecutionOrder as jest.Mock).mockReturnValue([[subQuery1, subQuery2]]);

      // Both queries return the same chunk
      const sharedChunk = createMockSearchResult('chunk-1', 'Shared content');

      (vectorSearch as jest.Mock)
        .mockResolvedValueOnce([sharedChunk])
        .mockResolvedValueOnce([sharedChunk]);

      (evaluateResults as jest.Mock)
        .mockResolvedValueOnce({
          relevant: [sharedChunk],
          irrelevant: [],
          evaluations: [{ chunkId: 'chunk-1', isRelevant: true, confidence: 0.9, reasoning: 'Good' }],
          avgConfidence: 0.9,
          gapsIdentified: [],
          needsRefinement: false,
        })
        .mockResolvedValueOnce({
          relevant: [sharedChunk],
          irrelevant: [],
          evaluations: [{ chunkId: 'chunk-1', isRelevant: true, confidence: 0.85, reasoning: 'Good' }],
          avgConfidence: 0.85,
          gapsIdentified: [],
          needsRefinement: false,
        });

      const result = await agenticSearch('Test', {
        orgId: 'org-123',
        logResults: false,
      });

      // Should deduplicate the shared chunk
      expect(result.finalResults).toHaveLength(1);
      expect(result.metadata.chunksRetrieved).toBe(1);
    });

    it('should track citations correctly', async () => {
      const subQuery1 = createMockSubQuery('q1', 'Query 1');
      const subQuery2 = createMockSubQuery('q2', 'Query 2');

      (decomposeQuery as jest.Mock).mockResolvedValue({
        originalQuery: 'Test',
        intent: 'multi_part',
        complexity: 3,
        subQueries: [subQuery1, subQuery2],
        reasoning: 'Multi-part',
      });

      (planExecutionOrder as jest.Mock).mockReturnValue([[subQuery1, subQuery2]]);

      const chunk1 = createMockSearchResult('chunk-1', 'Content 1');
      const chunk2 = createMockSearchResult('chunk-2', 'Content 2');

      (vectorSearch as jest.Mock)
        .mockResolvedValueOnce([chunk1])
        .mockResolvedValueOnce([chunk2]);

      (evaluateResults as jest.Mock)
        .mockResolvedValueOnce({
          relevant: [chunk1],
          irrelevant: [],
          evaluations: [{ chunkId: 'chunk-1', isRelevant: true, confidence: 0.9, reasoning: 'Good' }],
          avgConfidence: 0.9,
          gapsIdentified: [],
          needsRefinement: false,
        })
        .mockResolvedValueOnce({
          relevant: [chunk2],
          irrelevant: [],
          evaluations: [{ chunkId: 'chunk-2', isRelevant: true, confidence: 0.85, reasoning: 'Good' }],
          avgConfidence: 0.85,
          gapsIdentified: [],
          needsRefinement: false,
        });

      const result = await agenticSearch('Test', {
        orgId: 'org-123',
        logResults: false,
      });

      // Verify citation map
      expect(result.citationMap).toBeDefined();
      expect(result.citationMap.get('chunk-1')).toEqual(['q1']);
      expect(result.citationMap.get('chunk-2')).toEqual(['q2']);
    });

    it('should limit final results to top 20', async () => {
      const subQuery = createMockSubQuery('q1', 'Query');

      (decomposeQuery as jest.Mock).mockResolvedValue({
        originalQuery: 'Test',
        intent: 'single_fact',
        complexity: 1,
        subQueries: [subQuery],
        reasoning: 'Simple',
      });

      (planExecutionOrder as jest.Mock).mockReturnValue([[subQuery]]);

      // Return 30 results
      const mockResults = Array.from({ length: 30 }, (_, i) =>
        createMockSearchResult(`chunk-${i}`, `Content ${i}`, 0.9 - i * 0.01)
      );

      (vectorSearch as jest.Mock).mockResolvedValue(mockResults);

      (evaluateResults as jest.Mock).mockResolvedValue({
        relevant: mockResults,
        irrelevant: [],
        evaluations: mockResults.map((r) => ({ chunkId: r.id, isRelevant: true, confidence: 0.8, reasoning: 'Good' })),
        avgConfidence: 0.8,
        gapsIdentified: [],
        needsRefinement: false,
      });

      const result = await agenticSearch('Test', {
        orgId: 'org-123',
        logResults: false,
      });

      // Should limit to 20 results
      expect(result.finalResults).toHaveLength(20);
    });

    it('should pass recordingIds filter to vector search', async () => {
      const subQuery = createMockSubQuery('q1', 'Query');

      (decomposeQuery as jest.Mock).mockResolvedValue({
        originalQuery: 'Test',
        intent: 'single_fact',
        complexity: 1,
        subQueries: [subQuery],
        reasoning: 'Simple',
      });

      (planExecutionOrder as jest.Mock).mockReturnValue([[subQuery]]);

      const mockResults = [createMockSearchResult('chunk-1', 'Content')];

      (vectorSearch as jest.Mock).mockResolvedValue(mockResults);

      (evaluateResults as jest.Mock).mockResolvedValue({
        relevant: mockResults,
        irrelevant: [],
        evaluations: [{ chunkId: 'chunk-1', isRelevant: true, confidence: 0.9, reasoning: 'Good' }],
        avgConfidence: 0.9,
        gapsIdentified: [],
        needsRefinement: false,
      });

      const recordingIds = ['rec-1', 'rec-2'];

      await agenticSearch('Test', {
        orgId: 'org-123',
        recordingIds,
        logResults: false,
      });

      expect(vectorSearch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ recordingIds })
      );
    });

    it('should generate reasoning path', async () => {
      const subQuery1 = createMockSubQuery('q1', 'What is React?');
      const subQuery2 = createMockSubQuery('q2', 'What is Vue?');

      (decomposeQuery as jest.Mock).mockResolvedValue({
        originalQuery: 'Explain React and Vue',
        intent: 'multi_part',
        complexity: 3,
        subQueries: [subQuery1, subQuery2],
        reasoning: 'Breaking down multi-part query',
      });

      (planExecutionOrder as jest.Mock).mockReturnValue([[subQuery1, subQuery2]]);

      const mockResults1 = [createMockSearchResult('chunk-1', 'React info')];
      const mockResults2 = [createMockSearchResult('chunk-2', 'Vue info')];

      (vectorSearch as jest.Mock)
        .mockResolvedValueOnce(mockResults1)
        .mockResolvedValueOnce(mockResults2);

      (evaluateResults as jest.Mock)
        .mockResolvedValueOnce({
          relevant: mockResults1,
          irrelevant: [],
          evaluations: [{ chunkId: 'chunk-1', isRelevant: true, confidence: 0.9, reasoning: 'Good' }],
          avgConfidence: 0.9,
          gapsIdentified: [],
          needsRefinement: false,
        })
        .mockResolvedValueOnce({
          relevant: mockResults2,
          irrelevant: [],
          evaluations: [{ chunkId: 'chunk-2', isRelevant: true, confidence: 0.85, reasoning: 'Good' }],
          avgConfidence: 0.85,
          gapsIdentified: ['Need comparison'],
          needsRefinement: false,
        });

      const result = await agenticSearch('Explain React and Vue', {
        orgId: 'org-123',
        logResults: false,
      });

      expect(result.reasoning).toContain('Query Analysis');
      expect(result.reasoning).toContain('Search Strategy');
      expect(result.reasoning).toContain('What is React?');
      expect(result.reasoning).toContain('What is Vue?');
    });

    it('should log results to database when enabled', async () => {
      const subQuery = createMockSubQuery('q1', 'Test query');

      (decomposeQuery as jest.Mock).mockResolvedValue({
        originalQuery: 'Test query',
        intent: 'single_fact',
        complexity: 1,
        subQueries: [subQuery],
        reasoning: 'Simple',
      });

      (planExecutionOrder as jest.Mock).mockReturnValue([[subQuery]]);

      const mockResults = [createMockSearchResult('chunk-1', 'Content')];

      (vectorSearch as jest.Mock).mockResolvedValue(mockResults);

      (evaluateResults as jest.Mock).mockResolvedValue({
        relevant: mockResults,
        irrelevant: [],
        evaluations: [{ chunkId: 'chunk-1', isRelevant: true, confidence: 0.9, reasoning: 'Good' }],
        avgConfidence: 0.9,
        gapsIdentified: [],
        needsRefinement: false,
      });

      await agenticSearch('Test query', {
        orgId: 'org-123',
        userId: 'user-123',
        logResults: true,
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('agentic_search_logs');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          org_id: 'org-123',
          user_id: 'user-123',
          original_query: 'Test query',
        })
      );
    });

    it('should not throw if logging fails', async () => {
      const subQuery = createMockSubQuery('q1', 'Test query');

      (decomposeQuery as jest.Mock).mockResolvedValue({
        originalQuery: 'Test query',
        intent: 'single_fact',
        complexity: 1,
        subQueries: [subQuery],
        reasoning: 'Simple',
      });

      (planExecutionOrder as jest.Mock).mockReturnValue([[subQuery]]);

      const mockResults = [createMockSearchResult('chunk-1', 'Content')];

      (vectorSearch as jest.Mock).mockResolvedValue(mockResults);

      (evaluateResults as jest.Mock).mockResolvedValue({
        relevant: mockResults,
        irrelevant: [],
        evaluations: [{ chunkId: 'chunk-1', isRelevant: true, confidence: 0.9, reasoning: 'Good' }],
        avgConfidence: 0.9,
        gapsIdentified: [],
        needsRefinement: false,
      });

      // Make logging fail
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      // Should not throw
      await expect(
        agenticSearch('Test query', {
          orgId: 'org-123',
          logResults: true,
        })
      ).resolves.toBeDefined();
    });

    it('should calculate metadata correctly', async () => {
      const subQuery1 = createMockSubQuery('q1', 'Query 1');
      const subQuery2 = createMockSubQuery('q2', 'Query 2');

      (decomposeQuery as jest.Mock).mockResolvedValue({
        originalQuery: 'Test',
        intent: 'multi_part',
        complexity: 3,
        subQueries: [subQuery1, subQuery2],
        reasoning: 'Multi-part',
      });

      (planExecutionOrder as jest.Mock).mockReturnValue([[subQuery1, subQuery2]]);

      const mockResults1 = [createMockSearchResult('chunk-1', 'Content 1')];
      const mockResults2 = [createMockSearchResult('chunk-2', 'Content 2')];

      (vectorSearch as jest.Mock)
        .mockResolvedValueOnce(mockResults1)
        .mockResolvedValueOnce(mockResults2);

      (evaluateResults as jest.Mock)
        .mockResolvedValueOnce({
          relevant: mockResults1,
          irrelevant: [],
          evaluations: [{ chunkId: 'chunk-1', isRelevant: true, confidence: 0.9, reasoning: 'Good' }],
          avgConfidence: 0.9,
          gapsIdentified: ['Gap 1'],
          needsRefinement: true,
        })
        .mockResolvedValueOnce({
          relevant: mockResults2,
          irrelevant: [],
          evaluations: [{ chunkId: 'chunk-2', isRelevant: true, confidence: 0.85, reasoning: 'Good' }],
          avgConfidence: 0.85,
          gapsIdentified: [],
          needsRefinement: false,
        });

      const result = await agenticSearch('Test', {
        orgId: 'org-123',
        logResults: false,
      });

      expect(result.metadata).toEqual({
        iterationCount: 2,
        chunksRetrieved: 2,
        refinements: 1, // Only first iteration needed refinement
        subQueriesExecuted: 2,
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results from vector search', async () => {
      const subQuery = createMockSubQuery('q1', 'Query');

      (decomposeQuery as jest.Mock).mockResolvedValue({
        originalQuery: 'Test',
        intent: 'single_fact',
        complexity: 1,
        subQueries: [subQuery],
        reasoning: 'Simple',
      });

      (planExecutionOrder as jest.Mock).mockReturnValue([[subQuery]]);

      (vectorSearch as jest.Mock).mockResolvedValue([]);

      // Mock evaluateResults for empty case (though it won't be called when results are empty)
      (evaluateResults as jest.Mock).mockResolvedValue({
        relevant: [],
        irrelevant: [],
        evaluations: [],
        avgConfidence: 0,
        gapsIdentified: [],
        needsRefinement: true,
      });

      const result = await agenticSearch('Test', {
        orgId: 'org-123',
        logResults: false,
      });

      expect(result.finalResults).toHaveLength(0);
      expect(result.iterations).toHaveLength(1);
    });

    it('should handle vector search errors gracefully', async () => {
      const subQuery = createMockSubQuery('q1', 'Query');

      (decomposeQuery as jest.Mock).mockResolvedValue({
        originalQuery: 'Test',
        intent: 'single_fact',
        complexity: 1,
        subQueries: [subQuery],
        reasoning: 'Simple',
      });

      (planExecutionOrder as jest.Mock).mockReturnValue([[subQuery]]);

      (vectorSearch as jest.Mock).mockRejectedValue(new Error('Search failed'));

      await expect(
        agenticSearch('Test', {
          orgId: 'org-123',
          logResults: false,
        })
      ).rejects.toThrow('Search failed');
    });

    it('should handle empty sub-queries array', async () => {
      (decomposeQuery as jest.Mock).mockResolvedValue({
        originalQuery: 'Test',
        intent: 'single_fact',
        complexity: 1,
        subQueries: [],
        reasoning: 'Empty',
      });

      (planExecutionOrder as jest.Mock).mockReturnValue([]);

      const result = await agenticSearch('Test', {
        orgId: 'org-123',
        logResults: false,
      });

      expect(result.iterations).toHaveLength(0);
      expect(result.finalResults).toHaveLength(0);
    });
  });
});
