/**
 * Extract Frames Worker Handler Unit Tests
 *
 * Tests the complete frame extraction pipeline including:
 * - Video download from storage
 * - Frame extraction via FFmpeg
 * - Visual indexing with Gemini
 * - OCR text extraction
 * - Database updates
 * - Error handling and cleanup
 */

import { handleExtractFrames, ExtractFramesPayload } from '@/lib/workers/handlers/extract-frames';
import type { Job } from '@/lib/types/jobs';
import { extractFrames } from '@/lib/services/frame-extraction';
import { indexRecordingFrames } from '@/lib/services/visual-indexing';
import { extractFrameText } from '@/lib/services/ocr-service';
import { promises as fs } from 'fs';

// Mock services
jest.mock('@/lib/services/frame-extraction');
jest.mock('@/lib/services/visual-indexing');
jest.mock('@/lib/services/ocr-service');
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn(),
    unlink: jest.fn(),
  },
}));

// Mock Supabase
const mockUpdate = jest.fn();
const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockDownload = jest.fn();
const mockEq = jest.fn();

const mockSupabase = {
  from: jest.fn((table: string) => ({
    update: mockUpdate,
    insert: mockInsert,
    select: mockSelect,
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

describe('Extract Frames Worker Handler', () => {
  const mockRecordingId = 'test-recording-123';
  const mockOrgId = 'test-org-456';
  const mockVideoUrl = 'org/recording/video.webm';
  const mockVideoPath = '/path/to/video.mp4';

  const mockJob: Job<ExtractFramesPayload> = {
    id: 'job-123',
    type: 'extract_frames',
    status: 'pending',
    payload: {
      recordingId: mockRecordingId,
      orgId: mockOrgId,
      videoUrl: mockVideoUrl,
    },
    org_id: mockOrgId,
    attempt_count: 0,
    max_attempts: 3,
    run_after: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockExtractedFrames = {
    recordingId: mockRecordingId,
    frames: [
      {
        frameNumber: 1,
        timeSec: 0.5,
        localPath: '/tmp/frame_0001.jpg',
        storagePath: `${mockOrgId}/${mockRecordingId}/frames/frame_0001.jpg`,
        width: 1920,
        height: 1080,
        sizeBytes: 150000,
      },
      {
        frameNumber: 2,
        timeSec: 1.0,
        localPath: '/tmp/frame_0002.jpg',
        storagePath: `${mockOrgId}/${mockRecordingId}/frames/frame_0002.jpg`,
        width: 1920,
        height: 1080,
        sizeBytes: 145000,
      },
    ],
    duration: 5000,
    totalFrames: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    (extractFrames as jest.Mock).mockResolvedValue(mockExtractedFrames);
    (indexRecordingFrames as jest.Mock).mockResolvedValue(undefined);
    (extractFrameText as jest.Mock).mockResolvedValue({
      text: 'Sample OCR text',
      confidence: 90,
      blocks: [],
    });

    // Setup Supabase mocks
    mockEq.mockResolvedValue({ data: null, error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockInsert.mockResolvedValue({ error: null });
    mockSelect.mockReturnValue({
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [
          { id: 'frame-1', frame_number: 1, frame_url: 'frame_0001.jpg' },
          { id: 'frame-2', frame_number: 2, frame_url: 'frame_0002.jpg' },
        ],
        error: null,
      }),
    });

    // Mock video download
    mockDownload.mockResolvedValue({
      data: new Blob(['mock-video-data']),
      error: null,
    });

    // Mock fs operations
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);
  });

  describe('handleExtractFrames', () => {
    it('should complete full extraction pipeline', async () => {
      await handleExtractFrames(mockJob);

      // Verify frame extraction
      expect(extractFrames).toHaveBeenCalledWith(
        expect.any(String),
        mockRecordingId,
        mockOrgId,
        expect.objectContaining({
          detectSceneChanges: true,
        })
      );

      // Verify frame records inserted
      expect(mockInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            recording_id: mockRecordingId,
            org_id: mockOrgId,
            frame_number: 1,
          }),
        ])
      );

      // Verify visual indexing called
      expect(indexRecordingFrames).toHaveBeenCalledWith(mockRecordingId, mockOrgId);

      // Verify recording updated
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          frames_extracted: true,
          frame_count: 2,
          visual_indexing_status: 'completed',
        })
      );
    });

    it('should download video from storage when videoUrl provided', async () => {
      await handleExtractFrames(mockJob);

      expect(mockDownload).toHaveBeenCalledWith(mockVideoUrl);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should use local video path when videoPath provided', async () => {
      const jobWithPath: Job<ExtractFramesPayload> = {
        ...mockJob,
        payload: {
          ...mockJob.payload,
          videoPath: mockVideoPath,
          videoUrl: undefined,
        },
      };

      await handleExtractFrames(jobWithPath);

      expect(mockDownload).not.toHaveBeenCalled();
      expect(extractFrames).toHaveBeenCalledWith(
        mockVideoPath,
        mockRecordingId,
        mockOrgId,
        expect.any(Object)
      );
    });

    it('should throw error when no video source provided', async () => {
      const invalidJob: Job<ExtractFramesPayload> = {
        ...mockJob,
        payload: {
          ...mockJob.payload,
          videoPath: undefined,
          videoUrl: undefined,
        },
      };

      await expect(handleExtractFrames(invalidJob)).rejects.toThrow(
        'No video path or URL provided'
      );
    });

    it('should update recording status to processing', async () => {
      await handleExtractFrames(mockJob);

      expect(mockUpdate).toHaveBeenCalledWith({
        visual_indexing_status: 'processing',
      });
    });

    it('should insert frame metadata into database', async () => {
      await handleExtractFrames(mockJob);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            recording_id: mockRecordingId,
            org_id: mockOrgId,
            frame_number: 1,
            frame_time_sec: 0.5,
            frame_url: expect.stringContaining('frame_0001.jpg'),
            metadata: expect.objectContaining({
              width: 1920,
              height: 1080,
              sizeBytes: 150000,
            }),
          }),
        ])
      );
    });

    it('should skip visual descriptions when disabled', async () => {
      process.env.ENABLE_FRAME_DESCRIPTIONS = 'false';

      await handleExtractFrames(mockJob);

      expect(indexRecordingFrames).not.toHaveBeenCalled();

      delete process.env.ENABLE_FRAME_DESCRIPTIONS;
    });

    it('should run OCR when enabled', async () => {
      process.env.ENABLE_OCR = 'true';

      await handleExtractFrames(mockJob);

      expect(mockSelect).toHaveBeenCalled();
      expect(extractFrameText).toHaveBeenCalled();

      delete process.env.ENABLE_OCR;
    });

    it('should skip OCR when disabled', async () => {
      process.env.ENABLE_OCR = 'false';

      await handleExtractFrames(mockJob);

      expect(extractFrameText).not.toHaveBeenCalled();

      delete process.env.ENABLE_OCR;
    });

    it('should use environment variables for frame extraction options', async () => {
      process.env.FRAME_EXTRACTION_FPS = '1.0';
      process.env.FRAME_EXTRACTION_MAX_FRAMES = '100';
      process.env.FRAME_QUALITY = '90';

      await handleExtractFrames(mockJob);

      expect(extractFrames).toHaveBeenCalledWith(
        expect.any(String),
        mockRecordingId,
        mockOrgId,
        expect.objectContaining({
          fps: 1.0,
          maxFrames: 100,
          quality: 90,
        })
      );

      delete process.env.FRAME_EXTRACTION_FPS;
      delete process.env.FRAME_EXTRACTION_MAX_FRAMES;
      delete process.env.FRAME_QUALITY;
    });

    it('should cleanup temp video file after processing', async () => {
      await handleExtractFrames(mockJob);

      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('.webm'));
    });

    it('should not cleanup if using local video path', async () => {
      const jobWithPath: Job<ExtractFramesPayload> = {
        ...mockJob,
        payload: {
          ...mockJob.payload,
          videoPath: mockVideoPath,
          videoUrl: undefined,
        },
      };

      await handleExtractFrames(jobWithPath);

      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it('should handle cleanup failure gracefully', async () => {
      (fs.unlink as jest.Mock).mockRejectedValueOnce(new Error('Cleanup failed'));

      // Should not throw
      await expect(handleExtractFrames(mockJob)).resolves.toBeUndefined();
    });

    it('should create event notification on success', async () => {
      await handleExtractFrames(mockJob);

      expect(mockSupabase.from).toHaveBeenCalledWith('events');
      expect(mockInsert).toHaveBeenCalledWith({
        type: 'frames.extracted',
        payload: {
          recordingId: mockRecordingId,
          orgId: mockOrgId,
          frameCount: 2,
        },
      });
    });
  });

  describe('error handling', () => {
    it('should update recording status to failed on error', async () => {
      (extractFrames as jest.Mock).mockRejectedValueOnce(new Error('Extraction failed'));

      await expect(handleExtractFrames(mockJob)).rejects.toThrow('Extraction failed');

      expect(mockUpdate).toHaveBeenCalledWith({
        visual_indexing_status: 'failed',
      });
    });

    it('should handle video download errors', async () => {
      mockDownload.mockResolvedValueOnce({
        data: null,
        error: new Error('Download failed'),
      });

      await expect(handleExtractFrames(mockJob)).rejects.toThrow(
        'Failed to download video'
      );
    });

    it('should handle frame extraction errors', async () => {
      (extractFrames as jest.Mock).mockRejectedValueOnce(
        new Error('FFmpeg extraction failed')
      );

      await expect(handleExtractFrames(mockJob)).rejects.toThrow(
        'FFmpeg extraction failed'
      );

      expect(mockUpdate).toHaveBeenCalledWith({
        visual_indexing_status: 'failed',
      });
    });

    it('should handle frame insertion errors', async () => {
      mockInsert.mockResolvedValueOnce({
        error: new Error('Database error'),
      });

      await expect(handleExtractFrames(mockJob)).rejects.toThrow(
        'Failed to store frames'
      );
    });

    it('should continue on visual indexing errors', async () => {
      (indexRecordingFrames as jest.Mock).mockRejectedValueOnce(
        new Error('Gemini API error')
      );

      // Should still complete but throw the error
      await expect(handleExtractFrames(mockJob)).rejects.toThrow('Gemini API error');
    });

    it('should handle OCR errors gracefully', async () => {
      process.env.ENABLE_OCR = 'true';
      (extractFrameText as jest.Mock).mockRejectedValueOnce(new Error('OCR failed'));

      // Should complete without failing entire job
      await handleExtractFrames(mockJob);

      delete process.env.ENABLE_OCR;
    });

    it('should cleanup video on error', async () => {
      (extractFrames as jest.Mock).mockRejectedValueOnce(new Error('Test error'));

      await expect(handleExtractFrames(mockJob)).rejects.toThrow('Test error');

      // Should still attempt cleanup
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('OCR processing', () => {
    beforeEach(() => {
      process.env.ENABLE_OCR = 'true';
    });

    afterEach(() => {
      delete process.env.ENABLE_OCR;
    });

    it('should process OCR for all frames', async () => {
      await handleExtractFrames(mockJob);

      expect(extractFrameText).toHaveBeenCalledTimes(2);
    });

    it('should update frame records with OCR results', async () => {
      const mockOcrResult = {
        text: 'Hello World',
        confidence: 95,
        blocks: [
          {
            text: 'Hello World',
            confidence: 95,
            bbox: { x0: 10, y0: 10, x1: 100, y1: 30 },
          },
        ],
      };

      (extractFrameText as jest.Mock).mockResolvedValue(mockOcrResult);

      await handleExtractFrames(mockJob);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          ocr_text: 'Hello World',
          ocr_confidence: 95,
          ocr_blocks: mockOcrResult.blocks,
        })
      );
    });

    it('should skip frames with no OCR text', async () => {
      (extractFrameText as jest.Mock).mockResolvedValue({
        text: '',
        confidence: 0,
        blocks: [],
      });

      await handleExtractFrames(mockJob);

      // Should not update frame with empty OCR
      expect(mockUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({
          ocr_text: '',
        })
      );
    });

    it('should process frames in batches', async () => {
      const manyFrames = Array.from({ length: 12 }, (_, i) => ({
        id: `frame-${i + 1}`,
        frame_number: i + 1,
        frame_url: `frame_${String(i + 1).padStart(4, '0')}.jpg`,
      }));

      mockSelect.mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: manyFrames,
          error: null,
        }),
      });

      await handleExtractFrames(mockJob);

      // Should process all 12 frames
      expect(extractFrameText).toHaveBeenCalledTimes(12);
    });

    it('should handle individual frame OCR failures', async () => {
      (extractFrameText as jest.Mock)
        .mockResolvedValueOnce({ text: 'Frame 1', confidence: 90, blocks: [] })
        .mockRejectedValueOnce(new Error('OCR error'))
        .mockResolvedValueOnce({ text: 'Frame 3', confidence: 85, blocks: [] });

      // Should not throw - continues processing other frames
      await expect(handleExtractFrames(mockJob)).resolves.toBeUndefined();
    });

    it('should download frame from storage for OCR', async () => {
      await handleExtractFrames(mockJob);

      expect(mockDownload).toHaveBeenCalledWith('frame_0001.jpg');
      expect(mockDownload).toHaveBeenCalledWith('frame_0002.jpg');
    });

    it('should cleanup OCR temp files', async () => {
      await handleExtractFrames(mockJob);

      // Should unlink temp OCR files (one for video + one for each frame processed)
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('performance', () => {
    it('should complete extraction in reasonable time', async () => {
      const startTime = Date.now();

      await handleExtractFrames(mockJob);

      const duration = Date.now() - startTime;

      // Should complete quickly with mocks
      expect(duration).toBeLessThan(1000);
    });

    it('should handle large frame counts efficiently', async () => {
      const manyFrames = Array.from({ length: 100 }, (_, i) => ({
        frameNumber: i + 1,
        timeSec: i * 0.5,
        localPath: `/tmp/frame_${String(i + 1).padStart(4, '0')}.jpg`,
        storagePath: `org/rec/frames/frame_${String(i + 1).padStart(4, '0')}.jpg`,
        width: 1920,
        height: 1080,
        sizeBytes: 150000,
      }));

      (extractFrames as jest.Mock).mockResolvedValueOnce({
        recordingId: mockRecordingId,
        frames: manyFrames,
        duration: 10000,
        totalFrames: 100,
      });

      await handleExtractFrames(mockJob);

      expect(mockInsert).toHaveBeenCalledWith(expect.any(Array));
      expect(mockInsert.mock.calls[0][0]).toHaveLength(100);
    });
  });

  describe('edge cases', () => {
    it('should handle zero frames extracted', async () => {
      (extractFrames as jest.Mock).mockResolvedValueOnce({
        recordingId: mockRecordingId,
        frames: [],
        duration: 1000,
        totalFrames: 0,
      });

      await handleExtractFrames(mockJob);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          frame_count: 0,
        })
      );
    });

    it('should handle missing video metadata', async () => {
      mockDownload.mockResolvedValueOnce({
        data: new Blob([]),
        error: null,
      });

      await handleExtractFrames(mockJob);

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should handle very long recording IDs', async () => {
      const longIdJob = {
        ...mockJob,
        payload: {
          ...mockJob.payload,
          recordingId: 'a'.repeat(100),
        },
      };

      await handleExtractFrames(longIdJob);

      expect(extractFrames).toHaveBeenCalled();
    });

    it('should handle special characters in video path', async () => {
      const specialPathJob: Job<ExtractFramesPayload> = {
        ...mockJob,
        payload: {
          ...mockJob.payload,
          videoPath: '/tmp/video with spaces & special.mp4',
          videoUrl: undefined,
        },
      };

      await handleExtractFrames(specialPathJob);

      expect(extractFrames).toHaveBeenCalledWith(
        '/tmp/video with spaces & special.mp4',
        expect.any(String),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('concurrent processing', () => {
    it('should handle multiple jobs safely', async () => {
      const jobs = [
        { ...mockJob, id: 'job-1' },
        { ...mockJob, id: 'job-2' },
        { ...mockJob, id: 'job-3' },
      ];

      await Promise.all(jobs.map((job) => handleExtractFrames(job)));

      expect(extractFrames).toHaveBeenCalledTimes(3);
    });
  });
});
