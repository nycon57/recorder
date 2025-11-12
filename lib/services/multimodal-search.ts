/**
 * Multimodal Search Service
 *
 * Combines visual and audio search capabilities for comprehensive
 * video content retrieval. Uses vector embeddings to search across
 * both transcript text and video frame descriptions.
 *
 * @module lib/services/multimodal-search
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateEmbedding } from '@/lib/utils/embeddings';
import {
  VisualSearchResult,
  MultimodalSearchOptions,
  MultimodalSearchResult,
  MultimodalSearchMode,
} from '@/lib/types/video-frames';
import { vectorSearch } from './vector-search-google';

/**
 * Check if visual search is enabled
 */
export function isVisualSearchEnabled(): boolean {
  return process.env.ENABLE_VISUAL_SEARCH === 'true';
}

/**
 * Search video frames by visual content
 *
 * @param query - Natural language search query
 * @param options - Search configuration options
 * @returns Array of matching video frames with similarity scores
 *
 * @example
 * ```typescript
 * const results = await visualSearch('show me slides with graphs', {
 *   orgId: 'org-123',
 *   limit: 20,
 *   threshold: 0.7,
 * });
 * ```
 */
export async function visualSearch(
  query: string,
  options: {
    orgId: string;
    limit?: number;
    threshold?: number;
    recordingIds?: string[];
    includeOcr?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
  }
): Promise<VisualSearchResult[]> {
  const {
    orgId,
    limit = 20,
    threshold = 0.7,
    recordingIds,
    includeOcr = true,
    dateFrom,
    dateTo,
  } = options;

  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(query);

  // Build SQL query with filters
  let sql = `
    SELECT
      vf.id,
      vf.recording_id,
      vf.frame_time_sec,
      vf.frame_url,
      vf.visual_description,
      vf.ocr_text,
      vf.metadata,
      vf.created_at,
      r.id as "recording.id",
      r.title as "recording.title",
      r.duration_sec as "recording.duration_sec",
      r.created_at as "recording.created_at",
      1 - (vf.visual_embedding <=> $1::vector) as similarity
    FROM video_frames vf
    INNER JOIN recordings r ON vf.recording_id = r.id
    WHERE vf.org_id = $2
      AND r.deleted_at IS NULL
      AND vf.visual_embedding IS NOT NULL
      AND 1 - (vf.visual_embedding <=> $1::vector) >= $3
  `;

  const params: any[] = [
    `[${queryEmbedding.join(',')}]`,
    orgId,
    threshold,
  ];
  let paramIndex = 4;

  // Filter by recording IDs
  if (recordingIds && recordingIds.length > 0) {
    sql += ` AND vf.recording_id = ANY($${paramIndex}::uuid[])`;
    params.push(recordingIds);
    paramIndex++;
  }

  // Filter by date range
  if (dateFrom) {
    sql += ` AND r.created_at >= $${paramIndex}`;
    params.push(dateFrom.toISOString());
    paramIndex++;
  }

  if (dateTo) {
    sql += ` AND r.created_at <= $${paramIndex}`;
    params.push(dateTo.toISOString());
    paramIndex++;
  }

  // Order by similarity and limit
  sql += `
    ORDER BY similarity DESC
    LIMIT $${paramIndex}
  `;
  params.push(limit);

  // Execute query
  const { data, error } = await supabaseAdmin.rpc('exec_sql' as any, {
    sql,
    params,
  });

  if (error) {
    console.error('[visualSearch] Error:', error);
    throw new Error(`Visual search failed: ${error.message}`);
  }

  // Transform results
  const results: VisualSearchResult[] = (data || []).map((row: any) => ({
    id: row.id,
    recordingId: row.recording_id,
    frameTimeSec: row.frame_time_sec,
    frameUrl: row.frame_url || '',
    visualDescription: row.visual_description,
    ocrText: includeOcr ? row.ocr_text : null,
    similarity: row.similarity,
    metadata: row.metadata || {},
    recording: {
      id: row['recording.id'],
      title: row['recording.title'],
      duration_sec: row['recording.duration_sec'],
      created_at: row['recording.created_at'],
    },
  }));

  // Generate presigned URLs for frames
  for (const result of results) {
    if (result.frameUrl) {
      const { data: urlData } = await supabaseAdmin.storage
        .from('frames')
        .createSignedUrl(result.frameUrl, 3600); // 1 hour expiry

      if (urlData?.signedUrl) {
        result.frameUrl = urlData.signedUrl;
      }
    }
  }

  return results;
}

/**
 * Combined multimodal search across audio (transcript) and visual (frames)
 *
 * @param query - Natural language search query
 * @param options - Multimodal search configuration
 * @returns Combined search results with metadata
 *
 * @example
 * ```typescript
 * const result = await multimodalSearch('explain database indexing', {
 *   orgId: 'org-123',
 *   includeVisual: true,
 *   audioWeight: 0.7,
 *   visualWeight: 0.3,
 * });
 * ```
 */
