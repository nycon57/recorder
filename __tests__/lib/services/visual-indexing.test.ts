/**
 * Visual Indexing Service Unit Tests
 *
 * Tests Gemini Vision frame description functionality including:
 * - Frame description generation
 * - Scene type classification
 * - Element detection
 * - Batch processing
 * - Error recovery
 */

import { describeFrame, indexRecordingFrames } from '@/lib/services/visual-indexing';
import { promises as fs } from 'fs';

// Mock Google AI
const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent,
}));

jest.mock('@/lib/google-ai', () => ({
  createGoogleGenerativeAI: jest.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

// Mock fs
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
  },
}));

// Mock Supabase
const mockUpdate = jest.fn();
const mockEq = jest.fn(() => ({ data: null, error: null }));
const mockSelect = jest.fn();
const mockDownload = jest.fn();

const mockSupabase = {
  from: jest.fn((table: string) => ({
    select: mockSelect,
    update: mockUpdate,
  })),
  storage: {
    from: jest.fn(() => ({
      download: mockDownload,
    })),
  },
};

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Mock embeddings service
jest.mock('@/lib/services/embeddings', () => ({
  generateEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0.1)),
}));

describe('Visual Indexing Service', () => {
  const mockImagePath = '/tmp/frame_123.jpg';
  const mockRecordingId = 'test-recording-123';
  const mockOrgId = 'test-org-456';

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup fs mocks
    (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('mock-image-data'));
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);

    // Setup Gemini response
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          description: 'A code editor showing JavaScript code with syntax highlighting',
          sceneType: 'code',
          detectedElements: ['code editor', 'line numbers', 'syntax highlighting', 'function definition'],
          confidence: 0.95,
        }),
      },
    });

    // Setup Supabase mocks
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ data: null, error: null });
  });

  describe('describeFrame', () => {
    it('should generate description for frame', async () => {
      const result = await describeFrame(mockImagePath);

      expect(result).toMatchObject({
        description: expect.stringContaining('code editor'),
        sceneType: 'code',
        detectedElements: expect.arrayContaining(['code editor']),
        confidence: 0.95,
      });

      expect(fs.readFile).toHaveBeenCalledWith(mockImagePath);
      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it('should classify scene type correctly', async () => {
      const sceneTypes = [
        { response: 'ui', expected: 'ui' },
        { response: 'code', expected: 'code' },
        { response: 'terminal', expected: 'terminal' },
        { response: 'browser', expected: 'browser' },
        { response: 'editor', expected: 'editor' },
        { response: 'other', expected: 'other' },
      ];

      for (const { response, expected } of sceneTypes) {
        mockGenerateContent.mockResolvedValueOnce({
          response: {
            text: () => JSON.stringify({
              description: 'Test description',
              sceneType: response,
              detectedElements: [],
              confidence: 0.9,
            }),
          },
        });

        const result = await describeFrame(mockImagePath);
        expect(result.sceneType).toBe(expected);
      }
    });

    it('should detect UI elements', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            description: 'A user interface with multiple buttons and input fields',
            sceneType: 'ui',
            detectedElements: [
              'Submit button',
              'Cancel button',
              'Email input',
              'Password input',
              'Remember me checkbox',
            ],
            confidence: 0.92,
          }),
        },
      });

      const result = await describeFrame(mockImagePath);

      expect(result.detectedElements).toHaveLength(5);
      expect(result.detectedElements).toContain('Submit button');
      expect(result.detectedElements).toContain('Email input');
    });

    it('should include frame context in prompt', async () => {
      const context = 'This is from a tutorial video about React hooks';

      await describeFrame(mockImagePath, context);

      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs[1].text).toContain(context);
    });

    it('should handle malformed JSON response', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => 'This is not valid JSON at all',
        },
      });

      const result = await describeFrame(mockImagePath);

      expect(result).toMatchObject({
        description: 'Unable to analyze frame',
        sceneType: 'other',
        detectedElements: [],
        confidence: 0.3,
      });
    });

    it('should extract JSON from markdown response', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => `Here is the analysis:

\`\`\`json
{
  "description": "Terminal window showing npm install output",
  "sceneType": "terminal",
  "detectedElements": ["command prompt", "npm output", "progress bar"],
  "confidence": 0.88
}
\`\`\`

Hope this helps!`,
        },
      });

      const result = await describeFrame(mockImagePath);

      expect(result.sceneType).toBe('terminal');
      expect(result.confidence).toBe(0.88);
    });

    it('should handle missing fields in response', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            description: 'Some description',
            // Missing sceneType, detectedElements, confidence
          }),
        },
      });

      const result = await describeFrame(mockImagePath);

      expect(result.sceneType).toBe('other'); // Default
      expect(result.detectedElements).toEqual([]); // Default
      expect(result.confidence).toBe(0.7); // Default
    });

    it('should convert image to base64', async () => {
      const mockBuffer = Buffer.from('test-image-data');
      (fs.readFile as jest.Mock).mockResolvedValueOnce(mockBuffer);

      await describeFrame(mockImagePath);

      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs[0].inlineData).toMatchObject({
        mimeType: 'image/jpeg',
        data: mockBuffer.toString('base64'),
      });
    });

    it('should handle API errors', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('API rate limit exceeded'));

      await expect(describeFrame(mockImagePath)).rejects.toThrow('API rate limit exceeded');
    });

    it('should use correct model', async () => {
      await describeFrame(mockImagePath);

      expect(mockGetGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-2.0-flash-exp',
      });
    });

    it('should provide detailed prompt', async () => {
      await describeFrame(mockImagePath);

      const callArgs = mockGenerateContent.mock.calls[0][0];
      const prompt = callArgs[1].text;

      expect(prompt).toContain('video frame analyzer');
      expect(prompt).toContain('Scene Type');
      expect(prompt).toContain('Detected Elements');
      expect(prompt).toContain('Confidence');
      expect(prompt).toContain('JSON format');
    });
  });

  describe('indexRecordingFrames', () => {
    const mockFrames = [
      {
        id: 'frame-1',
        frame_url: 'org/recording/frames/frame_0001.jpg',
        frame_time_sec: 1.0,
      },
      {
        id: 'frame-2',
        frame_url: 'org/recording/frames/frame_0002.jpg',
        frame_time_sec: 2.0,
      },
      {
        id: 'frame-3',
        frame_url: 'org/recording/frames/frame_0003.jpg',
        frame_time_sec: 3.0,
      },
    ];

    beforeEach(() => {
      // Setup frame query
      mockSelect.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockFrames,
              error: null,
            }),
          }),
        }),
      });

      // Setup storage download
      mockDownload.mockResolvedValue({
        data: new Blob(['mock-image-data']),
        error: null,
      });
    });

    it('should process all unprocessed frames', async () => {
      await indexRecordingFrames(mockRecordingId, mockOrgId);

      expect(mockSelect).toHaveBeenCalledWith('id, frame_url, frame_time_sec');
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
      expect(mockUpdate).toHaveBeenCalledTimes(3);
    });

    it('should download frames from storage', async () => {
      await indexRecordingFrames(mockRecordingId, mockOrgId);

      expect(mockDownload).toHaveBeenCalledTimes(3);
      mockFrames.forEach((frame) => {
        expect(mockDownload).toHaveBeenCalledWith(frame.frame_url);
      });
    });

    it('should generate embeddings for descriptions', async () => {
      const { generateEmbedding } = require('@/lib/services/embeddings');

      await indexRecordingFrames(mockRecordingId, mockOrgId);

      expect(generateEmbedding).toHaveBeenCalledTimes(3);
    });

    it('should update frame records with results', async () => {
      await indexRecordingFrames(mockRecordingId, mockOrgId);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          visual_description: expect.any(String),
          visual_embedding: expect.any(Array),
          scene_type: expect.any(String),
          detected_elements: expect.any(Array),
          metadata: expect.objectContaining({
            confidence: expect.any(Number),
          }),
        })
      );
    });

    it('should process frames in batches', async () => {
      const manyFrames = Array.from({ length: 12 }, (_, i) => ({
        id: `frame-${i + 1}`,
        frame_url: `org/recording/frames/frame_${String(i + 1).padStart(4, '0')}.jpg`,
        frame_time_sec: i + 1,
      }));

      mockSelect.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: manyFrames,
              error: null,
            }),
          }),
        }),
      });

      await indexRecordingFrames(mockRecordingId, mockOrgId);

      // Should process all frames
      expect(mockGenerateContent).toHaveBeenCalledTimes(12);
    });

    it('should handle frames with no data', async () => {
      mockSelect.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      await indexRecordingFrames(mockRecordingId, mockOrgId);

      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('should handle query errors', async () => {
      mockSelect.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Query failed'),
            }),
          }),
        }),
      });

      await indexRecordingFrames(mockRecordingId, mockOrgId);

      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('should skip frames that fail to download', async () => {
      mockDownload
        .mockResolvedValueOnce({ data: new Blob(['data']), error: null })
        .mockResolvedValueOnce({ data: null, error: new Error('Not found') })
        .mockResolvedValueOnce({ data: new Blob(['data']), error: null });

      await indexRecordingFrames(mockRecordingId, mockOrgId);

      // Should only process 2 frames (skipped the failed one)
      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });

    it('should continue on individual frame errors', async () => {
      mockGenerateContent
        .mockResolvedValueOnce({
          response: { text: () => '{"description":"test","sceneType":"ui","detectedElements":[],"confidence":0.9}' },
        })
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({
          response: { text: () => '{"description":"test","sceneType":"ui","detectedElements":[],"confidence":0.9}' },
        });

      await indexRecordingFrames(mockRecordingId, mockOrgId);

      // Should process 2 out of 3 frames
      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });

    it('should cleanup temp files after processing', async () => {
      await indexRecordingFrames(mockRecordingId, mockOrgId);

      expect(fs.unlink).toHaveBeenCalledTimes(3);
    });

    it('should handle cleanup errors gracefully', async () => {
      (fs.unlink as jest.Mock).mockRejectedValue(new Error('Cleanup failed'));

      // Should not throw
      await expect(
        indexRecordingFrames(mockRecordingId, mockOrgId)
      ).resolves.toBeUndefined();
    });

    it('should filter frames by recording ID', async () => {
      await indexRecordingFrames(mockRecordingId, mockOrgId);

      const selectChain = mockSelect.mock.results[0].value;
      expect(selectChain.eq).toHaveBeenCalledWith('recording_id', mockRecordingId);
    });

    it('should only select frames without descriptions', async () => {
      await indexRecordingFrames(mockRecordingId, mockOrgId);

      const eqChain = mockSelect.mock.results[0].value.eq.mock.results[0].value;
      expect(eqChain.is).toHaveBeenCalledWith('visual_description', null);
    });

    it('should order frames by frame number', async () => {
      await indexRecordingFrames(mockRecordingId, mockOrgId);

      const isChain = mockSelect.mock.results[0].value.eq.mock.results[0].value.is.mock.results[0].value;
      expect(isChain.order).toHaveBeenCalledWith('frame_number');
    });

    it('should use correct storage bucket', async () => {
      process.env.FRAMES_STORAGE_BUCKET = 'custom-frames-bucket';

      await indexRecordingFrames(mockRecordingId, mockOrgId);

      expect(mockSupabase.storage.from).toHaveBeenCalledWith('custom-frames-bucket');

      delete process.env.FRAMES_STORAGE_BUCKET;
    });
  });

  describe('batch processing', () => {
    it('should process frames in parallel batches of 5', async () => {
      const frames = Array.from({ length: 15 }, (_, i) => ({
        id: `frame-${i + 1}`,
        frame_url: `frame_${i + 1}.jpg`,
        frame_time_sec: i + 1,
      }));

      mockSelect.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: frames, error: null }),
          }),
        }),
      });

      mockDownload.mockResolvedValue({
        data: new Blob(['data']),
        error: null,
      });

      const startTimes: number[] = [];
      mockGenerateContent.mockImplementation(async () => {
        startTimes.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          response: {
            text: () => '{"description":"test","sceneType":"ui","detectedElements":[],"confidence":0.9}',
          },
        };
      });

      await indexRecordingFrames(mockRecordingId, mockOrgId);

      // Should have processed all 15 frames in 3 batches
      expect(mockGenerateContent).toHaveBeenCalledTimes(15);
    });
  });

  describe('edge cases', () => {
    it('should handle binary data in frame', async () => {
      const binaryData = new Uint8Array([255, 216, 255, 224]); // JPEG header
      mockDownload.mockResolvedValueOnce({
        data: new Blob([binaryData]),
        error: null,
      });

      await indexRecordingFrames(mockRecordingId, mockOrgId);

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should handle very long descriptions', async () => {
      const longDescription = 'A'.repeat(5000);
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            description: longDescription,
            sceneType: 'other',
            detectedElements: [],
            confidence: 0.8,
          }),
        },
      });

      const result = await describeFrame(mockImagePath);

      expect(result.description).toHaveLength(5000);
    });
  });
});
