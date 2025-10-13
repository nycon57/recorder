/**
 * Mock for sharp package
 * Used in Jest tests to mock image processing
 */

export interface MockSharpInstance {
  jpeg: jest.Mock;
  toBuffer: jest.Mock;
  metadata: jest.Mock;
}

const createMockSharpInstance = (): MockSharpInstance => {
  const instance: MockSharpInstance = {
    jpeg: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-image-data')),
    metadata: jest.fn().mockResolvedValue({
      width: 1920,
      height: 1080,
      format: 'jpeg',
      size: 150000,
    }),
  };
  return instance;
};

const sharp = jest.fn(() => createMockSharpInstance());

export default sharp;

// Export mock instance creator for test manipulation
export const createMockSharp = createMockSharpInstance;
