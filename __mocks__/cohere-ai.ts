/**
 * Mock for cohere-ai package
 * Used in Jest tests
 */

export class CohereClient {
  constructor(config?: any) {
    // Mock constructor
  }

  rerank = jest.fn().mockResolvedValue({
    results: [],
  });
}

export const mockRerank = jest.fn();
