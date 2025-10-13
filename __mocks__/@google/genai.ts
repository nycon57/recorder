/**
 * Mock for @google/genai package
 * Used in Jest tests to avoid ESM import issues
 */

export class GoogleGenAI {
  constructor(config?: any) {
    // Mock constructor
  }

  getGenerativeModel(config: any) {
    return {
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => 'Mock generated content',
        },
      }),
    };
  }

  models = {
    embedContent: jest.fn().mockResolvedValue({
      embeddings: [
        {
          values: new Array(1536).fill(0.1),
        },
      ],
    }),
  };
}

// Export mock functions that tests can access
export const mockGenerateContent = jest.fn();
export const mockEmbedContent = jest.fn();
