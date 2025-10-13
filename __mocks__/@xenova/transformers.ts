/**
 * Mock for @xenova/transformers package
 * Used in Jest tests to avoid ESM import issues and heavy model loading
 */

// Mock embeddings data (384-dimensional vector for all-MiniLM-L6-v2)
const createMockEmbedding = (length: number = 384): number[] => {
  return Array(length).fill(0).map(() => Math.random() * 0.1);
};

// Mock pipeline function
export const pipeline = jest.fn().mockImplementation(async (task: string, model: string, options?: any) => {
  console.log(`[Mock] Loading pipeline: ${task}, model: ${model}`);

  if (task === 'feature-extraction') {
    // Return a mock feature extraction pipeline
    return jest.fn().mockImplementation(async (text: string | string[], options?: any) => {
      console.log(`[Mock] Generating embeddings for: ${Array.isArray(text) ? text.length : 1} texts`);

      // Return mock embedding
      const embedding = createMockEmbedding(384);

      return {
        data: new Float32Array(embedding),
        dims: [1, 384],
      };
    });
  }

  // Default mock for other pipelines
  return jest.fn().mockResolvedValue({
    data: new Float32Array([0.1, 0.2, 0.3]),
  });
});

// Mock Pipeline type
export class Pipeline {
  constructor(task: string, model: string, options?: any) {
    // Mock constructor
  }
}

// Export other commonly used types/functions
export const env = {
  allowLocalModels: true,
  useBrowserCache: true,
  cacheDir: './.cache',
};
