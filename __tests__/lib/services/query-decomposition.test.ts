/**
 * Tests for Query Decomposition Service
 */

import { decomposeQuery, planExecutionOrder } from '@/lib/services/query-decomposition';
import { classifyQueryIntent } from '@/lib/services/query-intent';
import { googleAI } from '@/lib/google/client';
import type { SubQuery } from '@/lib/types/agentic-rag';

// Mock dependencies
jest.mock('@/lib/google/client', () => ({
  googleAI: {
    getGenerativeModel: jest.fn(),
  },
}));

jest.mock('@/lib/services/query-intent');

describe('Query Decomposition Service', () => {
  let mockModel: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock model setup
    mockModel = {
      generateContent: jest.fn(),
    };
    (googleAI.getGenerativeModel as jest.Mock).mockReturnValue(mockModel);
  });

  describe('decomposeQuery', () => {
    it('should skip decomposition for simple queries', async () => {
      // Mock simple query classification
      (classifyQueryIntent as jest.Mock).mockResolvedValue({
        intent: 'single_fact',
        confidence: 0.9,
        complexity: 1,
        reasoning: 'Simple factual question',
      });

      const result = await decomposeQuery('What is TypeScript?');

      expect(result.subQueries).toHaveLength(1);
      expect(result.subQueries[0].text).toBe('What is TypeScript?');
      expect(result.subQueries[0].intent).toBe('single_fact');
      expect(result.reasoning).toContain('no decomposition needed');
      expect(mockModel.generateContent).not.toHaveBeenCalled();
    });

    it('should decompose complex comparison query', async () => {
      (classifyQueryIntent as jest.Mock).mockResolvedValue({
        intent: 'comparison',
        confidence: 0.85,
        complexity: 4,
        reasoning: 'Comparing two technologies',
      });

      const mockResponse = {
        reasoning: 'Breaking down comparison into individual technology explanations',
        subQueries: [
          {
            id: 'q1',
            text: 'What is React?',
            intent: 'single_fact',
            dependency: null,
            priority: 5,
          },
          {
            id: 'q2',
            text: 'What is Vue?',
            intent: 'single_fact',
            dependency: null,
            priority: 5,
          },
          {
            id: 'q3',
            text: 'Compare React and Vue features',
            intent: 'comparison',
            dependency: null,
            priority: 4,
          },
        ],
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await decomposeQuery('What is the difference between React and Vue?');

      expect(result.subQueries).toHaveLength(3);
      expect(result.intent).toBe('comparison');
      expect(result.complexity).toBe(4);
      expect(result.reasoning).toBe(mockResponse.reasoning);
      expect(mockModel.generateContent).toHaveBeenCalledTimes(1);
    });

    it('should decompose multi-part query with dependencies', async () => {
      (classifyQueryIntent as jest.Mock).mockResolvedValue({
        intent: 'multi_part',
        confidence: 0.88,
        complexity: 3,
        reasoning: 'Multiple questions',
      });

      const mockResponse = {
        reasoning: 'Breaking down into sequential questions',
        subQueries: [
          {
            id: 'q1',
            text: 'What is TypeScript?',
            intent: 'single_fact',
            dependency: null,
            priority: 5,
          },
          {
            id: 'q2',
            text: 'What are TypeScript benefits?',
            intent: 'exploration',
            dependency: 'q1',
            priority: 4,
          },
        ],
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await decomposeQuery('Explain TypeScript and its benefits');

      expect(result.subQueries).toHaveLength(2);
      expect(result.subQueries[1].dependency).toBe('q1');
    });

    it('should handle how-to query decomposition', async () => {
      (classifyQueryIntent as jest.Mock).mockResolvedValue({
        intent: 'how_to',
        confidence: 0.92,
        complexity: 4,
        reasoning: 'Procedural instructions',
      });

      const mockResponse = {
        reasoning: 'Breaking down into sequential steps',
        subQueries: [
          {
            id: 'q1',
            text: 'What is Next.js deployment?',
            intent: 'single_fact',
            dependency: null,
            priority: 3,
          },
          {
            id: 'q2',
            text: 'What are deployment prerequisites?',
            intent: 'exploration',
            dependency: 'q1',
            priority: 5,
          },
          {
            id: 'q3',
            text: 'What are the deployment steps?',
            intent: 'how_to',
            dependency: 'q2',
            priority: 5,
          },
        ],
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await decomposeQuery('How do I deploy a Next.js application?');

      expect(result.subQueries.length).toBeGreaterThan(1);
      expect(result.intent).toBe('how_to');
    });

    it('should respect MAX_SUBQUERIES environment variable', async () => {
      process.env.MAX_SUBQUERIES = '3';

      (classifyQueryIntent as jest.Mock).mockResolvedValue({
        intent: 'exploration',
        confidence: 0.80,
        complexity: 5,
        reasoning: 'Complex exploration',
      });

      // Mock response with 5 sub-queries
      const mockResponse = {
        reasoning: 'Breaking down exploration',
        subQueries: Array.from({ length: 5 }, (_, i) => ({
          id: `q${i + 1}`,
          text: `Sub-query ${i + 1}`,
          intent: 'single_fact',
          dependency: null,
          priority: 5 - i,
        })),
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await decomposeQuery('Tell me everything about quantum computing');

      // Should be limited to 3
      expect(result.subQueries).toHaveLength(3);

      delete process.env.MAX_SUBQUERIES;
    });

    it('should handle LLM returning invalid JSON', async () => {
      (classifyQueryIntent as jest.Mock).mockResolvedValue({
        intent: 'comparison',
        confidence: 0.85,
        complexity: 4,
        reasoning: 'Comparison query',
      });

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'This is not valid JSON',
        },
      });

      const result = await decomposeQuery('Compare A and B');

      // Should fall back to single query
      expect(result.subQueries).toHaveLength(1);
      expect(result.subQueries[0].text).toBe('Compare A and B');
      expect(result.reasoning).toContain('Fallback');
    });

    it('should throw error when LLM API call fails', async () => {
      (classifyQueryIntent as jest.Mock).mockResolvedValue({
        intent: 'multi_part',
        confidence: 0.85,
        complexity: 3,
        reasoning: 'Multi-part query',
      });

      mockModel.generateContent.mockRejectedValue(new Error('API error'));

      // API errors should propagate (not caught by the function)
      await expect(decomposeQuery('Explain X and Y')).rejects.toThrow('API error');
    });

    it('should extract JSON from markdown code blocks', async () => {
      (classifyQueryIntent as jest.Mock).mockResolvedValue({
        intent: 'comparison',
        confidence: 0.85,
        complexity: 4,
        reasoning: 'Comparison',
      });

      const mockResponse = {
        reasoning: 'Decomposed comparison',
        subQueries: [
          {
            id: 'q1',
            text: 'What is A?',
            intent: 'single_fact',
            dependency: null,
            priority: 5,
          },
        ],
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => `\`\`\`json\n${JSON.stringify(mockResponse)}\n\`\`\``,
        },
      });

      const result = await decomposeQuery('Compare A and B');

      expect(result.subQueries).toHaveLength(1);
      expect(result.subQueries[0].text).toBe('What is A?');
    });

    it('should sanitize sub-query IDs', async () => {
      (classifyQueryIntent as jest.Mock).mockResolvedValue({
        intent: 'multi_part',
        confidence: 0.85,
        complexity: 3,
        reasoning: 'Multi-part',
      });

      const mockResponse = {
        reasoning: 'Decomposition',
        subQueries: [
          {
            // Missing ID
            text: 'Sub-query 1',
            intent: 'single_fact',
            dependency: null,
            priority: 5,
          },
          {
            id: 'q2',
            text: 'Sub-query 2',
            // Missing intent
            dependency: null,
            priority: 4,
          },
        ],
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await decomposeQuery('Multi-part query');

      expect(result.subQueries).toHaveLength(2);
      expect(result.subQueries[0].id).toBe('q1'); // Generated ID
      expect(result.subQueries[1].intent).toBe('single_fact'); // Default intent
    });

    it('should set default priority when missing', async () => {
      (classifyQueryIntent as jest.Mock).mockResolvedValue({
        intent: 'multi_part',
        confidence: 0.85,
        complexity: 3,
        reasoning: 'Multi-part',
      });

      const mockResponse = {
        reasoning: 'Decomposition',
        subQueries: [
          {
            id: 'q1',
            text: 'Sub-query 1',
            intent: 'single_fact',
            dependency: null,
            // Missing priority
          },
        ],
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await decomposeQuery('Test query');

      expect(result.subQueries[0].priority).toBe(3); // Default priority
    });
  });

  describe('planExecutionOrder', () => {
    it('should execute independent queries in parallel', () => {
      const subQueries: SubQuery[] = [
        { id: 'q1', text: 'Query 1', intent: 'single_fact', dependency: null, priority: 5 },
        { id: 'q2', text: 'Query 2', intent: 'single_fact', dependency: null, priority: 5 },
        { id: 'q3', text: 'Query 3', intent: 'single_fact', dependency: null, priority: 5 },
      ];

      const batches = planExecutionOrder(subQueries);

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(3);
    });

    it('should respect dependencies between queries', () => {
      const subQueries: SubQuery[] = [
        { id: 'q1', text: 'Query 1', intent: 'single_fact', dependency: null, priority: 5 },
        { id: 'q2', text: 'Query 2', intent: 'single_fact', dependency: 'q1', priority: 4 },
        { id: 'q3', text: 'Query 3', intent: 'single_fact', dependency: 'q2', priority: 3 },
      ];

      const batches = planExecutionOrder(subQueries);

      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(1);
      expect(batches[0][0].id).toBe('q1');
      expect(batches[1][0].id).toBe('q2');
      expect(batches[2][0].id).toBe('q3');
    });

    it('should handle mixed dependencies', () => {
      const subQueries: SubQuery[] = [
        { id: 'q1', text: 'Query 1', intent: 'single_fact', dependency: null, priority: 5 },
        { id: 'q2', text: 'Query 2', intent: 'single_fact', dependency: null, priority: 5 },
        { id: 'q3', text: 'Query 3', intent: 'single_fact', dependency: 'q1', priority: 4 },
        { id: 'q4', text: 'Query 4', intent: 'single_fact', dependency: 'q1', priority: 4 },
      ];

      const batches = planExecutionOrder(subQueries);

      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(2); // q1 and q2 in parallel
      expect(batches[1]).toHaveLength(2); // q3 and q4 in parallel
    });

    it('should handle circular dependencies gracefully', () => {
      const subQueries: SubQuery[] = [
        { id: 'q1', text: 'Query 1', intent: 'single_fact', dependency: 'q2', priority: 5 },
        { id: 'q2', text: 'Query 2', intent: 'single_fact', dependency: 'q1', priority: 5 },
      ];

      const batches = planExecutionOrder(subQueries);

      // Should execute all queries in one batch to break circular dependency
      expect(batches.length).toBeGreaterThan(0);
      const totalQueries = batches.reduce((sum, batch) => sum + batch.length, 0);
      expect(totalQueries).toBe(2);
    });

    it('should handle single query', () => {
      const subQueries: SubQuery[] = [
        { id: 'q1', text: 'Query 1', intent: 'single_fact', dependency: null, priority: 5 },
      ];

      const batches = planExecutionOrder(subQueries);

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(1);
    });

    it('should handle empty query list', () => {
      const batches = planExecutionOrder([]);

      expect(batches).toHaveLength(0);
    });

    it('should handle complex dependency tree', () => {
      const subQueries: SubQuery[] = [
        { id: 'q1', text: 'Query 1', intent: 'single_fact', dependency: null, priority: 5 },
        { id: 'q2', text: 'Query 2', intent: 'single_fact', dependency: null, priority: 5 },
        { id: 'q3', text: 'Query 3', intent: 'single_fact', dependency: 'q1', priority: 4 },
        { id: 'q4', text: 'Query 4', intent: 'single_fact', dependency: 'q2', priority: 4 },
        { id: 'q5', text: 'Query 5', intent: 'single_fact', dependency: 'q3', priority: 3 },
      ];

      const batches = planExecutionOrder(subQueries);

      expect(batches).toHaveLength(3);
      expect(batches[0]).toContainEqual(expect.objectContaining({ id: 'q1' }));
      expect(batches[0]).toContainEqual(expect.objectContaining({ id: 'q2' }));
      expect(batches[1]).toContainEqual(expect.objectContaining({ id: 'q3' }));
      expect(batches[1]).toContainEqual(expect.objectContaining({ id: 'q4' }));
      expect(batches[2]).toContainEqual(expect.objectContaining({ id: 'q5' }));
    });

    it('should handle invalid dependency references', () => {
      const subQueries: SubQuery[] = [
        { id: 'q1', text: 'Query 1', intent: 'single_fact', dependency: 'nonexistent', priority: 5 },
        { id: 'q2', text: 'Query 2', intent: 'single_fact', dependency: null, priority: 5 },
      ];

      const batches = planExecutionOrder(subQueries);

      // Should still execute all queries
      const totalQueries = batches.reduce((sum, batch) => sum + batch.length, 0);
      expect(totalQueries).toBe(2);
    });
  });

  describe('Integration', () => {
    it('should decompose and plan execution for complex query', async () => {
      (classifyQueryIntent as jest.Mock).mockResolvedValue({
        intent: 'comparison',
        confidence: 0.85,
        complexity: 4,
        reasoning: 'Comparison query',
      });

      const mockResponse = {
        reasoning: 'Breaking down comparison',
        subQueries: [
          {
            id: 'q1',
            text: 'What is React?',
            intent: 'single_fact',
            dependency: null,
            priority: 5,
          },
          {
            id: 'q2',
            text: 'What is Vue?',
            intent: 'single_fact',
            dependency: null,
            priority: 5,
          },
          {
            id: 'q3',
            text: 'Compare features',
            intent: 'comparison',
            dependency: 'q1',
            priority: 4,
          },
        ],
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const decomposition = await decomposeQuery('Compare React and Vue');
      const batches = planExecutionOrder(decomposition.subQueries);

      expect(decomposition.subQueries).toHaveLength(3);
      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(2); // q1 and q2 in parallel
      expect(batches[1]).toHaveLength(1); // q3 depends on q1
    });
  });
});
