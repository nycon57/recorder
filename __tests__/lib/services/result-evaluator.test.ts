/**
 * Tests for Result Evaluation Service
 */

import { evaluateResults } from '@/lib/services/result-evaluator';
import { googleAI } from '@/lib/google/client';
import type { SearchResult } from '@/lib/services/vector-search-google';

// Mock Google AI client
jest.mock('@/lib/google/client', () => ({
  googleAI: {
    getGenerativeModel: jest.fn(),
  },
}));

describe('Result Evaluation Service', () => {
  let mockModel: any;

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

    // Default mock model setup
    mockModel = {
      generateContent: jest.fn(),
    };
    (googleAI.getGenerativeModel as jest.Mock).mockReturnValue(mockModel);

    // Clear environment variables
    delete process.env.AGENTIC_CONFIDENCE_THRESHOLD;
  });

  describe('evaluateResults', () => {
    it('should return empty evaluation for no results', async () => {
      const result = await evaluateResults('test query', []);

      expect(result.relevant).toHaveLength(0);
      expect(result.irrelevant).toHaveLength(0);
      expect(result.evaluations).toHaveLength(0);
      expect(result.avgConfidence).toBe(0);
      expect(result.gapsIdentified).toEqual(['No results retrieved']);
      expect(result.needsRefinement).toBe(true);
    });

    it('should evaluate single relevant result', async () => {
      const results = [
        createMockSearchResult('1', 'TypeScript is a typed superset of JavaScript'),
      ];

      const mockResponse = {
        evaluations: [
          {
            chunkIndex: 0,
            isRelevant: true,
            confidence: 0.95,
            reasoning: 'Directly answers the query about TypeScript',
          },
        ],
        gapsIdentified: [],
        needsRefinement: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await evaluateResults('What is TypeScript?', results);

      expect(result.relevant).toHaveLength(1);
      expect(result.irrelevant).toHaveLength(0);
      expect(result.evaluations[0].isRelevant).toBe(true);
      expect(result.evaluations[0].confidence).toBe(0.95);
      expect(result.avgConfidence).toBe(0.95);
      expect(result.needsRefinement).toBe(false);
    });

    it('should evaluate multiple results with mixed relevance', async () => {
      const results = [
        createMockSearchResult('1', 'React is a JavaScript library for building UIs'),
        createMockSearchResult('2', 'Vue is a progressive JavaScript framework'),
        createMockSearchResult('3', 'Python is a programming language'),
      ];

      const mockResponse = {
        evaluations: [
          { chunkIndex: 0, isRelevant: true, confidence: 0.9, reasoning: 'About React' },
          { chunkIndex: 1, isRelevant: true, confidence: 0.85, reasoning: 'About Vue' },
          { chunkIndex: 2, isRelevant: false, confidence: 0.3, reasoning: 'About Python, not relevant' },
        ],
        gapsIdentified: ['Need more details on differences'],
        needsRefinement: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await evaluateResults('Compare React and Vue', results);

      expect(result.relevant).toHaveLength(2);
      expect(result.irrelevant).toHaveLength(1);
      expect(result.avgConfidence).toBeCloseTo((0.9 + 0.85 + 0.3) / 3, 2);
      expect(result.gapsIdentified).toContain('Need more details on differences');
    });

    it('should handle JSON in markdown code blocks', async () => {
      const results = [createMockSearchResult('1', 'Test content')];

      const mockResponse = {
        evaluations: [
          { chunkIndex: 0, isRelevant: true, confidence: 0.8, reasoning: 'Relevant' },
        ],
        gapsIdentified: [],
        needsRefinement: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => `\`\`\`json\n${JSON.stringify(mockResponse)}\n\`\`\``,
        },
      });

      const result = await evaluateResults('test query', results);

      expect(result.relevant).toHaveLength(1);
      expect(result.evaluations[0].confidence).toBe(0.8);
    });

    it('should truncate long chunk text in prompt', async () => {
      const longText = 'A'.repeat(1000);
      const results = [createMockSearchResult('1', longText)];

      const mockResponse = {
        evaluations: [
          { chunkIndex: 0, isRelevant: true, confidence: 0.8, reasoning: 'Relevant' },
        ],
        gapsIdentified: [],
        needsRefinement: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      await evaluateResults('test query', results);

      // Verify prompt was created (model was called)
      expect(mockModel.generateContent).toHaveBeenCalledTimes(1);
      const callArg = mockModel.generateContent.mock.calls[0][0];
      // Should truncate to 500 chars + "..."
      expect(callArg).toContain('...');
    });

    it('should use confidence threshold from environment', async () => {
      process.env.AGENTIC_CONFIDENCE_THRESHOLD = '0.9';

      const results = [createMockSearchResult('1', 'Test content')];

      const mockResponse = {
        evaluations: [
          { chunkIndex: 0, isRelevant: true, confidence: 0.85, reasoning: 'Relevant' },
        ],
        gapsIdentified: [],
        needsRefinement: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await evaluateResults('test query', results);

      // avgConfidence (0.85) < threshold (0.9), so refinement needed
      expect(result.needsRefinement).toBe(true);
    });

    it('should respect needsRefinement from LLM when confidence is high', async () => {
      const results = [createMockSearchResult('1', 'Test content')];

      const mockResponse = {
        evaluations: [
          { chunkIndex: 0, isRelevant: true, confidence: 0.95, reasoning: 'Relevant' },
        ],
        gapsIdentified: ['Missing important context'],
        needsRefinement: true, // LLM says refinement needed
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await evaluateResults('test query', results);

      // Even with high confidence, LLM says refinement needed
      expect(result.avgConfidence).toBe(0.95);
      expect(result.needsRefinement).toBe(true);
    });

    it('should fall back gracefully on LLM error', async () => {
      const results = [
        createMockSearchResult('1', 'Test content 1'),
        createMockSearchResult('2', 'Test content 2'),
      ];

      mockModel.generateContent.mockRejectedValue(new Error('API error'));

      const result = await evaluateResults('test query', results);

      // Should accept all results with fallback evaluation
      expect(result.relevant).toHaveLength(2);
      expect(result.irrelevant).toHaveLength(0);
      expect(result.avgConfidence).toBe(0.7);
      expect(result.evaluations).toHaveLength(2);
      expect(result.evaluations[0].reasoning).toBe('Fallback evaluation');
      expect(result.needsRefinement).toBe(false);
    });

    it('should fall back gracefully on invalid JSON', async () => {
      const results = [createMockSearchResult('1', 'Test content')];

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'This is not JSON',
        },
      });

      const result = await evaluateResults('test query', results);

      expect(result.relevant).toHaveLength(1);
      expect(result.avgConfidence).toBe(0.7);
      expect(result.evaluations[0].reasoning).toBe('Fallback evaluation');
    });

    it('should handle partial evaluation data', async () => {
      const results = [
        createMockSearchResult('1', 'Test 1'),
        createMockSearchResult('2', 'Test 2'),
      ];

      const mockResponse = {
        evaluations: [
          // Only one evaluation when there are two results
          { chunkIndex: 0, isRelevant: true, confidence: 0.9, reasoning: 'Relevant' },
        ],
        gapsIdentified: [],
        needsRefinement: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await evaluateResults('test query', results);

      // Should handle gracefully
      expect(result.evaluations).toHaveLength(1);
      expect(result.relevant).toHaveLength(1);
      expect(result.irrelevant).toHaveLength(1);
    });

    it('should map chunk IDs correctly', async () => {
      const results = [
        createMockSearchResult('chunk-123', 'Content 1'),
        createMockSearchResult('chunk-456', 'Content 2'),
      ];

      const mockResponse = {
        evaluations: [
          { chunkIndex: 0, isRelevant: true, confidence: 0.9, reasoning: 'Good' },
          { chunkIndex: 1, isRelevant: false, confidence: 0.4, reasoning: 'Not relevant' },
        ],
        gapsIdentified: [],
        needsRefinement: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await evaluateResults('test query', results);

      expect(result.evaluations[0].chunkId).toBe('chunk-123');
      expect(result.evaluations[1].chunkId).toBe('chunk-456');
    });

    it('should handle out-of-bounds chunk indices', async () => {
      const results = [createMockSearchResult('1', 'Test')];

      const mockResponse = {
        evaluations: [
          { chunkIndex: 5, isRelevant: true, confidence: 0.9, reasoning: 'Good' }, // Invalid index
        ],
        gapsIdentified: [],
        needsRefinement: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await evaluateResults('test query', results);

      // Should handle gracefully
      expect(result.evaluations[0].chunkId).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty query string', async () => {
      const results = [createMockSearchResult('1', 'Test')];

      const mockResponse = {
        evaluations: [
          { chunkIndex: 0, isRelevant: false, confidence: 0.5, reasoning: 'Empty query' },
        ],
        gapsIdentified: ['Query is empty'],
        needsRefinement: true,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await evaluateResults('', results);

      expect(result.relevant).toHaveLength(0);
      expect(result.irrelevant).toHaveLength(1);
    });

    it('should handle results with missing metadata', async () => {
      const results = [
        {
          id: '1',
          recordingId: 'rec-1',
          recordingTitle: 'Test',
          chunkText: 'Test content',
          similarity: 0.8,
          metadata: {} as any,
          createdAt: new Date().toISOString(),
        },
      ];

      const mockResponse = {
        evaluations: [
          { chunkIndex: 0, isRelevant: true, confidence: 0.8, reasoning: 'Relevant' },
        ],
        gapsIdentified: [],
        needsRefinement: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await evaluateResults('test', results);

      expect(result.relevant).toHaveLength(1);
    });

    it('should handle very low confidence evaluations', async () => {
      const results = [
        createMockSearchResult('1', 'Completely unrelated content'),
      ];

      const mockResponse = {
        evaluations: [
          { chunkIndex: 0, isRelevant: false, confidence: 0.1, reasoning: 'Not relevant at all' },
        ],
        gapsIdentified: ['Need completely different content'],
        needsRefinement: true,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await evaluateResults('very specific query', results);

      expect(result.irrelevant).toHaveLength(1);
      expect(result.avgConfidence).toBe(0.1);
      expect(result.needsRefinement).toBe(true);
    });

    it('should calculate average confidence correctly', async () => {
      const results = [
        createMockSearchResult('1', 'Content 1'),
        createMockSearchResult('2', 'Content 2'),
        createMockSearchResult('3', 'Content 3'),
      ];

      const mockResponse = {
        evaluations: [
          { chunkIndex: 0, isRelevant: true, confidence: 0.9, reasoning: 'Good' },
          { chunkIndex: 1, isRelevant: true, confidence: 0.8, reasoning: 'Good' },
          { chunkIndex: 2, isRelevant: true, confidence: 0.7, reasoning: 'OK' },
        ],
        gapsIdentified: [],
        needsRefinement: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await evaluateResults('test', results);

      expect(result.avgConfidence).toBeCloseTo((0.9 + 0.8 + 0.7) / 3, 2);
    });

    it('should handle missing gapsIdentified field', async () => {
      const results = [createMockSearchResult('1', 'Test')];

      const mockResponse = {
        evaluations: [
          { chunkIndex: 0, isRelevant: true, confidence: 0.8, reasoning: 'Good' },
        ],
        // gapsIdentified missing
        needsRefinement: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await evaluateResults('test', results);

      expect(result.gapsIdentified).toEqual([]);
    });

    it('should handle large number of results', async () => {
      const results = Array.from({ length: 50 }, (_, i) =>
        createMockSearchResult(`${i}`, `Content ${i}`)
      );

      const mockResponse = {
        evaluations: results.map((_, i) => ({
          chunkIndex: i,
          isRelevant: i % 2 === 0, // Half relevant
          confidence: 0.7 + (i % 10) / 100,
          reasoning: 'Test',
        })),
        gapsIdentified: [],
        needsRefinement: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await evaluateResults('test', results);

      expect(result.relevant).toHaveLength(25);
      expect(result.irrelevant).toHaveLength(25);
      expect(result.evaluations).toHaveLength(50);
    });
  });
});
