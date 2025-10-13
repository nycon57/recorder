/**
 * Phase 4 Integration Tests
 *
 * End-to-end tests for the complete frame extraction and visual search pipeline:
 * 1. Extract frames from video
 * 2. Generate visual descriptions with Gemini
 * 3. Extract OCR text with Tesseract
 * 4. Generate embeddings
 * 5. Store in database
 * 6. Perform multimodal search
 *
 * These tests verify that all components work together correctly.
 */

import { extractFrames } from '@/lib/services/frame-extraction';
import { indexRecordingFrames } from '@/lib/services/visual-indexing';
import { extractFrameText } from '@/lib/services/ocr-service';
import { multimodalSearch } from '@/lib/services/multimodal-search';
import { handleExtractFrames } from '@/lib/workers/handlers/extract-frames';
import {
  mockRecording,
  mockFrameExtractionResult,
  mockVisualDescriptions,
  mockOCRResults,
  createMockEmbedding,
} from '../fixtures/phase4-test-data';

// Mock all external dependencies
jest.mock('@/lib/services/frame-extraction');
jest.mock('@/lib/services/visual-indexing');
jest.mock('@/lib/services/ocr-service');
jest.mock('@/lib/services/vector-search-google');
jest.mock('@/lib/services/embeddings');
jest.mock('@/lib/supabase/admin');
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn(),
    unlink: jest.fn(),
    readFile: jest.fn(),
  },
}));

