/**
 * Mock for tesseract.js package
 * Used in Jest tests to mock OCR operations
 */

export interface MockRecognizeResult {
  data: {
    text: string;
    confidence: number;
    blocks: Array<{
      text: string;
      confidence: number;
      bbox: {
        x0: number;
        y0: number;
        x1: number;
        y1: number;
      };
    }>;
  };
}

export interface MockWorker {
  recognize: jest.Mock;
  terminate: jest.Mock;
}

const mockWorker: MockWorker = {
  recognize: jest.fn().mockResolvedValue({
    data: {
      text: 'Sample OCR text\nLine 2 of text\nMore content here',
      confidence: 92.5,
      blocks: [
        {
          text: 'Sample OCR text',
          confidence: 95.0,
          bbox: { x0: 10, y0: 10, x1: 200, y1: 30 },
        },
        {
          text: 'Line 2 of text',
          confidence: 90.0,
          bbox: { x0: 10, y0: 40, x1: 180, y1: 60 },
        },
        {
          text: 'More content here',
          confidence: 93.0,
          bbox: { x0: 10, y0: 70, x1: 220, y1: 90 },
        },
      ],
    },
  } as MockRecognizeResult),
  terminate: jest.fn().mockResolvedValue(undefined),
};

const Tesseract = {
  createWorker: jest.fn().mockResolvedValue(mockWorker),
};

export default Tesseract;

// Export mock worker for test manipulation
export const mockTesseractWorker = mockWorker;
