/**
 * Tests for Query Intent Classification Service
 */

import { classifyQueryIntent } from '@/lib/services/query-intent';
import { googleAI } from '@/lib/google/client';

// Mock Google AI client
jest.mock('@/lib/google/client', () => ({
  googleAI: {
    getGenerativeModel: jest.fn(),
  },
}));

// Mock timeout utility to avoid actual timeouts in tests
jest.mock('@/lib/utils/timeout', () => ({
  withTimeout: jest.fn((promise) => promise), // Just pass through, preserving rejection
}));

describe('Query Intent Classification', () => {
  let mockModel: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock model setup
    mockModel = {
      generateContent: jest.fn(),
    };
    (googleAI.getGenerativeModel as jest.Mock).mockReturnValue(mockModel);
  });

  describe('classifyQueryIntent', () => {
    it('should classify single_fact query correctly', async () => {
      const mockResponse = {
        intent: 'single_fact',
        confidence: 0.9,
        complexity: 1,
        reasoning: 'Simple factual question',
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await classifyQueryIntent('What is TypeScript?');

      expect(result).toEqual(mockResponse);
      expect(result.intent).toBe('single_fact');
      expect(result.complexity).toBe(1);
      expect(result.confidence).toBe(0.9);
      expect(mockModel.generateContent).toHaveBeenCalledTimes(1);
    });

    it('should classify comparison query correctly', async () => {
      const mockResponse = {
        intent: 'comparison',
        confidence: 0.85,
        complexity: 4,
        reasoning: 'Comparing two technologies',
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await classifyQueryIntent('What is the difference between React and Vue?');

      expect(result.intent).toBe('comparison');
      expect(result.complexity).toBe(4);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should classify how_to query correctly', async () => {
      const mockResponse = {
        intent: 'how_to',
        confidence: 0.92,
        complexity: 3,
        reasoning: 'Procedural instructions requested',
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await classifyQueryIntent('How do I deploy a Next.js app?');

      expect(result.intent).toBe('how_to');
      expect(result.complexity).toBe(3);
    });

    it('should classify multi_part query correctly', async () => {
      const mockResponse = {
        intent: 'multi_part',
        confidence: 0.88,
        complexity: 3,
        reasoning: 'Multiple questions combined',
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await classifyQueryIntent('Explain TypeScript and how it differs from JavaScript?');

      expect(result.intent).toBe('multi_part');
      expect(result.complexity).toBeGreaterThanOrEqual(3);
    });

    it('should classify exploration query correctly', async () => {
      const mockResponse = {
        intent: 'exploration',
        confidence: 0.80,
        complexity: 5,
        reasoning: 'Open-ended research query',
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await classifyQueryIntent('Tell me about quantum computing');

      expect(result.intent).toBe('exploration');
      expect(result.complexity).toBe(5);
    });

    it('should handle JSON in markdown code blocks', async () => {
      const mockResponse = {
        intent: 'single_fact',
        confidence: 0.9,
        complexity: 1,
        reasoning: 'Simple question',
      };

      // Simulate response wrapped in markdown code blocks
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => `\`\`\`json\n${JSON.stringify(mockResponse)}\n\`\`\``,
        },
      });

      const result = await classifyQueryIntent('What is AI?');

      expect(result.intent).toBe('single_fact');
      expect(result.confidence).toBe(0.9);
    });

    it('should handle response with extra text around JSON', async () => {
      const mockResponse = {
        intent: 'comparison',
        confidence: 0.85,
        complexity: 4,
        reasoning: 'Comparison query',
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => `Here is the classification:\n\n${JSON.stringify(mockResponse)}\n\nThis query requires comparison.`,
        },
      });

      const result = await classifyQueryIntent('Compare A and B');

      expect(result.intent).toBe('comparison');
      expect(result.complexity).toBe(4);
    });

    it('should fall back to heuristics when LLM returns invalid JSON', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'This is not valid JSON at all',
        },
      });

      const result = await classifyQueryIntent('What is the difference between X and Y?');

      // Should use fallback classification
      expect(result.intent).toBe('comparison');
      expect(result.confidence).toBe(0.7);
      expect(result.reasoning).toContain('comparison keywords');
    });

    it('should throw error when LLM call fails', async () => {
      // The API call is not wrapped in try-catch, so errors should propagate
      mockModel.generateContent.mockRejectedValue(new Error('API error'));

      // Should throw the error
      await expect(classifyQueryIntent('How to build a website')).rejects.toThrow('API error');
    });

    describe('Fallback Classification', () => {
      beforeEach(() => {
        // Make LLM fail to test fallback logic
        mockModel.generateContent.mockResolvedValue({
          response: {
            text: () => 'invalid',
          },
        });
      });

      it('should detect comparison queries', async () => {
        const queries = [
          'What is the difference between X and Y?',
          'Compare A and B',
          'X vs Y',
          'Which is better, A or B?',
        ];

        for (const query of queries) {
          const result = await classifyQueryIntent(query);
          expect(result.intent).toBe('comparison');
          expect(result.complexity).toBe(4);
        }
      });

      it('should detect how-to queries', async () => {
        const queries = [
          'How to build a website',
          'How do I install Node.js',
          'Steps to deploy an app',
        ];

        for (const query of queries) {
          const result = await classifyQueryIntent(query);
          expect(result.intent).toBe('how_to');
          expect(result.complexity).toBe(3);
        }
      });

      it('should detect multi-part queries', async () => {
        const queries = [
          'Explain A and B',
          'What are X, Y, and Z?',
          'What is A? What is B?',
        ];

        for (const query of queries) {
          const result = await classifyQueryIntent(query);
          expect(result.intent).toBe('multi_part');
          expect(result.complexity).toBe(3);
        }
      });

      it('should detect exploration queries', async () => {
        const queries = [
          'Tell me about quantum computing',
          'Explain machine learning',
          'What is artificial intelligence',
        ];

        for (const query of queries) {
          const result = await classifyQueryIntent(query);
          expect(result.intent).toBe('exploration');
          expect(result.complexity).toBeGreaterThanOrEqual(2);
        }
      });

      it('should default to single_fact for simple queries', async () => {
        const result = await classifyQueryIntent('Simple question');

        expect(result.intent).toBe('single_fact');
        expect(result.confidence).toBe(0.5);
        expect(result.complexity).toBe(1);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty query', async () => {
        mockModel.generateContent.mockResolvedValue({
          response: {
            text: () => 'invalid',
          },
        });

        const result = await classifyQueryIntent('');

        expect(result.intent).toBe('single_fact');
        expect(result.confidence).toBeLessThanOrEqual(1.0);
      });

      it('should handle very long query', async () => {
        const mockResponse = {
          intent: 'exploration',
          confidence: 0.75,
          complexity: 5,
          reasoning: 'Complex multi-part query',
        };

        mockModel.generateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify(mockResponse),
          },
        });

        const longQuery = 'A'.repeat(1000) + ' and B'.repeat(1000);
        const result = await classifyQueryIntent(longQuery);

        expect(result.intent).toBeDefined();
        expect(result.complexity).toBeGreaterThanOrEqual(1);
        expect(result.complexity).toBeLessThanOrEqual(5);
      });

      it('should handle queries with special characters', async () => {
        const mockResponse = {
          intent: 'how_to',
          confidence: 0.85,
          complexity: 3,
          reasoning: 'Technical query',
        };

        mockModel.generateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify(mockResponse),
          },
        });

        const result = await classifyQueryIntent('How to use @decorators in TypeScript?');

        expect(result.intent).toBe('how_to');
      });

      it('should validate confidence is between 0 and 1', async () => {
        const mockResponse = {
          intent: 'single_fact',
          confidence: 0.9,
          complexity: 2,
          reasoning: 'Test',
        };

        mockModel.generateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify(mockResponse),
          },
        });

        const result = await classifyQueryIntent('Test query');

        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      });

      it('should validate complexity is between 1 and 5', async () => {
        const mockResponse = {
          intent: 'single_fact',
          confidence: 0.9,
          complexity: 2,
          reasoning: 'Test',
        };

        mockModel.generateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify(mockResponse),
          },
        });

        const result = await classifyQueryIntent('Test query');

        expect(result.complexity).toBeGreaterThanOrEqual(1);
        expect(result.complexity).toBeLessThanOrEqual(5);
      });
    });

    describe('Performance', () => {
      it('should complete classification within reasonable time', async () => {
        mockModel.generateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              intent: 'single_fact',
              confidence: 0.9,
              complexity: 1,
              reasoning: 'Fast response',
            }),
          },
        });

        const start = Date.now();
        await classifyQueryIntent('Quick test');
        const duration = Date.now() - start;

        // Should complete quickly (mocked, so should be nearly instant)
        expect(duration).toBeLessThan(1000);
      });
    });
  });
});
