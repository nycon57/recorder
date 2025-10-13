/**
 * OCR Service Unit Tests
 *
 * Tests text extraction from images including:
 * - Basic text extraction
 * - Confidence filtering
 * - Bounding box extraction
 * - Various image types
 * - Error handling
 */

import { extractText, extractFrameText } from '@/lib/services/ocr-service';
import Tesseract from 'tesseract.js';
import { mockTesseractWorker } from '../../../__mocks__/tesseract.js';

// Mock Tesseract
jest.mock('tesseract.js');

describe('OCR Service', () => {
  const mockImagePath = '/tmp/test-frame.jpg';

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock response
    mockTesseractWorker.recognize.mockResolvedValue({
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
    });

    mockTesseractWorker.terminate.mockResolvedValue(undefined);
  });

  describe('extractText', () => {
    it('should extract text from image', async () => {
      const result = await extractText(mockImagePath);

      expect(result).toMatchObject({
        text: expect.stringContaining('Sample OCR text'),
        confidence: 92.5,
        blocks: expect.arrayContaining([
          expect.objectContaining({
            text: 'Sample OCR text',
            confidence: 95.0,
          }),
        ]),
      });

      expect(Tesseract.createWorker).toHaveBeenCalledWith('eng');
      expect(mockTesseractWorker.recognize).toHaveBeenCalledWith(mockImagePath);
    });

    it('should extract bounding boxes for all text blocks', async () => {
      const result = await extractText(mockImagePath);

      expect(result.blocks).toHaveLength(3);
      result.blocks.forEach((block) => {
        expect(block.bbox).toMatchObject({
          x0: expect.any(Number),
          y0: expect.any(Number),
          x1: expect.any(Number),
          y1: expect.any(Number),
        });
      });
    });

    it('should include confidence scores for each block', async () => {
      const result = await extractText(mockImagePath);

      expect(result.blocks[0].confidence).toBe(95.0);
      expect(result.blocks[1].confidence).toBe(90.0);
      expect(result.blocks[2].confidence).toBe(93.0);
    });

    it('should terminate worker after processing', async () => {
      await extractText(mockImagePath);

      expect(mockTesseractWorker.terminate).toHaveBeenCalled();
    });

    it('should terminate worker even on error', async () => {
      mockTesseractWorker.recognize.mockRejectedValueOnce(new Error('OCR failed'));

      await expect(extractText(mockImagePath)).rejects.toThrow('OCR failed');
      expect(mockTesseractWorker.terminate).toHaveBeenCalled();
    });

    it('should handle empty text', async () => {
      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: '',
          confidence: 0,
          blocks: [],
        },
      });

      const result = await extractText(mockImagePath);

      expect(result.text).toBe('');
      expect(result.blocks).toHaveLength(0);
    });

    it('should handle missing blocks', async () => {
      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: 'Some text',
          confidence: 85,
          blocks: null,
        },
      });

      const result = await extractText(mockImagePath);

      expect(result.blocks).toEqual([]);
    });

    it('should preserve multi-line text', async () => {
      const multiLineText = 'Line 1\nLine 2\nLine 3';
      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: multiLineText,
          confidence: 88,
          blocks: [],
        },
      });

      const result = await extractText(mockImagePath);

      expect(result.text).toBe(multiLineText);
    });

    it('should handle special characters', async () => {
      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: 'Email: test@example.com\nPrice: $99.99',
          confidence: 87,
          blocks: [],
        },
      });

      const result = await extractText(mockImagePath);

      expect(result.text).toContain('@');
      expect(result.text).toContain('$');
    });

    it('should create worker with correct language', async () => {
      await extractText(mockImagePath);

      expect(Tesseract.createWorker).toHaveBeenCalledWith('eng');
    });
  });

  describe('extractFrameText', () => {
    it('should filter low-confidence blocks', async () => {
      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: 'High conf\nLow conf\nHigh conf',
          confidence: 85,
          blocks: [
            { text: 'High conf', confidence: 95, bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } },
            { text: 'Low conf', confidence: 50, bbox: { x0: 0, y0: 30, x1: 100, y1: 50 } },
            { text: 'High conf', confidence: 92, bbox: { x0: 0, y0: 60, x1: 100, y1: 80 } },
          ],
        },
      });

      const result = await extractFrameText(mockImagePath, 70);

      expect(result.blocks).toHaveLength(2);
      expect(result.text).toContain('High conf');
      expect(result.text).not.toContain('Low conf');
    });

    it('should use environment variable for default threshold', async () => {
      process.env.OCR_CONFIDENCE_THRESHOLD = '80';

      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: 'Test',
          confidence: 85,
          blocks: [
            { text: 'High', confidence: 85, bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } },
            { text: 'Low', confidence: 75, bbox: { x0: 0, y0: 30, x1: 100, y1: 50 } },
          ],
        },
      });

      const result = await extractFrameText(mockImagePath);

      expect(result.blocks).toHaveLength(1);
      expect(result.text).toBe('High');

      delete process.env.OCR_CONFIDENCE_THRESHOLD;
    });

    it('should join filtered text with spaces', async () => {
      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: 'Word1 Word2 Word3',
          confidence: 90,
          blocks: [
            { text: 'Word1', confidence: 95, bbox: { x0: 0, y0: 0, x1: 50, y1: 20 } },
            { text: 'Word2', confidence: 92, bbox: { x0: 60, y0: 0, x1: 110, y1: 20 } },
            { text: 'Word3', confidence: 88, bbox: { x0: 120, y0: 0, x1: 170, y1: 20 } },
          ],
        },
      });

      const result = await extractFrameText(mockImagePath, 70);

      expect(result.text).toBe('Word1 Word2 Word3');
    });

    it('should preserve overall confidence', async () => {
      const result = await extractFrameText(mockImagePath);

      expect(result.confidence).toBe(92.5);
    });

    it('should handle all blocks below threshold', async () => {
      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: 'Low conf',
          confidence: 40,
          blocks: [
            { text: 'Low', confidence: 45, bbox: { x0: 0, y0: 0, x1: 50, y1: 20 } },
            { text: 'conf', confidence: 35, bbox: { x0: 60, y0: 0, x1: 110, y1: 20 } },
          ],
        },
      });

      const result = await extractFrameText(mockImagePath, 70);

      expect(result.blocks).toHaveLength(0);
      expect(result.text).toBe('');
    });

    it('should use custom threshold when provided', async () => {
      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: 'Test',
          confidence: 85,
          blocks: [
            { text: 'High', confidence: 95, bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } },
            { text: 'Med', confidence: 85, bbox: { x0: 0, y0: 30, x1: 100, y1: 50 } },
            { text: 'Low', confidence: 75, bbox: { x0: 0, y0: 60, x1: 100, y1: 80 } },
          ],
        },
      });

      const result = await extractFrameText(mockImagePath, 90);

      expect(result.blocks).toHaveLength(1);
      expect(result.text).toBe('High');
    });
  });

  describe('image types', () => {
    it('should handle UI screenshots', async () => {
      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: 'Submit\nCancel\nEmail Address\nPassword',
          confidence: 89,
          blocks: [
            { text: 'Submit', confidence: 92, bbox: { x0: 10, y0: 10, x1: 80, y1: 40 } },
            { text: 'Cancel', confidence: 90, bbox: { x0: 90, y0: 10, x1: 160, y1: 40 } },
            { text: 'Email Address', confidence: 88, bbox: { x0: 10, y0: 60, x1: 150, y1: 80 } },
            { text: 'Password', confidence: 87, bbox: { x0: 10, y0: 90, x1: 120, y1: 110 } },
          ],
        },
      });

      const result = await extractText(mockImagePath);

      expect(result.text).toContain('Submit');
      expect(result.text).toContain('Email Address');
      expect(result.blocks).toHaveLength(4);
    });

    it('should handle code screenshots', async () => {
      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: 'function hello() {\n  console.log("Hello");\n}',
          confidence: 85,
          blocks: [
            { text: 'function hello() {', confidence: 88, bbox: { x0: 20, y0: 20, x1: 200, y1: 40 } },
            { text: '  console.log("Hello");', confidence: 82, bbox: { x0: 20, y0: 50, x1: 250, y1: 70 } },
            { text: '}', confidence: 85, bbox: { x0: 20, y0: 80, x1: 40, y1: 100 } },
          ],
        },
      });

      const result = await extractText(mockImagePath);

      expect(result.text).toContain('function');
      expect(result.text).toContain('console.log');
    });

    it('should handle terminal screenshots', async () => {
      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: '$ npm install\n+ package@1.0.0\nadded 42 packages',
          confidence: 86,
          blocks: [
            { text: '$ npm install', confidence: 90, bbox: { x0: 5, y0: 5, x1: 150, y1: 25 } },
            { text: '+ package@1.0.0', confidence: 88, bbox: { x0: 5, y0: 30, x1: 180, y1: 50 } },
            { text: 'added 42 packages', confidence: 82, bbox: { x0: 5, y0: 55, x1: 200, y1: 75 } },
          ],
        },
      });

      const result = await extractText(mockImagePath);

      expect(result.text).toContain('npm install');
      expect(result.text).toContain('packages');
    });

    it('should handle error messages', async () => {
      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: 'Error: Cannot find module\nat Function.Module._resolveFilename',
          confidence: 84,
          blocks: [
            { text: 'Error: Cannot find module', confidence: 88, bbox: { x0: 10, y0: 10, x1: 250, y1: 30 } },
            { text: 'at Function.Module._resolveFilename', confidence: 80, bbox: { x0: 10, y0: 40, x1: 300, y1: 60 } },
          ],
        },
      });

      const result = await extractText(mockImagePath);

      expect(result.text).toContain('Error:');
      expect(result.text).toContain('Cannot find module');
    });
  });

  describe('bounding boxes', () => {
    it('should provide accurate bounding boxes', async () => {
      const result = await extractText(mockImagePath);

      result.blocks.forEach((block) => {
        expect(block.bbox.x0).toBeLessThan(block.bbox.x1);
        expect(block.bbox.y0).toBeLessThan(block.bbox.y1);
        expect(block.bbox.x0).toBeGreaterThanOrEqual(0);
        expect(block.bbox.y0).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle overlapping text regions', async () => {
      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: 'Text1 Text2',
          confidence: 90,
          blocks: [
            { text: 'Text1', confidence: 92, bbox: { x0: 10, y0: 10, x1: 60, y1: 30 } },
            { text: 'Text2', confidence: 88, bbox: { x0: 50, y0: 10, x1: 100, y1: 30 } },
          ],
        },
      });

      const result = await extractText(mockImagePath);

      expect(result.blocks).toHaveLength(2);
      // Boxes can overlap - this is valid
    });

    it('should handle zero-size blocks', async () => {
      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: 'Tiny',
          confidence: 85,
          blocks: [
            { text: 'Tiny', confidence: 85, bbox: { x0: 10, y0: 10, x1: 10, y1: 10 } },
          ],
        },
      });

      const result = await extractText(mockImagePath);

      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].bbox).toMatchObject({
        x0: 10,
        y0: 10,
        x1: 10,
        y1: 10,
      });
    });
  });

  describe('error handling', () => {
    it('should propagate OCR errors', async () => {
      mockTesseractWorker.recognize.mockRejectedValueOnce(new Error('Image load failed'));

      await expect(extractText(mockImagePath)).rejects.toThrow('Image load failed');
    });

    it('should handle worker creation errors', async () => {
      (Tesseract.createWorker as jest.Mock).mockRejectedValueOnce(
        new Error('Failed to load language data')
      );

      await expect(extractText(mockImagePath)).rejects.toThrow('Failed to load language data');
    });

    it('should handle invalid image paths', async () => {
      mockTesseractWorker.recognize.mockRejectedValueOnce(new Error('ENOENT: no such file'));

      await expect(extractText('/invalid/path.jpg')).rejects.toThrow('ENOENT');
    });

    it('should handle corrupt images', async () => {
      mockTesseractWorker.recognize.mockRejectedValueOnce(
        new Error('Invalid JPEG image')
      );

      await expect(extractText(mockImagePath)).rejects.toThrow('Invalid JPEG image');
    });
  });

  describe('performance', () => {
    it('should complete OCR in reasonable time', async () => {
      const startTime = Date.now();

      await extractText(mockImagePath);

      const duration = Date.now() - startTime;

      // Should complete quickly (mocked)
      expect(duration).toBeLessThan(100);
    });

    it('should handle large images', async () => {
      const largeText = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');
      const largeBlocks = Array.from({ length: 100 }, (_, i) => ({
        text: `Line ${i + 1}`,
        confidence: 90,
        bbox: { x0: 10, y0: 10 + i * 20, x1: 200, y1: 30 + i * 20 },
      }));

      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: largeText,
          confidence: 90,
          blocks: largeBlocks,
        },
      });

      const result = await extractText(mockImagePath);

      expect(result.blocks).toHaveLength(100);
    });
  });

  describe('edge cases', () => {
    it('should handle empty image', async () => {
      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: '',
          confidence: 0,
          blocks: [],
        },
      });

      const result = await extractText(mockImagePath);

      expect(result.text).toBe('');
      expect(result.confidence).toBe(0);
    });

    it('should handle single character', async () => {
      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: 'A',
          confidence: 95,
          blocks: [
            { text: 'A', confidence: 95, bbox: { x0: 10, y0: 10, x1: 20, y1: 30 } },
          ],
        },
      });

      const result = await extractText(mockImagePath);

      expect(result.text).toBe('A');
      expect(result.blocks).toHaveLength(1);
    });

    it('should handle whitespace-only text', async () => {
      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: '   \n\t  ',
          confidence: 10,
          blocks: [],
        },
      });

      const result = await extractText(mockImagePath);

      expect(result.text).toBe('   \n\t  ');
      expect(result.blocks).toHaveLength(0);
    });

    it('should handle very low confidence', async () => {
      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: 'Uncertain text',
          confidence: 5,
          blocks: [
            { text: 'Uncertain text', confidence: 5, bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } },
          ],
        },
      });

      const result = await extractText(mockImagePath);

      expect(result.confidence).toBe(5);
    });

    it('should handle unicode characters', async () => {
      mockTesseractWorker.recognize.mockResolvedValueOnce({
        data: {
          text: 'Hello 世界 🌍',
          confidence: 85,
          blocks: [
            { text: 'Hello 世界 🌍', confidence: 85, bbox: { x0: 10, y0: 10, x1: 200, y1: 30 } },
          ],
        },
      });

      const result = await extractText(mockImagePath);

      expect(result.text).toContain('世界');
      expect(result.text).toContain('🌍');
    });
  });
});
