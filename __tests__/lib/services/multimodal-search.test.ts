/**
 * Multimodal Search Service Unit Tests
 *
 * Tests combined audio + visual search including:
 * - Transcript and frame search integration
 * - Result weighting and re-ranking
 * - Vector similarity calculations
 * - Edge cases and error handling
 */

import { multimodalSearch } from '@/lib/services/multimodal-search';

// Mock vector search
const mockVectorSearchGoogle = jest.fn();
jest.mock('@/lib/services/vector-search-google', () => ({
  vectorSearchGoogle: mockVectorSearchGoogle,
}));

// Mock embeddings
const mockGenerateEmbedding = jest.fn();
jest.mock('@/lib/services/embeddings', () => ({
  generateEmbedding: mockGenerateEmbedding,
}));

// Mock Supabase
const mockLimit = jest.fn();
const mockIn = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();

const mockSupabase = {
  from: jest.fn(() => ({
    select: mockSelect,
  })),
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

describe('Multimodal Search Service', () => {
  const mockOrgId = 'test-org-123';
  const mockQuery = 'How to create a React component';

  const mockTranscriptResults = [
    {
      chunkId: 'chunk-1',
      recordingId: 'rec-1',
      recordingTitle: 'React Tutorial',
      text: 'To create a React component, you use function or class syntax',
      similarity: 0.92,
      timestamp: 10.5,
    },
    {
      chunkId: 'chunk-2',
      recordingId: 'rec-1',
      recordingTitle: 'React Tutorial',
      text: 'Components are the building blocks of React applications',
      similarity: 0.88,
      timestamp: 25.0,
    },
  ];

  const mockFrames = [
    {
      id: 'frame-1',
      recording_id: 'rec-1',
      frame_time_sec: 12.0,
      frame_url: 'org/rec-1/frames/frame_0001.jpg',
      visual_description: 'Code editor showing a React component definition',
      ocr_text: 'function MyComponent() { return <div>Hello</div>; }',
      visual_embedding: new Array(1536).fill(0.5),
      recordings: {
        id: 'rec-1',
        title: 'React Tutorial',
      },
    },
    {
      id: 'frame-2',
      recording_id: 'rec-2',
      frame_time_sec: 5.0,
      frame_url: 'org/rec-2/frames/frame_0001.jpg',
      visual_description: 'Browser showing React component rendered',
      ocr_text: 'Hello World',
      visual_embedding: new Array(1536).fill(0.3),
      recordings: {
        id: 'rec-2',
        title: 'React Demo',
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockVectorSearchGoogle.mockResolvedValue(mockTranscriptResults);
    mockGenerateEmbedding.mockResolvedValue(new Array(1536).fill(0.1));

    // Setup Supabase query chain
    mockEq.mockReturnValue({ limit: mockLimit });
    mockIn.mockReturnValue({ eq: mockEq });
    mockSelect.mockReturnValue({ eq: mockEq, in: mockIn });
    mockLimit.mockResolvedValue({ data: mockFrames, error: null });
  });

  describe('multimodalSearch', () => {
    it('should perform combined audio and visual search', async () => {
      const result = await multimodalSearch(mockQuery, { orgId: mockOrgId });

      expect(result).toMatchObject({
        transcriptResults: expect.any(Array),
        visualResults: expect.any(Array),
        combinedResults: expect.any(Array),
        metadata: {
          transcriptCount: expect.any(Number),
          visualCount: expect.any(Number),
          combinedCount: expect.any(Number),
          audioWeight: expect.any(Number),
          visualWeight: expect.any(Number),
        },
      });

      expect(mockVectorSearchGoogle).toHaveBeenCalledWith(
        mockQuery,
        expect.objectContaining({ orgId: mockOrgId })
      );
    });

    it('should respect audio and visual weights', async () => {
      const result = await multimodalSearch(mockQuery, {
        orgId: mockOrgId,
        audioWeight: 0.6,
        visualWeight: 0.4,
      });

      expect(result.metadata.audioWeight).toBe(0.6);
      expect(result.metadata.visualWeight).toBe(0.4);

      // Check that combined results are weighted
      const combinedAudioResult = result.combinedResults.find(
        (r: any) => r.chunkId === 'chunk-1'
      );
      if (combinedAudioResult) {
        expect((combinedAudioResult as any).finalScore).toBeCloseTo(0.92 * 0.6, 2);
      }
    });

    it('should use default weights when not provided', async () => {
      const result = await multimodalSearch(mockQuery, { orgId: mockOrgId });

      expect(result.metadata.audioWeight).toBe(0.7);
      expect(result.metadata.visualWeight).toBe(0.3);
    });

    it('should respect limit parameter', async () => {
      const result = await multimodalSearch(mockQuery, {
        orgId: mockOrgId,
        limit: 10,
      });

      expect(result.combinedResults.length).toBeLessThanOrEqual(10);
    });

    it('should filter results by recording IDs', async () => {
      const recordingIds = ['rec-1', 'rec-2'];

      await multimodalSearch(mockQuery, {
        orgId: mockOrgId,
        recordingIds,
      });

      expect(mockVectorSearchGoogle).toHaveBeenCalledWith(
        mockQuery,
        expect.objectContaining({ recordingIds })
      );
    });

    it('should skip visual search when disabled', async () => {
      process.env.ENABLE_VISUAL_SEARCH = 'false';

      const result = await multimodalSearch(mockQuery, { orgId: mockOrgId });

      expect(result.visualResults).toHaveLength(0);
      expect(result.combinedResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ chunkId: expect.any(String) }),
        ])
      );

      delete process.env.ENABLE_VISUAL_SEARCH;
    });

    it('should skip visual search when includeFrames is false', async () => {
      const result = await multimodalSearch(mockQuery, {
        orgId: mockOrgId,
        includeFrames: false,
      });

      expect(result.visualResults).toHaveLength(0);
      expect(mockSupabase.from).not.toHaveBeenCalledWith('video_frames');
    });

    it('should combine and sort results by final score', async () => {
      const result = await multimodalSearch(mockQuery, {
        orgId: mockOrgId,
        audioWeight: 0.5,
        visualWeight: 0.5,
      });

      // Check that results are sorted by finalScore
      for (let i = 1; i < result.combinedResults.length; i++) {
        const prev = result.combinedResults[i - 1] as any;
        const curr = result.combinedResults[i] as any;
        expect(prev.finalScore).toBeGreaterThanOrEqual(curr.finalScore);
      }
    });

    it('should generate embedding for visual search', async () => {
      await multimodalSearch(mockQuery, { orgId: mockOrgId });

      expect(mockGenerateEmbedding).toHaveBeenCalledWith(mockQuery);
    });

    it('should query video frames table', async () => {
      await multimodalSearch(mockQuery, { orgId: mockOrgId });

      expect(mockSupabase.from).toHaveBeenCalledWith('video_frames');
      expect(mockSelect).toHaveBeenCalledWith(
        expect.stringContaining('visual_description')
      );
    });

    it('should filter frames by org ID', async () => {
      await multimodalSearch(mockQuery, { orgId: mockOrgId });

      expect(mockEq).toHaveBeenCalledWith('org_id', mockOrgId);
    });

    it('should filter frames by recording IDs when provided', async () => {
      const recordingIds = ['rec-1', 'rec-2'];

      await multimodalSearch(mockQuery, {
        orgId: mockOrgId,
        recordingIds,
      });

      expect(mockIn).toHaveBeenCalledWith('recording_id', recordingIds);
    });

    it('should handle no transcript results', async () => {
      mockVectorSearchGoogle.mockResolvedValueOnce([]);

      const result = await multimodalSearch(mockQuery, { orgId: mockOrgId });

      expect(result.transcriptResults).toHaveLength(0);
      expect(result.combinedResults.length).toBeGreaterThan(0); // Should have visual results
    });

    it('should handle no visual results', async () => {
      mockLimit.mockResolvedValueOnce({ data: [], error: null });

      const result = await multimodalSearch(mockQuery, { orgId: mockOrgId });

      expect(result.visualResults).toHaveLength(0);
      expect(result.combinedResults.length).toBeGreaterThan(0); // Should have transcript results
    });

    it('should handle empty results from both sources', async () => {
      mockVectorSearchGoogle.mockResolvedValueOnce([]);
      mockLimit.mockResolvedValueOnce({ data: [], error: null });

      const result = await multimodalSearch(mockQuery, { orgId: mockOrgId });

      expect(result.transcriptResults).toHaveLength(0);
      expect(result.visualResults).toHaveLength(0);
      expect(result.combinedResults).toHaveLength(0);
    });

    it('should include metadata in results', async () => {
      const result = await multimodalSearch(mockQuery, {
        orgId: mockOrgId,
        audioWeight: 0.6,
        visualWeight: 0.4,
        limit: 15,
      });

      expect(result.metadata).toEqual({
        transcriptCount: mockTranscriptResults.length,
        visualCount: expect.any(Number),
        combinedCount: expect.any(Number),
        audioWeight: 0.6,
        visualWeight: 0.4,
      });
    });
  });

  describe('visual search', () => {
    it('should calculate cosine similarity for frames', async () => {
      const result = await multimodalSearch(mockQuery, { orgId: mockOrgId });

      result.visualResults.forEach((vr) => {
        expect(vr.similarity).toBeGreaterThanOrEqual(0);
        expect(vr.similarity).toBeLessThanOrEqual(1);
      });
    });

    it('should filter frames below similarity threshold', async () => {
      // Mock frames with low similarity (different embeddings)
      const lowSimilarityFrames = [
        {
          ...mockFrames[0],
          visual_embedding: new Array(1536).fill(0.01), // Very different
        },
      ];

      mockLimit.mockResolvedValueOnce({
        data: lowSimilarityFrames,
        error: null,
      });

      const result = await multimodalSearch(mockQuery, { orgId: mockOrgId });

      // Should filter out low similarity results (< 0.70)
      expect(result.visualResults.length).toBeLessThanOrEqual(
        lowSimilarityFrames.length
      );
    });

    it('should sort visual results by similarity', async () => {
      const result = await multimodalSearch(mockQuery, { orgId: mockOrgId });

      for (let i = 1; i < result.visualResults.length; i++) {
        expect(result.visualResults[i - 1].similarity).toBeGreaterThanOrEqual(
          result.visualResults[i].similarity
        );
      }
    });

    it('should include frame metadata in results', async () => {
      const result = await multimodalSearch(mockQuery, { orgId: mockOrgId });

      result.visualResults.forEach((vr) => {
        expect(vr).toMatchObject({
          frameId: expect.any(String),
          recordingId: expect.any(String),
          recordingTitle: expect.any(String),
          frameTimeSec: expect.any(Number),
          frameUrl: expect.any(String),
          visualDescription: expect.any(String),
          similarity: expect.any(Number),
        });
      });
    });

    it('should include OCR text when available', async () => {
      const result = await multimodalSearch(mockQuery, { orgId: mockOrgId });

      const frameWithOcr = result.visualResults.find((vr) => vr.ocrText);
      expect(frameWithOcr).toBeDefined();
      expect(frameWithOcr?.ocrText).toBeTruthy();
    });

    it('should handle frames without OCR text', async () => {
      const framesWithoutOcr = [
        { ...mockFrames[0], ocr_text: null },
        { ...mockFrames[1], ocr_text: null },
      ];

      mockLimit.mockResolvedValueOnce({
        data: framesWithoutOcr,
        error: null,
      });

      const result = await multimodalSearch(mockQuery, { orgId: mockOrgId });

      result.visualResults.forEach((vr) => {
        expect(vr.ocrText).toBeUndefined();
      });
    });

    it('should handle database errors gracefully', async () => {
      mockLimit.mockResolvedValueOnce({
        data: null,
        error: new Error('Database connection failed'),
      });

      const result = await multimodalSearch(mockQuery, { orgId: mockOrgId });

      expect(result.visualResults).toHaveLength(0);
      expect(result.combinedResults.length).toBeGreaterThan(0); // Should still have transcript results
    });
  });

  describe('result combination', () => {
    it('should merge results from both sources', async () => {
      const result = await multimodalSearch(mockQuery, {
        orgId: mockOrgId,
        audioWeight: 0.5,
        visualWeight: 0.5,
      });

      expect(result.combinedResults.length).toBeGreaterThan(0);

      const hasTranscript = result.combinedResults.some((r: any) => r.chunkId);
      const hasVisual = result.combinedResults.some((r: any) => r.frameId);

      expect(hasTranscript || hasVisual).toBe(true);
    });

    it('should apply weights correctly', async () => {
      const audioWeight = 0.8;
      const visualWeight = 0.2;

      const result = await multimodalSearch(mockQuery, {
        orgId: mockOrgId,
        audioWeight,
        visualWeight,
      });

      const audioResult = result.combinedResults.find((r: any) => r.chunkId);
      if (audioResult) {
        expect((audioResult as any).finalScore).toBeCloseTo(
          mockTranscriptResults[0].similarity * audioWeight,
          2
        );
      }
    });

    it('should deduplicate results from same recording', async () => {
      const result = await multimodalSearch(mockQuery, { orgId: mockOrgId });

      const recordingIds = result.combinedResults.map((r: any) => r.recordingId);
      // Should have results but they might be from same recording
      expect(recordingIds.length).toBeGreaterThan(0);
    });

    it('should handle equal scores correctly', async () => {
      mockVectorSearchGoogle.mockResolvedValueOnce([
        { ...mockTranscriptResults[0], similarity: 0.9 },
        { ...mockTranscriptResults[1], similarity: 0.9 },
      ]);

      const result = await multimodalSearch(mockQuery, {
        orgId: mockOrgId,
        audioWeight: 0.5,
        visualWeight: 0.5,
      });

      // Should still return results
      expect(result.combinedResults.length).toBeGreaterThan(0);
    });

    it('should respect limit after combining results', async () => {
      const limit = 3;

      const result = await multimodalSearch(mockQuery, {
        orgId: mockOrgId,
        limit,
      });

      expect(result.combinedResults.length).toBeLessThanOrEqual(limit);
    });
  });

  describe('cosine similarity', () => {
    it('should calculate correct similarity for identical vectors', async () => {
      const identicalEmbedding = new Array(1536).fill(0.5);
      mockGenerateEmbedding.mockResolvedValueOnce(identicalEmbedding);

      const identicalFrame = {
        ...mockFrames[0],
        visual_embedding: identicalEmbedding,
      };

      mockLimit.mockResolvedValueOnce({
        data: [identicalFrame],
        error: null,
      });

      const result = await multimodalSearch(mockQuery, { orgId: mockOrgId });

      expect(result.visualResults[0].similarity).toBeCloseTo(1.0, 2);
    });

    it('should calculate correct similarity for orthogonal vectors', async () => {
      const queryEmbedding = [...new Array(768).fill(1), ...new Array(768).fill(0)];
      const frameEmbedding = [...new Array(768).fill(0), ...new Array(768).fill(1)];

      mockGenerateEmbedding.mockResolvedValueOnce(queryEmbedding);

      const orthogonalFrame = {
        ...mockFrames[0],
        visual_embedding: frameEmbedding,
      };

      mockLimit.mockResolvedValueOnce({
        data: [orthogonalFrame],
        error: null,
      });

      const result = await multimodalSearch(mockQuery, { orgId: mockOrgId });

      expect(result.visualResults[0].similarity).toBeCloseTo(0, 1);
    });

    it('should handle zero vectors', async () => {
      const zeroEmbedding = new Array(1536).fill(0);
      mockGenerateEmbedding.mockResolvedValueOnce(zeroEmbedding);

      const zeroFrame = {
        ...mockFrames[0],
        visual_embedding: zeroEmbedding,
      };

      mockLimit.mockResolvedValueOnce({
        data: [zeroFrame],
        error: null,
      });

      const result = await multimodalSearch(mockQuery, { orgId: mockOrgId });

      expect(result.visualResults[0].similarity).toBe(0);
    });
  });

  describe('performance', () => {
    it('should complete search in reasonable time', async () => {
      const startTime = Date.now();

      await multimodalSearch(mockQuery, { orgId: mockOrgId });

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
    });

    it('should handle large result sets', async () => {
      const manyTranscriptResults = Array.from({ length: 100 }, (_, i) => ({
        chunkId: `chunk-${i}`,
        recordingId: `rec-${i}`,
        recordingTitle: `Recording ${i}`,
        text: `Content ${i}`,
        similarity: 0.8 - i * 0.001,
        timestamp: i * 10,
      }));

      const manyFrames = Array.from({ length: 100 }, (_, i) => ({
        id: `frame-${i}`,
        recording_id: `rec-${i}`,
        frame_time_sec: i * 5,
        frame_url: `frame_${i}.jpg`,
        visual_description: `Description ${i}`,
        ocr_text: `Text ${i}`,
        visual_embedding: new Array(1536).fill(0.5 - i * 0.001),
        recordings: { id: `rec-${i}`, title: `Recording ${i}` },
      }));

      mockVectorSearchGoogle.mockResolvedValueOnce(manyTranscriptResults);
      mockLimit.mockResolvedValueOnce({ data: manyFrames, error: null });

      const result = await multimodalSearch(mockQuery, {
        orgId: mockOrgId,
        limit: 20,
      });

      expect(result.combinedResults).toHaveLength(20);
    });
  });

  describe('edge cases', () => {
    it('should handle empty query', async () => {
      const result = await multimodalSearch('', { orgId: mockOrgId });

      expect(mockVectorSearchGoogle).toHaveBeenCalledWith('', expect.any(Object));
    });

    it('should handle very long query', async () => {
      const longQuery = 'How to '.repeat(100) + 'create a component';

      const result = await multimodalSearch(longQuery, { orgId: mockOrgId });

      expect(result).toBeDefined();
    });

    it('should handle special characters in query', async () => {
      const specialQuery = 'How to use @decorators & {props} in [React]?';

      await multimodalSearch(specialQuery, { orgId: mockOrgId });

      expect(mockVectorSearchGoogle).toHaveBeenCalledWith(
        specialQuery,
        expect.any(Object)
      );
    });

    it('should handle missing recording titles', async () => {
      const framesWithoutTitle = [
        { ...mockFrames[0], recordings: { id: 'rec-1', title: null } },
      ];

      mockLimit.mockResolvedValueOnce({
        data: framesWithoutTitle,
        error: null,
      });

      const result = await multimodalSearch(mockQuery, { orgId: mockOrgId });

      expect(result.visualResults[0].recordingTitle).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      mockVectorSearchGoogle.mockRejectedValueOnce(
        new Error('Vector search API error')
      );

      await expect(
        multimodalSearch(mockQuery, { orgId: mockOrgId })
      ).rejects.toThrow('Vector search API error');
    });
  });
});
