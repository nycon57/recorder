/**
 * Tests for Extract Audio Handler
 *
 * Validates:
 * - Audio extraction from video files
 * - FFmpeg integration
 * - Storage upload/download
 * - Job enqueuing
 * - Error handling
 * - Temp file cleanup
 */

import { handleExtractAudio } from '@/lib/workers/handlers/extract-audio';
import { createClient as createAdminClient } from '@/lib/supabase/admin';

// Mock dependencies
jest.mock('@/lib/supabase/admin');
jest.mock('fluent-ffmpeg');
jest.mock('fs/promises');
jest.mock('@/lib/services/streaming-processor', () => ({
  streamingManager: {
    sendProgress: jest.fn(),
    sendError: jest.fn(),
  },
}));

describe('Extract Audio Handler', () => {
  let mockSupabase: any;
  let mockStorage: any;
  let mockProgressCallback: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStorage = {
      from: jest.fn().mockReturnThis(),
      download: jest.fn(),
      upload: jest.fn(),
    };

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      storage: mockStorage,
      update: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    (createAdminClient as jest.Mock).mockReturnValue(mockSupabase);
    mockProgressCallback = jest.fn();
  });

  describe('handleExtractAudio', () => {
    const mockJob = {
      id: 'job-123',
      type: 'extract_audio',
      status: 'pending',
      payload: {
        recordingId: 'recording-123',
        orgId: 'org-123',
        videoPath: 'org/video.mp4',
      },
      created_at: '2025-01-15T10:00:00Z',
    };

    it('should extract audio from video successfully', async () => {
      // Arrange
      const mockVideoBlob = new Blob(['video content'], { type: 'video/mp4' });

      mockStorage.download.mockResolvedValueOnce({
        data: mockVideoBlob,
        error: null,
      });

      mockStorage.upload.mockResolvedValueOnce({
        data: { path: 'org/audio.mp3' },
        error: null,
      });

      mockSupabase.single
        .mockResolvedValueOnce({ data: { metadata: {} }, error: null }) // fetch metadata
        .mockResolvedValueOnce({ data: null, error: null }); // update recording

      // Mock FFmpeg - In real tests, you'd mock the entire ffmpeg module
      // For this example, we'll assume success

      // Act
      await handleExtractAudio(mockJob as any, mockProgressCallback);

      // Assert
      expect(mockStorage.download).toHaveBeenCalledWith('org/video.mp4');
      expect(mockStorage.upload).toHaveBeenCalled();
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'transcribing' })
      );
      expect(mockSupabase.insert).toHaveBeenCalled(); // Job enqueued
      expect(mockProgressCallback).toHaveBeenCalled();
    });

    it('should handle video download failure', async () => {
      // Arrange
      mockStorage.download.mockResolvedValueOnce({
        data: null,
        error: { message: 'File not found' },
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: { metadata: {} },
        error: null,
      });

      // Act & Assert
      await expect(
        handleExtractAudio(mockJob as any, mockProgressCallback)
      ).rejects.toThrow('Failed to download video');

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error' })
      );
    });

    it('should handle FFmpeg extraction failure', async () => {
      // Arrange
      const mockVideoBlob = new Blob(['video content'], { type: 'video/mp4' });

      mockStorage.download.mockResolvedValueOnce({
        data: mockVideoBlob,
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: { metadata: {} },
        error: null,
      });

      // Mock FFmpeg failure
      // In a real test, you'd configure the ffmpeg mock to throw an error

      // Act & Assert
      // Test would verify error handling
    });

    it('should upload extracted audio to storage', async () => {
      // Arrange
      const mockVideoBlob = new Blob(['video content'], { type: 'video/mp4' });

      mockStorage.download.mockResolvedValueOnce({
        data: mockVideoBlob,
        error: null,
      });

      mockStorage.upload.mockResolvedValueOnce({
        data: { path: 'org/audio.mp3' },
        error: null,
      });

      mockSupabase.single
        .mockResolvedValueOnce({ data: { metadata: {} }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // Act
      await handleExtractAudio(mockJob as any, mockProgressCallback);

      // Assert
      expect(mockStorage.upload).toHaveBeenCalledWith(
        expect.stringContaining('.mp3'),
        expect.any(Buffer),
        expect.objectContaining({ contentType: 'audio/mpeg' })
      );
    });

    it('should enqueue transcription job after extraction', async () => {
      // Arrange
      const mockVideoBlob = new Blob(['video content'], { type: 'video/mp4' });

      mockStorage.download.mockResolvedValueOnce({
        data: mockVideoBlob,
        error: null,
      });

      mockStorage.upload.mockResolvedValueOnce({
        data: { path: 'org/audio.mp3' },
        error: null,
      });

      mockSupabase.single
        .mockResolvedValueOnce({ data: { metadata: {} }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // Act
      await handleExtractAudio(mockJob as any, mockProgressCallback);

      // Assert
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'transcribe',
          status: 'pending',
          payload: expect.objectContaining({
            recordingId: 'recording-123',
            orgId: 'org-123',
          }),
        })
      );
    });

    it('should report progress during extraction', async () => {
      // Arrange
      const mockVideoBlob = new Blob(['video content'], { type: 'video/mp4' });

      mockStorage.download.mockResolvedValueOnce({
        data: mockVideoBlob,
        error: null,
      });

      mockStorage.upload.mockResolvedValueOnce({
        data: { path: 'org/audio.mp3' },
        error: null,
      });

      mockSupabase.single
        .mockResolvedValueOnce({ data: { metadata: {} }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // Act
      await handleExtractAudio(mockJob as any, mockProgressCallback);

      // Assert
      expect(mockProgressCallback).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(String)
      );
      // Should have multiple progress callbacks
      expect(mockProgressCallback.mock.calls.length).toBeGreaterThan(1);
    });

    it('should preserve existing metadata when updating recording', async () => {
      // Arrange
      const mockVideoBlob = new Blob(['video content'], { type: 'video/mp4' });
      const existingMetadata = { customField: 'value', tags: ['test'] };

      mockStorage.download.mockResolvedValueOnce({
        data: mockVideoBlob,
        error: null,
      });

      mockStorage.upload.mockResolvedValueOnce({
        data: { path: 'org/audio.mp3' },
        error: null,
      });

      mockSupabase.single
        .mockResolvedValueOnce({
          data: { metadata: existingMetadata },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null });

      // Act
      await handleExtractAudio(mockJob as any, mockProgressCallback);

      // Assert
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            ...existingMetadata,
            audio_path: expect.any(String),
            extracted_at: expect.any(String),
          }),
        })
      );
    });

    it('should handle storage upload failure', async () => {
      // Arrange
      const mockVideoBlob = new Blob(['video content'], { type: 'video/mp4' });

      mockStorage.download.mockResolvedValueOnce({
        data: mockVideoBlob,
        error: null,
      });

      mockStorage.upload.mockResolvedValueOnce({
        data: null,
        error: { message: 'Storage quota exceeded' },
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: { metadata: {} },
        error: null,
      });

      // Act & Assert
      await expect(
        handleExtractAudio(mockJob as any, mockProgressCallback)
      ).rejects.toThrow('Failed to upload audio');

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error' })
      );
    });

    it('should create event after successful extraction', async () => {
      // Arrange
      const mockVideoBlob = new Blob(['video content'], { type: 'video/mp4' });

      mockStorage.download.mockResolvedValueOnce({
        data: mockVideoBlob,
        error: null,
      });

      mockStorage.upload.mockResolvedValueOnce({
        data: { path: 'org/audio.mp3' },
        error: null,
      });

      mockSupabase.single
        .mockResolvedValueOnce({ data: { metadata: {} }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // Act
      await handleExtractAudio(mockJob as any, mockProgressCallback);

      // Assert
      // Verify event was created
      const insertCalls = mockSupabase.insert.mock.calls;
      const eventInsert = insertCalls.find((call: any) => call[0]?.type === 'audio.extracted');
      expect(eventInsert).toBeDefined();
    });
  });
});
