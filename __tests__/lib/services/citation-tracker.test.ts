/**
 * Tests for Citation Tracker Service
 */

import { CitationTracker } from '@/lib/services/citation-tracker';
import type { SubQuery } from '@/lib/types/agentic-rag';
import type { SearchResult } from '@/lib/services/vector-search-google';

describe('Citation Tracker', () => {
  let tracker: CitationTracker;

  const createMockSubQuery = (id: string, text: string): SubQuery => ({
    id,
    text,
    intent: 'single_fact',
    dependency: null,
    priority: 5,
  });

  const createMockSearchResult = (id: string, text: string): SearchResult => ({
    id,
    recordingId: `rec-${id}`,
    recordingTitle: `Recording ${id}`,
    chunkText: text,
    similarity: 0.85,
    metadata: {
      source: 'transcript',
      chunkIndex: 0,
    },
    createdAt: new Date().toISOString(),
    timestamp: 123,
  });

  beforeEach(() => {
    tracker = new CitationTracker();
  });

  describe('registerSubQuery', () => {
    it('should register a sub-query', () => {
      const subQuery = createMockSubQuery('q1', 'What is TypeScript?');
      tracker.registerSubQuery(subQuery);

      const subQueries = tracker.getSubQueriesForChunk('some-chunk');
      expect(subQueries).toBeDefined();
    });

    it('should register multiple sub-queries', () => {
      const subQuery1 = createMockSubQuery('q1', 'Query 1');
      const subQuery2 = createMockSubQuery('q2', 'Query 2');

      tracker.registerSubQuery(subQuery1);
      tracker.registerSubQuery(subQuery2);

      const stats = tracker.getStats();
      expect(stats.totalSubQueries).toBe(2);
    });
  });

  describe('addChunk', () => {
    it('should add a chunk for a sub-query', () => {
      const subQuery = createMockSubQuery('q1', 'Test query');
      const chunk = createMockSearchResult('chunk-1', 'Test content');

      tracker.registerSubQuery(subQuery);
      tracker.addChunk(chunk, 'q1');

      const subQueries = tracker.getSubQueriesForChunk('chunk-1');
      expect(subQueries).toHaveLength(1);
      expect(subQueries[0].id).toBe('q1');
    });

    it('should add the same chunk for multiple sub-queries', () => {
      const subQuery1 = createMockSubQuery('q1', 'Query 1');
      const subQuery2 = createMockSubQuery('q2', 'Query 2');
      const chunk = createMockSearchResult('chunk-1', 'Shared content');

      tracker.registerSubQuery(subQuery1);
      tracker.registerSubQuery(subQuery2);
      tracker.addChunk(chunk, 'q1');
      tracker.addChunk(chunk, 'q2');

      const subQueries = tracker.getSubQueriesForChunk('chunk-1');
      expect(subQueries).toHaveLength(2);
      expect(subQueries.map((sq) => sq.id)).toContain('q1');
      expect(subQueries.map((sq) => sq.id)).toContain('q2');
    });

    it('should not duplicate sub-query references for same chunk', () => {
      const subQuery = createMockSubQuery('q1', 'Query 1');
      const chunk = createMockSearchResult('chunk-1', 'Content');

      tracker.registerSubQuery(subQuery);
      tracker.addChunk(chunk, 'q1');
      tracker.addChunk(chunk, 'q1'); // Add again

      const subQueries = tracker.getSubQueriesForChunk('chunk-1');
      expect(subQueries).toHaveLength(1); // Should not duplicate
    });
  });

  describe('addChunks', () => {
    it('should add multiple chunks for a sub-query', () => {
      const subQuery = createMockSubQuery('q1', 'Query 1');
      const chunks = [
        createMockSearchResult('chunk-1', 'Content 1'),
        createMockSearchResult('chunk-2', 'Content 2'),
        createMockSearchResult('chunk-3', 'Content 3'),
      ];

      tracker.registerSubQuery(subQuery);
      tracker.addChunks(chunks, 'q1');

      const retrievedChunks = tracker.getChunksForSubQuery('q1');
      expect(retrievedChunks).toHaveLength(3);
    });

    it('should handle empty chunks array', () => {
      const subQuery = createMockSubQuery('q1', 'Query 1');

      tracker.registerSubQuery(subQuery);
      tracker.addChunks([], 'q1');

      const chunks = tracker.getChunksForSubQuery('q1');
      expect(chunks).toHaveLength(0);
    });
  });

  describe('getSubQueriesForChunk', () => {
    it('should return empty array for unknown chunk', () => {
      const subQueries = tracker.getSubQueriesForChunk('unknown-chunk');
      expect(subQueries).toHaveLength(0);
    });

    it('should return all sub-queries that retrieved a chunk', () => {
      const subQuery1 = createMockSubQuery('q1', 'Query 1');
      const subQuery2 = createMockSubQuery('q2', 'Query 2');
      const subQuery3 = createMockSubQuery('q3', 'Query 3');
      const chunk = createMockSearchResult('chunk-1', 'Content');

      tracker.registerSubQuery(subQuery1);
      tracker.registerSubQuery(subQuery2);
      tracker.registerSubQuery(subQuery3);

      tracker.addChunk(chunk, 'q1');
      tracker.addChunk(chunk, 'q3');

      const subQueries = tracker.getSubQueriesForChunk('chunk-1');
      expect(subQueries).toHaveLength(2);
      expect(subQueries.map((sq) => sq.id).sort()).toEqual(['q1', 'q3']);
    });

    it('should filter out unregistered sub-queries', () => {
      const chunk = createMockSearchResult('chunk-1', 'Content');

      // Add chunk without registering sub-query
      tracker.addChunk(chunk, 'unregistered-query');

      const subQueries = tracker.getSubQueriesForChunk('chunk-1');
      expect(subQueries).toHaveLength(0);
    });
  });

  describe('getChunksForSubQuery', () => {
    it('should return empty array for unknown sub-query', () => {
      const chunks = tracker.getChunksForSubQuery('unknown-query');
      expect(chunks).toHaveLength(0);
    });

    it('should return all chunks retrieved by a sub-query', () => {
      const subQuery = createMockSubQuery('q1', 'Query 1');
      const chunks = [
        createMockSearchResult('chunk-1', 'Content 1'),
        createMockSearchResult('chunk-2', 'Content 2'),
      ];

      tracker.registerSubQuery(subQuery);
      tracker.addChunks(chunks, 'q1');

      const retrievedChunks = tracker.getChunksForSubQuery('q1');
      expect(retrievedChunks).toHaveLength(2);
      expect(retrievedChunks.map((c) => c.id).sort()).toEqual(['chunk-1', 'chunk-2']);
    });

    it('should return chunks for specific sub-query only', () => {
      const subQuery1 = createMockSubQuery('q1', 'Query 1');
      const subQuery2 = createMockSubQuery('q2', 'Query 2');
      const chunk1 = createMockSearchResult('chunk-1', 'Content 1');
      const chunk2 = createMockSearchResult('chunk-2', 'Content 2');

      tracker.registerSubQuery(subQuery1);
      tracker.registerSubQuery(subQuery2);
      tracker.addChunk(chunk1, 'q1');
      tracker.addChunk(chunk2, 'q2');

      const chunks = tracker.getChunksForSubQuery('q1');
      expect(chunks).toHaveLength(1);
      expect(chunks[0].id).toBe('chunk-1');
    });
  });

  describe('getCitationMap', () => {
    it('should return empty map when no chunks added', () => {
      const map = tracker.getCitationMap();
      expect(map.size).toBe(0);
    });

    it('should return citation map with chunk to sub-query mappings', () => {
      const subQuery1 = createMockSubQuery('q1', 'Query 1');
      const subQuery2 = createMockSubQuery('q2', 'Query 2');
      const chunk = createMockSearchResult('chunk-1', 'Content');

      tracker.registerSubQuery(subQuery1);
      tracker.registerSubQuery(subQuery2);
      tracker.addChunk(chunk, 'q1');
      tracker.addChunk(chunk, 'q2');

      const map = tracker.getCitationMap();
      expect(map.size).toBe(1);
      expect(map.get('chunk-1')).toEqual(['q1', 'q2']);
    });

    it('should return arrays instead of sets', () => {
      const subQuery = createMockSubQuery('q1', 'Query 1');
      const chunk = createMockSearchResult('chunk-1', 'Content');

      tracker.registerSubQuery(subQuery);
      tracker.addChunk(chunk, 'q1');

      const map = tracker.getCitationMap();
      const citations = map.get('chunk-1');
      expect(Array.isArray(citations)).toBe(true);
    });
  });

  describe('getAllCitations', () => {
    it('should return empty array when no chunks added', () => {
      const citations = tracker.getAllCitations();
      expect(citations).toHaveLength(0);
    });

    it('should return all citations with complete information', () => {
      const subQuery = createMockSubQuery('q1', 'What is TypeScript?');
      const chunk = createMockSearchResult('chunk-1', 'TypeScript is a typed superset of JavaScript');

      tracker.registerSubQuery(subQuery);
      tracker.addChunk(chunk, 'q1');

      const citations = tracker.getAllCitations();
      expect(citations).toHaveLength(1);
      expect(citations[0]).toEqual({
        chunkId: 'chunk-1',
        chunkText: 'TypeScript is a typed superset of JavaScript',
        recordingId: 'rec-chunk-1',
        recordingTitle: 'Recording chunk-1',
        subQueryIds: ['q1'],
        subQueryTexts: ['What is TypeScript?'],
        timestamp: 123,
      });
    });

    it('should handle chunks with multiple sub-queries', () => {
      const subQuery1 = createMockSubQuery('q1', 'Query 1');
      const subQuery2 = createMockSubQuery('q2', 'Query 2');
      const chunk = createMockSearchResult('chunk-1', 'Shared content');

      tracker.registerSubQuery(subQuery1);
      tracker.registerSubQuery(subQuery2);
      tracker.addChunk(chunk, 'q1');
      tracker.addChunk(chunk, 'q2');

      const citations = tracker.getAllCitations();
      expect(citations).toHaveLength(1);
      expect(citations[0].subQueryIds).toEqual(['q1', 'q2']);
      expect(citations[0].subQueryTexts).toEqual(['Query 1', 'Query 2']);
    });

    it('should include chunks with unregistered sub-queries but no query texts', () => {
      const chunk = createMockSearchResult('chunk-1', 'Content');
      tracker.addChunk(chunk, 'unregistered');

      const citations = tracker.getAllCitations();
      // Citation is created, but subQueryTexts will be empty since query wasn't registered
      expect(citations).toHaveLength(1);
      expect(citations[0].subQueryTexts).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return zero stats for empty tracker', () => {
      const stats = tracker.getStats();
      expect(stats).toEqual({
        totalChunks: 0,
        totalSubQueries: 0,
        avgCitationsPerChunk: 0,
        maxCitationsPerChunk: 0,
      });
    });

    it('should calculate stats correctly', () => {
      const subQuery1 = createMockSubQuery('q1', 'Query 1');
      const subQuery2 = createMockSubQuery('q2', 'Query 2');
      const subQuery3 = createMockSubQuery('q3', 'Query 3');
      const chunk1 = createMockSearchResult('chunk-1', 'Content 1');
      const chunk2 = createMockSearchResult('chunk-2', 'Content 2');

      tracker.registerSubQuery(subQuery1);
      tracker.registerSubQuery(subQuery2);
      tracker.registerSubQuery(subQuery3);

      // chunk-1 cited by q1 and q2 (2 citations)
      tracker.addChunk(chunk1, 'q1');
      tracker.addChunk(chunk1, 'q2');

      // chunk-2 cited by q1 only (1 citation)
      tracker.addChunk(chunk2, 'q1');

      const stats = tracker.getStats();
      expect(stats.totalChunks).toBe(2);
      expect(stats.totalSubQueries).toBe(3);
      expect(stats.avgCitationsPerChunk).toBeCloseTo(1.5, 2); // (2 + 1) / 2
      expect(stats.maxCitationsPerChunk).toBe(2);
    });

    it('should handle single chunk', () => {
      const subQuery = createMockSubQuery('q1', 'Query 1');
      const chunk = createMockSearchResult('chunk-1', 'Content');

      tracker.registerSubQuery(subQuery);
      tracker.addChunk(chunk, 'q1');

      const stats = tracker.getStats();
      expect(stats.totalChunks).toBe(1);
      expect(stats.avgCitationsPerChunk).toBe(1);
      expect(stats.maxCitationsPerChunk).toBe(1);
    });
  });

  describe('generateReport', () => {
    it('should generate empty report for no citations', () => {
      const report = tracker.generateReport();
      expect(report).toContain('Total Chunks: 0');
      expect(report).toContain('Total Sub-Queries: 0');
    });

    it('should generate report with citations', () => {
      const subQuery = createMockSubQuery('q1', 'What is React?');
      const chunk = createMockSearchResult('chunk-1', 'React is a JavaScript library');

      tracker.registerSubQuery(subQuery);
      tracker.addChunk(chunk, 'q1');

      const report = tracker.generateReport();
      expect(report).toContain('Total Chunks: 1');
      expect(report).toContain('Total Sub-Queries: 1');
      expect(report).toContain('Recording chunk-1');
      expect(report).toContain('React is a JavaScript library');
      expect(report).toContain('What is React?');
    });

    it('should group citations by recording', () => {
      const subQuery = createMockSubQuery('q1', 'Query 1');
      const chunk1 = createMockSearchResult('chunk-1', 'Content 1');
      const chunk2 = {
        ...createMockSearchResult('chunk-2', 'Content 2'),
        recordingId: 'rec-chunk-1', // Same recording as chunk-1
      };

      tracker.registerSubQuery(subQuery);
      tracker.addChunk(chunk1, 'q1');
      tracker.addChunk(chunk2, 'q1');

      const report = tracker.generateReport();
      expect(report).toContain('Chunks: 2');
    });

    it('should truncate long chunk text in report', () => {
      const subQuery = createMockSubQuery('q1', 'Query');
      const longText = 'A'.repeat(100);
      const chunk = createMockSearchResult('chunk-1', longText);

      tracker.registerSubQuery(subQuery);
      tracker.addChunk(chunk, 'q1');

      const report = tracker.generateReport();
      // Should truncate to 60 chars
      expect(report).toContain('...');
    });

    it('should limit displayed chunks per recording', () => {
      const subQuery = createMockSubQuery('q1', 'Query');
      // All chunks need to have the same recordingId to be grouped
      const chunks = Array.from({ length: 5 }, (_, i) => ({
        ...createMockSearchResult(`chunk-${i}`, `Content ${i}`),
        recordingId: 'rec-same', // Same recording ID
      }));

      tracker.registerSubQuery(subQuery);
      tracker.addChunks(chunks, 'q1');

      const report = tracker.generateReport();
      // Should show first 3 and indicate more
      expect(report).toContain('and 2 more chunks');
    });

    it('should handle recordings with no title', () => {
      const subQuery = createMockSubQuery('q1', 'Query');
      const chunk = {
        ...createMockSearchResult('chunk-1', 'Content'),
        recordingTitle: undefined,
        recordingId: 'rec-chunk-1',
      };

      tracker.registerSubQuery(subQuery);
      tracker.addChunk(chunk as any, 'q1');

      const report = tracker.generateReport();
      // Fallback to "Recording {first 8 chars of ID}"
      expect(report).toContain('Recording rec-chun');
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle many-to-many relationships', () => {
      // Multiple sub-queries, multiple chunks, complex citations
      const subQueries = [
        createMockSubQuery('q1', 'What is React?'),
        createMockSubQuery('q2', 'What is Vue?'),
        createMockSubQuery('q3', 'Compare React and Vue'),
      ];

      const chunks = [
        createMockSearchResult('chunk-1', 'React content'),
        createMockSearchResult('chunk-2', 'Vue content'),
        createMockSearchResult('chunk-3', 'Comparison content'),
      ];

      subQueries.forEach((sq) => tracker.registerSubQuery(sq));

      // chunk-1: q1 and q3
      tracker.addChunk(chunks[0], 'q1');
      tracker.addChunk(chunks[0], 'q3');

      // chunk-2: q2 and q3
      tracker.addChunk(chunks[1], 'q2');
      tracker.addChunk(chunks[1], 'q3');

      // chunk-3: q3 only
      tracker.addChunk(chunks[2], 'q3');

      const stats = tracker.getStats();
      expect(stats.totalChunks).toBe(3);
      expect(stats.totalSubQueries).toBe(3);

      const q3Chunks = tracker.getChunksForSubQuery('q3');
      expect(q3Chunks).toHaveLength(3); // All chunks

      const chunk1SubQueries = tracker.getSubQueriesForChunk('chunk-1');
      expect(chunk1SubQueries).toHaveLength(2); // q1 and q3
    });

    it('should maintain consistency across operations', () => {
      const subQuery = createMockSubQuery('q1', 'Query');
      const chunks = Array.from({ length: 10 }, (_, i) =>
        createMockSearchResult(`chunk-${i}`, `Content ${i}`)
      );

      tracker.registerSubQuery(subQuery);

      // Add chunks incrementally
      chunks.forEach((chunk) => tracker.addChunk(chunk, 'q1'));

      const stats = tracker.getStats();
      const map = tracker.getCitationMap();
      const citations = tracker.getAllCitations();

      expect(stats.totalChunks).toBe(10);
      expect(map.size).toBe(10);
      expect(citations).toHaveLength(10);
    });
  });
});