export async function multimodalSearch(
  query: string,
  options: MultimodalSearchOptions
): Promise<MultimodalSearchResult> {
  const startTime = Date.now();

  const {
    orgId,
    limit = 10,
    threshold = 0.7,
    recordingIds,
    includeVisual = true,
    audioWeight = 0.7,
    visualWeight = 0.3,
    includeOcr = true,
    dateFrom,
    dateTo,
    contentTypes,
    tagIds,
    tagFilterMode,
    collectionId,
    favoritesOnly,
  } = options;

  // Validate weights sum to 1
  if (Math.abs(audioWeight + visualWeight - 1) > 0.001) {
    throw new Error('audioWeight and visualWeight must sum to 1.0');
  }

  // Determine search mode
  let mode: MultimodalSearchMode = 'multimodal';
  if (!includeVisual || !isVisualSearchEnabled()) {
    mode = 'audio';
  }

  // Perform audio search (transcript chunks)
  const audioResults = await searchTranscriptChunks(query, {
    orgId,
    limit: Math.ceil(limit * 1.5), // Get extra for merging
    threshold,
    recordingIds,
    dateFrom,
    dateTo,
    contentTypes,
    tagIds,
    tagFilterMode,
    collectionId,
    favoritesOnly,
  });

  let visualResults: VisualSearchResult[] = [];
  let combinedResults: any[] = [];

  // Perform visual search if enabled
  if (mode === 'multimodal') {
    visualResults = await visualSearch(query, {
      orgId,
      limit: Math.ceil(limit * 1.5),
      threshold,
      recordingIds,
      includeOcr,
      dateFrom,
      dateTo,
    });

    // Combine and rerank results
    combinedResults = combineAndRerankResults(
      audioResults,
      visualResults,
      audioWeight,
      visualWeight,
      limit
    );
  }

  const processingTime = Date.now() - startTime;

  return {
    query,
    mode,
    audioResults: mode === 'multimodal' ? audioResults : audioResults.slice(0, limit),
    visualResults: mode === 'multimodal' ? visualResults : undefined,
    combinedResults: mode === 'multimodal' ? combinedResults : undefined,
    metadata: {
      totalResults:
        mode === 'multimodal'
          ? combinedResults.length
          : audioResults.length,
      audioCount: audioResults.length,
      visualCount: visualResults.length,
      threshold,
      processingTime,
      weights:
        mode === 'multimodal'
          ? {
              audio: audioWeight,
              visual: visualWeight,
            }
          : undefined,
    },
  };
}

/**
 * Search transcript chunks by text
 * Internal helper function
 */
async function searchTranscriptChunks(
  query: string,
  options: {
    orgId: string;
    limit: number;
    threshold: number;
    recordingIds?: string[];
    dateFrom?: Date;
    dateTo?: Date;
    contentTypes?: ('recording' | 'video' | 'audio' | 'document' | 'text')[];
    tagIds?: string[];
    tagFilterMode?: 'AND' | 'OR';
    collectionId?: string;
    favoritesOnly?: boolean;
  }
) {
  const {
    orgId,
    limit,
    threshold,
    recordingIds,
    dateFrom,
    dateTo,
    contentTypes,
    tagIds,
    tagFilterMode,
    collectionId,
    favoritesOnly,
  } = options;

  // Use vectorSearch for consistent filtering logic
  const results = await vectorSearch(query, {
    orgId,
    limit,
    threshold,
    recordingIds,
    dateFrom,
    dateTo,
    contentTypes,
    tagIds,
    tagFilterMode,
    collectionId,
    favoritesOnly,
  });

  // Map to multimodal format
  return results.map((result) => ({
    id: result.id,
    recording_id: result.recordingId,
    chunk_text: result.chunkText,
    start_time_sec: result.metadata.startTime,
    end_time_sec: result.metadata.endTime,
    metadata: result.metadata,
    similarity: result.similarity,
  }));
}

/**
 * Combine and rerank audio and visual results
 * Uses weighted scoring to merge results from both modalities
 */
function combineAndRerankResults(
  audioResults: any[],
  visualResults: VisualSearchResult[],
  audioWeight: number,
  visualWeight: number,
  limit: number
): Array<{ type: 'audio' | 'visual'; score: number; data: any }> {
  // Transform audio results
  const audioScored = audioResults.map((result) => ({
    type: 'audio' as const,
    score: result.similarity * audioWeight,
    data: result,
  }));

  // Transform visual results
  const visualScored = visualResults.map((result) => ({
    type: 'visual' as const,
    score: result.similarity * visualWeight,
    data: result,
  }));

  // Combine and sort by weighted score
  const combined = [...audioScored, ...visualScored]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return combined;
}

/**
 * Get frame count for a recording
 */
export async function getFrameCount(
  recordingId: string,
  orgId: string
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('video_frames')
    .select('*', { count: 'exact', head: true })
    .eq('recording_id', recordingId)
    .eq('org_id', orgId);

  if (error) {
    console.error('[getFrameCount] Error:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Check if frames have been extracted for a recording
 */
export async function hasExtractedFrames(
  recordingId: string,
  orgId: string
): Promise<boolean> {
  const count = await getFrameCount(recordingId, orgId);
  return count > 0;
}
