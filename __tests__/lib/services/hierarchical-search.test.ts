import {
  hierarchicalSearch,
  hierarchicalSearchRecording,
  getRecordingSummaries,
  generateDualEmbeddings,
} from '@/lib/services/hierarchical-search';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';

// Mock dependencies
jest.mock('@/lib/supabase/server');
jest.mock('@google/genai');

describe('Hierarchical Search Service', () => {
  let mockSupabase: any;
  let mockGenAI: any;
  let mockModels: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      rpc: jest.fn(),
      from: jest.fn(),
    };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);

    // Mock Google GenAI
    mockModels = {
      embedContent: jest.fn(),
    };
    mockGenAI = {
      models: mockModels,
    };
    (GoogleGenAI as jest.Mock).mockImplementation(() => mockGenAI);

    // Set environment variable
    process.env.GOOGLE_AI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.GOOGLE_AI_API_KEY;
  });

  describe('generateDualEmbeddings', () => {
    it('should generate both 1536-dim and 3072-dim embeddings', async () => {
      const text = 'machine learning algorithms';

      // Mock embedding responses
      mockModels.embedContent
        .mockResolvedValueOnce({
          // 1536-dim
          embeddings: [{ values: new Array(1536).fill(0.1) }],
        })
        .mockResolvedValueOnce({
          // 3072-dim
          embeddings: [{ values: new Array(3072).fill(0.2) }],
        });

      // Execute
      const result = await generateDualEmbeddings(text);

      // Assertions
      expect(result).toHaveProperty('embedding1536');
      expect(result).toHaveProperty('embedding3072');
      expect(result.embedding1536).toHaveLength(1536);
      expect(result.embedding3072).toHaveLength(3072);
      expect(mockModels.embedContent).toHaveBeenCalledTimes(2);

      // Verify first call for 1536-dim
      expect(mockModels.embedContent).toHaveBeenNthCalledWith(1, {
        model: expect.any(String),
        contents: text,
        config: {
          taskType: expect.any(String),
          outputDimensionality: 1536,
        },
      });

      // Verify second call for 3072-dim
      expect(mockModels.embedContent).toHaveBeenNthCalledWith(2, {
        model: expect.any(String),
        contents: text,
        config: {
          taskType: expect.any(String),
          outputDimensionality: 3072,
        },
      });
    });

    it('should throw error if embedding generation fails', async () => {
      const text = 'test query';

      // Mock error
      mockModels.embedContent.mockRejectedValue(
        new Error('Embedding API error')
      );

      // Execute & Assert
      await expect(generateDualEmbeddings(text)).rejects.toThrow(
        'Failed to generate dual embeddings'
      );
    });
  });

  describe('hierarchicalSearch', () => {
    it('should perform hierarchical search successfully', async () => {
      const query = 'machine learning algorithms';
      const orgId = 'test-org-id';

      // Mock dual embeddings
      mockModels.embedContent
        .mockResolvedValueOnce({
          embeddings: [{ values: new Array(1536).fill(0.1) }],
        })
        .mockResolvedValueOnce({
          embeddings: [{ values: new Array(3072).fill(0.2) }],
        });

      // Mock database response
      const mockResults = [
        {
          id: 'chunk-1',
          recording_id: 'rec-1',
          recording_title: 'ML Basics',
          chunk_text: 'Introduction to machine learning algorithms.',
          similarity: 0.92,
          summary_similarity: 0.88,
          metadata: { source: 'transcript', chunkIndex: 0 },
          created_at: new Date().toISOString(),
        },
        {
          id: 'chunk-2',
          recording_id: 'rec-2',
          recording_title: 'Deep Learning',
          chunk_text: 'Neural networks and deep learning.',
          similarity: 0.89,
          summary_similarity: 0.85,
          metadata: { source: 'document', chunkIndex: 5 },
          created_at: new Date().toISOString(),
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockResults,
        error: null,
      });

      // Execute
      const results = await hierarchicalSearch(query, {
        orgId,
        topDocuments: 5,
        chunksPerDocument: 3,
      });

      // Assertions
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        id: 'chunk-1',
        recordingId: 'rec-1',
        recordingTitle: 'ML Basics',
        chunkText: expect.stringContaining('machine learning'),
        similarity: 0.92,
        summarySimilarity: 0.88,
      });

      // Verify RPC call
      expect(mockSupabase.rpc).toHaveBeenCalledWith('hierarchical_search', {
        query_embedding_1536: expect.any(String),
        query_embedding_3072: expect.any(String),
        match_org_id: orgId,
        top_documents: 5,
        chunks_per_document: 3,
        match_threshold: 0.7,
      });
    });

    it('should use default options when not provided', async () => {
      const query = 'test query';
      const orgId = 'test-org-id';

      // Mock embeddings
      mockModels.embedContent
        .mockResolvedValueOnce({
          embeddings: [{ values: new Array(1536).fill(0.1) }],
        })
        .mockResolvedValueOnce({
          embeddings: [{ values: new Array(3072).fill(0.2) }],
        });

      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      // Execute without optional params
      await hierarchicalSearch(query, { orgId });

      // Verify default values were used
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'hierarchical_search',
        expect.objectContaining({
          top_documents: 5, // default
          chunks_per_document: 3, // default
          match_threshold: 0.7, // default
        })
      );
    });

    it('should return empty array if no results found', async () => {
      const query = 'nonexistent topic';
      const orgId = 'test-org-id';

      // Mock embeddings
      mockModels.embedContent
        .mockResolvedValueOnce({
          embeddings: [{ values: new Array(1536).fill(0.1) }],
        })
        .mockResolvedValueOnce({
          embeddings: [{ values: new Array(3072).fill(0.2) }],
        });

      // Mock empty results
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      // Execute
      const results = await hierarchicalSearch(query, { orgId });

      // Assertions
      expect(results).toEqual([]);
    });

    it('should throw error if database query fails', async () => {
      const query = 'test query';
      const orgId = 'test-org-id';

      // Mock embeddings
      mockModels.embedContent
        .mockResolvedValueOnce({
          embeddings: [{ values: new Array(1536).fill(0.1) }],
        })
        .mockResolvedValueOnce({
          embeddings: [{ values: new Array(3072).fill(0.2) }],
        });

      // Mock database error
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection error' },
      });

      // Execute & Assert
      await expect(
        hierarchicalSearch(query, { orgId })
      ).rejects.toThrow('Hierarchical search failed');
    });

    it('should deduplicate results with same ID', async () => {
      const query = 'test query';
      const orgId = 'test-org-id';

      // Mock embeddings
      mockModels.embedContent
        .mockResolvedValueOnce({
          embeddings: [{ values: new Array(1536).fill(0.1) }],
        })
        .mockResolvedValueOnce({
          embeddings: [{ values: new Array(3072).fill(0.2) }],
        });

      // Mock results with duplicates
      const mockResults = [
        {
          id: 'chunk-1',
          recording_id: 'rec-1',
          recording_title: 'Recording 1',
          chunk_text: 'First occurrence',
          similarity: 0.95,
          summary_similarity: 0.90,
          metadata: {},
          created_at: new Date().toISOString(),
        },
        {
          id: 'chunk-1', // Duplicate ID
          recording_id: 'rec-1',
          recording_title: 'Recording 1',
          chunk_text: 'Second occurrence',
          similarity: 0.85,
          summary_similarity: 0.80,
          metadata: {},
          created_at: new Date().toISOString(),
        },
        {
          id: 'chunk-2',
          recording_id: 'rec-2',
          recording_title: 'Recording 2',
          chunk_text: 'Unique chunk',
          similarity: 0.90,
          summary_similarity: 0.88,
          metadata: {},
          created_at: new Date().toISOString(),
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockResults,
        error: null,
      });

      // Execute
      const results = await hierarchicalSearch(query, { orgId });

      // Should only have 2 results (duplicate removed)
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('chunk-1');
      expect(results[1].id).toBe('chunk-2');
      // Should keep first occurrence with higher similarity
      expect(results[0].chunkText).toBe('First occurrence');
    });

    it('should respect custom threshold', async () => {
      const query = 'test query';
      const orgId = 'test-org-id';

      mockModels.embedContent
        .mockResolvedValueOnce({
          embeddings: [{ values: new Array(1536).fill(0.1) }],
        })
        .mockResolvedValueOnce({
          embeddings: [{ values: new Array(3072).fill(0.2) }],
        });

      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      // Execute with custom threshold
      await hierarchicalSearch(query, {
        orgId,
        threshold: 0.85,
      });

      // Verify threshold was passed
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'hierarchical_search',
        expect.objectContaining({
          match_threshold: 0.85,
        })
      );
    });
  });

  describe('hierarchicalSearchRecording', () => {
    it('should search within specific recording', async () => {
      const recordingId = 'target-recording';
      const query = 'test query';
      const orgId = 'test-org-id';

      // Mock embeddings
      mockModels.embedContent
        .mockResolvedValueOnce({
          embeddings: [{ values: new Array(1536).fill(0.1) }],
        })
        .mockResolvedValueOnce({
          embeddings: [{ values: new Array(3072).fill(0.2) }],
        });

      // Mock results from multiple recordings
      const mockResults = [
        {
          id: 'chunk-1',
          recording_id: 'target-recording',
          recording_title: 'Target',
          chunk_text: 'Target chunk',
          similarity: 0.9,
          summary_similarity: 0.85,
          metadata: {},
          created_at: new Date().toISOString(),
        },
        {
          id: 'chunk-2',
          recording_id: 'other-recording',
          recording_title: 'Other',
          chunk_text: 'Other chunk',
          similarity: 0.95,
          summary_similarity: 0.90,
          metadata: {},
          created_at: new Date().toISOString(),
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockResults,
        error: null,
      });

      // Execute
      const results = await hierarchicalSearchRecording(
        recordingId,
        query,
        orgId
      );

      // Should only return results from target recording
      expect(results).toHaveLength(1);
      expect(results[0].recordingId).toBe('target-recording');

      // Verify parameters
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'hierarchical_search',
        expect.objectContaining({
          top_documents: 1, // Single document
          chunks_per_document: 10, // More chunks per doc
        })
      );
    });

    it('should allow custom chunks per document', async () => {
      const recordingId = 'test-recording';
      const query = 'test query';
      const orgId = 'test-org-id';

      mockModels.embedContent
        .mockResolvedValueOnce({
          embeddings: [{ values: new Array(1536).fill(0.1) }],
        })
        .mockResolvedValueOnce({
          embeddings: [{ values: new Array(3072).fill(0.2) }],
        });

      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      // Execute with custom chunks per document
      await hierarchicalSearchRecording(recordingId, query, orgId, {
        chunksPerDocument: 5,
      });

      // Verify custom value was used
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'hierarchical_search',
        expect.objectContaining({
          chunks_per_document: 5,
        })
      );
    });
  });

  describe('getRecordingSummaries', () => {
    it('should fetch recording summaries for organization', async () => {
      const orgId = 'test-org-id';

      const mockSummaries = [
        {
          recording_id: 'rec-1',
          summary_text: 'Summary of recording 1',
        },
        {
          recording_id: 'rec-2',
          summary_text: 'Summary of recording 2',
        },
      ];

      // Mock Supabase query chain
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: mockSummaries,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      // Execute
      const results = await getRecordingSummaries(orgId);

      // Assertions
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        recordingId: 'rec-1',
        summaryText: 'Summary of recording 1',
      });

      // Verify query
      expect(mockSupabase.from).toHaveBeenCalledWith('recording_summaries');
      expect(mockQuery.eq).toHaveBeenCalledWith('org_id', orgId);
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(mockQuery.limit).toHaveBeenCalledWith(10); // default limit
    });

    it('should respect custom limit', async () => {
      const orgId = 'test-org-id';

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      // Execute with custom limit
      await getRecordingSummaries(orgId, 5);

      // Verify custom limit
      expect(mockQuery.limit).toHaveBeenCalledWith(5);
    });

    it('should throw error if database query fails', async () => {
      const orgId = 'test-org-id';

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      // Execute & Assert
      await expect(getRecordingSummaries(orgId)).rejects.toThrow(
        'Failed to fetch summaries'
      );
    });

    it('should return empty array if no summaries found', async () => {
      const orgId = 'test-org-id';

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      // Execute
      const results = await getRecordingSummaries(orgId);

      // Should return empty array
      expect(results).toEqual([]);
    });
  });
});
