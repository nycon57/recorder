/**
 * Embeddings Handler (Google) Integration Tests
 *
 * Tests the full embedding generation pipeline including:
 * - Transcript and document fetching
 * - Semantic chunking with content classification
 * - Adaptive chunk sizing
 * - Embedding generation and storage
 * - Job orchestration
 */

import { generateEmbeddings } from '@/lib/workers/handlers/embeddings-google';
import type { Database } from '@/lib/types/database';

// Mock dependencies
jest.mock('@/lib/supabase/admin');
jest.mock('@google/genai');
jest.mock('@/lib/services/semantic-chunker');
jest.mock('@/lib/services/content-classifier');
jest.mock('@/lib/services/adaptive-sizing');

// Import mocked modules
import { createClient } from '@/lib/supabase/admin';
import { GoogleGenAI } from '@google/genai';
import { createSemanticChunker } from '@/lib/services/semantic-chunker';
import { classifyContent } from '@/lib/services/content-classifier';
import { getAdaptiveChunkConfig } from '@/lib/services/adaptive-sizing';

type Job = Database['public']['Tables']['jobs']['Row'];

describe('Embeddings Handler (Google) - Integration', () => {
  let mockSupabase: any;
  let mockGoogleAI: any;
  let mockChunker: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    // Mock Google AI
    mockGoogleAI = {
      models: {
        embedContent: jest.fn().mockResolvedValue({
          embeddings: [
            {
              values: new Array(1536).fill(0.1),
            },
          ],
        }),
      },
    };

    (GoogleGenAI as jest.Mock).mockImplementation(() => mockGoogleAI);

    // Mock semantic chunker
    mockChunker = {
      chunk: jest.fn().mockResolvedValue([
        {
          text: 'Chunk 1 text',
          startPosition: 0,
          endPosition: 100,
          sentences: ['Sentence 1.', 'Sentence 2.'],
          semanticScore: 0.85,
          structureType: 'paragraph',
          boundaryType: 'semantic_break',
          tokenCount: 25,
        },
        {
          text: 'Chunk 2 text',
          startPosition: 100,
          endPosition: 200,
          sentences: ['Sentence 3.', 'Sentence 4.'],
          semanticScore: 0.90,
          structureType: 'code',
          boundaryType: 'structure_boundary',
          tokenCount: 30,
        },
      ]),
    };

    (createSemanticChunker as jest.Mock).mockReturnValue(mockChunker);

    // Mock content classifier
    (classifyContent as jest.Mock).mockReturnValue({
      type: 'technical',
      confidence: 0.85,
      features: {
        hasCode: true,
        hasList: false,
        hasTable: false,
        technicalTermDensity: 0.25,
        averageSentenceLength: 80,
      },
    });

    // Mock adaptive sizing
    (getAdaptiveChunkConfig as jest.Mock).mockReturnValue({
      minSize: 200,
      maxSize: 600,
      targetSize: 400,
      similarityThreshold: 0.8,
      preserveStructures: true,
    });
  });

  describe('Happy Path', () => {
    it('should generate embeddings for audio transcript and document', async () => {
      const job: Job = {
        id: 'job-1',
        type: 'generate_embeddings',
        status: 'pending',
        payload: {
          recordingId: 'rec-1',
          transcriptId: 'trans-1',
          documentId: 'doc-1',
          orgId: 'org-1',
        },
        attempt_count: 0,
        run_after: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        error: null,
        dedupe_key: null,
      };

      // Mock existing embeddings check (none exist)
      mockSupabase.select.mockResolvedValueOnce({
        data: null,
        count: 0,
      });

      // Mock transcript fetch (audio-only)
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          text: 'This is a transcript with multiple sentences. It discusses technical topics.',
          words_json: {
            segments: [
              { start: 0, end: 5, text: 'This is a transcript' },
              { start: 5, end: 10, text: 'with multiple sentences.' },
            ],
          },
          visual_events: [],
          video_metadata: null,
          provider: 'whisper',
        },
        error: null,
      });

      // Mock document fetch
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          markdown: '# Document Title\n\nThis is the document content with code examples.',
        },
        error: null,
      });

      // Mock embeddings insert
      mockSupabase.insert.mockResolvedValue({ error: null });

      // Mock updates
      mockSupabase.update.mockResolvedValue({ error: null });

      await generateEmbeddings(job);

      // Verify content classification was called
      expect(classifyContent).toHaveBeenCalledWith(
        '# Document Title\n\nThis is the document content with code examples.'
      );

      // Verify adaptive config was retrieved
      expect(getAdaptiveChunkConfig).toHaveBeenCalledWith('technical');

      // Verify semantic chunker was created with adaptive config
      expect(createSemanticChunker).toHaveBeenCalledWith({
        minSize: 200,
        maxSize: 600,
        targetSize: 400,
        similarityThreshold: 0.8,
        preserveStructures: true,
      });

      // Verify semantic chunking was called
      expect(mockChunker.chunk).toHaveBeenCalledWith(
        '# Document Title\n\nThis is the document content with code examples.',
        expect.objectContaining({
          recordingId: 'rec-1',
          contentType: 'technical',
        })
      );

      // Verify embeddings were generated (2 transcript + 2 document chunks)
      expect(mockGoogleAI.models.embedContent).toHaveBeenCalledTimes(4);

      // Verify embeddings were saved
      expect(mockSupabase.from).toHaveBeenCalledWith('transcript_chunks');
      expect(mockSupabase.insert).toHaveBeenCalled();

      // Verify recording was updated
      expect(mockSupabase.update).toHaveBeenCalledWith({
        embeddings_updated_at: expect.any(String),
        updated_at: expect.any(String),
      });

      // Verify summary job was enqueued
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'generate_summary',
          status: 'pending',
        })
      );
    });

    it('should handle video transcript with visual context', async () => {
      const job: Job = {
        id: 'job-2',
        type: 'generate_embeddings',
        status: 'pending',
        payload: {
          recordingId: 'rec-2',
          transcriptId: 'trans-2',
          documentId: 'doc-2',
          orgId: 'org-2',
        },
        attempt_count: 0,
        run_after: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        error: null,
        dedupe_key: null,
      };

      // Mock existing embeddings check
      mockSupabase.select.mockResolvedValueOnce({ data: null, count: 0 });

      // Mock transcript fetch (video with visual events)
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          text: 'Video transcript with visual context.',
          words_json: {
            segments: [{ start: 0, end: 5, text: 'Video transcript with visual context.' }],
          },
          visual_events: [
            { timestamp: 2.5, description: 'User clicks button', confidence: 0.9 },
          ],
          video_metadata: { width: 1920, height: 1080 },
          provider: 'gemini-video',
        },
        error: null,
      });

      // Mock document fetch
      mockSupabase.single.mockResolvedValueOnce({
        data: { markdown: '# Video Document' },
        error: null,
      });

      mockSupabase.insert.mockResolvedValue({ error: null });
      mockSupabase.update.mockResolvedValue({ error: null });

      await generateEmbeddings(job);

      // Verify video chunking was used (checked by provider type)
      expect(mockSupabase.from).toHaveBeenCalledWith('transcripts');
    });

    it('should skip generation if embeddings already exist', async () => {
      const job: Job = {
        id: 'job-3',
        type: 'generate_embeddings',
        status: 'pending',
        payload: {
          recordingId: 'rec-3',
          transcriptId: 'trans-3',
          documentId: 'doc-3',
          orgId: 'org-3',
        },
        attempt_count: 0,
        run_after: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        error: null,
        dedupe_key: null,
      };

      // Mock existing embeddings (already exist)
      mockSupabase.select.mockResolvedValueOnce({
        data: [{ id: 'chunk-1' }],
        count: 5,
      });

      // Mock summary job check (doesn't exist)
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock summary job insertion
      mockSupabase.insert.mockResolvedValue({ error: null });

      await generateEmbeddings(job);

      // Verify no transcript/document fetch happened
      expect(mockSupabase.single).not.toHaveBeenCalled();

      // Verify no embeddings were generated
      expect(mockGoogleAI.models.embedContent).not.toHaveBeenCalled();

      // Verify summary job was still enqueued
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'generate_summary',
        })
      );
    });
  });

  describe('Content Classification', () => {
    it('should classify narrative content correctly', async () => {
      const job: Job = {
        id: 'job-4',
        type: 'generate_embeddings',
        status: 'pending',
        payload: {
          recordingId: 'rec-4',
          transcriptId: 'trans-4',
          documentId: 'doc-4',
          orgId: 'org-4',
        },
        attempt_count: 0,
        run_after: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        error: null,
        dedupe_key: null,
      };

      // Mock narrative content
      (classifyContent as jest.Mock).mockReturnValue({
        type: 'narrative',
        confidence: 0.90,
        features: {
          hasCode: false,
          hasList: false,
          hasTable: false,
          technicalTermDensity: 0.05,
          averageSentenceLength: 120,
        },
      });

      // Mock adaptive config for narrative
      (getAdaptiveChunkConfig as jest.Mock).mockReturnValue({
        minSize: 400,
        maxSize: 1000,
        targetSize: 700,
        similarityThreshold: 0.85,
        preserveStructures: true,
      });

      mockSupabase.select.mockResolvedValueOnce({ data: null, count: 0 });
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            text: 'Transcript',
            words_json: { segments: [] },
            visual_events: [],
            provider: 'whisper',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { markdown: 'Once upon a time...' },
          error: null,
        });

      mockSupabase.insert.mockResolvedValue({ error: null });
      mockSupabase.update.mockResolvedValue({ error: null });

      await generateEmbeddings(job);

      // Verify narrative config was used
      expect(getAdaptiveChunkConfig).toHaveBeenCalledWith('narrative');
      expect(createSemanticChunker).toHaveBeenCalledWith(
        expect.objectContaining({
          minSize: 400,
          maxSize: 1000,
          targetSize: 700,
        })
      );
    });

    it('should classify reference content correctly', async () => {
      const job: Job = {
        id: 'job-5',
        type: 'generate_embeddings',
        status: 'pending',
        payload: {
          recordingId: 'rec-5',
          transcriptId: 'trans-5',
          documentId: 'doc-5',
          orgId: 'org-5',
        },
        attempt_count: 0,
        run_after: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        error: null,
        dedupe_key: null,
      };

      // Mock reference content
      (classifyContent as jest.Mock).mockReturnValue({
        type: 'reference',
        confidence: 0.95,
        features: {
          hasCode: false,
          hasList: true,
          hasTable: true,
          technicalTermDensity: 0.10,
          averageSentenceLength: 60,
        },
      });

      // Mock adaptive config for reference
      (getAdaptiveChunkConfig as jest.Mock).mockReturnValue({
        minSize: 150,
        maxSize: 500,
        targetSize: 300,
        similarityThreshold: 0.9,
        preserveStructures: true,
      });

      mockSupabase.select.mockResolvedValueOnce({ data: null, count: 0 });
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            text: 'Transcript',
            words_json: { segments: [] },
            visual_events: [],
            provider: 'whisper',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { markdown: '- Item 1\n- Item 2\n| A | B |\n|---|---|\n| 1 | 2 |' },
          error: null,
        });

      mockSupabase.insert.mockResolvedValue({ error: null });
      mockSupabase.update.mockResolvedValue({ error: null });

      await generateEmbeddings(job);

      // Verify reference config was used
      expect(getAdaptiveChunkConfig).toHaveBeenCalledWith('reference');
      expect(createSemanticChunker).toHaveBeenCalledWith(
        expect.objectContaining({
          similarityThreshold: 0.9, // Higher threshold to keep lists/tables together
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw error if transcript not found', async () => {
      const job: Job = {
        id: 'job-6',
        type: 'generate_embeddings',
        status: 'pending',
        payload: {
          recordingId: 'rec-6',
          transcriptId: 'trans-6',
          documentId: 'doc-6',
          orgId: 'org-6',
        },
        attempt_count: 0,
        run_after: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        error: null,
        dedupe_key: null,
      };

      mockSupabase.select.mockResolvedValueOnce({ data: null, count: 0 });
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Transcript not found' },
      });

      await expect(generateEmbeddings(job)).rejects.toThrow('Failed to fetch transcript');
    });

    it('should throw error if document not found', async () => {
      const job: Job = {
        id: 'job-7',
        type: 'generate_embeddings',
        status: 'pending',
        payload: {
          recordingId: 'rec-7',
          transcriptId: 'trans-7',
          documentId: 'doc-7',
          orgId: 'org-7',
        },
        attempt_count: 0,
        run_after: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        error: null,
        dedupe_key: null,
      };

      mockSupabase.select.mockResolvedValueOnce({ data: null, count: 0 });
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            text: 'Transcript',
            words_json: { segments: [] },
            visual_events: [],
            provider: 'whisper',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Document not found' },
        });

      await expect(generateEmbeddings(job)).rejects.toThrow('Failed to fetch document');
    });

    it('should throw error if embedding generation fails', async () => {
      const job: Job = {
        id: 'job-8',
        type: 'generate_embeddings',
        status: 'pending',
        payload: {
          recordingId: 'rec-8',
          transcriptId: 'trans-8',
          documentId: 'doc-8',
          orgId: 'org-8',
        },
        attempt_count: 0,
        run_after: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        error: null,
        dedupe_key: null,
      };

      mockSupabase.select.mockResolvedValueOnce({ data: null, count: 0 });
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            text: 'Transcript',
            words_json: { segments: [] },
            visual_events: [],
            provider: 'whisper',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { markdown: 'Document' },
          error: null,
        });

      // Mock embedding failure
      mockGoogleAI.models.embedContent.mockResolvedValue({
        embeddings: [], // No embeddings returned
      });

      await expect(generateEmbeddings(job)).rejects.toThrow('No embedding returned from Google API');
    });

    it('should throw error if database insert fails', async () => {
      const job: Job = {
        id: 'job-9',
        type: 'generate_embeddings',
        status: 'pending',
        payload: {
          recordingId: 'rec-9',
          transcriptId: 'trans-9',
          documentId: 'doc-9',
          orgId: 'org-9',
        },
        attempt_count: 0,
        run_after: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        error: null,
        dedupe_key: null,
      };

      mockSupabase.select.mockResolvedValueOnce({ data: null, count: 0 });
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            text: 'Transcript',
            words_json: { segments: [] },
            visual_events: [],
            provider: 'whisper',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { markdown: 'Document' },
          error: null,
        });

      // Mock insert failure
      mockSupabase.insert.mockResolvedValue({
        error: { message: 'Database insert failed' },
      });

      await expect(generateEmbeddings(job)).rejects.toThrow('Failed to save embeddings');
    });
  });

  describe('Semantic Chunking Metadata', () => {
    it('should include semantic chunking metadata in document chunks', async () => {
      const job: Job = {
        id: 'job-10',
        type: 'generate_embeddings',
        status: 'pending',
        payload: {
          recordingId: 'rec-10',
          transcriptId: 'trans-10',
          documentId: 'doc-10',
          orgId: 'org-10',
        },
        attempt_count: 0,
        run_after: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        error: null,
        dedupe_key: null,
      };

      mockSupabase.select.mockResolvedValueOnce({ data: null, count: 0 });
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            text: 'Transcript',
            words_json: { segments: [] },
            visual_events: [],
            provider: 'whisper',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { markdown: 'Document with code' },
          error: null,
        });

      // Capture insert call to verify metadata
      let insertedRecords: any[] = [];
      mockSupabase.insert.mockImplementation((records: any[]) => {
        insertedRecords = records;
        return Promise.resolve({ error: null });
      });

      mockSupabase.update.mockResolvedValue({ error: null });

      await generateEmbeddings(job);

      // Find document chunk (not transcript chunk)
      const documentChunk = insertedRecords.find(
        (r) => r.metadata?.source === 'document'
      );

      expect(documentChunk).toBeDefined();
      expect(documentChunk.chunking_strategy).toBe('semantic');
      expect(documentChunk.semantic_score).toBe(0.85);
      expect(documentChunk.structure_type).toBeDefined();
      expect(documentChunk.boundary_type).toBeDefined();
      expect(documentChunk.metadata.sentenceCount).toBe(2);
    });

    it('should mark transcript chunks with fixed strategy', async () => {
      const job: Job = {
        id: 'job-11',
        type: 'generate_embeddings',
        status: 'pending',
        payload: {
          recordingId: 'rec-11',
          transcriptId: 'trans-11',
          documentId: 'doc-11',
          orgId: 'org-11',
        },
        attempt_count: 0,
        run_after: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        error: null,
        dedupe_key: null,
      };

      mockSupabase.select.mockResolvedValueOnce({ data: null, count: 0 });
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            text: 'Transcript',
            words_json: { segments: [{ start: 0, end: 5, text: 'Transcript' }] },
            visual_events: [],
            provider: 'whisper',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { markdown: 'Document' },
          error: null,
        });

      let insertedRecords: any[] = [];
      mockSupabase.insert.mockImplementation((records: any[]) => {
        insertedRecords = records;
        return Promise.resolve({ error: null });
      });

      mockSupabase.update.mockResolvedValue({ error: null });

      await generateEmbeddings(job);

      // Find transcript chunk
      const transcriptChunk = insertedRecords.find(
        (r) => r.metadata?.source === 'transcript'
      );

      expect(transcriptChunk).toBeDefined();
      expect(transcriptChunk.chunking_strategy).toBe('fixed');
      expect(transcriptChunk.semantic_score).toBeNull();
    });
  });
});