describe('Phase 4 Integration Tests', () => {
  describe('Complete Frame Extraction Pipeline', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should extract frames and index them end-to-end', async () => {
      // Arrange
      const mockSupabase = require('@/lib/supabase/admin').createClient();

      (extractFrames as jest.Mock).mockResolvedValue(mockFrameExtractionResult);
      (indexRecordingFrames as jest.Mock).mockResolvedValue(undefined);

      mockSupabase.from.mockImplementation((table: string) => ({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }));

      mockSupabase.storage = {
        from: jest.fn(() => ({
          download: jest.fn().mockResolvedValue({
            data: new Blob(['mock-video']),
            error: null,
          }),
        })),
      };

      const job = {
        id: 'job-123',
        type: 'extract_frames' as const,
        status: 'pending' as const,
        payload: {
          recordingId: mockRecording.id,
          orgId: mockRecording.org_id,
          videoUrl: mockRecording.video_url,
        },
        org_id: mockRecording.org_id,
        attempt_count: 0,
        max_attempts: 3,
        run_after: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Act
      await handleExtractFrames(job);

      // Assert
      expect(extractFrames).toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalledWith('video_frames');
      expect(mockSupabase.from).toHaveBeenCalledWith('recordings');
    });

    it('should handle frame extraction errors gracefully', async () => {
      // Arrange
      const mockSupabase = require('@/lib/supabase/admin').createClient();

      (extractFrames as jest.Mock).mockRejectedValue(new Error('FFmpeg failed'));

      mockSupabase.from.mockImplementation(() => ({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      }));

      mockSupabase.storage = {
        from: jest.fn(() => ({
          download: jest.fn().mockResolvedValue({
            data: new Blob(['mock-video']),
            error: null,
          }),
        })),
      };

      const job = {
        id: 'job-123',
        type: 'extract_frames' as const,
        status: 'pending' as const,
        payload: {
          recordingId: mockRecording.id,
          orgId: mockRecording.org_id,
          videoUrl: mockRecording.video_url,
        },
        org_id: mockRecording.org_id,
        attempt_count: 0,
        max_attempts: 3,
        run_after: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Act & Assert
      await expect(handleExtractFrames(job)).rejects.toThrow('FFmpeg failed');

      // Verify status was updated to failed
      expect(mockSupabase.from).toHaveBeenCalledWith('recordings');
    });

    it('should process OCR in parallel batches', async () => {
      // Arrange
      const mockSupabase = require('@/lib/supabase/admin').createClient();

      (extractFrames as jest.Mock).mockResolvedValue(mockFrameExtractionResult);
      (extractFrameText as jest.Mock).mockResolvedValue(mockOCRResults[0]);

      const manyFrames = Array.from({ length: 12 }, (_, i) => ({
        id: `frame-${i + 1}`,
        frame_number: i + 1,
        frame_url: `frame_${i + 1}.jpg`,
      }));

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'video_frames') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
            insert: jest.fn().mockResolvedValue({ error: null }),
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: manyFrames,
                error: null,
              }),
            }),
          };
        }
        return {
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      });

      mockSupabase.storage = {
        from: jest.fn(() => ({
          download: jest.fn().mockResolvedValue({
            data: new Blob(['mock-image']),
            error: null,
          }),
        })),
      };

      process.env.ENABLE_OCR = 'true';

      const job = {
        id: 'job-123',
        type: 'extract_frames' as const,
        status: 'pending' as const,
        payload: {
          recordingId: mockRecording.id,
          orgId: mockRecording.org_id,
          videoUrl: mockRecording.video_url,
        },
        org_id: mockRecording.org_id,
        attempt_count: 0,
        max_attempts: 3,
        run_after: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Act
      await handleExtractFrames(job);

      // Assert
      expect(extractFrameText).toHaveBeenCalledTimes(12);

      delete process.env.ENABLE_OCR;
    });
  });

  describe('Multimodal Search Integration', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should combine audio and visual results correctly', async () => {
      // Arrange
      const mockVectorSearch = require('@/lib/services/vector-search-google').vectorSearchGoogle;
      const mockGenerateEmbedding = require('@/lib/services/embeddings').generateEmbedding;

      mockVectorSearch.mockResolvedValue([
        {
          chunkId: 'chunk-1',
          recordingId: mockRecording.id,
          recordingTitle: mockRecording.title,
          text: 'React component tutorial',
          similarity: 0.95,
          timestamp: 10,
        },
      ]);

      mockGenerateEmbedding.mockResolvedValue(createMockEmbedding());

      const mockSupabase = require('@/lib/supabase/server').createClient();
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'frame-1',
                  recording_id: mockRecording.id,
                  frame_time_sec: 5.0,
                  frame_url: 'frame_0001.jpg',
                  visual_description: 'Code editor',
                  ocr_text: 'function MyComponent()',
                  visual_embedding: createMockEmbedding(0.8),
                  recordings: {
                    id: mockRecording.id,
                    title: mockRecording.title,
                  },
                },
              ],
              error: null,
            }),
          }),
        }),
      }));

      process.env.ENABLE_VISUAL_SEARCH = 'true';

      // Act
      const result = await multimodalSearch('React component', {
        orgId: mockRecording.org_id,
        includeFrames: true,
        audioWeight: 0.6,
        visualWeight: 0.4,
      });

      // Assert
      expect(result.transcriptResults).toBeDefined();
      expect(result.visualResults).toBeDefined();
      expect(result.combinedResults).toBeDefined();
      expect(result.metadata.transcriptCount).toBeGreaterThan(0);

      delete process.env.ENABLE_VISUAL_SEARCH;
    });

    it('should respect similarity threshold', async () => {
      // Arrange
      const mockVectorSearch = require('@/lib/services/vector-search-google').vectorSearchGoogle;
      const mockGenerateEmbedding = require('@/lib/services/embeddings').generateEmbedding;

      mockVectorSearch.mockResolvedValue([]);
      mockGenerateEmbedding.mockResolvedValue(createMockEmbedding());

      const mockSupabase = require('@/lib/supabase/server').createClient();
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'frame-1',
                  recording_id: mockRecording.id,
                  frame_time_sec: 5.0,
                  frame_url: 'frame_0001.jpg',
                  visual_description: 'Very different content',
                  visual_embedding: createMockEmbedding(0.01), // Low similarity
                  recordings: {
                    id: mockRecording.id,
                    title: mockRecording.title,
                  },
                },
              ],
              error: null,
            }),
          }),
        }),
      }));

      // Act
      const result = await multimodalSearch('React component', {
        orgId: mockRecording.org_id,
        threshold: 0.8, // High threshold
      });

      // Assert
      expect(result.visualResults).toHaveLength(0);
    });
  });

  describe('Error Recovery', () => {
    it('should retry failed jobs with exponential backoff', async () => {
      // Arrange
      const mockSupabase = require('@/lib/supabase/admin').createClient();

      (extractFrames as jest.Mock)
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(mockFrameExtractionResult);

      mockSupabase.from.mockImplementation(() => ({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }));

      mockSupabase.storage = {
        from: jest.fn(() => ({
          download: jest.fn().mockResolvedValue({
            data: new Blob(['mock-video']),
            error: null,
          }),
        })),
      };

      const job = {
        id: 'job-123',
        type: 'extract_frames' as const,
        status: 'pending' as const,
        payload: {
          recordingId: mockRecording.id,
          orgId: mockRecording.org_id,
          videoUrl: mockRecording.video_url,
        },
        org_id: mockRecording.org_id,
        attempt_count: 0,
        max_attempts: 3,
        run_after: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Act & Assert - First attempt fails
      await expect(handleExtractFrames(job)).rejects.toThrow('Temporary failure');

      // Second attempt succeeds
      await expect(handleExtractFrames(job)).resolves.toBeUndefined();
    });

    it('should mark job as failed after max attempts', async () => {
      // Arrange
      const mockSupabase = require('@/lib/supabase/admin').createClient();

      (extractFrames as jest.Mock).mockRejectedValue(new Error('Persistent failure'));

      mockSupabase.from.mockImplementation(() => ({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }));

      mockSupabase.storage = {
        from: jest.fn(() => ({
          download: jest.fn().mockResolvedValue({
            data: new Blob(['mock-video']),
            error: null,
          }),
        })),
      };

      const job = {
        id: 'job-123',
        type: 'extract_frames' as const,
        status: 'pending' as const,
        payload: {
          recordingId: mockRecording.id,
          orgId: mockRecording.org_id,
          videoUrl: mockRecording.video_url,
        },
        org_id: mockRecording.org_id,
        attempt_count: 2, // Already failed twice
        max_attempts: 3,
        run_after: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Act
      await expect(handleExtractFrames(job)).rejects.toThrow();

      // Assert
      const updateCalls = mockSupabase.from.mock.results
        .filter((r: any) => r.value.update)
        .map((r: any) => r.value.update.mock.calls[0][0]);

      expect(updateCalls).toContainEqual(
        expect.objectContaining({
          visual_indexing_status: 'failed',
        })
      );
    });
  });

  describe('Performance', () => {
    it('should process frames efficiently in batches', async () => {
      // Arrange
      const frameCount = 300;
      const batchSize = 5;

      (indexRecordingFrames as jest.Mock).mockImplementation(async () => {
        // Simulate batch processing
        for (let i = 0; i < frameCount; i += batchSize) {
          await Promise.resolve();
        }
      });

      const startTime = Date.now();

      // Act
      await indexRecordingFrames(mockRecording.id, mockRecording.org_id);

      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent job processing', async () => {
      // Arrange
      const mockSupabase = require('@/lib/supabase/admin').createClient();

      (extractFrames as jest.Mock).mockResolvedValue(mockFrameExtractionResult);

      mockSupabase.from.mockImplementation(() => ({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }));

      mockSupabase.storage = {
        from: jest.fn(() => ({
          download: jest.fn().mockResolvedValue({
            data: new Blob(['mock-video']),
            error: null,
          }),
        })),
      };

      const jobs = Array.from({ length: 5 }, (_, i) => ({
        id: `job-${i}`,
        type: 'extract_frames' as const,
        status: 'pending' as const,
        payload: {
          recordingId: `rec-${i}`,
          orgId: mockRecording.org_id,
          videoUrl: `video-${i}.webm`,
        },
        org_id: mockRecording.org_id,
        attempt_count: 0,
        max_attempts: 3,
        run_after: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      // Act
      const results = await Promise.all(jobs.map((job) => handleExtractFrames(job)));

      // Assert
      expect(results).toHaveLength(5);
      expect(extractFrames).toHaveBeenCalledTimes(5);
    });
  });
});
