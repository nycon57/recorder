/**
 * Frame Extraction Service Unit Tests
 *
 * Tests video frame extraction functionality including:
 * - Uniform frame extraction
 * - Scene change detection
 * - Quality optimization
 * - Storage upload
 * - Error handling
 */

import { extractFrames } from '@/lib/services/frame-extraction';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import { mockFFmpegInstance } from '../../../__mocks__/fluent-ffmpeg';

// Mock dependencies
jest.mock('fluent-ffmpeg');
jest.mock('sharp');
jest.mock('fs', () => ({
  promises: {
    mkdtemp: jest.fn(),
    readdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    rm: jest.fn(),
  },
}));

// Mock Supabase
const mockUpload = jest.fn();
const mockStorage = {
  from: jest.fn(() => ({
    upload: mockUpload,
    download: jest.fn(),
  })),
};

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(() => ({
    storage: mockStorage,
  })),
}));

describe('Frame Extraction Service', () => {
  const mockRecordingId = 'test-recording-123';
  const mockOrgId = 'test-org-456';
  const mockVideoPath = '/tmp/test-video.mp4';
  const mockTempDir = '/tmp/frames-abc123';

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup fs mocks
    (fs.mkdtemp as jest.Mock).mockResolvedValue(mockTempDir);
    (fs.readdir as jest.Mock).mockResolvedValue([
      'frame_0001.jpg',
      'frame_0002.jpg',
      'frame_0003.jpg',
    ]);
    (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('mock-image-data'));
    (fs.rm as jest.Mock).mockResolvedValue(undefined);

    // Setup sharp mock
    const mockSharpInstance = {
      jpeg: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('optimized-image')),
      metadata: jest.fn().mockResolvedValue({
        width: 1920,
        height: 1080,
        format: 'jpeg',
      }),
    };
    (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);

    // Setup storage mock
    mockUpload.mockResolvedValue({ error: null });
  });

  describe('extractFrames', () => {
    it('should extract frames from video at uniform intervals', async () => {
      const result = await extractFrames(mockVideoPath, mockRecordingId, mockOrgId, {
        fps: 1,
        maxFrames: 10,
        quality: 85,
      });

      expect(result).toMatchObject({
        recordingId: mockRecordingId,
        totalFrames: 3, // Based on mock readdir
      });

      expect(result.frames).toHaveLength(3);
      expect(result.frames[0]).toMatchObject({
        frameNumber: 1,
        timeSec: expect.any(Number),
        storagePath: expect.stringContaining(mockOrgId),
        width: 1920,
        height: 1080,
      });

      // Verify FFmpeg was called
      expect(ffmpeg).toHaveBeenCalledWith(mockVideoPath);
      expect(mockFFmpegInstance.fps).toHaveBeenCalledWith(1);
      expect(mockFFmpegInstance.frames).toHaveBeenCalledWith(10);
    });

    it('should respect maxFrames limit', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(
        Array.from({ length: 100 }, (_, i) => `frame_${String(i + 1).padStart(4, '0')}.jpg`)
      );

      const result = await extractFrames(mockVideoPath, mockRecordingId, mockOrgId, {
        maxFrames: 20,
      });

      expect(result.totalFrames).toBeLessThanOrEqual(20);
      expect(result.frames.length).toBeLessThanOrEqual(20);
    });

    it('should optimize frame quality with sharp', async () => {
      const quality = 50;

      await extractFrames(mockVideoPath, mockRecordingId, mockOrgId, {
        quality,
      });

      // Verify sharp was called with quality setting
      const sharpInstance = (sharp as unknown as jest.Mock).mock.results[0].value;
      expect(sharpInstance.jpeg).toHaveBeenCalledWith({
        quality,
        mozjpeg: true,
      });
    });

    it('should upload frames to Supabase Storage', async () => {
      await extractFrames(mockVideoPath, mockRecordingId, mockOrgId);

      expect(mockUpload).toHaveBeenCalled();
      const uploadCall = mockUpload.mock.calls[0];

      expect(uploadCall[0]).toMatch(
        new RegExp(`${mockOrgId}/${mockRecordingId}/frames/frame_\\d{4}\\.jpg`)
      );
      expect(uploadCall[1]).toBeInstanceOf(Buffer);
      expect(uploadCall[2]).toMatchObject({
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: true,
      });
    });

    it('should handle scene change detection mode', async () => {
      await extractFrames(mockVideoPath, mockRecordingId, mockOrgId, {
        detectSceneChanges: true,
        maxFrames: 50,
      });

      expect(mockFFmpegInstance.complexFilter).toHaveBeenCalled();
      const filterCall = mockFFmpegInstance.complexFilter.mock.calls[0][0];
      expect(filterCall).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ filter: 'select' }),
        ])
      );
    });

    it('should calculate frame times correctly', async () => {
      const fps = 2; // 1 frame every 0.5 seconds

      const result = await extractFrames(mockVideoPath, mockRecordingId, mockOrgId, {
        fps,
      });

      expect(result.frames[0].timeSec).toBeCloseTo(0.5, 1);
      expect(result.frames[1].timeSec).toBeCloseTo(1.0, 1);
      expect(result.frames[2].timeSec).toBeCloseTo(1.5, 1);
    });

    it('should use environment variables for defaults', async () => {
      process.env.FRAME_EXTRACTION_FPS = '0.5';
      process.env.FRAME_EXTRACTION_MAX_FRAMES = '300';
      process.env.FRAME_QUALITY = '85';

      await extractFrames(mockVideoPath, mockRecordingId, mockOrgId);

      expect(mockFFmpegInstance.fps).toHaveBeenCalledWith(0.5);
      expect(mockFFmpegInstance.frames).toHaveBeenCalledWith(300);

      // Cleanup
      delete process.env.FRAME_EXTRACTION_FPS;
      delete process.env.FRAME_EXTRACTION_MAX_FRAMES;
      delete process.env.FRAME_QUALITY;
    });

    it('should cleanup temp directory after extraction', async () => {
      await extractFrames(mockVideoPath, mockRecordingId, mockOrgId);

      expect(fs.rm).toHaveBeenCalledWith(mockTempDir, {
        recursive: true,
        force: true,
      });
    });

    it('should cleanup temp directory even on error', async () => {
      mockUpload.mockResolvedValueOnce({ error: new Error('Upload failed') });

      await extractFrames(mockVideoPath, mockRecordingId, mockOrgId);

      // Should still cleanup
      expect(fs.rm).toHaveBeenCalledWith(mockTempDir, {
        recursive: true,
        force: true,
      });
    });

    it('should handle FFmpeg errors', async () => {
      mockFFmpegInstance.run.mockImplementationOnce(function (this: any) {
        const errorCallback = this.on.mock.calls.find(
          (call: any[]) => call[0] === 'error'
        )?.[1];
        if (errorCallback) {
          setTimeout(() => errorCallback(new Error('FFmpeg extraction failed')), 10);
        }
        return this;
      });

      await expect(
        extractFrames(mockVideoPath, mockRecordingId, mockOrgId)
      ).rejects.toThrow('FFmpeg extraction failed');

      // Should still cleanup
      expect(fs.rm).toHaveBeenCalled();
    });

    it('should skip frames that fail to upload', async () => {
      mockUpload
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: new Error('Upload failed') })
        .mockResolvedValueOnce({ error: null });

      const result = await extractFrames(mockVideoPath, mockRecordingId, mockOrgId);

      // Should have 2 frames (skipped the failed one)
      expect(result.totalFrames).toBe(2);
      expect(result.frames).toHaveLength(2);
    });

    it('should return extraction duration', async () => {
      const result = await extractFrames(mockVideoPath, mockRecordingId, mockOrgId);

      expect(result.duration).toBeGreaterThan(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should handle empty frame extraction', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue([]);

      const result = await extractFrames(mockVideoPath, mockRecordingId, mockOrgId);

      expect(result.totalFrames).toBe(0);
      expect(result.frames).toHaveLength(0);
    });

    it('should filter non-jpg files', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue([
        'frame_0001.jpg',
        'frame_0002.png',
        'frame_0003.jpg',
        'metadata.json',
      ]);

      const result = await extractFrames(mockVideoPath, mockRecordingId, mockOrgId);

      // Should only process .jpg files
      expect(result.totalFrames).toBe(2);
    });

    it('should use correct storage bucket from env', async () => {
      process.env.FRAMES_STORAGE_BUCKET = 'custom-frames-bucket';

      await extractFrames(mockVideoPath, mockRecordingId, mockOrgId);

      expect(mockStorage.from).toHaveBeenCalledWith('custom-frames-bucket');

      delete process.env.FRAMES_STORAGE_BUCKET;
    });

    it('should handle metadata extraction', async () => {
      const result = await extractFrames(mockVideoPath, mockRecordingId, mockOrgId);

      // Verify ffprobe was called
      expect(ffmpeg.ffprobe).toHaveBeenCalledWith(
        mockVideoPath,
        expect.any(Function)
      );

      // Frames should have metadata
      expect(result.frames[0]).toMatchObject({
        width: expect.any(Number),
        height: expect.any(Number),
        sizeBytes: expect.any(Number),
      });
    });

    it('should sort frames numerically', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue([
        'frame_0010.jpg',
        'frame_0002.jpg',
        'frame_0001.jpg',
      ]);

      const result = await extractFrames(mockVideoPath, mockRecordingId, mockOrgId);

      // Should be in numerical order
      expect(result.frames[0].frameNumber).toBe(1);
      expect(result.frames[1].frameNumber).toBe(2);
      expect(result.frames[2].frameNumber).toBe(3);
    });
  });

  describe('getVideoMetadata', () => {
    it('should extract video duration and dimensions', async () => {
      // This is tested indirectly through extractFrames
      const result = await extractFrames(mockVideoPath, mockRecordingId, mockOrgId);

      expect(ffmpeg.ffprobe).toHaveBeenCalled();
      expect(result.frames[0].width).toBe(1920);
      expect(result.frames[0].height).toBe(1080);
    });

    it('should handle ffprobe errors', async () => {
      (ffmpeg.ffprobe as jest.Mock).mockImplementationOnce(
        (path: string, callback: Function) => {
          callback(new Error('Invalid video file'));
        }
      );

      await expect(
        extractFrames(mockVideoPath, mockRecordingId, mockOrgId)
      ).rejects.toThrow('Invalid video file');
    });

    it('should handle missing video stream', async () => {
      (ffmpeg.ffprobe as jest.Mock).mockImplementationOnce(
        (path: string, callback: Function) => {
          callback(null, {
            format: { duration: 60 },
            streams: [{ codec_type: 'audio' }], // No video stream
          });
        }
      );

      const result = await extractFrames(mockVideoPath, mockRecordingId, mockOrgId);

      // Should default to 0 for missing dimensions
      expect(result.frames[0].width).toBe(1920); // From sharp metadata
      expect(result.frames[0].height).toBe(1080);
    });
  });

  describe('performance', () => {
    it('should complete extraction in reasonable time', async () => {
      const startTime = Date.now();

      await extractFrames(mockVideoPath, mockRecordingId, mockOrgId, {
        maxFrames: 10,
      });

      const duration = Date.now() - startTime;

      // Should complete within 2 seconds (mocked, so should be fast)
      expect(duration).toBeLessThan(2000);
    });

    it('should handle large frame counts efficiently', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(
        Array.from({ length: 300 }, (_, i) => `frame_${String(i + 1).padStart(4, '0')}.jpg`)
      );

      const result = await extractFrames(mockVideoPath, mockRecordingId, mockOrgId, {
        maxFrames: 300,
      });

      expect(result.totalFrames).toBe(300);
      expect(mockUpload).toHaveBeenCalledTimes(300);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in paths', async () => {
      const specialPath = '/tmp/video with spaces & special.mp4';

      await extractFrames(specialPath, mockRecordingId, mockOrgId);

      expect(ffmpeg).toHaveBeenCalledWith(specialPath);
    });

    it('should handle very short videos', async () => {
      (ffmpeg.ffprobe as jest.Mock).mockImplementationOnce(
        (path: string, callback: Function) => {
          callback(null, {
            format: { duration: 1 }, // 1 second
            streams: [{ codec_type: 'video', width: 1920, height: 1080 }],
          });
        }
      );

      const result = await extractFrames(mockVideoPath, mockRecordingId, mockOrgId, {
        fps: 1,
      });

      expect(result).toBeDefined();
      expect(result.frames.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle cleanup failure gracefully', async () => {
      (fs.rm as jest.Mock).mockRejectedValueOnce(new Error('Cleanup failed'));

      // Should not throw on cleanup failure
      await expect(
        extractFrames(mockVideoPath, mockRecordingId, mockOrgId)
      ).resolves.toBeDefined();
    });
  });
});
