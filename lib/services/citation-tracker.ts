/**
 * Citation Tracker Service
 *
 * Tracks which sub-queries contributed to which chunks in the final result set.
 * This provides transparency and helps understand the reasoning path.
 */

import type { SearchResult } from '@/lib/services/vector-search-google';
import type { SubQuery } from '@/lib/types/agentic-rag';

export interface CitationEntry {
  chunkId: string;
  chunkText: string;
  recordingId: string;
  recordingTitle?: string;
  subQueryIds: string[];
  subQueryTexts: string[];
  timestamp?: number;
}

/**
 * Citation Tracker Class
 *
 * Maintains mapping between chunks and the sub-queries that retrieved them.
 */
export class CitationTracker {
  private citationMap: Map<string, Set<string>>; // chunkId -> Set of subQueryIds
  private subQueryMap: Map<string, SubQuery>; // subQueryId -> SubQuery
  private chunkMap: Map<string, SearchResult>; // chunkId -> SearchResult

  constructor() {
    this.citationMap = new Map();
    this.subQueryMap = new Map();
    this.chunkMap = new Map();
  }

  /**
   * Register a sub-query
   */
  registerSubQuery(subQuery: SubQuery): void {
    this.subQueryMap.set(subQuery.id, subQuery);
  }

  /**
   * Add a chunk retrieved by a sub-query
   */
  addChunk(chunk: SearchResult, subQueryId: string): void {
    // Store chunk
    this.chunkMap.set(chunk.id, chunk);

    // Add citation
    if (!this.citationMap.has(chunk.id)) {
      this.citationMap.set(chunk.id, new Set());
    }
    this.citationMap.get(chunk.id)!.add(subQueryId);
  }

  /**
   * Add multiple chunks for a sub-query
   */
  addChunks(chunks: SearchResult[], subQueryId: string): void {
    for (const chunk of chunks) {
      this.addChunk(chunk, subQueryId);
    }
  }

  /**
   * Get sub-queries that contributed to a chunk
   */
  getSubQueriesForChunk(chunkId: string): SubQuery[] {
    const subQueryIds = this.citationMap.get(chunkId);
    if (!subQueryIds) return [];

    return Array.from(subQueryIds)
      .map((id) => this.subQueryMap.get(id))
      .filter((sq): sq is SubQuery => sq !== undefined);
  }

  /**
   * Get chunks retrieved by a sub-query
   */
  getChunksForSubQuery(subQueryId: string): SearchResult[] {
    const chunks: SearchResult[] = [];

    for (const [chunkId, subQueryIds] of this.citationMap.entries()) {
      if (subQueryIds.has(subQueryId)) {
        const chunk = this.chunkMap.get(chunkId);
        if (chunk) chunks.push(chunk);
      }
    }

    return chunks;
  }

  /**
   * Get the complete citation map
   */
  getCitationMap(): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const [chunkId, subQueryIds] of this.citationMap.entries()) {
      map.set(chunkId, Array.from(subQueryIds));
    }
    return map;
  }

  /**
   * Get all chunks with their citations
   */
  getAllCitations(): CitationEntry[] {
    const citations: CitationEntry[] = [];

    for (const [chunkId, subQueryIds] of this.citationMap.entries()) {
      const chunk = this.chunkMap.get(chunkId);
      if (!chunk) continue;

      const subQueries = Array.from(subQueryIds)
        .map((id) => this.subQueryMap.get(id))
        .filter((sq): sq is SubQuery => sq !== undefined);

      citations.push({
        chunkId,
        chunkText: chunk.chunkText,
        recordingId: chunk.recordingId,
        recordingTitle: chunk.recordingTitle,
        subQueryIds: Array.from(subQueryIds),
        subQueryTexts: subQueries.map((sq) => sq.text),
        timestamp: chunk.timestamp,
      });
    }

    return citations;
  }

  /**
   * Get statistics about citations
   */
  getStats(): {
    totalChunks: number;
    totalSubQueries: number;
    avgCitationsPerChunk: number;
    maxCitationsPerChunk: number;
  } {
    const citationCounts = Array.from(this.citationMap.values()).map(
      (set) => set.size
    );

    return {
      totalChunks: this.chunkMap.size,
      totalSubQueries: this.subQueryMap.size,
      avgCitationsPerChunk:
        citationCounts.reduce((sum, count) => sum + count, 0) /
        Math.max(citationCounts.length, 1),
      maxCitationsPerChunk: Math.max(...citationCounts, 0),
    };
  }

  /**
   * Generate a human-readable citation report
   */
  generateReport(): string {
    const lines: string[] = [];
    const stats = this.getStats();

    lines.push('=== Citation Report ===');
    lines.push(`Total Chunks: ${stats.totalChunks}`);
    lines.push(`Total Sub-Queries: ${stats.totalSubQueries}`);
    lines.push(
      `Average Citations per Chunk: ${stats.avgCitationsPerChunk.toFixed(2)}`
    );
    lines.push('');

    // Group by recording
    const byRecording = new Map<string, CitationEntry[]>();
    for (const citation of this.getAllCitations()) {
      if (!byRecording.has(citation.recordingId)) {
        byRecording.set(citation.recordingId, []);
      }
      byRecording.get(citation.recordingId)!.push(citation);
    }

    for (const [recordingId, citations] of byRecording.entries()) {
      const recordingTitle =
        citations[0]?.recordingTitle || `Recording ${recordingId.slice(0, 8)}`;
      lines.push(`Recording: ${recordingTitle}`);
      lines.push(`  Chunks: ${citations.length}`);

      for (const citation of citations.slice(0, 3)) {
        lines.push(`  - ${citation.chunkText.slice(0, 60)}...`);
        lines.push(
          `    Retrieved by: ${citation.subQueryTexts.join(', ')}`
        );
      }

      if (citations.length > 3) {
        lines.push(`  ... and ${citations.length - 3} more chunks`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }
}
